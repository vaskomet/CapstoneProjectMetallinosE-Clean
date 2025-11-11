"""
CleaningJob and JobBid serializers for Django REST Framework API interactions.
Supports bidding system, job lifecycle management, scheduling, and eco-metrics tracking.
"""

from datetime import date
from rest_framework import serializers
from .models import CleaningJob, JobBid, JobPhoto
from users.models import User
from users.serializers import UserSerializer


class JobPhotoSerializer(serializers.ModelSerializer):
    """
    Serializer for JobPhoto model - handles before/after photo uploads.
    """
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = JobPhoto
        fields = [
            'id',
            'job',
            'photo_type',
            'image',
            'image_url',
            'description',
            'uploaded_at'
        ]
        read_only_fields = ['id', 'uploaded_at']
    
    def get_image_url(self, obj):
        """Return full URL for the image"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class JobBidSerializer(serializers.ModelSerializer):
    """
    Serializer for JobBid model - handles cleaner bids on jobs.
    """
    cleaner = UserSerializer(read_only=True)
    cleaner_stats = serializers.SerializerMethodField()
    
    class Meta:
        model = JobBid
        fields = [
            'id',
            'job',
            'cleaner',
            'cleaner_stats',
            'bid_amount',
            'estimated_duration',
            'message',
            'status',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['cleaner', 'created_at', 'updated_at']
    
    def get_cleaner_stats(self, obj):
        """
        Get cleaner statistics for bid comparison.
        
        Returns:
            dict: Contains average rating, review count, and verification status.
        """
        from django.db.models import Avg, Count
        
        # Check if reviews model is available
        try:
            from reviews.models import Review
            
            # Get reviews for this cleaner
            reviews = Review.objects.filter(reviewee=obj.cleaner)
            if not reviews.exists():
                return {
                    'avg_rating': None,
                    'review_count': 0,
                    'is_verified': getattr(obj.cleaner, 'is_verified_cleaner', False),
                    'jobs_completed': 0,
                }
            
            # Calculate review statistics
            stats = reviews.aggregate(
                avg_rating=Avg('overall_rating'),
                review_count=Count('id')
            )
            
            # Count completed jobs
            from .models import CleaningJob
            completed_jobs = CleaningJob.objects.filter(
                cleaner=obj.cleaner,
                status='completed'
            ).count()
            
            return {
                'avg_rating': round(stats['avg_rating'], 1) if stats['avg_rating'] else None,
                'review_count': stats['review_count'],
                'is_verified': getattr(obj.cleaner, 'is_verified_cleaner', False),
                'jobs_completed': completed_jobs,
            }
        except ImportError:
            # Reviews model not available, return minimal data
            from .models import CleaningJob
            completed_jobs = CleaningJob.objects.filter(
                cleaner=obj.cleaner,
                status='completed'
            ).count()
            
            return {
                'avg_rating': None,
                'review_count': 0,
                'is_verified': getattr(obj.cleaner, 'is_verified_cleaner', False),
                'jobs_completed': completed_jobs,
            }


class CleaningJobSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for CleaningJob model with nested property details and bids.
    Used for displaying job information with complete context including bidding info.
    """
    # Client and cleaner displayed with user details
    client = UserSerializer(read_only=True)
    cleaner = UserSerializer(read_only=True)
    
    # Property field with depth=1 includes basic property details like address
    property = serializers.SerializerMethodField()
    
    # Include bids for this job
    bids = JobBidSerializer(many=True, read_only=True)
    
    # Accepted bid details
    accepted_bid = JobBidSerializer(read_only=True)
    
    # Photo relationships
    before_photos = serializers.SerializerMethodField()
    after_photos = serializers.SerializerMethodField()
    
    # Payment information
    payment_info = serializers.SerializerMethodField()
    
    # Bid statistics (count, average, min, max)
    bid_stats = serializers.SerializerMethodField()
    
    # Search result highlighting (only populated when search is active)
    highlighted_description = serializers.SerializerMethodField()
    highlighted_address = serializers.SerializerMethodField()
    highlighted_city = serializers.SerializerMethodField()
    highlighted_notes = serializers.SerializerMethodField()
    
    # Eco-impact metrics managed by views or Celery tasks
    eco_impact_metrics = serializers.JSONField(read_only=True)

    class Meta:
        model = CleaningJob
        fields = [
            'id',
            'client', 
            'cleaner', 
            'property', 
            'status', 
            'scheduled_date', 
            'start_time', 
            'end_time',
            'actual_start_time',
            'actual_end_time',
            'services_description',
            'client_budget',
            'final_price',
            'checklist', 
            'notes', 
            'bids',
            'accepted_bid',
            'before_photos',
            'after_photos',
            'payment_info',
            'bid_stats',
            'highlighted_description',
            'highlighted_address',
            'highlighted_city',
            'highlighted_notes',
            'cleaner_confirmed_at',
            'client_review',
            'client_rating',
            'eco_impact_metrics',
            'created_at',
            'updated_at'
        ]
        # Read-only fields (e.g., eco_impact_metrics) managed by views or Celery tasks, per CompatibilitySpecifics.rtf
    
    def get_property(self, obj):
        """
        Custom property serialization to include address details.
        Returns property info needed for booking display and map integration.
        """
        if obj.property:
            return {
                'id': obj.property.id,
                'address': obj.property.address_line1,
                'city': obj.property.city,
                'state': obj.property.state,
                'zip_code': obj.property.postal_code,
                'property_type': obj.property.property_type,
                'size_sqft': obj.property.size_sqft
            }
        return None
    
    def get_before_photos(self, obj):
        """Get all before photos for this job"""
        before_photos = obj.photos.filter(photo_type='before')
        return JobPhotoSerializer(before_photos, many=True, context=self.context).data
    
    def get_after_photos(self, obj):
        """Get all after photos for this job"""
        after_photos = obj.photos.filter(photo_type='after')
        return JobPhotoSerializer(after_photos, many=True, context=self.context).data
    
    def get_payment_info(self, obj):
        """
        Get payment information for this job.
        Returns payment status, amount, and method details if payment exists.
        """
        try:
            # Get the latest payment for this job
            payment = obj.payments.order_by('-created_at').first()
            if payment:
                return {
                    'id': payment.id,
                    'status': payment.status,
                    'amount': str(payment.amount),
                    'platform_fee': str(payment.platform_fee),
                    'cleaner_payout': str(payment.cleaner_payout),
                    'payment_method': {
                        'type': payment.payment_method_type,
                        'brand': payment.payment_method_brand,
                        'last4': payment.payment_method_last4,
                    } if payment.payment_method_type else None,
                    'paid_at': payment.paid_at.isoformat() if payment.paid_at else None,
                    'created_at': payment.created_at.isoformat(),
                }
            return None
        except Exception as e:
            # Log error but don't fail the serialization
            print(f"Error getting payment info for job {obj.id}: {e}")
            return None
    
    def get_bid_stats(self, obj):
        """
        Calculate statistics for pending bids on this job.
        
        Returns:
            dict: Contains count, average, lowest, and highest bid amounts.
                  Returns None if no pending bids exist.
        """
        from django.db.models import Avg, Min, Max, Count
        
        # Only calculate stats for pending bids
        bids = obj.bids.filter(status='pending')
        if not bids.exists():
            return None
        
        # Aggregate bid statistics
        stats = bids.aggregate(
            count=Count('id'),
            avg_bid=Avg('bid_amount'),
            lowest_bid=Min('bid_amount'),
            highest_bid=Max('bid_amount')
        )
        
        return {
            'count': stats['count'],
            'average': float(stats['avg_bid']) if stats['avg_bid'] else None,
            'lowest': float(stats['lowest_bid']) if stats['lowest_bid'] else None,
            'highest': float(stats['highest_bid']) if stats['highest_bid'] else None,
        }
    
    def get_highlighted_description(self, obj):
        """Get highlighted search results for services_description field"""
        return getattr(obj, 'highlighted_description', None)
    
    def get_highlighted_address(self, obj):
        """Get highlighted search results for address field"""
        return getattr(obj, 'highlighted_address', None)
    
    def get_highlighted_city(self, obj):
        """Get highlighted search results for city field"""
        return getattr(obj, 'highlighted_city', None)
    
    def get_highlighted_notes(self, obj):
        """Get highlighted search results for notes field"""
        return getattr(obj, 'highlighted_notes', None)


