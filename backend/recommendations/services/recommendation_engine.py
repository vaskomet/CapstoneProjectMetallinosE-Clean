"""
Unified recommendation service combining rule-based and neural network approaches.

Dual-Mode System:
1. Rule-Based: Uses ScoringService (works immediately, interpretable)
2. Neural Network: Uses trained HybridRecommendationModel (learns from data)
3. Ensemble: Combines both with configurable weighting

Automatically falls back to rule-based if NN model unavailable.
"""
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.conf import settings
from django.db import models
import logging

from cleaning_jobs.models import CleaningJob, JobBid
from properties.models import Property
from recommendations.models import CleanerScore, JobRecommendation, CleanerRecommendation
from recommendations.services.scoring_service import ScoringService

# ML imports (handle gracefully if not available)
try:
    import torch
    import numpy as np
    from recommendations.services.ml_models import HybridRecommendationModel, ModelManager
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logging.warning('PyTorch not available - using rule-based recommendations only')

User = get_user_model()
logger = logging.getLogger(__name__)


class RecommendationEngine:
    """
    Unified recommendation engine with dual-mode support.
    
    Modes:
    - 'rule_based': Use only weighted scoring algorithm
    - 'neural': Use only neural network (if available)
    - 'ensemble': Combine both (default)
    
    Configuration via Django settings:
    - RECOMMENDATION_MODE: 'rule_based' | 'neural' | 'ensemble'
    - RECOMMENDATION_ENSEMBLE_WEIGHTS: {'rule_based': 0.5, 'neural': 0.5}
    - RECOMMENDATION_CACHE_TTL: Cache duration in seconds
    """
    
    def __init__(self, mode: Optional[str] = None):
        self.scoring_service = ScoringService()
        
        # Determine mode (use settings or parameter override)
        self.mode = mode or getattr(settings, 'RECOMMENDATION_MODE', 'ensemble')
        
        # Validate mode
        if self.mode == 'neural' and not ML_AVAILABLE:
            logger.warning(
                'Neural mode requested but PyTorch not available in Docker container. '
                'Falling back to rule-based mode. To enable: rebuild Docker image with ML dependencies.'
            )
            self.mode = 'rule_based'
        
        # Load ensemble weights from settings
        self.ensemble_weights = getattr(
            settings,
            'RECOMMENDATION_ENSEMBLE_WEIGHTS',
            {'rule_based': 0.6, 'neural': 0.4}
        )
        
        # Load neural model if needed
        self.nn_model = None
        self.model_manager = None
        if self.mode in ['neural', 'ensemble'] and ML_AVAILABLE:
            try:
                self._load_neural_model()
                logger.info(f'Neural network model loaded successfully in Docker container')
            except Exception as e:
                logger.error(f'Failed to load neural model in Docker: {e}')
                if self.mode == 'neural':
                    logger.warning('Falling back to rule-based mode due to model loading failure')
                    self.mode = 'rule_based'
        
        # Cache TTL from settings
        self.cache_ttl = getattr(settings, 'RECOMMENDATION_CACHE_TTL', 3600)

    def _load_neural_model(self):
        """Load trained neural network model"""
        self.model_manager = ModelManager()
        
        # Initialize model structure
        self.nn_model = HybridRecommendationModel(
            num_clients=User.objects.filter(role='client').count(),
            num_cleaners=User.objects.filter(role='cleaner').count()
        )
        
        # Load weights
        self.nn_model = self.model_manager.load_model(
            model=self.nn_model,
            model_name='hybrid_recommendation',
            version='latest'
        )
        
        logger.info('Neural network model loaded successfully')

    def recommend_cleaners_for_job(
        self,
        job: CleaningJob,
        limit: int = 10,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Get recommended cleaners for a job.
        
        Args:
            job: CleaningJob instance
            limit: Maximum number of recommendations
            filters: Optional filters (e.g., max_distance, min_rating)
        
        Returns:
            List of dicts with:
            - cleaner: User instance
            - score: Overall recommendation score (0-100)
            - rule_based_score: Score from rule-based algorithm
            - neural_score: Score from neural network (if available)
            - breakdown: Dict with detailed scoring
            - reasoning: List of reasons for recommendation
        """
        cache_key = f'job_recommendations_{job.id}_{self.mode}_{limit}'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        # Get candidate cleaners
        candidates = self._get_candidate_cleaners(job, filters)
        
        # Score each candidate
        scored_candidates = []
        for cleaner in candidates:
            scores = self._score_cleaner_for_job(job, cleaner)
            if scores:
                scored_candidates.append(scores)
        
        # Sort by overall score
        scored_candidates.sort(key=lambda x: x['score'], reverse=True)
        
        # Limit results
        recommendations = scored_candidates[:limit]
        
        # Track recommendations (for analytics and ML training)
        self._track_job_recommendations(job, recommendations)
        
        # Cache results
        cache.set(cache_key, recommendations, self.cache_ttl)
        
        return recommendations

    def recommend_jobs_for_cleaner(
        self,
        cleaner: User,
        limit: int = 10,
        filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Get recommended jobs for a cleaner.
        
        Args:
            cleaner: User instance (must be cleaner role)
            limit: Maximum number of recommendations
            filters: Optional filters (e.g., max_distance, property_types)
        
        Returns:
            List of dicts with job recommendations
        """
        cache_key = f'cleaner_recommendations_{cleaner.id}_{self.mode}_{limit}'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        # Get open jobs
        jobs = CleaningJob.objects.filter(
            status='open_for_bids'
        ).select_related('client', 'property')
        
        # Apply filters
        if filters:
            if 'max_distance' in filters and hasattr(cleaner, 'service_area'):
                # Filter by distance (would need spatial query)
                pass
            if 'property_types' in filters:
                jobs = jobs.filter(property__property_type__in=filters['property_types'])
        
        # Score each job
        scored_jobs = []
        for job in jobs:
            scores = self._score_job_for_cleaner(job, cleaner)
            if scores:
                scored_jobs.append(scores)
        
        # Sort by score
        scored_jobs.sort(key=lambda x: x['score'], reverse=True)
        
        # Limit results
        recommendations = scored_jobs[:limit]
        
        # Cache
        cache.set(cache_key, recommendations, self.cache_ttl)
        
        return recommendations

    def _score_cleaner_for_job(self, job: CleaningJob, cleaner: User) -> Optional[Dict]:
        """
        Score a cleaner for a specific job using selected mode.
        
        Returns dict with scores and reasoning, or None if not suitable.
        """
        # Get rule-based score
        rule_score, rule_breakdown = self._get_rule_based_cleaner_score(job, cleaner)
        
        # Get neural score if available
        neural_score = None
        if self.mode in ['neural', 'ensemble'] and self.nn_model:
            neural_score = self._get_neural_cleaner_score(job, cleaner)
        
        # Combine scores based on mode
        if self.mode == 'rule_based':
            final_score = rule_score
        elif self.mode == 'neural' and neural_score is not None:
            final_score = neural_score
        elif self.mode == 'ensemble' and neural_score is not None:
            # Weighted ensemble
            final_score = (
                self.ensemble_weights['rule_based'] * rule_score +
                self.ensemble_weights['neural'] * neural_score
            )
        else:
            final_score = rule_score
        
        # Generate reasoning
        reasoning = self._generate_cleaner_reasoning(rule_breakdown, cleaner)
        
        return {
            'cleaner': cleaner,
            'score': round(final_score, 2),
            'rule_based_score': round(rule_score, 2),
            'neural_score': round(neural_score, 2) if neural_score else None,
            'breakdown': rule_breakdown,
            'reasoning': reasoning,
        }

    def _get_rule_based_cleaner_score(
        self,
        job: CleaningJob,
        cleaner: User
    ) -> Tuple[float, Dict]:
        """
        Calculate rule-based recommendation score for cleaner-job pair.
        
        Factors:
        - Base cleaner quality (30%)
        - Location match (25%)
        - Specialization match (20%)
        - Pricing competitiveness (15%)
        - Availability (10%)
        """
        # Get cleaner's overall score
        cleaner_score = CleanerScore.objects.filter(cleaner=cleaner).first()
        if not cleaner_score:
            # Calculate on-the-fly
            score_data = self.scoring_service.calculate_cleaner_score(cleaner.id)
            quality_score = score_data.get('overall_score', 50.0)
        else:
            quality_score = float(cleaner_score.overall_score)
        
        # Quality component (30%)
        quality_component = quality_score * 0.30
        
        # Location component (25%)
        location_score = self._calculate_location_match(job, cleaner)
        location_component = location_score * 0.25
        
        # Specialization component (20%)
        specialization_score = self._calculate_specialization_match(job, cleaner)
        specialization_component = specialization_score * 0.20
        
        # Pricing component (15%)
        pricing_score = self._calculate_pricing_competitiveness(job, cleaner)
        pricing_component = pricing_score * 0.15
        
        # Availability component (10%)
        availability_score = self._calculate_availability(job, cleaner)
        availability_component = availability_score * 0.10
        
        # Total score
        total_score = (
            quality_component +
            location_component +
            specialization_component +
            pricing_component +
            availability_component
        )
        
        breakdown = {
            'quality': quality_score,
            'location': location_score,
            'specialization': specialization_score,
            'pricing': pricing_score,
            'availability': availability_score,
        }
        
        return total_score, breakdown

    def _get_neural_cleaner_score(self, job: CleaningJob, cleaner: User) -> float:
        """Get neural network prediction for cleaner-job pair"""
        if not self.nn_model or not self.model_manager:
            return 50.0
        
        try:
            # Prepare input features
            client_id = self.model_manager.get_client_index(job.client.id)
            cleaner_id = self.model_manager.get_cleaner_index(cleaner.id)
            property_type = self.model_manager.get_property_type_index(job.property.property_type)
            
            # Extract continuous features (same as training)
            features = self._extract_job_cleaner_features(job, cleaner)
            
            # Convert to tensors
            device = next(self.nn_model.parameters()).device
            client_tensor = torch.tensor([client_id]).to(device)
            cleaner_tensor = torch.tensor([cleaner_id]).to(device)
            property_tensor = torch.tensor([property_type]).to(device)
            features_tensor = torch.tensor([features], dtype=torch.float32).to(device)
            
            # Get prediction
            self.nn_model.eval()
            with torch.no_grad():
                prediction, _ = self.nn_model(
                    client_tensor, cleaner_tensor, property_tensor, features_tensor
                )
            
            # Convert to 0-100 scale (model outputs 0-1)
            score = prediction.item() * 100.0
            
            return max(0.0, min(100.0, score))
            
        except Exception as e:
            logger.error(f'Neural scoring error: {e}')
            return 50.0

    def _extract_job_cleaner_features(self, job: CleaningJob, cleaner: User) -> List[float]:
        """Extract features for neural network (same as training)"""
        # Get cleaner score
        cleaner_score = CleanerScore.objects.filter(cleaner=cleaner).first()
        
        features = [
            # Location
            (job.property.latitude - 37.9838) * 10,
            (job.property.longitude - 23.7275) * 10,
            
            # Property
            job.property.square_meters / 1000.0,
            job.estimated_duration.total_seconds() / 3600.0,
            1.0 if job.eco_friendly_preference else 0.0,
            
            # Bid (use average or 0 if no bid yet)
            0.0,  # Placeholder for bid amount
            
            # Distance
            self._calculate_distance_km(job.property, cleaner) / 50.0,
            
            # Cleaner quality
            float(cleaner_score.quality_score if cleaner_score else 50.0) / 100.0,
            float(cleaner_score.communication_score if cleaner_score else 50.0) / 100.0,
            float(cleaner_score.professionalism_score if cleaner_score else 50.0) / 100.0,
            float(cleaner_score.timeliness_score if cleaner_score else 50.0) / 100.0,
            float(cleaner_score.overall_score if cleaner_score else 50.0) / 100.0,
            
            # Cleaner reliability
            float(cleaner_score.completion_rate if cleaner_score else 0.5),
            float(cleaner_score.on_time_rate if cleaner_score else 0.5),
            
            # Cleaner experience
            np.log1p(cleaner_score.total_jobs if cleaner_score else 0) / 10.0,
            float(cleaner_score.avg_rating if cleaner_score else 5.0) / 10.0,
            
            # Temporal
            job.created_at.hour / 24.0,
            job.created_at.weekday() / 7.0,
        ]
        
        return features

    # Helper methods (location, specialization, pricing, etc.)
    
    def _calculate_location_match(self, job: CleaningJob, cleaner: User) -> float:
        """Score location match (0-100)"""
        distance = self._calculate_distance_km(job.property, cleaner)
        
        # Score decays with distance
        if distance <= 5:
            return 100.0
        elif distance <= 10:
            return 80.0
        elif distance <= 20:
            return 60.0
        elif distance <= 30:
            return 40.0
        else:
            return 20.0

    def _calculate_distance_km(self, property_obj: Property, cleaner: User) -> float:
        """Calculate distance in km"""
        try:
            from math import radians, cos, sin, asin, sqrt
            
            service_area = cleaner.service_area
            if not service_area:
                return 15.0
            
            lon1, lat1 = property_obj.longitude, property_obj.latitude
            lon2, lat2 = service_area.longitude, service_area.latitude
            
            lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
            c = 2 * asin(sqrt(a))
            
            return 6371 * c
        except:
            return 15.0

    def _calculate_specialization_match(self, job: CleaningJob, cleaner: User) -> float:
        """Score specialization match"""
        cleaner_score = CleanerScore.objects.filter(cleaner=cleaner).first()
        if not cleaner_score:
            return 50.0
        
        # Check if cleaner specializes in this property type
        if cleaner_score.primary_property_type == job.property.property_type:
            score = 100.0
        else:
            score = 60.0
        
        # Bonus for eco-friendly if job prefers it
        if job.eco_friendly_preference and cleaner_score.eco_friendly_jobs_percentage > 50:
            score = min(100.0, score + 20.0)
        
        return score

    def _calculate_pricing_competitiveness(self, job: CleaningJob, cleaner: User) -> float:
        """Score pricing competitiveness"""
        cleaner_score = CleanerScore.objects.filter(cleaner=cleaner).first()
        if not cleaner_score or not cleaner_score.avg_bid_amount:
            return 50.0
        
        # Get market average for similar jobs
        similar_jobs = JobBid.objects.filter(
            job__property__property_type=job.property.property_type,
            job__property__square_meters__range=(
                job.property.square_meters * 0.8,
                job.property.square_meters * 1.2
            )
        )
        
        market_avg = similar_jobs.aggregate(avg=models.Avg('bid_amount'))['avg']
        if not market_avg:
            return 50.0
        
        cleaner_avg = float(cleaner_score.avg_bid_amount)
        ratio = cleaner_avg / float(market_avg)
        
        # Score based on how competitive (lower is better, but not too low)
        if ratio < 0.8:
            return 60.0  # Too cheap might signal quality issues
        elif ratio <= 1.0:
            return 100.0  # Competitive
        elif ratio <= 1.2:
            return 70.0  # Slightly expensive
        else:
            return 40.0  # Too expensive

    def _calculate_availability(self, job: CleaningJob, cleaner: User) -> float:
        """Score availability"""
        cleaner_score = CleanerScore.objects.filter(cleaner=cleaner).first()
        if not cleaner_score:
            return 50.0
        
        # Active cleaners score higher
        if cleaner_score.is_active:
            return 100.0
        elif cleaner_score.jobs_last_90_days > 0:
            return 70.0
        else:
            return 30.0

    def _generate_cleaner_reasoning(self, breakdown: Dict, cleaner: User) -> List[str]:
        """Generate human-readable reasons for recommendation"""
        reasons = []
        
        if breakdown['quality'] >= 80:
            reasons.append(f"High quality score ({breakdown['quality']:.0f}/100)")
        if breakdown['location'] >= 80:
            reasons.append("Nearby location")
        if breakdown['specialization'] >= 80:
            reasons.append("Specializes in this property type")
        if breakdown['pricing'] >= 80:
            reasons.append("Competitive pricing")
        
        return reasons

    def _get_candidate_cleaners(self, job: CleaningJob, filters: Optional[Dict]) -> List[User]:
        """Get candidate cleaners for a job"""
        cleaners = User.objects.filter(role='cleaner', is_active=True)
        
        if filters:
            # Apply filters
            pass
        
        return list(cleaners)

    def _track_job_recommendations(self, job: CleaningJob, recommendations: List[Dict]):
        """Track recommendations for analytics"""
        for rank, rec in enumerate(recommendations, start=1):
            JobRecommendation.objects.get_or_create(
                job=job,
                cleaner=rec['cleaner'],
                defaults={
                    'recommendation_score': Decimal(str(rec['score'])),
                    'rank': rank,
                    'location_score': Decimal(str(rec['breakdown']['location'])),
                    'pricing_score': Decimal(str(rec['breakdown']['pricing'])),
                    'specialization_score': Decimal(str(rec['breakdown']['specialization'])),
                    'availability_score': Decimal(str(rec['breakdown']['availability'])),
                }
            )

    def _score_job_for_cleaner(self, job: CleaningJob, cleaner: User) -> Optional[Dict]:
        """Score a job for a cleaner (inverse of _score_cleaner_for_job)"""
        # Similar logic but from cleaner's perspective
        return self._score_cleaner_for_job(job, cleaner)
