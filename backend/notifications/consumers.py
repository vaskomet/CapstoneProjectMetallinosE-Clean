import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Notification
from .serializers import NotificationSerializer

User = get_user_model()


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time notifications
    """
    
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.user = self.scope['user']
        
        # Check authentication and authorization
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # Check if user can access these notifications
        if str(self.user.id) != str(self.user_id) and not self.user.is_staff:
            await self.close()
            return
        
        self.notification_group_name = f'notifications_{self.user_id}'
        
        # Join notification group
        await self.channel_layer.group_add(
            self.notification_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send recent unread notifications on connect
        await self.send_recent_notifications()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'notification_group_name'):
            # Leave notification group
            await self.channel_layer.group_discard(
                self.notification_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get('action')
            
            if action == 'mark_read':
                await self.mark_notification_read(data.get('notification_id'))
            elif action == 'mark_all_read':
                await self.mark_all_notifications_read()
            elif action == 'get_unread_count':
                await self.send_unread_count()
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
    
    async def send_recent_notifications(self):
        """Send recent unread notifications on connection"""
        notifications = await self.get_recent_notifications()
        if notifications:
            await self.send(text_data=json.dumps({
                'type': 'recent_notifications',
                'notifications': notifications
            }))
    
    async def send_unread_count(self):
        """Send current unread notification count"""
        count = await self.get_unread_count()
        await self.send(text_data=json.dumps({
            'type': 'unread_count',
            'count': count
        }))
    
    async def mark_notification_read(self, notification_id):
        """Mark a specific notification as read"""
        if notification_id:
            success = await self.mark_notification_as_read(notification_id)
            if success:
                await self.send(text_data=json.dumps({
                    'type': 'notification_read',
                    'notification_id': notification_id
                }))
                # Send updated unread count
                await self.send_unread_count()
    
    async def mark_all_notifications_read(self):
        """Mark all notifications as read for this user"""
        count = await self.mark_all_as_read()
        await self.send(text_data=json.dumps({
            'type': 'all_notifications_read',
            'marked_count': count
        }))
        await self.send_unread_count()
    
    # WebSocket event handlers
    async def notification_message(self, event):
        """Send notification to WebSocket"""
        notification_data = event['notification']
        
        # Mark as delivered
        await self.mark_notification_delivered(notification_data.get('id'))
        
        await self.send(text_data=json.dumps({
            'type': 'new_notification',
            'notification': notification_data
        }))
        
        # Send updated unread count
        await self.send_unread_count()
    
    async def notification_update(self, event):
        """Send notification update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'notification_update',
            'notification_id': event['notification_id'],
            'updates': event['updates']
        }))
    
    async def bulk_notification(self, event):
        """Handle bulk notification"""
        await self.send(text_data=json.dumps({
            'type': 'bulk_notification',
            'notifications': event['notifications']
        }))
        await self.send_unread_count()
    
    # Database operations
    @database_sync_to_async
    def get_recent_notifications(self, limit=10):
        """Get recent unread notifications"""
        try:
            notifications = Notification.objects.filter(
                recipient_id=self.user_id,
                is_read=False
            ).order_by('-created_at')[:limit]
            
            serializer = NotificationSerializer(notifications, many=True)
            return serializer.data
        except Exception as e:
            print(f"Error getting recent notifications: {e}")
            return []
    
    @database_sync_to_async
    def get_unread_count(self):
        """Get unread notification count"""
        try:
            return Notification.objects.filter(
                recipient_id=self.user_id,
                is_read=False
            ).count()
        except Exception as e:
            print(f"Error getting unread count: {e}")
            return 0
    
    @database_sync_to_async
    def mark_notification_as_read(self, notification_id):
        """Mark specific notification as read"""
        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient_id=self.user_id
            )
            notification.mark_as_read()
            return True
        except Notification.DoesNotExist:
            return False
    
    @database_sync_to_async
    def mark_all_as_read(self):
        """Mark all notifications as read for user"""
        try:
            notifications = Notification.objects.filter(
                recipient_id=self.user_id,
                is_read=False
            )
            count = notifications.count()
            notifications.update(is_read=True)
            return count
        except Exception as e:
            print(f"Error marking all as read: {e}")
            return 0
    
    @database_sync_to_async
    def mark_notification_delivered(self, notification_id):
        """Mark notification as delivered"""
        try:
            notification = Notification.objects.get(
                id=notification_id,
                recipient_id=self.user_id
            )
            notification.mark_as_delivered()
        except Notification.DoesNotExist:
            pass


# Utility function to send notifications via WebSocket
@database_sync_to_async
def send_notification_to_user(user_id, notification_data):
    """Send notification to specific user via WebSocket"""
    from channels.layers import get_channel_layer
    import asyncio
    
    channel_layer = get_channel_layer()
    group_name = f'notifications_{user_id}'
    
    asyncio.create_task(
        channel_layer.group_send(
            group_name,
            {
                'type': 'notification_message',
                'notification': notification_data
            }
        )
    )


# Utility function to create and send notification
def create_and_send_notification(recipient, notification_type, title, message, 
                                sender=None, content_object=None, priority='medium',
                                action_url=None, metadata=None):
    """Create notification and send via WebSocket"""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    
    # Create notification
    notification = Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notification_type=notification_type,
        title=title,
        message=message,
        priority=priority,
        content_object=content_object,
        action_url=action_url,
        metadata=metadata or {}
    )
    
    # Serialize notification
    serializer = NotificationSerializer(notification)
    notification_data = serializer.data
    
    # Send via WebSocket
    channel_layer = get_channel_layer()
    group_name = f'notifications_{recipient.id}'
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'notification_message',
            'notification': notification_data
        }
    )
    
    return notification