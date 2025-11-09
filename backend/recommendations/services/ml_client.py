"""
ML Client Service - Communication layer between Django and ML microservice

Handles HTTP requests to the ML service with retry logic, error handling,
and response parsing.
"""
import httpx
import logging
from typing import List, Dict, Optional, Any
from django.conf import settings
import asyncio
from functools import wraps

logger = logging.getLogger(__name__)

# ML Service configuration
ML_SERVICE_URL = getattr(settings, 'ML_SERVICE_URL', 'http://ml-service:8001')
ML_SERVICE_TIMEOUT = 10.0  # seconds
ML_SERVICE_MAX_RETRIES = 3


class MLServiceError(Exception):
    """Base exception for ML service errors"""
    pass


class MLServiceUnavailable(MLServiceError):
    """ML service is not available"""
    pass


class MLServiceClient:
    """
    Client for communicating with the ML microservice.
    
    Usage:
        client = MLServiceClient()
        recommendations = client.get_cleaner_recommendations(
            job_id=123,
            client_id=45,
            property_type='apartment',
            features=[...],
            top_k=5
        )
    """
    
    def __init__(self, base_url: str = None, timeout: float = None):
        self.base_url = base_url or ML_SERVICE_URL
        self.timeout = timeout or ML_SERVICE_TIMEOUT
        self.client = httpx.Client(timeout=self.timeout)
    
    def __del__(self):
        """Cleanup httpx client"""
        try:
            self.client.close()
        except:
            pass
    
    def _make_request(
        self,
        method: str,
        endpoint: str,
        json_data: Optional[Dict] = None,
        retries: int = ML_SERVICE_MAX_RETRIES
    ) -> Dict[str, Any]:
        """
        Make HTTP request to ML service with retry logic.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            json_data: Request body for POST requests
            retries: Number of retry attempts
        
        Returns:
            Response JSON data
        
        Raises:
            MLServiceUnavailable: If service is not reachable
            MLServiceError: If request fails after retries
        """
        url = f"{self.base_url}{endpoint}"
        last_exception = None
        
        for attempt in range(retries):
            try:
                logger.debug(f"ML service request: {method} {url} (attempt {attempt + 1}/{retries})")
                
                if method.upper() == 'GET':
                    response = self.client.get(url)
                elif method.upper() == 'POST':
                    response = self.client.post(url, json=json_data)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                response.raise_for_status()
                
                logger.debug(f"ML service response: {response.status_code}")
                return response.json()
                
            except httpx.HTTPStatusError as e:
                last_exception = e
                logger.warning(f"ML service HTTP error: {e.response.status_code} - {e.response.text}")
                
                # Don't retry on 4xx errors (client errors)
                if 400 <= e.response.status_code < 500:
                    raise MLServiceError(f"ML service error: {e.response.text}")
                
            except httpx.ConnectError as e:
                last_exception = e
                logger.warning(f"ML service connection error: {str(e)}")
                
            except httpx.TimeoutException as e:
                last_exception = e
                logger.warning(f"ML service timeout: {str(e)}")
            
            except Exception as e:
                last_exception = e
                logger.error(f"Unexpected ML service error: {str(e)}")
            
            # Wait before retry (exponential backoff)
            if attempt < retries - 1:
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                logger.info(f"Retrying in {wait_time}s...")
                import time
                time.sleep(wait_time)
        
        # All retries failed
        if isinstance(last_exception, (httpx.ConnectError, httpx.TimeoutException)):
            raise MLServiceUnavailable(f"ML service unavailable after {retries} attempts")
        else:
            raise MLServiceError(f"ML service request failed: {str(last_exception)}")
    
    def health_check(self) -> bool:
        """
        Check if ML service is healthy.
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            response = self._make_request('GET', '/health', retries=1)
            return response.get('status') == 'healthy' and response.get('model_loaded', False)
        except:
            return False
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get ML model information.
        
        Returns:
            Dict with model version, device, num_clients, num_cleaners, etc.
        """
        return self._make_request('GET', '/model/info')
    
    def get_cleaner_recommendations(
        self,
        job_id: int,
        client_id: int,
        property_type: str,
        features: List[float],
        top_k: int = 5,
        use_hybrid: bool = True
    ) -> Dict[str, Any]:
        """
        Get top-K cleaner recommendations for a job.
        
        Args:
            job_id: Job ID
            client_id: Client user ID
            property_type: Property type ('apartment', 'house', 'office', 'commercial')
            features: List of 18 continuous features
            top_k: Number of recommendations to return
            use_hybrid: Use hybrid model (True) or rule-based only (False)
        
        Returns:
            Dict with:
                - job_id: int
                - recommendations: List[Dict] with id, score, rule_based_score, neural_score, confidence
                - model_version: str
                - inference_time_ms: float
        
        Example:
            {
                'job_id': 123,
                'recommendations': [
                    {
                        'id': 45,
                        'score': 0.892,
                        'rule_based_score': 0.85,
                        'neural_score': 0.93,
                        'confidence': 0.88
                    },
                    ...
                ],
                'model_version': '1.0',
                'inference_time_ms': 5.23
            }
        """
        payload = {
            'job_id': job_id,
            'client_id': client_id,
            'property_type': property_type,
            'features': features,
            'top_k': top_k,
            'use_hybrid': use_hybrid
        }
        
        return self._make_request('POST', '/recommend/cleaners', json_data=payload)
    
    def get_job_recommendations(
        self,
        cleaner_id: int,
        job_ids: List[int],
        features_list: List[List[float]],
        property_types: List[str],
        top_k: int = 10
    ) -> Dict[str, Any]:
        """
        Get top-K job recommendations for a cleaner.
        
        Args:
            cleaner_id: Cleaner user ID
            job_ids: List of job IDs to score
            features_list: List of feature vectors (one per job)
            property_types: List of property types (one per job)
            top_k: Number of recommendations to return
        
        Returns:
            Dict with cleaner_id, recommendations, model_version, inference_time_ms
        """
        payload = {
            'cleaner_id': cleaner_id,
            'job_ids': job_ids,
            'features_list': features_list,
            'property_types': property_types,
            'top_k': top_k
        }
        
        return self._make_request('POST', '/recommend/jobs', json_data=payload)
    
    def get_bid_suggestion(
        self,
        job_id: int,
        cleaner_id: int,
        client_id: int,
        property_type: str,
        features: List[float]
    ) -> Dict[str, Any]:
        """
        Get bid price suggestion for a cleaner-job pair.
        
        Args:
            job_id: Job ID
            cleaner_id: Cleaner user ID
            client_id: Client user ID
            property_type: Property type
            features: List of 18 continuous features
        
        Returns:
            Dict with:
                - job_id: int
                - cleaner_id: int
                - suggested_bid: float
                - confidence_interval: [float, float]
                - model_version: str
        """
        payload = {
            'job_id': job_id,
            'cleaner_id': cleaner_id,
            'client_id': client_id,
            'property_type': property_type,
            'features': features
        }
        
        return self._make_request('POST', '/suggest/bid', json_data=payload)


