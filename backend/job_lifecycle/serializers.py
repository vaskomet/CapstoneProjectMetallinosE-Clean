"""
Job Lifecycle Serializers

Handles serialization for the enhanced job workflow including:
- Photo uploads with proper validation
- Lifecycle event tracking
- Action management
"""

from rest_framework import serializers
from .models import JobPhoto, JobLifecycleEvent, JobAction
from cleaning_jobs.models import CleaningJob
from users.serializers import UserSerializer


class JobPhotoSerializer(serializers.ModelSerializer):
    """
    Serializer for JobPhoto model - handles before/after/progress photo uploads.
    Includes validation for image files and metadata.
    """
    uploaded_by = UserSerializer(read_only=True)
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
            'uploaded_by',
            'location_verified',
            'uploaded_at'
        ]
        read_only_fields = ['id', 'uploaded_by', 'location_verified', 'uploaded_at']
    
    def get_image_url(self, obj):
        """Return full URL for the image"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
    
    def validate_image(self, value):
        """Validate image file size and format"""
        # Max file size: 10MB
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("Image file too large. Maximum size is 10MB.")
        
        # Allowed formats
        allowed_formats = ['JPEG', 'JPG', 'PNG', 'WEBP']
        if hasattr(value, 'image'):
            if value.image.format not in allowed_formats:
                raise serializers.ValidationError(f"Unsupported image format. Allowed: {', '.join(allowed_formats)}")
        
        return value


class JobLifecycleEventSerializer(serializers.ModelSerializer):
    """
    Serializer for JobLifecycleEvent model - tracks job status changes and events.
    Provides audit trail for job progression.
    """
    triggered_by = UserSerializer(read_only=True)
    
    class Meta:
        model = JobLifecycleEvent
        fields = [
            'id',
            'job',
            'event_type',
            'triggered_by',
            'old_status',
            'new_status',
            'description',
            'metadata',
            'timestamp'
        ]
        read_only_fields = ['id', 'triggered_by', 'timestamp']


# JobNotificationSerializer REMOVED - consolidated with generic notifications system
#
# Use notifications.serializers.NotificationSerializer instead
# Migration date: November 14, 2025


class JobActionSerializer(serializers.ModelSerializer):
    """
    Serializer for JobAction model - handles cleaner workflow actions.
    """
    performed_by = UserSerializer(read_only=True)
    
    class Meta:
        model = JobAction
        fields = [
            'id',
            'job',
            'action_type',
            'performed_by',
            'notes',
            'latitude',
            'longitude',
            'performed_at'
        ]
        read_only_fields = ['id', 'performed_by', 'performed_at']


class JobWorkflowSerializer(serializers.Serializer):
    """
    Combined serializer for job workflow operations.
    Handles complex actions like starting/finishing jobs with photos and notes.
    """
    action_type = serializers.ChoiceField(choices=JobAction.ACTION_TYPE_CHOICES)
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    photos = JobPhotoSerializer(many=True, required=False)
    
    # GPS coordinates for verification
    latitude = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=7, required=False)
    
    def validate(self, data):
        """Validate workflow action requirements"""
        action_type = data.get('action_type')
        
        # Photo validation will be handled in the view after parsing form data
        # This allows for more flexible photo handling via multipart form data
        
        return data


class JobStatusUpdateSerializer(serializers.Serializer):
    """
    Serializer for updating job status with proper workflow validation.
    """
    new_status = serializers.ChoiceField(choices=CleaningJob.STATUS_CHOICES)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True)
    
    def validate_new_status(self, value):
        """Validate status transition is allowed"""
        job = self.context.get('job')
        if not job:
            raise serializers.ValidationError("Job context is required for status validation.")
        
        current_status = job.status
        
        # Define allowed status transitions
        allowed_transitions = {
            'open_for_bids': ['bid_accepted', 'cancelled'],
            'bid_accepted': ['confirmed', 'cancelled'],
            'confirmed': ['ready_to_start', 'cancelled'],
            'ready_to_start': ['in_progress', 'cancelled'],
            'in_progress': ['awaiting_review'],
            'awaiting_review': ['completed'],
            'completed': [],  # Final status
            'cancelled': []   # Final status
        }
        
        if value not in allowed_transitions.get(current_status, []):
            raise serializers.ValidationError(
                f"Cannot transition from '{current_status}' to '{value}'. "
                f"Allowed transitions: {allowed_transitions.get(current_status, [])}"
            )
        
        return value