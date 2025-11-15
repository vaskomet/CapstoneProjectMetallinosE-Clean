from rest_framework import serializers
from .models import Notification, NotificationPreference, NotificationTemplate
from users.serializers import UserSerializer


class NotificationSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    time_ago = serializers.SerializerMethodField()
    content_object_data = serializers.SerializerMethodField()
    job = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'sender', 'notification_type',
            'title', 'message', 'priority', 'is_read', 'is_delivered',
            'created_at', 'read_at', 'delivered_at', 'expires_at',
            'action_url', 'metadata', 'time_ago', 'content_object_data', 'job'
        ]
        read_only_fields = [
            'created_at', 'read_at', 'delivered_at', 'is_delivered'
        ]
    
    def get_time_ago(self, obj):
        """Human readable time since creation"""
        from django.utils import timezone
        from datetime import timedelta
        
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff < timedelta(minutes=1):
            return "Just now"
        elif diff < timedelta(hours=1):
            return f"{diff.seconds // 60} minutes ago"
        elif diff < timedelta(days=1):
            return f"{diff.seconds // 3600} hours ago"
        elif diff < timedelta(days=7):
            return f"{diff.days} days ago"
        else:
            return obj.created_at.strftime("%b %d, %Y")
    
    def get_content_object_data(self, obj):
        """Get basic data about the related object"""
        if obj.content_object:
            if hasattr(obj.content_object, 'id'):
                return {
                    'type': obj.content_type.model,
                    'id': obj.object_id,
                    'str': str(obj.content_object)
                }
        return None
    
    def get_job(self, obj):
        """Get job ID if this notification is related to a CleaningJob"""
        if obj.content_object and obj.content_type.model == 'cleaningjob':
            return obj.object_id
        return None


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'email_job_updates', 'email_messages', 'email_marketing',
            'push_job_updates', 'push_messages', 'push_reminders',
            'inapp_all', 'quiet_hours_enabled', 'quiet_hours_start',
            'quiet_hours_end', 'updated_at'
        ]


class NotificationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationTemplate
        fields = [
            'id', 'name', 'notification_type', 'title_template',
            'message_template', 'default_priority', 'is_active'
        ]


class CreateNotificationSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications"""
    
    class Meta:
        model = Notification
        fields = [
            'recipient', 'notification_type', 'title', 'message',
            'priority', 'action_url', 'metadata', 'expires_at'
        ]
    
    def create(self, validated_data):
        validated_data['sender'] = self.context.get('sender')
        return super().create(validated_data)


class BulkNotificationSerializer(serializers.Serializer):
    """Serializer for sending bulk notifications"""
    recipient_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    notification_type = serializers.ChoiceField(choices=Notification.NOTIFICATION_TYPES)
    title = serializers.CharField(max_length=255)
    message = serializers.CharField()
    priority = serializers.ChoiceField(
        choices=Notification.PRIORITY_LEVELS,
        default='medium'
    )
    action_url = serializers.URLField(required=False)
    metadata = serializers.JSONField(required=False, default=dict)