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
    
    class Meta:
        model = JobBid
        fields = [
            'id',
            'job',
            'cleaner',
            'bid_amount',
            'estimated_duration',
            'message',
            'status',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['cleaner', 'created_at', 'updated_at']


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