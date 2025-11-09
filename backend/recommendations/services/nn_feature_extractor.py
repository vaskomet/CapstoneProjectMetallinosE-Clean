"""
Neural Network Feature Extractor Service

This service extracts the 427 features required for neural network inference
from job, cleaner, property, and historical data in real-time.

Based on extract_nn_features.py but optimized for production inference.
"""

from typing import List, Dict, Optional
import numpy as np
from datetime import datetime, timedelta
from django.db.models import Avg, Count, Q, F
from django.core.cache import cache
import logging

from cleaning_jobs.models import CleaningJob, JobBid
from reviews.models import Review, ReviewRating
from properties.models import Property
from users.models import User

logger = logging.getLogger(__name__)


class NNFeatureExtractor:
    """
    Extracts 427 features for neural network prediction.
    
    Feature breakdown:
    - Property features: 9
    - Cleaner features: 11
    - Historical match features: 10
    - Contextual features: 9
    - Rating dimension features: 4
    - Text embeddings: 384 (optional, can use zeros if not available)
    
    Total: 427 features
    """
    
    def __init__(self, use_cache=True, cache_ttl=3600):
        """
        Initialize feature extractor.
        
        Args:
            use_cache: Whether to cache computed features
            cache_ttl: Cache time-to-live in seconds (default 1 hour)
        """
        self.use_cache = use_cache
        self.cache_ttl = cache_ttl
        self.embedding_model = None
        self._load_embedding_model()
    
    def _load_embedding_model(self):
        """Load sentence transformer model for text embeddings"""
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("Loading sentence-transformers model (all-MiniLM-L6-v2)...")
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("✓ Embedding model loaded successfully")
        except ImportError:
            logger.warning("sentence-transformers not installed. Text embeddings will use zeros.")
            self.embedding_model = None
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self.embedding_model = None
    
    def extract_for_job_cleaner_pair(
        self,
        job: CleaningJob,
        cleaner: User,
        reference_date: Optional[datetime] = None
    ) -> np.ndarray:
        """
        Extract 427 features for a specific job-cleaner pair.
        
        Args:
            job: CleaningJob instance
            cleaner: User instance (must be cleaner role)
            reference_date: Date to use for temporal filtering (default: now)
            
        Returns:
            numpy array of shape (427,) with unscaled features
        """
        if reference_date is None:
            reference_date = datetime.now()
        
        features = {}
        
        # Extract all feature groups
        features.update(self._extract_property_features(job.property))
        features.update(self._extract_cleaner_features(cleaner, reference_date))
        features.update(self._extract_historical_features(job.client, cleaner, reference_date))
        features.update(self._extract_contextual_features(job, reference_date))
        features.update(self._extract_rating_features(cleaner, reference_date))
        
        # Get text embeddings from job description
        embeddings = self._get_text_embeddings(job)
        
        # Combine all features in correct order
        feature_list = [
            # Property features (9)
            features['prop_size_sqft'],
            features['prop_type_house'],
            features['prop_type_apartment'],
            features['prop_type_office'],
            features['prop_latitude'],
            features['prop_longitude'],
            features['prop_total_jobs'],
            features['prop_eco_friendly'],
            features['prop_pet_present'],
            
            # Cleaner features (11)
            features['cleaner_total_jobs'],
            features['cleaner_avg_rating'],
            features['cleaner_rating_trend'],
            features['cleaner_experience_years'],
            features['cleaner_spec_house'],
            features['cleaner_spec_apartment'],
            features['cleaner_spec_office'],
            features['cleaner_avg_job_value'],
            features['cleaner_completion_rate'],
            features['cleaner_avg_bid_amount'],
            features['cleaner_client_retention'],
            
            # Historical features (10)
            features['hist_previous_jobs'],
            features['hist_avg_rating'],
            features['hist_days_since_last'],
            features['hist_prop_type_match'],
            features['hist_price_compatibility'],
            features['hist_client_avg_rating'],
            features['hist_client_total_jobs'],
            features['hist_rebooking_indicator'],
            features['hist_has_communication'],
            features['hist_issue_resolution_rate'],
            
            # Contextual features (9)
            features['ctx_urgency_days'],
            features['ctx_price_low'],
            features['ctx_price_medium'],
            features['ctx_price_high'],
            features['ctx_service_complexity'],
            features['ctx_season_sin'],
            features['ctx_season_cos'],
            features['ctx_is_weekend'],
            features['ctx_client_tenure_days'],
            
            # Rating dimension features (4)
            features['rating_quality'],
            features['rating_communication'],
            features['rating_timeliness'],
            features['rating_professionalism'],
        ]
        
        # Add embeddings (384 dimensions)
        feature_list.extend(embeddings)
        
        return np.array(feature_list, dtype=np.float32)
    
    def extract_batch(
        self,
        job: CleaningJob,
        cleaners: List[User],
        reference_date: Optional[datetime] = None
    ) -> np.ndarray:
        """
        Extract features for multiple cleaners for the same job.
        More efficient than calling extract_for_job_cleaner_pair multiple times.
        
        Args:
            job: CleaningJob instance
            cleaners: List of User instances
            reference_date: Date to use for temporal filtering
            
        Returns:
            numpy array of shape (N, 427) where N = len(cleaners)
        """
        features_list = []
        
        for cleaner in cleaners:
            features = self.extract_for_job_cleaner_pair(job, cleaner, reference_date)
            features_list.append(features)
        
        return np.array(features_list, dtype=np.float32)
    
    # =========================================================================
    # PROPERTY FEATURES (9)
    # =========================================================================
    
    def _extract_property_features(self, property: Property) -> Dict[str, float]:
        """Extract 9 property-related features"""
        
        # Cache key for property features (they don't change often)
        cache_key = f'nn_features:property:{property.id}'
        if self.use_cache:
            cached = cache.get(cache_key)
            if cached:
                return cached
        
        features = {}
        
        # Size
        features['prop_size_sqft'] = float(property.size_sqft) if property.size_sqft else 0.0
        
        # Property type (one-hot encoding)
        features['prop_type_house'] = 1.0 if property.property_type == 'house' else 0.0
        features['prop_type_apartment'] = 1.0 if property.property_type == 'apartment' else 0.0
        features['prop_type_office'] = 1.0 if property.property_type == 'office' else 0.0
        
        # Location
        features['prop_latitude'] = float(property.latitude) if property.latitude else 0.0
        features['prop_longitude'] = float(property.longitude) if property.longitude else 0.0
        
        # Historical usage
        total_jobs = CleaningJob.objects.filter(property=property).count()
        features['prop_total_jobs'] = float(total_jobs)
        
        # Special requirements (from preferences JSONField)
        prefs = property.preferences or {}
        features['prop_eco_friendly'] = 1.0 if prefs.get('eco_friendly') else 0.0
        features['prop_pet_present'] = 1.0 if prefs.get('pet_present') or prefs.get('has_pets') else 0.0
        
        # Cache for 1 hour
        if self.use_cache:
            cache.set(cache_key, features, self.cache_ttl)
        
        return features
    
    # =========================================================================
    # CLEANER FEATURES (11)
    # =========================================================================
    
    def _extract_cleaner_features(self, cleaner: User, reference_date: datetime) -> Dict[str, float]:
        """Extract 11 cleaner performance features"""
        
        features = {}
        
        # Get cleaner's completed jobs before reference date
        cleaner_jobs = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed',
            scheduled_date__lte=reference_date
        )
        
        cleaner_job_count = cleaner_jobs.count()
        features['cleaner_total_jobs'] = float(cleaner_job_count)
        
        # Average rating and trend
        if cleaner_job_count > 0:
            past_reviews = Review.objects.filter(
                job__in=cleaner_jobs,
                overall_rating__isnull=False
            )
            avg_rating = past_reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            features['cleaner_avg_rating'] = float(avg_rating) if avg_rating else 0.0
            
            # Rating trend (recent vs overall)
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
        
        # Experience
        account_age_days = (reference_date.date() - cleaner.date_joined.date()).days
        features['cleaner_experience_years'] = account_age_days / 365.0
        
        # Specialization (job type distribution)
        total_jobs_for_pct = max(cleaner_job_count, 1)
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
        
        # Completion rate
        all_assigned = CleaningJob.objects.filter(
            cleaner=cleaner,
            scheduled_date__lte=reference_date
        ).exclude(status='open_for_bids').count()
        if all_assigned > 0:
            features['cleaner_completion_rate'] = cleaner_job_count / all_assigned
        else:
            features['cleaner_completion_rate'] = 0.0
        
        # Average bid amount
        cleaner_bids = JobBid.objects.filter(
            cleaner=cleaner,
            created_at__lte=reference_date
        )
        if cleaner_bids.exists():
            avg_bid = cleaner_bids.aggregate(Avg('bid_amount'))['bid_amount__avg']
            features['cleaner_avg_bid_amount'] = float(avg_bid) if avg_bid else 0.0
        else:
            features['cleaner_avg_bid_amount'] = 0.0
        
        # Client retention
        unique_clients = cleaner_jobs.values('client').distinct().count()
        if cleaner_job_count > 0:
            features['cleaner_client_retention'] = 1 - (unique_clients / cleaner_job_count)
        else:
            features['cleaner_client_retention'] = 0.0
        
        return features
    
    # =========================================================================
    # HISTORICAL MATCH FEATURES (10)
    # =========================================================================
    
    def _extract_historical_features(
        self,
        client: User,
        cleaner: User,
        reference_date: datetime
    ) -> Dict[str, float]:
        """Extract 10 features about previous client-cleaner interactions"""
        
        features = {}
        
        # Previous jobs between this client and cleaner
        previous_jobs = CleaningJob.objects.filter(
            client=client,
            cleaner=cleaner,
            status='completed',
            scheduled_date__lt=reference_date
        )
        
        prev_job_count = previous_jobs.count()
        features['hist_previous_jobs'] = float(prev_job_count)
        
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
            days_since = (reference_date.date() - last_job.scheduled_date).days
            features['hist_days_since_last'] = float(days_since)
            
            # Property type match rate
            # (Will be computed based on current job's property type)
            features['hist_prop_type_match'] = 0.0  # Placeholder
            
            # Price compatibility
            avg_prev_price = previous_jobs.filter(
                final_price__isnull=False
            ).aggregate(Avg('final_price'))['final_price__avg']
            features['hist_price_compatibility'] = float(avg_prev_price) if avg_prev_price else 0.0
            
            # Rebooking indicator
            features['hist_rebooking_indicator'] = 1.0
        else:
            features['hist_avg_rating'] = 0.0
            features['hist_days_since_last'] = 9999.0  # Large number for no history
            features['hist_prop_type_match'] = 0.0
            features['hist_price_compatibility'] = 0.0
            features['hist_rebooking_indicator'] = 0.0
        
        # Client's overall stats
        client_jobs = CleaningJob.objects.filter(
            client=client,
            status='completed',
            scheduled_date__lt=reference_date
        )
        client_job_count = client_jobs.count()
        features['hist_client_total_jobs'] = float(client_job_count)
        
        if client_job_count > 0:
            client_reviews = Review.objects.filter(
                job__in=client_jobs,
                overall_rating__isnull=False
            )
            client_avg = client_reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            features['hist_client_avg_rating'] = float(client_avg) if client_avg else 0.0
        else:
            features['hist_client_avg_rating'] = 0.0
        
        # Communication exists (placeholder - would check chat history)
        features['hist_has_communication'] = 0.0
        
        # Issue resolution rate (placeholder - would check support tickets)
        features['hist_issue_resolution_rate'] = 1.0
        
        return features
    
    # =========================================================================
    # CONTEXTUAL FEATURES (9)
    # =========================================================================
    
    def _extract_contextual_features(self, job: CleaningJob, reference_date: datetime) -> Dict[str, float]:
        """Extract 9 contextual features about the job"""
        
        features = {}
        
        # Urgency (days until scheduled date)
        days_until = (job.scheduled_date - reference_date.date()).days
        features['ctx_urgency_days'] = float(max(days_until, 0))
        
        # Price range (one-hot encoding based on client_budget)
        # Low: < 80, Medium: 80-150, High: > 150
        expected_price = float(job.client_budget) if job.client_budget else 100.0
        features['ctx_price_low'] = 1.0 if expected_price < 80 else 0.0
        features['ctx_price_medium'] = 1.0 if 80 <= expected_price <= 150 else 0.0
        features['ctx_price_high'] = 1.0 if expected_price > 150 else 0.0
        
        # Service complexity (based on size and special requirements)
        size = float(job.property.size_sqft) if job.property.size_sqft else 100.0
        complexity = size / 100.0  # Normalize
        prefs = job.property.preferences or {}
        if prefs.get('pet_present') or prefs.get('has_pets'):
            complexity *= 1.2
        if prefs.get('eco_friendly'):
            complexity *= 1.1
        features['ctx_service_complexity'] = complexity
        
        # Seasonality (sin/cos encoding of month)
        import math
        month = job.scheduled_date.month
        features['ctx_season_sin'] = math.sin(2 * math.pi * month / 12)
        features['ctx_season_cos'] = math.cos(2 * math.pi * month / 12)
        
        # Is weekend
        features['ctx_is_weekend'] = 1.0 if job.scheduled_date.weekday() >= 5 else 0.0
        
        # Client tenure
        client_age_days = (reference_date.date() - job.client.date_joined.date()).days
        features['ctx_client_tenure_days'] = float(client_age_days)
        
        return features
    
    # =========================================================================
    # RATING DIMENSION FEATURES (4)
    # =========================================================================
    
    def _extract_rating_features(self, cleaner: User, reference_date: datetime) -> Dict[str, float]:
        """Extract 4 rating dimension averages"""
        
        features = {}
        
        # Get cleaner's completed jobs
        cleaner_jobs = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed',
            scheduled_date__lte=reference_date
        )
        
        # Get all review ratings for this cleaner
        review_ratings = ReviewRating.objects.filter(
            review__job__in=cleaner_jobs
        )
        
        # Average rating for each dimension
        dimensions = ['quality', 'communication', 'timeliness', 'professionalism']
        
        for dimension in dimensions:
            ratings = review_ratings.filter(category=dimension)
            avg = ratings.aggregate(Avg('rating'))['rating__avg']
            features[f'rating_{dimension}'] = float(avg) if avg else 0.0
        
        return features
    
    # =========================================================================
    # TEXT EMBEDDINGS (384)
    # =========================================================================
    
    def _get_text_embeddings(self, job: CleaningJob) -> List[float]:
        """
        Get 384-dimensional text embeddings for job description.
        
        Combines property description and job special instructions,
        then generates embeddings using sentence-transformers.
        
        Uses caching to avoid recomputing embeddings for same text.
        Falls back to zeros if model not available or text is empty.
        
        Args:
            job: CleaningJob instance
            
        Returns:
            List of 384 float values
        """
        # Build text from property description and job instructions
        property_desc = job.property.description if job.property.description else ""
        job_instructions = job.special_instructions if job.special_instructions else ""
        text = f"{property_desc} {job_instructions}".strip()
        
        # Return zeros if no text or model unavailable
        if not text or self.embedding_model is None:
            return [0.0] * 384
        
        # Check cache first
        if self.use_cache:
            cache_key = f"text_embedding:{hash(text)}"
            cached = cache.get(cache_key)
            if cached is not None:
                return cached
        
        # Generate embedding
        try:
            embedding = self.embedding_model.encode(
                text,
                show_progress_bar=False,
                convert_to_numpy=True
            )
            embedding_list = embedding.astype(np.float32).tolist()
            
            # Cache result
            if self.use_cache:
                cache.set(cache_key, embedding_list, self.cache_ttl)
            
            return embedding_list
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            return [0.0] * 384


# Singleton instance
_feature_extractor = None


def get_feature_extractor(use_cache=True, cache_ttl=3600) -> NNFeatureExtractor:
    """Get or create the global feature extractor instance"""
    global _feature_extractor
    if _feature_extractor is None:
        _feature_extractor = NNFeatureExtractor(use_cache=use_cache, cache_ttl=cache_ttl)
    return _feature_extractor
