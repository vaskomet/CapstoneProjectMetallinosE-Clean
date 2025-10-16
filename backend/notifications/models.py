from django.db import models
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


class Notification(models.Model):
    """
    Real-time notifications for users
    """
    NOTIFICATION_TYPES = (
        ('job_created', 'New Job Available'),
        ('job_accepted', 'Job Accepted'),
        ('job_started', 'Job Started'),
        ('job_completed', 'Job Completed'),
        ('job_cancelled', 'Job Cancelled'),
        ('payment_received', 'Payment Received'),
        ('message_received', 'New Message'),
        ('system_alert', 'System Alert'),
        ('reminder', 'Reminder'),
    )
    
    PRIORITY_LEVELS = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    )
    
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications'
    )
    
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_LEVELS, default='medium')
    
    # Generic relation to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Status fields
    is_read = models.BooleanField(default=False)
    is_delivered = models.BooleanField(default=False)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    action_url = models.URLField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.title} -> {self.recipient.username}"
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = models.timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
    
    def mark_as_delivered(self):
        """Mark notification as delivered"""
        if not self.is_delivered:
            self.is_delivered = True
            self.delivered_at = models.timezone.now()
            self.save(update_fields=['is_delivered', 'delivered_at'])


class NotificationPreference(models.Model):
    """
    User preferences for notifications
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )
    
    # Email notifications
    email_job_updates = models.BooleanField(default=True)
    email_messages = models.BooleanField(default=True)
    email_marketing = models.BooleanField(default=False)
    
    # Push notifications
    push_job_updates = models.BooleanField(default=True)
    push_messages = models.BooleanField(default=True)
    push_reminders = models.BooleanField(default=True)
    
    # In-app notifications
    inapp_all = models.BooleanField(default=True)
    
    # Quiet hours
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Notification preferences for {self.user.username}"


class NotificationTemplate(models.Model):
    """
    Templates for different notification types
    """
    name = models.CharField(max_length=100, unique=True)
    notification_type = models.CharField(max_length=20, choices=Notification.NOTIFICATION_TYPES)
    title_template = models.CharField(max_length=255)
    message_template = models.TextField()
    default_priority = models.CharField(max_length=10, choices=Notification.PRIORITY_LEVELS, default='medium')
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Template: {self.name}"
    
    def render(self, context):
        """Render template with context variables"""
        title = self.title_template.format(**context)
        message = self.message_template.format(**context)
        return title, message
