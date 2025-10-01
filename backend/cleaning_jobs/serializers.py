"""
CleaningJob serializers for Django REST Framework API interactions.
Supports booking lifecycle management, scheduling, and eco-metrics tracking.
"""

from datetime import date
from rest_framework import serializers
from .models import CleaningJob
from properties.models import ServiceType
from users.models import User


class CleaningJobSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for CleaningJob model with nested property details.
    Used for displaying job information with complete context.
    """
    # Client and cleaner displayed as email for clear identification
    client = serializers.StringRelatedField(read_only=True)
    cleaner = serializers.StringRelatedField(read_only=True)
    
    # Property field with depth=1 includes basic property details like address
    # Enables frontend to display location without additional API calls
    property = serializers.SerializerMethodField()
    
    # Services requested links to ServiceType for package selection display
    services_requested = serializers.StringRelatedField(many=True, read_only=True)
    
    # Eco-impact metrics managed by views or Celery tasks, per CompatibilitySpecifics.rtf
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
            'services_requested', 
            'checklist', 
            'total_cost', 
            'discount_applied', 
            'notes', 
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


class CleaningJobCreateSerializer(serializers.ModelSerializer):
    """
    Writable serializer for creating new CleaningJob instances.
    Handles validation, initial state setup, and pricing calculation.
    
    Usage example:
    serializer = CleaningJobCreateSerializer(data={
        'property': 1,
        'scheduled_date': '2025-10-02',
        'start_time': '09:00:00',
        'services_requested': [1, 2],
        'checklist': ['kitchen', 'bathroom'],
        'notes': 'Please use eco-friendly products'
    })
    """
    
    # Services requested as list of ServiceType IDs for flexible package selection
    services_requested = serializers.PrimaryKeyRelatedField(
        queryset=ServiceType.objects.all(),
        many=True,
        required=True
    )
    
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
            'services_requested',
            'checklist',
            'notes',
            'discount_applied'
        ]
        # Excludes read-only fields (status, total_cost, eco_impact_metrics) set by views

    def validate_scheduled_date(self, value):
        """
        Validate ensures future bookings only.
        Prevents scheduling jobs in the past.
        """
        if value < date.today():
            raise serializers.ValidationError(
                "Scheduled date cannot be in the past."
            )
        return value
    
    def validate_checklist(self, value):
        """
        Checklist validation to ensure meaningful task list.
        Each item should be a non-empty string.
        """
        if value:
            for item in value:
                if not item.strip():
                    raise serializers.ValidationError(
                        "Checklist items cannot be empty."
                    )
        return value
    
    def validate_services_requested(self, value):
        """
        Validate that at least one service is requested.
        Services requested links to ServiceType for package selection.
        """
        if not value:
            raise serializers.ValidationError(
                "At least one service must be requested."
            )
        return value

    def create(self, validated_data):
        """
        Create method sets initial state and pricing.
        - Sets status to 'pending' for new bookings
        - Assigns client from request.user context
        - Calculates total_cost based on services_requested
        """
        # Extract services_requested for separate handling due to ManyToMany
        services_requested = validated_data.pop('services_requested', [])
        
        # Create CleaningJob instance with initial status
        cleaning_job = CleaningJob.objects.create(
            **validated_data,
            status='pending',  # Initial state for new bookings
            client=self.context['request'].user,  # Assign from authenticated user
            total_cost=0.00  # Will be calculated below
        )
        
        # Set services_requested many-to-many relationship
        cleaning_job.services_requested.set(services_requested)
        
        # Calculate total_cost based on services_requested pricing
        total_cost = sum(service.base_price for service in services_requested)
        cleaning_job.total_cost = total_cost
        cleaning_job.save()
        
        return cleaning_job


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