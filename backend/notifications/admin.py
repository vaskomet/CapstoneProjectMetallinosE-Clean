from django.contrib import admin
from .models import Notification, NotificationTemplate, NotificationPreference

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'title', 'notification_type', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('recipient__email', 'title', 'message')
    date_hierarchy = 'created_at'

@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'notification_type', 'is_active', 'created_at')
    list_filter = ('notification_type', 'is_active', 'created_at')
    search_fields = ('name', 'title_template', 'message_template')

@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'email_job_updates', 'push_job_updates', 'quiet_hours_enabled', 'updated_at')
    list_filter = ('email_job_updates', 'push_job_updates', 'quiet_hours_enabled', 'updated_at')
    search_fields = ('user__email',)
