from django.db import models
from users.models import User
from properties.models import Property, ServiceType
import os
from django.utils import timezone


def job_photo_upload_path(instance, filename):
    """Generate upload path for job photos: jobs/{job_id}/{before|after}/{filename}"""
    return f'jobs/{instance.job.id}/{instance.photo_type}/{filename}'


class JobPhoto(models.Model):
    """
    JobPhoto model for storing before/after photos with proper file management.
    Provides safety documentation and quality assurance.
    """
    PHOTO_TYPE_CHOICES = [
        ('before', 'Before Photo'),
        ('after', 'After Photo'),
    ]
    
    job = models.ForeignKey(
        'CleaningJob',
        on_delete=models.CASCADE,
        related_name='photos'
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
        help_text="Optional description of what the photo shows"
    )
    
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['job', 'photo_type']),
        ]
    
    def __str__(self):
        return f"{self.photo_type.title()} photo for Job #{self.job.id}"

class JobBid(models.Model):
    """
    JobBid model allows cleaners to submit competitive offers on cleaning jobs.
    Clients can review and accept the best bid.
    """
    BID_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
    ]
    
    id = models.AutoField(primary_key=True)
    
    # The job being bid on
    job = models.ForeignKey(
        'CleaningJob',
        on_delete=models.CASCADE,
        related_name='bids'
    )
    
    # The cleaner submitting the bid
    cleaner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='submitted_bids'
    )
    
    # Bid details
    bid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Cleaner's proposed price for the job"
    )
    
    estimated_duration = models.DurationField(
        help_text="Estimated time to complete the job"
    )
    
    message = models.TextField(
        blank=True,
        help_text="Optional message from cleaner to client"
    )
    
    # Bid status
    status = models.CharField(
        max_length=20,
        choices=BID_STATUS_CHOICES,
        default='pending'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        # Prevent duplicate bids from same cleaner on same job
        unique_together = ['job', 'cleaner']
        indexes = [
            models.Index(fields=['job', 'status']),
            models.Index(fields=['cleaner', 'status']),
        ]
    
    def __str__(self):
        return f"Bid by {self.cleaner.username} on Job #{self.job.id} - ${self.bid_amount}"


class CleaningJob(models.Model):
    """
    CleaningJob model manages the lifecycle of cleaning jobs from booking to completion.
    Supports scheduling, checklists, eco-metrics, and real-time status updates.
    """
    STATUS_CHOICES = [
        ('open_for_bids', 'Open for Bids'),
        ('bid_accepted', 'Bid Accepted - Awaiting Cleaner Confirmation'),
        ('confirmed', 'Confirmed by Cleaner'),
        ('ready_to_start', 'Ready to Start (30min window)'),
        ('in_progress', 'In Progress'),
        ('awaiting_review', 'Awaiting Client Review'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.AutoField(primary_key=True)
    
    # Client field limited to clients via role check in future views
    client = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='client_jobs'
    )
    
    # Cleaner field limited to cleaners via role check in future views
    cleaner = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='cleaner_jobs'
    )
    
    property = models.ForeignKey(Property, on_delete=models.CASCADE)
    
    # Status field drives job lifecycle transitions
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='open_for_bids'
    )
    
    # Scheduling fields for FullCalendar.js integration
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)  # For estimated completion
    
    # Client-defined services and pricing
    services_description = models.TextField(
        default="General cleaning services",
        help_text="Description of services needed (e.g., 'Deep clean 3-bedroom house, kitchen, 2 bathrooms')"
    )
    client_budget = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=0.00,
        help_text="Client's budget for this job"
    )
    
    # Checklist for customizable tasks (e.g., ['kitchen', 'bathroom'])
    checklist = models.JSONField(default=list, blank=True)
    
    # Final agreed price after bid acceptance
    final_price = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        null=True,
        blank=True,
        help_text="Final agreed price after bid acceptance"
    )
    
    # Track which bid was accepted
    accepted_bid = models.ForeignKey(
        'JobBid',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accepted_job'
    )
    
    # Discount for promo logic
    discount_applied = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0.00
    )
    
    # Notes for real-time updates and communication
    notes = models.TextField(blank=True)
    
    # Eco-impact metrics for tracking (e.g., {'water_saved_liters': 50, 'chemicals_avoided_kg': 1.0})
    eco_impact_metrics = models.JSONField(default=dict, blank=True)
    
    # Enhanced job tracking fields for safety and accountability
    actual_start_time = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When cleaner actually started the job"
    )
    actual_end_time = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When cleaner actually finished the job"
    )
    
    # Photo documentation handled by JobPhoto model relationship
    # Access via: job.photos.filter(photo_type='before') or job.photos.filter(photo_type='after')
    
    # Cleaner confirmation timestamp
    cleaner_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When cleaner confirmed the accepted bid"
    )
    
    # Client review and rating
    client_review = models.TextField(
        blank=True,
        help_text="Client's review of the completed job"
    )
    client_rating = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Client rating from 1-5 stars"
    )
    
    # Future field placeholder
    # recurring_frequency = models.CharField(max_length=20, blank=True)  # To be added for subscription bookings in Phase 4
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['scheduled_date']),
            models.Index(fields=['client', 'cleaner']),  # Composite index for history/earnings queries
        ]
        # Indexes optimize FullCalendar.js scheduling and Celery task queries, per CompatibilitySpecifics.rtf

    def __str__(self):
        return f"Job #{self.id} - {self.property} ({self.status})"
    
    def can_start_job(self):
        """
        Check if the job can be started based on timing constraints.
        Job can be started 30 minutes before scheduled time.
        """
        from django.utils import timezone
        from datetime import datetime, timedelta
        
        if not self.scheduled_date or not self.start_time:
            return False, "Job has no scheduled date/time"
        
        # Combine scheduled date and time
        scheduled_datetime = datetime.combine(self.scheduled_date, self.start_time)
        scheduled_datetime = timezone.make_aware(scheduled_datetime)
        
        # Current time
        now = timezone.now()
        
        # Allow starting 30 minutes before scheduled time
        earliest_start = scheduled_datetime - timedelta(minutes=30)
        
        # Don't allow starting more than 2 hours after scheduled time
        latest_start = scheduled_datetime + timedelta(hours=2)
        
        if now < earliest_start:
            time_diff = earliest_start - now
            minutes_until = int(time_diff.total_seconds() / 60)
            return False, f"Job can be started in {minutes_until} minutes (30 min before scheduled time)"
        
        if now > latest_start:
            return False, "Job start window has expired (more than 2 hours past scheduled time)"
        
        return True, "Job can be started now"
    
    def is_ready_to_start_window(self):
        """
        Check if we're in the 30-minute window before job start time.
        This determines when status should change to 'ready_to_start'.
        """
        can_start, _ = self.can_start_job()
        return can_start
    
    def get_next_allowed_status(self):
        """
        Get the next allowed status based on current status and timing constraints.
        """
        status_transitions = {
            'open_for_bids': ['bid_accepted', 'cancelled'],
            'bid_accepted': ['confirmed', 'cancelled'],
            'confirmed': ['ready_to_start', 'cancelled'],
            'ready_to_start': ['in_progress', 'cancelled'],
            'in_progress': ['awaiting_review'],
            'awaiting_review': ['completed'],
            'completed': [],
            'cancelled': []
        }
        
        allowed = status_transitions.get(self.status, [])
        
        # Add timing constraints for starting job
        if self.status == 'confirmed':
            can_start, _ = self.can_start_job()
            if can_start:
                allowed = ['ready_to_start', 'cancelled']
            else:
                allowed = ['cancelled']  # Can only cancel if not in start window
        
        return allowed

# Run python manage.py makemigrations after adding 'cleaning_jobs' to INSTALLED_APPS.
