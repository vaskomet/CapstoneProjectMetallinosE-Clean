from django.db import models
from users.models import User
from properties.models import Property, ServiceType

class CleaningJob(models.Model):
    """
    CleaningJob model manages the lifecycle of cleaning jobs from booking to completion.
    Supports scheduling, checklists, eco-metrics, and real-time status updates.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('in_progress', 'In Progress'),
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
        default='pending'
    )
    
    # Scheduling fields for FullCalendar.js integration
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)  # For estimated completion
    
    # Services requested for this job
    services_requested = models.ManyToManyField(ServiceType, blank=True)
    
    # Checklist for customizable tasks (e.g., ['kitchen', 'bathroom'])
    checklist = models.JSONField(default=list, blank=True)
    
    # Pricing fields - total_cost calculated via views
    total_cost = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0.00
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

# Run python manage.py makemigrations after adding 'cleaning_jobs' to INSTALLED_APPS.