class CleaningJobCreateSerializer(serializers.ModelSerializer):
    """
    Writable serializer for creating new CleaningJob instances with bidding system.
    Clients post jobs with descriptions and budgets, cleaners can then bid.
    """
    
    # Checklist validation to ensure non-empty list when provided
    checklist = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True
    )

    class Meta:
        model = CleaningJob
        fields = [
            'property',
            'scheduled_date',
            'start_time',
            'end_time',
            'services_description',
            'client_budget',
            'checklist',
            'notes'
        ]

    def validate_scheduled_date(self, value):
        """
        Validate ensures future bookings only.
        """
        if value < date.today():
            raise serializers.ValidationError(
                "Scheduled date cannot be in the past."
            )
        return value
    
    def validate_checklist(self, value):
        """
        Checklist validation to ensure meaningful task list.
        """
        if value:
            for item in value:
                if not item.strip():
                    raise serializers.ValidationError(
                        "Checklist items cannot be empty."
                    )
        return value
    
    def validate_client_budget(self, value):
        """
        Ensure budget is positive.
        """
        if value <= 0:
            raise serializers.ValidationError(
                "Budget must be greater than zero."
            )
        return value

    def create(self, validated_data):
        """
        Create method sets initial state for bidding.
        - Sets status to 'open_for_bids' for new jobs
        - Assigns client from request.user context
        """        
        # Create CleaningJob instance with initial status for bidding
        cleaning_job = CleaningJob.objects.create(
            **validated_data,
            status='open_for_bids',  # Initial state for bidding
            client=self.context['request'].user,  # Assign from authenticated user
        )
        
        return cleaning_job


class JobBidCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new job bids.
    """
    
    class Meta:
        model = JobBid
        fields = [
            'job',
            'bid_amount',
            'estimated_duration',
            'message'
        ]
    
    def validate_bid_amount(self, value):
        """
        Ensure bid amount is positive.
        """
        if value <= 0:
            raise serializers.ValidationError(
                "Bid amount must be greater than zero."
            )
        return value
    
    def create(self, validated_data):
        """
        Create bid with cleaner from request context.
        """
        return JobBid.objects.create(
            **validated_data,
            cleaner=self.context['request'].user
        )


# Test serializers with sample data in Django shell:
# from cleaning_jobs.serializers import CleaningJobCreateSerializer
# data = {
#     'property': 1,
#     'scheduled_date': '2025-10-02',
#     'start_time': '09:00:00',
#     'services_requested': [1],
#     'checklist': ['kitchen', 'bathroom'],
#     'notes': 'Use eco-friendly products'
# }
# serializer = CleaningJobCreateSerializer(data=data)
# if serializer.is_valid():
#     job = serializer.save()
#     print(f"Created job: {job}")
# else:
#     print(f"Validation errors: {serializer.errors}")