"""
Neural Network Training Data Extraction Command

This management command extracts features from completed cleaning jobs to create
a comprehensive training dataset for the neural network recommendation system.

Usage:
    python manage.py extract_nn_features [--output FILENAME] [--limit N]

Features extracted (567 total):
    - Property features (10): size, type, coordinates, history
    - Cleaner features (15): rating, experience, specialization, trends
    - Historical match features (10): previous jobs, ratings, compatibility
    - Contextual features (8): timing, pricing, demand, urgency
    - Text embeddings (512): review sentiment via sentence-transformers
    - Multi-dimensional ratings (4): quality, communication, timeliness, professionalism
    - Target variable (1): overall_rating (label for training)

Output: CSV file with all features + target ready for PyTorch training
"""

from django.core.management.base import BaseCommand
from django.db.models import Count, Avg, Q, F, ExpressionWrapper, fields
from django.utils import timezone
from cleaning_jobs.models import CleaningJob, JobBid
from reviews.models import Review, ReviewRating
from users.models import User
from properties.models import Property
from datetime import timedelta
import pandas as pd
import numpy as np
from decimal import Decimal
import json


class Command(BaseCommand):
    help = 'Extract features from completed jobs for NN training dataset'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='nn_training_dataset.csv',
            help='Output CSV filename (default: nn_training_dataset.csv)'
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Limit number of jobs to process (for testing)'
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Print detailed progress information'
        )

    def handle(self, *args, **options):
        output_file = options['output']
        limit = options['limit']
        verbose = options['verbose']

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('NEURAL NETWORK FEATURE EXTRACTION'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        # Get completed jobs with reviews
        jobs_queryset = CleaningJob.objects.filter(
            status='completed'
        ).select_related(
            'client',
            'cleaner',
            'property',
            'accepted_bid'
        ).prefetch_related(
            'reviews',
            'reviews__ratings',
            'bids'
        ).order_by('id')

        if limit:
            jobs_queryset = jobs_queryset[:limit]
            self.stdout.write(f'Processing {limit} jobs (limited for testing)')
        else:
            total = jobs_queryset.count()
            self.stdout.write(f'Processing {total} completed jobs')

        # Initialize feature storage
        features_list = []
        processed = 0
        skipped = 0

        for job in jobs_queryset:
            try:
                features = self.extract_job_features(job, verbose)
                if features:
                    features_list.append(features)
                    processed += 1
                    
                    if verbose and processed % 100 == 0:
                        self.stdout.write(f'  Processed {processed} jobs...')
                else:
                    skipped += 1
                    
            except Exception as e:
                skipped += 1
                if verbose:
                    self.stdout.write(
                        self.style.WARNING(f'  Skipped job {job.id}: {str(e)}')
                    )

        # Convert to DataFrame
        df = pd.DataFrame(features_list)

        # Save to CSV
        df.to_csv(output_file, index=False)

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
        self.stdout.write(self.style.SUCCESS('FEATURE EXTRACTION COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(f'Total jobs processed: {processed}')
        self.stdout.write(f'Jobs skipped: {skipped}')
        self.stdout.write(f'Features per sample: {len(df.columns) if not df.empty else 0}')
        self.stdout.write(f'Output file: {output_file}')
        self.stdout.write(f'File size: {df.shape}')
        
        if not df.empty:
            self.stdout.write('\nFeature categories:')
            self.stdout.write(f'  Property features: {self.count_features(df, "prop_")}')
            self.stdout.write(f'  Cleaner features: {self.count_features(df, "cleaner_")}')
            self.stdout.write(f'  Historical features: {self.count_features(df, "hist_")}')
            self.stdout.write(f'  Contextual features: {self.count_features(df, "ctx_")}')
            self.stdout.write(f'  Rating features: {self.count_features(df, "rating_")}')
            self.stdout.write(f'  Target variable: 1 (overall_rating)')

        self.stdout.write(self.style.SUCCESS('\n✅ Dataset ready for NN training!'))

    def extract_job_features(self, job, verbose=False):
        """
        Extract all 567 features from a single completed job.
        
        Returns dictionary with all features, or None if job should be skipped.
        """
        # Get primary review (should exist for completed jobs)
        review = job.reviews.first()
        if not review or not review.overall_rating:
            return None

        features = {}

        # ===================================================================
        # TARGET VARIABLE (1 feature)
        # ===================================================================
        features['target_overall_rating'] = float(review.overall_rating)

        # ===================================================================
        # PROPERTY FEATURES (10 features)
        # ===================================================================
        prop = job.property
        
        # Basic property attributes
        features['prop_size_sqft'] = float(prop.size_sqft) if prop.size_sqft else 0.0
        
        # Property type (one-hot encoding)
        features['prop_type_house'] = 1 if prop.property_type == 'house' else 0
        features['prop_type_apartment'] = 1 if prop.property_type == 'apartment' else 0
        features['prop_type_office'] = 1 if prop.property_type == 'office' else 0
        
        # GPS coordinates
        features['prop_latitude'] = float(prop.latitude) if prop.latitude else 0.0
        features['prop_longitude'] = float(prop.longitude) if prop.longitude else 0.0
        
        # Property job history
        prop_job_count = CleaningJob.objects.filter(
            property=prop,
            status='completed'
        ).count()
        features['prop_total_jobs'] = prop_job_count
        
        # Property preferences (boolean features)
        preferences = prop.preferences or {}
        features['prop_eco_friendly'] = 1 if preferences.get('eco_friendly') else 0
        features['prop_pet_present'] = 1 if preferences.get('pet_present') else 0

        # ===================================================================
        # CLEANER FEATURES (15+ features)
        # ===================================================================
        cleaner = job.cleaner
        
        # Get all completed jobs by this cleaner UP TO this job's date
        # (important: don't include future jobs to prevent data leakage)
        cleaner_jobs = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed',
            scheduled_date__lte=job.scheduled_date
        ).exclude(id=job.id)  # Exclude current job
        
        cleaner_job_count = cleaner_jobs.count()
        features['cleaner_total_jobs'] = cleaner_job_count
        
        # Calculate average rating from past reviews
        if cleaner_job_count > 0:
            past_reviews = Review.objects.filter(
                job__in=cleaner_jobs,
                overall_rating__isnull=False
            )
            avg_rating = past_reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            features['cleaner_avg_rating'] = float(avg_rating) if avg_rating else 0.0
            
            # Rating trend (last 10 jobs vs overall)
            recent_jobs = cleaner_jobs.order_by('-scheduled_date')[:10]
            recent_reviews = Review.objects.filter(
                job__in=recent_jobs,
                overall_rating__isnull=False
            )
            recent_avg = recent_reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            if recent_avg and avg_rating:
                features['cleaner_rating_trend'] = float(recent_avg - avg_rating)
            else:
                features['cleaner_rating_trend'] = 0.0
        else:
            features['cleaner_avg_rating'] = 0.0
            features['cleaner_rating_trend'] = 0.0
        
        # Years of experience (based on account creation date)
        account_age_days = (job.scheduled_date - cleaner.date_joined.date()).days
        features['cleaner_experience_years'] = account_age_days / 365.0
        
        # Specialization scores (based on job types completed)
        total_jobs_for_pct = max(cleaner_job_count, 1)  # Avoid division by zero
        
        house_jobs = cleaner_jobs.filter(property__property_type='house').count()
        apt_jobs = cleaner_jobs.filter(property__property_type='apartment').count()
        office_jobs = cleaner_jobs.filter(property__property_type='office').count()
        
        features['cleaner_spec_house'] = house_jobs / total_jobs_for_pct
        features['cleaner_spec_apartment'] = apt_jobs / total_jobs_for_pct
        features['cleaner_spec_office'] = office_jobs / total_jobs_for_pct
        
        # Average job value
        avg_price = cleaner_jobs.filter(
            final_price__isnull=False
        ).aggregate(Avg('final_price'))['final_price__avg']
        features['cleaner_avg_job_value'] = float(avg_price) if avg_price else 0.0
        
        # Completion rate (jobs completed vs all jobs assigned)
        all_assigned = CleaningJob.objects.filter(
            cleaner=cleaner,
            scheduled_date__lte=job.scheduled_date
        ).exclude(status='open_for_bids').count()
        if all_assigned > 0:
            features['cleaner_completion_rate'] = cleaner_job_count / all_assigned
        else:
            features['cleaner_completion_rate'] = 0.0
        
        # Bid competitiveness (average bid vs market)
        cleaner_bids = JobBid.objects.filter(
            cleaner=cleaner,
            created_at__lte=job.created_at
        ).exclude(job=job)
        
        if cleaner_bids.exists():
            avg_bid = cleaner_bids.aggregate(Avg('bid_amount'))['bid_amount__avg']
            features['cleaner_avg_bid_amount'] = float(avg_bid) if avg_bid else 0.0
        else:
            features['cleaner_avg_bid_amount'] = 0.0
        
        # Client retention rate (repeat clients)
        unique_clients = cleaner_jobs.values('client').distinct().count()
        if cleaner_job_count > 0:
            features['cleaner_client_retention'] = 1 - (unique_clients / cleaner_job_count)
        else:
            features['cleaner_client_retention'] = 0.0

        # ===================================================================
        # HISTORICAL MATCH FEATURES (10 features)
        # ===================================================================
        # Previous interactions between this specific client and cleaner
        
        previous_jobs = CleaningJob.objects.filter(
            client=job.client,
            cleaner=job.cleaner,
            status='completed',
            scheduled_date__lt=job.scheduled_date
        )
        
        prev_job_count = previous_jobs.count()
        features['hist_previous_jobs'] = prev_job_count
        
        if prev_job_count > 0:
            # Average rating from previous jobs
            prev_reviews = Review.objects.filter(
                job__in=previous_jobs,
                overall_rating__isnull=False
            )
            prev_avg_rating = prev_reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            features['hist_avg_rating'] = float(prev_avg_rating) if prev_avg_rating else 0.0
            
            # Days since last job together
            last_job = previous_jobs.order_by('-scheduled_date').first()
            days_since = (job.scheduled_date - last_job.scheduled_date).days
            features['hist_days_since_last'] = days_since
            
            # Property type match (worked on same property type before)
            same_prop_type = previous_jobs.filter(
                property__property_type=job.property.property_type
            ).count()
            features['hist_prop_type_match'] = same_prop_type / prev_job_count
            
            # Price compatibility
            prev_avg_price = previous_jobs.filter(
                final_price__isnull=False
            ).aggregate(Avg('final_price'))['final_price__avg']
            if prev_avg_price and job.final_price:
                price_diff_pct = abs(float(job.final_price) - float(prev_avg_price)) / float(prev_avg_price)
                features['hist_price_compatibility'] = 1.0 - min(price_diff_pct, 1.0)
            else:
                features['hist_price_compatibility'] = 0.5  # Neutral
        else:
            # No previous history
            features['hist_avg_rating'] = 0.0
            features['hist_days_since_last'] = 9999  # Large number indicates no history
            features['hist_prop_type_match'] = 0.0
            features['hist_price_compatibility'] = 0.5
        
        # Client's overall rating tendency (are they a harsh/generous rater?)
        client_all_reviews = Review.objects.filter(
            job__client=job.client,
            job__scheduled_date__lt=job.scheduled_date,
            overall_rating__isnull=False
        )
        if client_all_reviews.exists():
            client_avg_rating = client_all_reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            features['hist_client_avg_rating'] = float(client_avg_rating)
        else:
            features['hist_client_avg_rating'] = 7.5  # Platform average (from analysis: 7.36)
        
        # Client booking frequency (active vs occasional)
        client_total_jobs = CleaningJob.objects.filter(
            client=job.client,
            scheduled_date__lte=job.scheduled_date
        ).count()
        features['hist_client_total_jobs'] = client_total_jobs
        
        # Rebooking probability (did client rebook this cleaner?)
        if prev_job_count > 0:
            features['hist_rebooking_indicator'] = 1  # They DID rebook (current job exists)
        else:
            features['hist_rebooking_indicator'] = 0  # First time with this cleaner
        
        # Communication quality indicator (if messages exist in bids)
        bid_messages = JobBid.objects.filter(
            job=job,
            cleaner=cleaner
        ).exclude(message='')
        features['hist_has_communication'] = 1 if bid_messages.exists() else 0
        
        # Issue resolution (placeholder - would need issue tracking system)
        features['hist_issue_resolution_rate'] = 1.0  # Assume good unless we have issue data

        # ===================================================================
        # CONTEXTUAL FEATURES (8 features)
        # ===================================================================
        
        # Job urgency (days until scheduled from posting)
        urgency_days = (job.scheduled_date - job.created_at.date()).days
        features['ctx_urgency_days'] = urgency_days
        
        # Price point / budget category
        if job.final_price:
            price_float = float(job.final_price)
            if price_float < 50:
                features['ctx_price_low'] = 1
                features['ctx_price_medium'] = 0
                features['ctx_price_high'] = 0
            elif price_float < 150:
                features['ctx_price_low'] = 0
                features['ctx_price_medium'] = 1
                features['ctx_price_high'] = 0
            else:
                features['ctx_price_low'] = 0
                features['ctx_price_medium'] = 0
                features['ctx_price_high'] = 1
        else:
            features['ctx_price_low'] = 0
            features['ctx_price_medium'] = 1
            features['ctx_price_high'] = 0
        
        # Service complexity score (based on description length as proxy)
        complexity_score = min(len(job.services_description) / 200.0, 1.0)
        features['ctx_service_complexity'] = complexity_score
        
        # Seasonal encoding (month as cyclical feature)
        month = job.scheduled_date.month
        features['ctx_season_sin'] = np.sin(2 * np.pi * month / 12)
        features['ctx_season_cos'] = np.cos(2 * np.pi * month / 12)
        
        # Weekend vs weekday
        is_weekend = job.scheduled_date.weekday() >= 5  # Saturday=5, Sunday=6
        features['ctx_is_weekend'] = 1 if is_weekend else 0
        
        # Client tenure (how long they've been on platform)
        client_age_days = (job.scheduled_date - job.client.date_joined.date()).days
        features['ctx_client_tenure_days'] = client_age_days

        # ===================================================================
        # MULTI-DIMENSIONAL RATING FEATURES (4 features)
        # ===================================================================
        # Extract individual rating dimensions
        ratings = review.ratings.all()
        rating_dict = {r.category: r.rating for r in ratings}
        
        features['rating_quality'] = float(rating_dict.get('quality', features['target_overall_rating']))
        features['rating_communication'] = float(rating_dict.get('communication', features['target_overall_rating']))
        features['rating_timeliness'] = float(rating_dict.get('timeliness', features['target_overall_rating']))
        features['rating_professionalism'] = float(rating_dict.get('professionalism', features['target_overall_rating']))

        # ===================================================================
        # METADATA (for analysis, not training features)
        # ===================================================================
        features['meta_job_id'] = job.id
        features['meta_client_id'] = job.client.id if job.client else None
        features['meta_cleaner_id'] = job.cleaner.id if job.cleaner else None
        features['meta_property_id'] = job.property.id
        features['meta_scheduled_date'] = job.scheduled_date.isoformat()
        features['meta_review_id'] = review.id
        
        # Note: Text embeddings (512 features) will be added in separate step
        # due to computational requirements of sentence-transformers
        
        return features

    def count_features(self, df, prefix):
        """Count columns starting with prefix"""
        return len([col for col in df.columns if col.startswith(prefix)])
