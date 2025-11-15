"""
Job Lifecycle Management Models

This app handles the enhanced workflow for cleaning jobs including:
- Photo documentation (before/after)
- Job lifecycle event tracking
- Real-time notifications
- Cleaner workflow actions (confirm, start, finish)

Separated from cleaning_jobs app for better modularity and future extensibility.
"""

from django.db import models
from django.utils import timezone
from cleaning_jobs.models import CleaningJob
from users.models import User
import os


def job_photo_upload_path(instance, filename):
    """Generate upload path for job photos: job_photos/{job_id}/{before|after}/{timestamp}_{filename}"""
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    return f'job_photos/{instance.job.id}/{instance.photo_type}/{timestamp}_{filename}'


class JobPhoto(models.Model):
    """
    Photo documentation for cleaning jobs.
    Provides safety documentation and quality assurance for both cleaners and clients.
    """
    PHOTO_TYPE_CHOICES = [
        ('before', 'Before Photo'),
        ('after', 'After Photo'),
        ('progress', 'Progress Photo'),  # Optional mid-job updates
    ]
    
    job = models.ForeignKey(
        CleaningJob,
        on_delete=models.CASCADE,
        related_name='lifecycle_photos'
    )
    
    photo_type = models.CharField(
        max_length=10,
        choices=PHOTO_TYPE_CHOICES
    )
    
    image = models.ImageField(
        upload_to=job_photo_upload_path,
        help_text="Photo taken by cleaner for documentation"
    )
    
    description = models.CharField(
        max_length=200,
        blank=True,
        help_text="Optional description of what the photo shows (e.g., 'Kitchen before cleaning')"
    )
    
    # Metadata for safety and verification
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        help_text="Cleaner who uploaded the photo"
    )
    
    location_verified = models.BooleanField(
        default=False,
        help_text="Whether photo was taken at job location (future GPS verification)"
    )
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['job', 'photo_type']),
            models.Index(fields=['uploaded_at']),
        ]
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return f"{self.photo_type.title()} photo for Job #{self.job.id} by {self.uploaded_by}"


class JobLifecycleEvent(models.Model):
    """
    Track all status changes and important events in the job lifecycle.
    Provides audit trail and helps with analytics and dispute resolution.
    """
    EVENT_TYPE_CHOICES = [
        ('status_change', 'Status Change'),
        ('bid_accepted', 'Bid Accepted'),
        ('cleaner_confirmed', 'Cleaner Confirmed'),
        ('job_started', 'Job Started'),
        ('job_finished', 'Job Finished'),
        ('client_reviewed', 'Client Reviewed'),
        ('photo_uploaded', 'Photo Uploaded'),
        ('note_added', 'Note Added'),
    ]
    
    job = models.ForeignKey(
        CleaningJob,
        on_delete=models.CASCADE,
        related_name='lifecycle_events'
    )
    
    event_type = models.CharField(
        max_length=20,
        choices=EVENT_TYPE_CHOICES
    )
    
    # Who triggered this event
    triggered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        help_text="User who triggered this event (client, cleaner, or system)"
    )
    
    # Event details
    old_status = models.CharField(
        max_length=20,
        blank=True,
        help_text="Previous status before this event"
    )
    
    new_status = models.CharField(
        max_length=20,
        blank=True,
        help_text="New status after this event"
    )
    
    description = models.TextField(
        blank=True,
        help_text="Detailed description of what happened"
    )
    
    # Additional metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional event data (e.g., GPS coordinates, photo IDs, etc.)"
    )
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['job', 'event_type']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"Job #{self.job.id}: {self.event_type} by {self.triggered_by} at {self.timestamp}"


# JobNotification model REMOVED - consolidated with generic notifications system
# 
# Migration: All 28 JobNotification records migrated to notifications.Notification
# Migration file: 0003_migrate_notifications_to_generic.py
# Date: November 14, 2025
#
# Use notifications.utils.create_and_send_notification() instead:
#
#   from notifications.utils import create_and_send_notification
#   
#   create_and_send_notification(
#       recipient=user,
#       notification_type='job_started',
#       title="Job Started",
#       message="Your job has started...",
#       priority='high',
#       content_object=job,  # Links to CleaningJob via ContentType
#       action_url=f"/jobs/{job.id}",
#       metadata={'job_status': job.status}
#   )
#
# Benefits of consolidation:
# - All notifications in one place (complete history for users)
# - Additional features: priority, delivery tracking, expiration, templates
# - Generic system works with ANY model via ContentType framework
# - Eliminates code duplication and maintenance burden


class JobAction(models.Model):
    """
    Track specific actions that cleaners can perform on jobs.
    Provides structured workflow for job progression.
    """
    ACTION_TYPE_CHOICES = [
        ('confirm_bid', 'Confirm Accepted Bid'),
        ('start_job', 'Start Job'),
        ('finish_job', 'Finish Job'),
        ('accept_completion', 'Accept Job Completion'),  # Client accepts finished work
        ('reject_completion', 'Reject Job Completion'),  # Client rejects finished work
        ('upload_photos', 'Upload Photos'),
        ('add_note', 'Add Note'),
    ]
    
    job = models.ForeignKey(
        CleaningJob,
        on_delete=models.CASCADE,
        related_name='actions'
    )
    
    action_type = models.CharField(
        max_length=20,
        choices=ACTION_TYPE_CHOICES
    )
    
    # Action details
    performed_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text="User who performed this action"
    )
    
    notes = models.TextField(
        blank=True,
        help_text="Optional notes from the cleaner"
    )
    
    # Location data for verification (future enhancement)
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="GPS latitude when action was performed"
    )
    
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="GPS longitude when action was performed"
    )
    
    performed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['job', 'action_type']),
            models.Index(fields=['performed_at']),
        ]
        ordering = ['-performed_at']
    
    def __str__(self):
        return f"Job #{self.job.id}: {self.action_type} by {self.performed_by.username}"
