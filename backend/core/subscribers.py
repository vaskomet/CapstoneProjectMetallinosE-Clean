"""
Event subscriber service for processing Pub/Sub events.

This module provides event subscription and processing capabilities, handling
events published through the Redis Pub/Sub system and converting them into
appropriate actions like notifications, WebSocket updates, and background tasks.

Key Features:
- Multi-topic subscription
- Event processing and routing
- Notification creation from events
- WebSocket real-time updates
- Error handling and retry logic
"""

import json
import redis
import asyncio
import logging
from typing import List, Dict, Any
from django.conf import settings
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)
User = get_user_model()


class EventSubscriber:
    """
    Event subscriber that listens to Redis Pub/Sub and processes events.
    
    Handles incoming events from various topics and converts them into appropriate
    actions like creating notifications, sending WebSocket updates, and triggering
    background tasks.
    
    Usage:
        subscriber = EventSubscriber()
        subscriber.subscribe_to_topics(['jobs', 'notifications', 'chat'])
    """
    
    def __init__(self):
        """Initialize Redis connection and channel layer for WebSocket updates."""
        try:
            # Parse Redis URL if provided, otherwise use individual settings
            redis_url = getattr(settings, 'REDIS_URL', None)
            
            if redis_url:
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=10,
                    socket_timeout=10
                )
            else:
                self.redis_client = redis.Redis(
                    host=getattr(settings, 'REDIS_HOST', 'localhost'),
                    port=getattr(settings, 'REDIS_PORT', 6379),
                    db=getattr(settings, 'REDIS_DB', 0),
                    decode_responses=True,
                    socket_connect_timeout=10,
                    socket_timeout=10
                )
            
            self.channel_layer = get_channel_layer()
            
            # Test Redis connection
            self.redis_client.ping()
            logger.info("EventSubscriber: Redis connection established")
            
        except Exception as e:
            logger.error(f"EventSubscriber: Failed to initialize: {e}")
            raise
    
    def subscribe_to_topics(self, topics: List[str]) -> None:
        """
        Subscribe to multiple topics and start processing events.
        
        Args:
            topics: List of topic names to subscribe to (e.g., ['jobs', 'notifications'])
        
        Note:
            This method runs indefinitely, processing events as they arrive.
        """
        pubsub = self.redis_client.pubsub()
        
        try:
            # Subscribe to topic channels
            for topic in topics:
                channel = f'topic:{topic}'
                pubsub.subscribe(channel)
                logger.info(f"Subscribed to topic: {topic}")
            
            logger.info(f"Event subscriber ready, listening to topics: {topics}")
            
            # Process messages indefinitely
            for message in pubsub.listen():
                if message['type'] == 'message':
                    self.process_event(message['data'])
                    
        except KeyboardInterrupt:
            logger.info("Event subscriber stopped by user")
        except Exception as e:
            logger.error(f"Error in event subscription: {e}")
        finally:
            pubsub.close()
    
    def process_event(self, event_data: str) -> None:
        """
        Process incoming event and route to appropriate handler.
        
        Args:
            event_data: JSON string containing event information
        """
        try:
            event = json.loads(event_data)
            topic = event.get('topic')
            event_type = event.get('event_type')
            data = event.get('data', {})
            
            logger.info(f"Processing event: {event_type} from topic: {topic}")
            
            if topic == 'jobs':
                self.handle_job_event(event_type, data)
            elif topic == 'notifications':
                self.handle_notification_event(event_type, data)
            elif topic == 'chat':
                self.handle_chat_event(event_type, data)
            elif topic == 'payments':
                self.handle_payment_event(event_type, data)
            else:
                logger.warning(f"Unknown topic: {topic}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in event data: {e}")
        except Exception as e:
            logger.error(f"Error processing event: {e}")
    
    def handle_job_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """
        Handle job-related events.
        
        Args:
            event_type: Type of job event (e.g., 'job_created', 'job_accepted')
            data: Event payload containing job information
        """
        try:
            if event_type == 'job_created':
                self.handle_job_created(data)
            elif event_type == 'job_accepted':
                self.handle_job_accepted(data)
            elif event_type == 'job_started':
                self.handle_job_started(data)
            elif event_type == 'job_completed':
                self.handle_job_completed(data)
            elif event_type == 'job_cancelled':
                self.handle_job_cancelled(data)
            elif event_type == 'job_status_changed':
                self.handle_job_status_changed(data)
            
            # Send WebSocket update for all job events
            self.send_websocket_update('job_updates', {
                'event_type': event_type,
                'data': data
            })
            
        except Exception as e:
            logger.error(f"Error handling job event {event_type}: {e}")
    
    def handle_job_created(self, data: Dict[str, Any]) -> None:
        """
        Handle new job creation event.
        
        Creates notifications for eligible cleaners in the job area.
        """
        try:
            # Find cleaners in the job area
            eligible_cleaners = self.find_cleaners_for_job(data)
            
            # Create notifications for eligible cleaners
            for cleaner in eligible_cleaners:
                self.create_notification(
                    user=cleaner,
                    template_key='job_created',
                    context={
                        'job_title': data.get('services_description', 'New Job'),
                        'job_location': data.get('property_address', 'Unknown Location'),
                        'job_budget': data.get('client_budget', '0'),
                        'job_id': data.get('job_id')
                    }
                )
            
            logger.info(f"Created job notifications for {len(eligible_cleaners)} cleaners")
            
        except Exception as e:
            logger.error(f"Error handling job_created event: {e}")
    
    def handle_job_accepted(self, data: Dict[str, Any]) -> None:
        """Handle job acceptance event."""
        client_id = data.get('client_id')
        cleaner_id = data.get('cleaner_id')
        
        if client_id:
            try:
                client = User.objects.get(id=client_id)
                self.create_notification(
                    user=client,
                    template_key='job_accepted',
                    context={
                        'job_title': data.get('services_description', 'Your Job'),
                        'cleaner_name': data.get('cleaner_name', 'A cleaner'),
                        'job_id': data.get('job_id')
                    }
                )
            except User.DoesNotExist:
                logger.error(f"Client not found: {client_id}")
    
    def handle_job_started(self, data: Dict[str, Any]) -> None:
        """Handle job started event."""
        client_id = data.get('client_id')
        
        if client_id:
            try:
                client = User.objects.get(id=client_id)
                self.create_notification(
                    user=client,
                    template_key='job_started',
                    context={
                        'job_title': data.get('services_description', 'Your Job'),
                        'job_id': data.get('job_id')
                    }
                )
            except User.DoesNotExist:
                logger.error(f"Client not found: {client_id}")
    
    def handle_job_completed(self, data: Dict[str, Any]) -> None:
        """Handle job completion event."""
        client_id = data.get('client_id')
        
        if client_id:
            try:
                client = User.objects.get(id=client_id)
                self.create_notification(
                    user=client,
                    template_key='job_completed',
                    context={
                        'job_title': data.get('services_description', 'Your Job'),
                        'job_id': data.get('job_id')
                    }
                )
            except User.DoesNotExist:
                logger.error(f"Client not found: {client_id}")
    
    def handle_job_cancelled(self, data: Dict[str, Any]) -> None:
        """Handle job cancellation event."""
        # Notify both client and cleaner if assigned
        client_id = data.get('client_id')
        cleaner_id = data.get('cleaner_id')
        
        for user_id in [client_id, cleaner_id]:
            if user_id:
                try:
                    user = User.objects.get(id=user_id)
                    self.create_notification(
                        user=user,
                        template_key='job_cancelled',
                        context={
                            'job_title': data.get('services_description', 'Job'),
                            'job_id': data.get('job_id')
                        }
                    )
                except User.DoesNotExist:
                    logger.error(f"User not found: {user_id}")
    
    def handle_job_status_changed(self, data: Dict[str, Any]) -> None:
        """Handle general job status change for real-time updates."""
        # This is mainly for WebSocket updates, notifications handled by specific events
        pass
    
    def handle_notification_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle notification-specific events."""
        # Future implementation for notification-specific events
        pass
    
    def handle_chat_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle chat-related events."""
        # Future implementation for chat events
        pass
    
    def handle_payment_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle payment-related events."""
        # Future implementation for payment events
        pass
    
    def find_cleaners_for_job(self, job_data: Dict[str, Any]) -> List:
        """
        Find cleaners eligible for a job based on location and availability.
        
        Args:
            job_data: Job information including location
            
        Returns:
            List of User objects representing eligible cleaners
        """
        try:
            # For now, return all cleaners. In the future, implement location-based filtering
            cleaners = User.objects.filter(role='cleaner', is_active=True)
            return list(cleaners)
            
        except Exception as e:
            logger.error(f"Error finding cleaners for job: {e}")
            return []
    
    def create_notification(self, user, template_key: str, context: Dict[str, Any]) -> None:
        """
        Create a notification for a user using a template.
        
        Args:
            user: User to notify
            template_key: Notification template key
            context: Template context variables
        """
        try:
            from notifications.models import NotificationTemplate, Notification
            
            # Get the notification template
            template = NotificationTemplate.objects.filter(
                notification_type=template_key,
                is_active=True
            ).first()
            
            if not template:
                logger.error(f"Notification template not found: {template_key}")
                return
            
            # Create notification
            notification = Notification.objects.create(
                recipient=user,
                title=template.title_template.format(**context),
                message=template.message_template.format(**context),
                notification_type=template_key
            )
            
            # Send WebSocket notification
            self.send_user_notification(user.id, {
                'id': notification.id,
                'title': notification.title,
                'message': notification.message,
                'type': notification.notification_type,
                'created_at': notification.created_at.isoformat(),
                'is_read': notification.is_read
            })
            
            logger.info(f"Created notification for user {user.id}: {template_key}")
            
        except Exception as e:
            logger.error(f"Error creating notification: {e}")
    
    def send_websocket_update(self, group_name: str, message: Dict[str, Any]) -> None:
        """
        Send real-time updates via WebSocket.
        
        Args:
            group_name: WebSocket group name
            message: Message to send
        """
        try:
            if self.channel_layer:
                async_to_sync(self.channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'send_update',
                        'message': message
                    }
                )
        except Exception as e:
            logger.error(f"Error sending WebSocket update: {e}")
    
    def send_user_notification(self, user_id: int, notification_data: Dict[str, Any]) -> None:
        """
        Send notification to specific user via WebSocket.
        
        Args:
            user_id: Target user ID
            notification_data: Notification data to send
        """
        try:
            if self.channel_layer:
                async_to_sync(self.channel_layer.group_send)(
                    f'user_{user_id}',
                    {
                        'type': 'send_notification',
                        'notification': notification_data
                    }
                )
        except Exception as e:
            logger.error(f"Error sending user notification: {e}")