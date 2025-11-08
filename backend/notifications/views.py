from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Notification, NotificationPreference
from .serializers import (
    NotificationSerializer, NotificationPreferenceSerializer,
    CreateNotificationSerializer, BulkNotificationSerializer
)
from .utils import create_and_send_notification


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing notifications
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        return Notification.objects.filter(recipient=user).order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Get unread notifications"""
        notifications = self.get_queryset().filter(is_read=False)
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get unread notification count"""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'notification marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        notifications = self.get_queryset().filter(is_read=False)
        count = notifications.count()
        notifications.update(is_read=True)
        return Response({'marked_count': count})
    
    @action(detail=False, methods=['post'])
    def send_notification(self, request):
        """Send a new notification (admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = CreateNotificationSerializer(
            data=request.data,
            context={'sender': request.user}
        )
        
        if serializer.is_valid():
            notification = serializer.save()
            response_serializer = NotificationSerializer(notification)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def send_bulk(self, request):
        """Send bulk notifications (admin only)"""
        if not request.user.is_staff:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = BulkNotificationSerializer(data=request.data)
        
        if serializer.is_valid():
            data = serializer.validated_data
            notifications_created = []
            
            for recipient_id in data['recipient_ids']:
                try:
                    from users.models import User
                    recipient = User.objects.get(id=recipient_id)
                    
                    notification = create_and_send_notification(
                        recipient=recipient,
                        notification_type=data['notification_type'],
                        title=data['title'],
                        message=data['message'],
                        sender=request.user,
                        priority=data['priority'],
                        action_url=data.get('action_url'),
                        metadata=data.get('metadata', {})
                    )
                    notifications_created.append(notification.id)
                except User.DoesNotExist:
                    continue
            
            return Response({
                'notifications_sent': len(notifications_created),
                'notification_ids': notifications_created
            })
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing notification preferences
    """
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)
    
    def get_object(self):
        """Get or create notification preferences for the user"""
        preferences, created = NotificationPreference.objects.get_or_create(
            user=self.request.user
        )
        return preferences
    
    def create(self, request, *args, **kwargs):
        """Override create to ensure only one preference per user"""
        preferences = self.get_object()
        serializer = self.get_serializer(preferences, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
