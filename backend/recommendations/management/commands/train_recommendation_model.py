"""
Management command to train neural network recommendation models.

Workflow:
1. Load historical data (jobs, bids, reviews)
2. Feature engineering and preprocessing
3. Train/validation split
4. Train HybridRecommendationModel
5. Evaluate and save best model
6. Generate performance reports

Usage:
    python manage.py train_recommendation_model --epochs 50 --batch-size 256
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
import torch
import numpy as np
from datetime import timedelta
from typing import Dict, List, Tuple

from cleaning_jobs.models import CleaningJob, JobBid
from reviews.models import Review, ReviewRating
from properties.models import Property
from recommendations.models import CleanerScore
from recommendations.services.ml_models import (
    HybridRecommendationModel,
    ModelManager,
    train_hybrid_model
)
from recommendations.services.scoring_service import ScoringService

User = get_user_model()


class Command(BaseCommand):
    help = 'Train neural network recommendation models'

    def add_arguments(self, parser):
        parser.add_argument('--epochs', type=int, default=50, help='Number of training epochs')
        parser.add_argument('--batch-size', type=int, default=256, help='Training batch size')
        parser.add_argument('--learning-rate', type=float, default=0.001, help='Learning rate')
        parser.add_argument('--val-split', type=float, default=0.2, help='Validation split ratio')
        parser.add_argument('--model-version', type=str, default='1.0', help='Model version tag')

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting model training pipeline...'))
        
        # Step 1: Load and prepare data
        self.stdout.write('Loading historical data...')
        train_data, val_data = self._prepare_training_data(
            val_split=options['val_split']
        )
        
        self.stdout.write(f'Training samples: {len(train_data["labels"])}')
        self.stdout.write(f'Validation samples: {len(val_data["labels"])}')
        
        # Step 2: Train model
        self.stdout.write('Training hybrid recommendation model...')
        model = train_hybrid_model(
            train_data=train_data,
            val_data=val_data,
            num_epochs=options['epochs'],
            batch_size=options['batch_size'],
            learning_rate=options['learning_rate']
        )
        
        # Step 3: Save model
        self.stdout.write('Saving trained model...')
        model_manager = ModelManager()
        
        metadata = {
            'version': options['model_version'],
            'train_samples': len(train_data['labels']),
            'val_samples': len(val_data['labels']),
            'epochs': options['epochs'],
            'batch_size': options['batch_size'],
            'learning_rate': options['learning_rate'],
            'num_clients': len(set(train_data['client_ids'])),
            'num_cleaners': len(set(train_data['cleaner_ids'])),
        }
        
        checkpoint_path = model_manager.save_model(
            model=model,
            model_name='hybrid_recommendation',
            version=options['model_version'],
            metadata=metadata
        )
        
        self.stdout.write(self.style.SUCCESS(f'Model saved to: {checkpoint_path}'))
        
        # Step 4: Evaluate
        self._evaluate_model(model, val_data)

    def _prepare_training_data(self, val_split: float = 0.2) -> Tuple[Dict, Dict]:
        """
        Prepare training and validation datasets from historical data.
        
        Training target: Predict if a cleaner will be hired for a job (binary classification)
        or predict the review rating (regression).
        
        Features:
        - Client embedding ID
        - Cleaner embedding ID
        - Property type (categorical)
        - Continuous: property_size, distance, cleaner_quality, cleaner_reliability,
          cleaner_experience, bid_amount, etc.
        
        Returns:
            (train_data, val_data) dictionaries
        """
        # Get all completed jobs with accepted bids
        completed_jobs = CleaningJob.objects.filter(
            status='completed',
            accepted_bid__isnull=False
        ).select_related('client', 'cleaner', 'property', 'accepted_bid')
        
        self.stdout.write(f'Found {completed_jobs.count()} completed jobs')
        
        # Initialize feature lists
        client_ids = []
        cleaner_ids = []
        property_types = []
        continuous_features = []
        labels = []
        
        # Build ID mappings
        model_manager = ModelManager()
        all_clients = list(User.objects.filter(role='client').values_list('id', flat=True))
        all_cleaners = list(User.objects.filter(role='cleaner').values_list('id', flat=True))
        model_manager.build_feature_maps(all_clients, all_cleaners)
        
        self.stdout.write(f'Total clients in DB: {len(all_clients)}')
        self.stdout.write(f'Total cleaners in DB: {len(all_cleaners)}')
        self.stdout.write(f'Client ID map size: {len(model_manager.client_id_map)}')
        self.stdout.write(f'Cleaner ID map size: {len(model_manager.cleaner_id_map)}')

        
        # Calculate cleaner scores (needed for features)
        scoring_service = ScoringService()
        cleaner_scores = {}
        for cleaner_id in all_cleaners:
            cleaner = User.objects.get(id=cleaner_id)
            score_obj = scoring_service.calculate_cleaner_score(cleaner)
            # Convert CleanerScore model to dict for easy access
            cleaner_scores[cleaner_id] = {
                'quality_score': score_obj.quality_score or 50.0,
                'communication_score': score_obj.communication_score or 50.0,
                'professionalism_score': score_obj.professionalism_score or 50.0,
                'timeliness_score': score_obj.timeliness_score or 50.0,
                'overall_score': score_obj.overall_score or 50.0,
                'completion_rate': score_obj.completion_rate or 0.5,
                'on_time_rate': score_obj.on_time_rate or 0.5,
                'total_jobs': score_obj.total_jobs or 0,
                'avg_rating': score_obj.avg_rating or 5.0,
            }
        
        # Process each job
        for job in completed_jobs:
            try:
                # Get review rating (our target variable)
                review = Review.objects.filter(job=job, reviewee=job.cleaner).first()
                if not review:
                    continue
                
                # Target: normalized rating (0-1 scale)
                target = review.overall_rating / 10.0
                
                # Client and cleaner IDs (will be mapped to embedding indices)
                client_id = model_manager.get_client_index(job.client.id)
                cleaner_id = model_manager.get_cleaner_index(job.cleaner.id)
                
                # Property type
                prop_type = model_manager.get_property_type_index(job.property.property_type)
                
                # Continuous features (normalized to similar scales)
                features = self._extract_features(job, cleaner_scores)
                
                client_ids.append(client_id)
                cleaner_ids.append(cleaner_id)
                property_types.append(prop_type)
                continuous_features.append(features)
                labels.append(target)
                
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Error processing job {job.id}: {e}'))
                continue
        
        # Convert to numpy arrays
        client_ids = np.array(client_ids)
        cleaner_ids = np.array(cleaner_ids)
        property_types = np.array(property_types)
        continuous_features = np.array(continuous_features)
        labels = np.array(labels)
        
        # Debug: Check index ranges
        self.stdout.write(f'Client indices - min: {client_ids.min()}, max: {client_ids.max()}')
        self.stdout.write(f'Cleaner indices - min: {cleaner_ids.min()}, max: {cleaner_ids.max()}')
        self.stdout.write(f'Expected max client index: {len(model_manager.client_id_map) - 1}')
        self.stdout.write(f'Expected max cleaner index: {len(model_manager.cleaner_id_map) - 1}')
        
        # Shuffle data
        indices = np.arange(len(labels))
        np.random.shuffle(indices)
        
        client_ids = client_ids[indices]
        cleaner_ids = cleaner_ids[indices]
        property_types = property_types[indices]
        continuous_features = continuous_features[indices]
        labels = labels[indices]
        
        # Train/val split
        split_idx = int(len(labels) * (1 - val_split))
        
        train_data = {
            'client_ids': client_ids[:split_idx].tolist(),
            'cleaner_ids': cleaner_ids[:split_idx].tolist(),
            'property_types': property_types[:split_idx].tolist(),
            'features': continuous_features[:split_idx].tolist(),
            'labels': labels[:split_idx].tolist(),
            'num_clients': len(model_manager.client_id_map),  # Use full map size
            'num_cleaners': len(model_manager.cleaner_id_map),  # Use full map size
        }
        
        val_data = {
            'client_ids': client_ids[split_idx:].tolist(),
            'cleaner_ids': cleaner_ids[split_idx:].tolist(),
            'property_types': property_types[split_idx:].tolist(),
            'features': continuous_features[split_idx:].tolist(),
            'labels': labels[split_idx:].tolist(),
        }
        
        return train_data, val_data

    def _extract_features(self, job: CleaningJob, cleaner_scores: Dict) -> List[float]:
        """
        Extract continuous features for a job-cleaner pair.
        
        Returns 18 normalized features:
        1-2: Property location (lat, lng normalized)
        3: Property size (normalized by 1000)
        4: Estimated duration (hours)
        5: Eco-friendly preference (0/1)
        6: Bid amount (normalized by 1000)
        7: Distance cleaner-to-job (km, normalized by 50)
        8-12: Cleaner quality metrics (0-100 scale)
        13: Cleaner completion rate (0-1)
        14: Cleaner on-time rate (0-1)
        15: Cleaner total jobs (log-normalized)
        16: Cleaner avg rating (0-1)
        17: Job posted hour (0-23, normalized by 24)
        18: Day of week (0-6, normalized by 7)
        """
        cleaner_data = cleaner_scores.get(job.cleaner.id, {})
        
        features = [
            # Location (normalize Athens coords ~38°N, 23°E)
            (float(job.property.latitude) - 37.9838) * 10,  # Scale to ~[-2, 2]
            (float(job.property.longitude) - 23.7275) * 10,
            
            # Property characteristics
            float(job.property.size_sqft) / 1000.0,  # Normalize by 1000
            float(job.accepted_bid.estimated_duration.total_seconds()) / 3600.0,  # Convert to hours
            1.0 if len(job.checklist) > 3 else 0.0,  # Complex job indicator
            
            # Bid amount
            float(job.accepted_bid.bid_amount) / 1000.0,  # Normalize by 1000
            
            # Distance (calculate or use 0 if no service area)
            float(self._calculate_distance(job.property, job.cleaner)) / 50.0,  # Normalize by 50km
            
            # Cleaner quality (already 0-100, divide by 100 for 0-1)
            float(cleaner_data.get('quality_score', 50.0)) / 100.0,
            float(cleaner_data.get('communication_score', 50.0)) / 100.0,
            float(cleaner_data.get('professionalism_score', 50.0)) / 100.0,
            float(cleaner_data.get('timeliness_score', 50.0)) / 100.0,
            float(cleaner_data.get('overall_score', 50.0)) / 100.0,
            
            # Cleaner reliability
            float(cleaner_data.get('completion_rate', 0.5)),
            float(cleaner_data.get('on_time_rate', 0.5)),
            
            # Cleaner experience (log transform)
            np.log1p(float(cleaner_data.get('total_jobs', 0))) / 10.0,  # Normalize
            float(cleaner_data.get('avg_rating', 5.0)) / 10.0,  # 0-1 scale
            
            # Temporal features
            float(job.created_at.hour) / 24.0,
            float(job.created_at.weekday()) / 7.0,
        ]
        
        return features

    def _calculate_distance(self, property_obj: Property, cleaner: User) -> float:
        """Calculate distance between property and cleaner's service area center"""
        try:
            service_area = cleaner.service_area
            if not service_area:
                return 10.0  # Default distance
            
            # Simple Haversine distance
            from math import radians, cos, sin, asin, sqrt
            
            lon1, lat1 = property_obj.longitude, property_obj.latitude
            lon2, lat2 = service_area.longitude, service_area.latitude
            
            lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            c = 2 * asin(sqrt(a))
            km = 6371 * c
            
            return km
        except:
            return 10.0

    def _evaluate_model(self, model: HybridRecommendationModel, val_data: Dict):
        """Evaluate model on validation set"""
        self.stdout.write('Evaluating model...')
        
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model.to(device)
        model.eval()
        
        with torch.no_grad():
            client_ids = torch.tensor(val_data['client_ids']).to(device)
            cleaner_ids = torch.tensor(val_data['cleaner_ids']).to(device)
            property_types = torch.tensor(val_data['property_types']).to(device)
            features = torch.tensor(val_data['features'], dtype=torch.float32).to(device)
            labels = torch.tensor(val_data['labels'], dtype=torch.float32).to(device)
            
            predictions, breakdown = model(client_ids, cleaner_ids, property_types, features)
            
            # Calculate metrics
            mse = torch.mean((predictions - labels) ** 2).item()
            mae = torch.mean(torch.abs(predictions - labels)).item()
            
            # R-squared
            ss_res = torch.sum((labels - predictions) ** 2).item()
            ss_tot = torch.sum((labels - labels.mean()) ** 2).item()
            r2 = 1 - (ss_res / ss_tot)
            
            self.stdout.write(self.style.SUCCESS('\nValidation Metrics:'))
            self.stdout.write(f'  MSE: {mse:.4f}')
            self.stdout.write(f'  MAE: {mae:.4f}')
            self.stdout.write(f'  R²: {r2:.4f}')
            self.stdout.write(f'  Ensemble Alpha: {model.get_alpha_value():.4f}')
            
            # Show sample predictions
            self.stdout.write('\nSample Predictions (first 10):')
            for i in range(min(10, len(labels))):
                self.stdout.write(
                    f'  True: {labels[i].item():.3f}, '
                    f'Predicted: {predictions[i].item():.3f}, '
                    f'CF: {breakdown["collaborative"][i].item():.3f}, '
                    f'Content: {breakdown["content"][i].item():.3f}'
                )