# Singleton instance
_ml_client = None


def get_ml_client() -> MLServiceClient:
    """
    Get singleton ML service client instance.
    
    Usage:
        from recommendations.services.ml_client import get_ml_client
        
        ml_client = get_ml_client()
        recommendations = ml_client.get_cleaner_recommendations(...)
    """
    global _ml_client
    if _ml_client is None:
        _ml_client = MLServiceClient()
    return _ml_client


def ml_service_fallback(fallback_value=None):
    """
    Decorator to handle ML service failures gracefully.
    
    If ML service is unavailable, returns fallback_value instead of raising exception.
    
    Usage:
        @ml_service_fallback(fallback_value=[])
        def get_recommendations(job_id):
            ml_client = get_ml_client()
            result = ml_client.get_cleaner_recommendations(...)
            return result['recommendations']
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except MLServiceUnavailable as e:
                logger.warning(f"ML service unavailable in {func.__name__}: {str(e)}")
                logger.info(f"Returning fallback value: {fallback_value}")
                return fallback_value
            except MLServiceError as e:
                logger.error(f"ML service error in {func.__name__}: {str(e)}")
                logger.info(f"Returning fallback value: {fallback_value}")
                return fallback_value
        return wrapper
    return decorator


# ============================================================================
# Neural Network Prediction Methods
# ============================================================================

def predict_nn_single(features: List[float]) -> Optional[Dict[str, float]]:
    """
    Get neural network prediction for a single cleaner-job pair.
    
    Args:
        features: List of 427 unscaled features
        
    Returns:
        Dict with keys: match_score, denormalized_rating, inference_time_ms
        or None if prediction fails
    """
    client = get_ml_client()
    
    if len(features) != 427:
        logger.error(f"Invalid feature count: {len(features)}, expected 427")
        return None
    
    try:
        response = client.client.post(
            f"{client.base_url}/predict/nn",
            json={"features": features}
        )
        response.raise_for_status()
        return response.json()
        
    except httpx.TimeoutException:
        logger.error("NN prediction request timed out")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"NN prediction HTTP error: {e.response.status_code}")
        return None
    except Exception as e:
        logger.error(f"NN prediction failed: {str(e)}")
        return None


def predict_nn_batch(features_batch: List[List[float]]) -> Optional[List[Dict[str, float]]]:
    """
    Get neural network predictions for multiple cleaner-job pairs.
    
    Args:
        features_batch: List of feature lists (each with 427 unscaled features)
        
    Returns:
        List of prediction dicts or None if prediction fails
    """
    client = get_ml_client()
    
    if len(features_batch) > 100:
        logger.warning(f"Batch size {len(features_batch)} exceeds limit, truncating to 100")
        features_batch = features_batch[:100]
    
    # Validate feature dimensions
    for i, features in enumerate(features_batch):
        if len(features) != 427:
            logger.error(f"Invalid feature count at index {i}: {len(features)}, expected 427")
            return None
    
    try:
        response = client.client.post(
            f"{client.base_url}/predict/nn/batch",
            json={"features_batch": features_batch},
            timeout=ML_SERVICE_TIMEOUT * 2  # Longer timeout for batch
        )
        response.raise_for_status()
        data = response.json()
        return data['predictions']
        
    except httpx.TimeoutException:
        logger.error("NN batch prediction request timed out")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"NN batch prediction HTTP error: {e.response.status_code}")
        return None
    except Exception as e:
        logger.error(f"NN batch prediction failed: {str(e)}")
        return None


def get_nn_model_info() -> Optional[Dict]:
    """
    Get neural network model metadata.
    
    Returns:
        Dict with model architecture, parameters, and performance metrics
    """
    client = get_ml_client()
    
    try:
        response = client.client.get(f"{client.base_url}/model/nn/info")
        response.raise_for_status()
        return response.json()
        
    except Exception as e:
        logger.error(f"Failed to get NN model info: {str(e)}")
        return None
