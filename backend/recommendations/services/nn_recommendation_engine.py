"""
Neural Network Recommendation Engine

Orchestrates feature extraction, ML service communication, and recommendation ranking
using the trained neural network model.
"""

import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime

from django.core.cache import cache
from django.db.models import Q, Avg, Count

from cleaning_jobs.models import CleaningJob
from users.models import User
from reviews.models import Review
from .nn_feature_extractor import get_feature_extractor
from .ml_client import predict_nn_batch, predict_nn_single

logger = logging.getLogger(__name__)


class NNRecommendationEngine:
    """
    Neural network-based recommendation engine for cleaner-job matching.
    
    Workflow:
    1. Extract 427 features for each job-cleaner pair
    2. Call ML service for neural network prediction
    3. Rank cleaners by predicted match score
    4. Fall back to hybrid scoring if NN fails
    """
    
    def __init__(self, use_cache=True, cache_ttl=1800):
        """
        Initialize recommendation engine.
        
        Args:
            use_cache: Whether to cache recommendations
            cache_ttl: Cache time-to-live in seconds (default 30 min)
        """
        self.feature_extractor = get_feature_extractor(use_cache=use_cache)
        self.use_cache = use_cache
        self.cache_ttl = cache_ttl
    
    def get_recommendations(
        self,
        job: CleaningJob,
        cleaner_ids: Optional[List[int]] = None,
        top_k: int = 10,
        min_score: float = 0.0,
        use_fallback: bool = True
    ) -> List[Dict]:
        """
        Get ranked cleaner recommendations for a job using neural network.
        
        Args:
            job: CleaningJob instance
            cleaner_ids: Optional list of cleaner IDs to consider (defaults to all available)
            top_k: Number of top recommendations to return
            min_score: Minimum match score threshold (0-1 scale)
            use_fallback: Whether to use hybrid scoring if NN fails
            
        Returns:
            List of dicts with keys: cleaner_id, cleaner, match_score, denormalized_rating, method
        """
        # Check cache
        cache_key = self._get_cache_key(job.id, cleaner_ids, top_k)
        if self.use_cache:
            cached = cache.get(cache_key)
            if cached:
                logger.info(f"Returning cached NN recommendations for job {job.id}")
                return cached
        
        # Get candidate cleaners
        cleaners = self._get_candidate_cleaners(job, cleaner_ids)
        
        if not cleaners:
            logger.warning(f"No candidate cleaners found for job {job.id}")
            return []
        
        logger.info(f"Getting NN recommendations for job {job.id} with {len(cleaners)} cleaners")
        
        # Extract features for all cleaners
        try:
            features_batch = self.feature_extractor.extract_batch(
                job=job,
                cleaners=cleaners,
                reference_date=datetime.now()
            )
            logger.debug(f"Extracted features batch shape: {features_batch.shape}")
            
        except Exception as e:
            logger.error(f"Feature extraction failed: {str(e)}")
            if use_fallback:
                return self._fallback_to_hybrid(job, cleaners, top_k)
            return []
        
        # Get predictions from ML service
        try:
            predictions = predict_nn_batch(features_batch.tolist())
            
            if predictions is None:
                logger.error("NN batch prediction returned None")
                if use_fallback:
                    return self._fallback_to_hybrid(job, cleaners, top_k)
                return []
            
            logger.info(f"Received {len(predictions)} NN predictions")
            
        except Exception as e:
            logger.error(f"NN prediction failed: {str(e)}")
            if use_fallback:
                return self._fallback_to_hybrid(job, cleaners, top_k)
            return []
        
        # Combine cleaners with predictions
        recommendations = []
        for cleaner, prediction in zip(cleaners, predictions):
            match_score = prediction['match_score']
            
            # Filter by minimum score
            if match_score < min_score:
                continue
            
            recommendations.append({
                'cleaner_id': cleaner.id,
                'cleaner': cleaner,
                'match_score': match_score,
                'denormalized_rating': prediction['denormalized_rating'],
                'inference_time_ms': prediction.get('inference_time_ms', 0),
                'method': 'neural_network'
            })
        
        # Sort by match score (descending)
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)
        
        # Take top K
        recommendations = recommendations[:top_k]
        
        # Cache results
        if self.use_cache:
            cache.set(cache_key, recommendations, self.cache_ttl)
        
        logger.info(
            f"Returning {len(recommendations)} NN recommendations for job {job.id} "
            f"(top score: {recommendations[0]['match_score']:.3f if recommendations else 'N/A'})"
        )
        
        return recommendations
    
    def get_single_prediction(
        self,
        job: CleaningJob,
        cleaner: User
    ) -> Optional[Dict]:
        """
        Get neural network prediction for a single job-cleaner pair.
        
        Args:
            job: CleaningJob instance
            cleaner: User instance (cleaner role)
            
        Returns:
            Dict with prediction details or None if prediction fails
        """
        try:
            # Extract features
            features = self.feature_extractor.extract_for_job_cleaner_pair(
                job=job,
                cleaner=cleaner,
                reference_date=datetime.now()
            )
            
            # Get prediction
            prediction = predict_nn_single(features.tolist())
            
            if prediction is None:
                logger.error(f"NN prediction failed for job {job.id}, cleaner {cleaner.id}")
                return None
            
            return {
                'cleaner_id': cleaner.id,
                'cleaner': cleaner,
                'match_score': prediction['match_score'],
                'denormalized_rating': prediction['denormalized_rating'],
                'inference_time_ms': prediction.get('inference_time_ms', 0),
                'method': 'neural_network'
            }
            
        except Exception as e:
            logger.error(f"Single NN prediction failed: {str(e)}")
            return None
    
    def _get_candidate_cleaners(
        self,
        job: CleaningJob,
        cleaner_ids: Optional[List[int]] = None
    ) -> List[User]:
        """
        Get list of candidate cleaners for a job.
        
        Args:
            job: CleaningJob instance
            cleaner_ids: Optional specific cleaner IDs to consider
            
        Returns:
            List of User instances (cleaner role)
        """
        query = User.objects.filter(role='cleaner', is_active=True)
        
        # Filter by specific IDs if provided
        if cleaner_ids:
            query = query.filter(id__in=cleaner_ids)
        
        # TODO: Add additional filtering:
        # - Service area matching
        # - Availability checking
        # - Minimum rating threshold
        
        return list(query)
    
    def _fallback_to_hybrid(
        self,
        job: CleaningJob,
        cleaners: List[User],
        top_k: int
    ) -> List[Dict]:
        """
        Fall back to hybrid scoring algorithm if NN fails.
        
        Uses quality-first ranking: 60% rating, 25% experience, 15% completion rate
        
        Args:
            job: CleaningJob instance
            cleaners: List of candidate cleaners
            top_k: Number of recommendations to return
            
        Returns:
            List of recommendations using hybrid scoring
        """
        logger.warning(f"Falling back to hybrid scoring for job {job.id}")
        
        recommendations = []
        for cleaner in cleaners:
            try:
                # Get cleaner stats
                completed_jobs = CleaningJob.objects.filter(
                    cleaner=cleaner,
                    status='completed'
                )
                
                total_jobs = completed_jobs.count()
                
                # Average rating
                reviews = Review.objects.filter(
                    job__in=completed_jobs,
                    overall_rating__isnull=False
                )
                avg_rating = reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
                rating_score = min((avg_rating or 0) / 10.0, 1.0) if avg_rating else 0.5
                
                # Experience score
                experience_score = min(total_jobs / 50.0, 1.0)
                
                # Completion rate
                all_assigned = CleaningJob.objects.filter(
                    cleaner=cleaner
                ).exclude(status='open_for_bids').count()
                completion_rate = total_jobs / all_assigned if all_assigned > 0 else 0.0
                
                # Quality-first ranking
                hybrid_score = (
                    0.60 * rating_score +
                    0.25 * experience_score +
                    0.15 * completion_rate
                )
                
                # Convert to 5-10 scale for denormalized rating
                denormalized_rating = hybrid_score * 5.0 + 5.0
                
                recommendations.append({
                    'cleaner_id': cleaner.id,
                    'cleaner': cleaner,
                    'match_score': hybrid_score,
                    'denormalized_rating': denormalized_rating,
                    'inference_time_ms': 0,
                    'method': 'hybrid_fallback'
                })
            except Exception as e:
                logger.error(f"Hybrid scoring failed for cleaner {cleaner.id}: {str(e)}")
                continue
        
        # Sort and return top K
        recommendations.sort(key=lambda x: x['match_score'], reverse=True)
        return recommendations[:top_k]
    
    def _get_cache_key(
        self,
        job_id: int,
        cleaner_ids: Optional[List[int]],
        top_k: int
    ) -> str:
        """Generate cache key for recommendations"""
        cleaner_str = ','.join(map(str, sorted(cleaner_ids))) if cleaner_ids else 'all'
        return f'nn_recommendations:job_{job_id}:cleaners_{cleaner_str}:top_{top_k}'


# Singleton instance
_nn_engine = None


def get_nn_recommendation_engine(use_cache=True) -> NNRecommendationEngine:
    """Get or create the global NN recommendation engine instance"""
    global _nn_engine
    if _nn_engine is None:
        _nn_engine = NNRecommendationEngine(use_cache=use_cache)
    return _nn_engine
