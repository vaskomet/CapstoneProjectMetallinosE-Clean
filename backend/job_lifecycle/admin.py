"""
Job Lifecycle Admin Configuration

Django admin interface for managing job lifecycle components.
"""

from django.contrib import admin
from .models import JobPhoto, JobLifecycleEvent, JobNotification, JobAction


@admin.register(JobPhoto)
class JobPhotoAdmin(admin.ModelAdmin):
    """Admin interface for JobPhoto model"""
    list_display = ('job', 'photo_type', 'uploaded_by', 'description', 'uploaded_at')
    list_filter = ('photo_type', 'location_verified', 'uploaded_at')
    search_fields = ('job__id', 'uploaded_by__username', 'description')
    readonly_fields = ('uploaded_at',)
    
    fieldsets = (
        ('Photo Information', {
            'fields': ('job', 'photo_type', 'image', 'description')
        }),
        ('Metadata', {
            'fields': ('uploaded_by', 'location_verified', 'uploaded_at')
        }),
    )


@admin.register(JobLifecycleEvent)
class JobLifecycleEventAdmin(admin.ModelAdmin):
    """Admin interface for JobLifecycleEvent model"""
    list_display = ('job', 'event_type', 'triggered_by', 'old_status', 'new_status', 'timestamp')
    list_filter = ('event_type', 'timestamp')
    search_fields = ('job__id', 'triggered_by__username', 'description')
    readonly_fields = ('timestamp',)
    
    fieldsets = (
        ('Event Information', {
            'fields': ('job', 'event_type', 'triggered_by')
        }),
        ('Status Change', {
            'fields': ('old_status', 'new_status', 'description')
        }),
        ('Additional Data', {
            'fields': ('metadata', 'timestamp')
        }),
    )


@admin.register(JobNotification)
class JobNotificationAdmin(admin.ModelAdmin):
    """Admin interface for JobNotification model"""
    list_display = ('job', 'recipient', 'notification_type', 'title', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('job__id', 'recipient__username', 'title', 'message')
    readonly_fields = ('created_at', 'read_at')
    
    fieldsets = (
        ('Notification Details', {
            'fields': ('job', 'recipient', 'notification_type', 'title', 'message')
        }),
        ('Status', {
            'fields': ('is_read', 'read_at', 'action_url')
        }),
        ('Timestamps', {
            'fields': ('created_at',)
        }),
    )
    
    actions = ['mark_as_read', 'mark_as_unread']
    
    def mark_as_read(self, request, queryset):
        """Mark selected notifications as read"""
        updated = queryset.update(is_read=True)
        self.message_user(request, f'{updated} notifications marked as read.')
    mark_as_read.short_description = "Mark selected notifications as read"
    
    def mark_as_unread(self, request, queryset):
        """Mark selected notifications as unread"""
        updated = queryset.update(is_read=False, read_at=None)
        self.message_user(request, f'{updated} notifications marked as unread.')
    mark_as_unread.short_description = "Mark selected notifications as unread"


@admin.register(JobAction)
class JobActionAdmin(admin.ModelAdmin):
    """Admin interface for JobAction model"""
    list_display = ('job', 'action_type', 'performed_by', 'performed_at')
    list_filter = ('action_type', 'performed_at')
    search_fields = ('job__id', 'performed_by__username', 'notes')
    readonly_fields = ('performed_at',)
    
    fieldsets = (
        ('Action Information', {
            'fields': ('job', 'action_type', 'performed_by', 'notes')
        }),
        ('Location Data', {
            'fields': ('latitude', 'longitude'),
            'description': 'GPS coordinates when action was performed (for verification)'
        }),
        ('Timestamp', {
            'fields': ('performed_at',)
        }),
    )
