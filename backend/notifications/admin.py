from django.contrib import admin
from django.utils.html import format_html
from .models import Notification, NotificationPreference, NotificationTemplate


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin interface for Notification model"""
    list_display = ('title', 'recipient', 'notification_type', 'priority_display', 'is_read', 'is_delivered', 'created_at')
    list_filter = ('notification_type', 'priority', 'is_read', 'is_delivered', 'created_at')
    search_fields = ('title', 'message', 'recipient__username', 'sender__username')
    readonly_fields = ('created_at', 'delivered_at', 'read_at', 'content_object')
    date_hierarchy = 'created_at'
    actions = ['mark_as_read', 'mark_as_delivered']
    
    fieldsets = (
        ('Notification Details', {
            'fields': ('recipient', 'sender', 'notification_type', 'title', 'message', 'priority')
        }),
        ('Content Reference', {
            'fields': ('content_type', 'object_id', 'content_object'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('is_read', 'is_delivered', 'read_at', 'delivered_at')
        }),
        ('Metadata', {
            'fields': ('action_url', 'expires_at', 'metadata', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def priority_display(self, obj):
        colors = {
            'low': '#10B981',
            'medium': '#F59E0B', 
            'high': '#EF4444',
            'urgent': '#DC2626'
        }
        color = colors.get(obj.priority, '#6B7280')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, 
            obj.get_priority_display()
        )
    priority_display.short_description = 'Priority'
    
    def mark_as_read(self, request, queryset):
        for notification in queryset.filter(is_read=False):
            notification.mark_as_read()
        self.message_user(request, f'{queryset.count()} notifications marked as read.')
    mark_as_read.short_description = 'Mark selected notifications as read'
    
    def mark_as_delivered(self, request, queryset):
        for notification in queryset.filter(is_delivered=False):
            notification.mark_as_delivered()
        self.message_user(request, f'{queryset.count()} notifications marked as delivered.')
    mark_as_delivered.short_description = 'Mark selected notifications as delivered'


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    """Admin interface for NotificationPreference model"""
    list_display = ('user', 'email_job_updates', 'push_job_updates', 'quiet_hours_enabled', 'updated_at')
    list_filter = ('email_job_updates', 'push_job_updates', 'quiet_hours_enabled', 'updated_at')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Email Notifications', {
            'fields': ('email_job_updates', 'email_messages', 'email_marketing')
        }),
        ('Push Notifications', {
            'fields': ('push_job_updates', 'push_messages', 'push_reminders')
        }),
        ('In-App Notifications', {
            'fields': ('inapp_all',)
        }),
        ('Quiet Hours', {
            'fields': ('quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    """Admin interface for NotificationTemplate model"""
    list_display = ('name', 'notification_type', 'default_priority', 'is_active', 'updated_at')
    list_filter = ('notification_type', 'default_priority', 'is_active', 'updated_at')
    search_fields = ('name', 'title_template', 'message_template')
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        ('Template Info', {
            'fields': ('name', 'notification_type', 'default_priority', 'is_active')
        }),
        ('Template Content', {
            'fields': ('title_template', 'message_template'),
            'description': 'Use {variable_name} for dynamic content'
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
