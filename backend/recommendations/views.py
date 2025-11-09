"""
Recommendation System API Views

Provides REST endpoints for ML-powered cleaner and job recommendations.
Integrates with FastAPI ML microservice via MLServiceClient.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q, Avg, Count
import logging

from users.serializers import UserSerializer
from users.location_utils import find_cleaners_by_location
from cleaning_jobs.models import CleaningJob
from properties.models import Property
from .services.ml_client import get_ml_client, MLServiceError

User = get_user_model()
logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recommend_cleaners_for_location(request):
    """
    Get ML-powered cleaner recommendations for a location.
    
    Query parameters:
        - latitude (required): Job location latitude
        - longitude (required): Job location longitude
        - max_radius (optional): Search radius in km (default: 15)
        - property_id (optional): Specific property for personalized recommendations
        - property_type (optional): apartment/house/office/commercial
        - property_size (optional): Property size in sq meters
        - top_k (optional): Number of recommendations (default: 10)
        - job_id (optional): Existing job ID for context-aware recommendations
    
    Returns:
        {
            "count": 5,
            "recommendations": [
                {
                    "cleaner": {...user data...},
                    "score": 0.87,
                    "distance_km": 2.3,
                    "service_areas": [...],
                    "stats": {...},
                    "previous_jobs": 2,  # If property_id provided
                    "last_cleaned": "2024-10-15",  # If has history
                    "previous_rating": 9.5  # If has history
                }
            ],
            "ml_enabled": true,
            "fallback_mode": false,
            "property_aware": true  # If property_id was provided
        }
    """
    # Extract parameters
    try:
        latitude = float(request.query_params.get('latitude'))
        longitude = float(request.query_params.get('longitude'))
    except (TypeError, ValueError):
        return Response(
            {'error': 'latitude and longitude are required and must be valid numbers'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    max_radius = float(request.query_params.get('max_radius', 15))
    property_id = request.query_params.get('property_id')
    property_type = request.query_params.get('property_type', 'apartment')
    property_size = request.query_params.get('property_size')
    top_k = int(request.query_params.get('top_k', 10))
    job_id = request.query_params.get('job_id')
    
    # Get property object if property_id provided
    property_obj = None
    if property_id:
        from properties.models import Property
        try:
            property_obj = Property.objects.get(id=property_id, owner=request.user)
            # Use property's details for more accurate recommendations
            if property_obj.property_type:
                property_type = property_obj.property_type
            if property_obj.size_sqft:
                property_size = property_obj.size_sqft
            if property_obj.latitude and property_obj.longitude:
                latitude = float(property_obj.latitude)
                longitude = float(property_obj.longitude)
        except Property.DoesNotExist:
            pass  # Fall back to provided parameters
    
    # Step 1: Get cleaners in service area (business rule filter)
    eligible_cleaners = find_cleaners_by_location(
        latitude=latitude,
        longitude=longitude,
        max_radius=max_radius,
        unit='km'
    )
    
    if not eligible_cleaners:
        return Response({
            'count': 0,
            'recommendations': [],
            'ml_enabled': False,
            'message': f'No cleaners found within {max_radius}km radius'
        })
    
    # Step 2: Extract features for ML scoring
    features = _build_features_from_params(
        latitude=latitude,
        longitude=longitude,
        property_type=property_type,
        property_size=property_size
    )
    
    # Step 3: Calculate hybrid scores (distance + quality metrics)
    # ML model requires job context, so use weighted scoring for browse mode
    ml_enabled = False
    fallback_mode = True
    cleaner_scores = {}
    
    logger.info('Location search without job context - using hybrid scoring (distance + quality)')
    
    # Get stats for all eligible cleaners
    cleaner_stats = {}
    for cleaner in eligible_cleaners:
        cleaner_stats[cleaner.id] = _get_cleaner_stats(cleaner)
    
    # Find max values for normalization
    max_jobs = max([stats['total_jobs'] for stats in cleaner_stats.values()]) or 1
    
    # Calculate hybrid scores with weighted factors
    for cleaner in eligible_cleaners:
        distance = getattr(cleaner, 'distance_miles', None)
        stats = cleaner_stats[cleaner.id]
        
        if distance is None:
            cleaner_scores[cleaner.id] = 0.5  # Default mid score
            continue
        
        # All cleaners in service range have equal geographic standing
        # Quality metrics determine the ranking
        
        # Factor 1: Rating score (60% weight) - PRIMARY FACTOR
        # Normalize rating to 0-1 scale (reviews are 1-10)
        avg_rating = stats['avg_rating']
        rating_score = min(avg_rating / 10.0, 1.0) if avg_rating > 0 else 0.5  # Default 0.5 for unrated
        
        # Factor 2: Experience score (25% weight)
        # Normalize job count (50+ jobs = full score)
        experience_score = min(stats['total_jobs'] / 50.0, 1.0)
        
        # Factor 3: Completion rate score (15% weight)
        completion_score = stats['completion_rate']
        
        # Weighted combination - Quality-first ranking
        final_score = (
            0.60 * rating_score +
            0.25 * experience_score +
            0.15 * completion_score
        )
        
        cleaner_scores[cleaner.id] = final_score
    
    # Boost scores for cleaners with history (check ALL client properties, not just selected one)
    from cleaning_jobs.models import CleaningJob
    from django.db.models import Avg, Count, Q
    from properties.models import Property
    
    # Get all properties owned by the requesting client
    client_properties = Property.objects.filter(owner=request.user)
    
    if client_properties.exists():
        for cleaner in eligible_cleaners:
            # Check if cleaner has worked at ANY of the client's properties
            previous_jobs_query = CleaningJob.objects.filter(
                property__in=client_properties,
                cleaner=cleaner,
                status='completed'
            )
            
            previous_jobs_count = previous_jobs_query.count()
            
            if previous_jobs_count > 0:
                # Significant boost for cleaners who've worked with this client before
                # 25% boost for 1 job, 30% for 2+ jobs
                history_boost = 0.25 if previous_jobs_count == 1 else 0.30
                
                # Apply boost to existing score (cap at 1.0)
                original_score = cleaner_scores.get(cleaner.id, 0.0)
                boosted_score = min(original_score + history_boost, 1.0)
                cleaner_scores[cleaner.id] = boosted_score
                
                logger.info(f'Client history boost: Cleaner {cleaner.id} has cleaned {previous_jobs_count} of client\'s properties. Score: {original_score:.2f} → {boosted_score:.2f}')
    
    
    try:
        # Still check ML service health for monitoring
        ml_client = get_ml_client()
    except MLServiceError as e:
        logger.warning(f'ML service unavailable (not used for location search): {e}')
    
    # Step 4: Build response with enriched cleaner data
    recommendations = []
    for cleaner in eligible_cleaners:
        # Get cleaner stats
        stats = _get_cleaner_stats(cleaner)
        
        # Get ML score (or fallback score)
        ml_score = cleaner_scores.get(cleaner.id, 0.0)
        
        # Serialize cleaner
        cleaner_data = UserSerializer(cleaner).data
        
        # Add service areas
        from users.serializers import ServiceAreaSerializer
        cleaner_data['service_areas'] = ServiceAreaSerializer(
            cleaner.service_areas.filter(is_active=True),
            many=True
        ).data
        
        # Build recommendation entry
        rec = {
            'cleaner': cleaner_data,
            'score': round(ml_score, 4),
            'stats': stats
        }
        
        # Add client history metadata (check ALL client properties)
        from cleaning_jobs.models import CleaningJob
        from django.db.models import Avg
        from properties.models import Property
        
        client_properties = Property.objects.filter(owner=request.user)
        
        if client_properties.exists():
            # Get all completed jobs this cleaner did for ANY of client's properties
            previous_jobs = CleaningJob.objects.filter(
                property__in=client_properties,
                cleaner=cleaner,
                status='completed'
            ).select_related('property').order_by('-scheduled_date')
            
            previous_jobs_count = previous_jobs.count()
            
            if previous_jobs_count > 0:
                rec['previous_jobs'] = previous_jobs_count
                rec['last_cleaned'] = previous_jobs.first().scheduled_date.isoformat()
                
                # Get average rating from all previous jobs with this client
                avg_rating = previous_jobs.aggregate(
                    avg_rating=Avg('client_rating')
                )['avg_rating']
                
                if avg_rating:
                    rec['previous_rating'] = round(float(avg_rating), 2)
                    
                # Add last review if available
                last_job = previous_jobs.first()
                if last_job.client_review:
                    rec['last_review'] = last_job.client_review[:150]  # Truncate for preview
                
                # Add which property they cleaned (for context)
                rec['last_property_address'] = f"{last_job.property.address_line1}, {last_job.property.city}"
        
        # Add distance if available
        if hasattr(cleaner, 'distance_miles'):
            rec['distance_km'] = round(cleaner.distance_miles, 2)
        
        recommendations.append(rec)
    
    # Step 5: Sort by ML score (descending)
    recommendations.sort(key=lambda x: x['score'], reverse=True)
    
    # Step 6: Limit to top_k
    recommendations = recommendations[:top_k]
    
    # Build response with property awareness metadata
    response_data = {
        'count': len(recommendations),
        'recommendations': recommendations,
        'ml_enabled': ml_enabled,
        'fallback_mode': fallback_mode,
        'property_aware': property_obj is not None,  # Flag for property-based search
        'search_params': {
            'latitude': latitude,
            'longitude': longitude,
            'radius_km': max_radius,
            'property_type': property_type
        }
    }
    
    # Add property details if available
    if property_obj:
        response_data['property_details'] = {
            'id': property_obj.id,
            'address': f"{property_obj.address_line1}, {property_obj.city}",
            'type': property_obj.property_type,
            'size_sqft': property_obj.size_sqft
        }
    
    return Response(response_data)


def _build_features_from_params(latitude, longitude, property_type, property_size):
    """
    Build feature vector for ML model from search parameters.
    
    Features (18 total):
    - Property type (categorical → index)
    - Property size (normalized)
    - Hour of day (default to 10am for search)
    - Day of week (default to weekday)
    - Time until job (default to 7 days)
    - Client budget (default mid-range)
    - Services count (default to 3)
    - Location coordinates
    - Dummy values for missing context
    """
    property_type_map = {
        'apartment': 0,
        'house': 1,
        'office': 2,
        'commercial': 3
    }
    
    features = [
        property_type_map.get(property_type, 0),  # property_type_idx
        float(property_size) if property_size else 80.0,  # property_size (avg apartment)
        10.0,  # hour_of_day (default 10am)
        2.0,   # day_of_week (default Tuesday)
        7.0,   # days_until_job (1 week ahead)
        150.0, # client_budget (mid-range €)
        3.0,   # num_services (typical cleaning)
        float(latitude),   # property_latitude
        float(longitude),  # property_longitude
        0.0,   # cleaner_latitude (filled by ML service)
        0.0,   # cleaner_longitude (filled by ML service)
        0.0,   # distance_km (calculated by ML service)
        0.0,   # cleaner_avg_rating (looked up by ML service)
        0.0,   # cleaner_total_jobs (looked up by ML service)
        0.0,   # cleaner_completion_rate (looked up by ML service)
        0.0,   # cleaner_avg_bid (looked up by ML service)
        0.0,   # price_match_score (calculated by ML service)
        0.0    # historical_collaboration (looked up by ML service)
    ]
    
    return features


def _get_cleaner_stats(cleaner):
    """Get performance statistics for a cleaner."""
    from cleaning_jobs.models import CleaningJob
    from reviews.models import Review
    
    completed_jobs = CleaningJob.objects.filter(
        cleaner=cleaner,
        status='completed'
    )
    
    total_jobs = completed_jobs.count()
    
    # Get average rating (reviewee is the cleaner being reviewed)
    avg_rating = Review.objects.filter(
        reviewee=cleaner
    ).aggregate(avg=Avg('overall_rating'))['avg'] or 0.0
    
    # Calculate completion rate (completed / assigned)
    assigned_jobs = CleaningJob.objects.filter(
        cleaner=cleaner,
        status__in=['confirmed', 'in_progress', 'completed']
    ).count()
    
    completion_rate = total_jobs / assigned_jobs if assigned_jobs > 0 else 0.0
    
    return {
        'avg_rating': round(avg_rating, 2),
        'total_jobs': total_jobs,
        'completion_rate': round(completion_rate, 2)
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ml_service_status(request):
    """
    Check ML service health and availability.
    
    Returns:
        {
            "available": true,
            "service_url": "http://ml-service:8001",
            "model_info": {...}
        }
    """
    ml_client = get_ml_client()
    
    try:
        # Try to get model info
        info = ml_client.get_model_info()
        
        return Response({
            'available': True,
            'service_url': ml_client.base_url,
            'model_info': info
        })
    except MLServiceError as e:
        return Response({
            'available': False,
            'service_url': ml_client.base_url,
            'error': str(e)
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_nn_recommendations(request):
    """
    Get neural network-based cleaner recommendations for a job.
    
    POST body:
        {
            "job_id": 123,
            "cleaner_ids": [1, 2, 3],  // Optional: specific cleaners to rank
            "top_k": 10,  // Optional: number of recommendations (default: 10)
            "min_score": 0.0  // Optional: minimum match score threshold (default: 0.0)
        }
    
    Returns:
        {
            "job_id": 123,
            "count": 5,
            "recommendations": [
                {
                    "cleaner_id": 45,
                    "cleaner": {...user data...},
                    "match_score": 0.87,  // 0-1 scale from neural network
                    "denormalized_rating": 9.35,  // 5-10 scale
                    "inference_time_ms": 31.2,
                    "method": "neural_network"  // or "hybrid_fallback"
                }
            ],
            "method": "neural_network",
            "cached": false,
            "processing_time_ms": 145.3
        }
    """
    import time
    from .services.nn_recommendation_engine import get_nn_recommendation_engine
    
    start_time = time.time()
    
    # Validate request data
    job_id = request.data.get('job_id')
    if not job_id:
        return Response(
            {'error': 'job_id is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get job
    try:
        job = CleaningJob.objects.get(id=job_id)
    except CleaningJob.DoesNotExist:
        return Response(
            {'error': f'Job {job_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check permissions: only job owner can get recommendations
    if job.client != request.user and not request.user.is_staff:
        return Response(
            {'error': 'You do not have permission to access this job'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Get optional parameters
    cleaner_ids = request.data.get('cleaner_ids')
    top_k = int(request.data.get('top_k', 10))
    min_score = float(request.data.get('min_score', 0.0))
    
    # Validate parameters
    if top_k < 1 or top_k > 100:
        return Response(
            {'error': 'top_k must be between 1 and 100'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if min_score < 0.0 or min_score > 1.0:
        return Response(
            {'error': 'min_score must be between 0.0 and 1.0'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get NN recommendations
    try:
        engine = get_nn_recommendation_engine(use_cache=True)
        
        recommendations = engine.get_recommendations(
            job=job,
            cleaner_ids=cleaner_ids,
            top_k=top_k,
            min_score=min_score,
            use_fallback=True
        )
        
        # Serialize cleaner data
        serialized_recommendations = []
        for rec in recommendations:
            serialized_recommendations.append({
                'cleaner_id': rec['cleaner_id'],
                'cleaner': UserSerializer(rec['cleaner']).data,
                'match_score': round(rec['match_score'], 4),
                'denormalized_rating': round(rec['denormalized_rating'], 2),
                'inference_time_ms': round(rec.get('inference_time_ms', 0), 2),
                'method': rec['method']
            })
        
        processing_time = (time.time() - start_time) * 1000
        
        # Determine if any used fallback
        methods_used = set(rec['method'] for rec in recommendations)
        primary_method = 'neural_network' if 'neural_network' in methods_used else 'hybrid_fallback'
        
        return Response({
            'job_id': job.id,
            'count': len(serialized_recommendations),
            'recommendations': serialized_recommendations,
            'method': primary_method,
            'cached': False,  # TODO: Detect if from cache
            'processing_time_ms': round(processing_time, 2)
        })
        
    except Exception as e:
        logger.error(f"NN recommendation error for job {job_id}: {str(e)}", exc_info=True)
        return Response(
            {'error': f'Failed to get recommendations: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_nn_model_info(request):
    """
    Get neural network model information.
    
    Returns:
        {
            "available": true,
            "model_info": {
                "model_name": "CleanerMatchNN",
                "architecture": [256, 128, 64, 32],
                "total_parameters": 152833,
                "num_features": 427,
                "test_r2_score": 0.9119,
                "test_mse": 0.0065,
                "test_mae": 0.0641
            }
        }
    """
    from .services.ml_client import get_nn_model_info as get_model_metadata
    
    try:
        model_info = get_model_metadata()
        
        if model_info is None:
            return Response({
                'available': False,
                'error': 'Neural network model not available'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        return Response({
            'available': True,
            'model_info': model_info
        })
        
    except Exception as e:
        logger.error(f"Failed to get NN model info: {str(e)}")
        return Response({
            'available': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
