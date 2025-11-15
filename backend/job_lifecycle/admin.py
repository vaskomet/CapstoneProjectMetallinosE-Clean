from django.contrib import admin
from .models import JobPhoto, JobLifecycleEvent, JobAction

@admin.register(JobPhoto)
class JobPhotoAdmin(admin.ModelAdmin):
    """
    JobPhoto admin interface.
    """
    list_display = ('job', 'photo_type', 'uploaded_by', 'description', 'uploaded_at')
    list_filter = ('photo_type', 'uploaded_at')
    search_fields = ('job__id', 'uploaded_by__username', 'description')
    date_hierarchy = 'uploaded_at'

@admin.register(JobLifecycleEvent)
class JobLifecycleEventAdmin(admin.ModelAdmin):
    """
    JobLifecycleEvent admin interface.
    """
    list_display = ('job', 'event_type', 'triggered_by', 'old_status', 'new_status', 'timestamp')
    list_filter = ('event_type', 'timestamp')
    search_fields = ('job__id', 'triggered_by__username', 'description')
    date_hierarchy = 'timestamp'

# JobNotificationAdmin REMOVED - consolidated with generic notifications system
# Use notifications.admin.NotificationAdmin instead
# Migration date: November 14, 2025

@admin.register(JobAction)
class JobActionAdmin(admin.ModelAdmin):
    """
    JobAction admin interface.
    """
    list_display = ('job', 'action_type', 'performed_by', 'performed_at')
    list_filter = ('action_type', 'performed_at')
    search_fields = ('job__id', 'performed_by__username', 'notes')
    date_hierarchy = 'performed_at'
