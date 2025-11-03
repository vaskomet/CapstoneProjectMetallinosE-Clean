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
                # For Pub/Sub, we need longer timeouts since listen() blocks indefinitely
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=10,
                    socket_timeout=None,  # No timeout for blocking Pub/Sub operations
                    socket_keepalive=True  # Keep connection alive
                )
            else:
                self.redis_client = redis.Redis(
                    host=getattr(settings, 'REDIS_HOST', 'localhost'),
                    port=getattr(settings, 'REDIS_PORT', 6379),
                    db=getattr(settings, 'REDIS_DB', 0),
                    decode_responses=True,
                    socket_connect_timeout=10,
                    socket_timeout=None,  # No timeout for blocking Pub/Sub operations
                    socket_keepalive=True  # Keep connection alive
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
            Includes automatic reconnection on connection loss.
        """
        retry_count = 0
        max_retries = 5
        retry_delay = 5  # seconds
        
        while retry_count < max_retries:
            pubsub = None
            try:
                # Create new pubsub instance
                pubsub = self.redis_client.pubsub(ignore_subscribe_messages=True)
                
                # Subscribe to topic channels
                for topic in topics:
                    channel = f'topic:{topic}'
                    pubsub.subscribe(channel)
                    logger.info(f"Subscribed to topic: {topic}")
                
                logger.info(f"Event subscriber ready, listening to topics: {topics}")
                
                # Reset retry count on successful connection
                retry_count = 0
                
                # Process messages indefinitely
                for message in pubsub.listen():
                    if message['type'] == 'message':
                        try:
                            self.process_event(message['data'])
                        except Exception as e:
                            logger.error(f"Error processing message: {e}", exc_info=True)
                            # Continue processing other messages even if one fails
                            
            except KeyboardInterrupt:
                logger.info("Event subscriber stopped by user")
                break
                
            except redis.ConnectionError as e:
                retry_count += 1
                logger.error(f"Redis connection lost (attempt {retry_count}/{max_retries}): {e}")
                
                if retry_count < max_retries:
                    logger.info(f"Reconnecting in {retry_delay} seconds...")
                    import time
                    time.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, 60)  # Exponential backoff, max 60s
                else:
                    logger.error("Max reconnection attempts reached, giving up")
                    raise
                    
            except Exception as e:
                logger.error(f"Error in event subscription: {e}", exc_info=True)
                retry_count += 1
                
                if retry_count < max_retries:
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    import time
                    time.sleep(retry_delay)
                else:
                    raise
                    
            finally:
                if pubsub:
                    try:
                        pubsub.close()
                        logger.info("Pubsub connection closed")
                    except Exception as e:
                        logger.error(f"Error closing pubsub: {e}")
    
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
            elif event_type == 'bid_received':
                self.handle_bid_received(data)
            elif event_type == 'bid_accepted':
                self.handle_bid_accepted_notification(data)
            elif event_type == 'bid_rejected':
                self.handle_bid_rejected(data)
            
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
    
    def handle_bid_received(self, data: Dict[str, Any]) -> None:
        """Handle bid received event - notify the job owner (client)."""
        client_id = data.get('client_id')
        
        if client_id:
            try:
                client = User.objects.get(id=client_id)
                self.create_notification(
                    user=client,
                    template_key='bid_received',
                    context={
                        'job_title': data.get('job_title', 'Your Job'),
                        'cleaner_name': data.get('cleaner_name', 'A cleaner'),
                        'bid_amount': data.get('bid_amount', '0'),
                        'job_id': data.get('job_id')
                    }
                )
                logger.info(f"Created bid_received notification for client {client_id}")
            except User.DoesNotExist:
                logger.error(f"Client not found: {client_id}")
    
    def handle_bid_accepted_notification(self, data: Dict[str, Any]) -> None:
        """Handle bid accepted event - notify the cleaner."""
        cleaner_id = data.get('cleaner_id')
        
        if cleaner_id:
            try:
                cleaner = User.objects.get(id=cleaner_id)
                self.create_notification(
                    user=cleaner,
                    template_key='bid_accepted',
                    context={
                        'job_title': data.get('job_title', 'Job'),
                        'client_name': data.get('client_name', 'Client'),
                        'bid_amount': data.get('bid_amount', '0'),
                        'job_id': data.get('job_id')
                    }
                )
                logger.info(f"Created bid_accepted notification for cleaner {cleaner_id}")
            except User.DoesNotExist:
                logger.error(f"Cleaner not found: {cleaner_id}")
    
    def handle_bid_rejected(self, data: Dict[str, Any]) -> None:
        """Handle bid rejected event - notify the cleaner."""
        cleaner_id = data.get('cleaner_id')
        
        if cleaner_id:
            try:
                cleaner = User.objects.get(id=cleaner_id)
                self.create_notification(
                    user=cleaner,
                    template_key='bid_rejected',
                    context={
                        'job_title': data.get('job_title', 'Job'),
                        'job_id': data.get('job_id')
                    }
                )
                logger.info(f"Created bid_rejected notification for cleaner {cleaner_id}")
            except User.DoesNotExist:
                logger.error(f"Cleaner not found: {cleaner_id}")
    
    def handle_notification_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle notification-specific events."""
        # Future implementation for notification-specific events
        pass
    
    def handle_chat_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Handle chat-related events."""
        try:
            if event_type == 'message_received':
                self.handle_message_received(data)
        except Exception as e:
            logger.error(f"Error handling chat event {event_type}: {e}")
    
    def handle_message_received(self, data: Dict[str, Any]) -> None:
        """Handle new message event - notify the recipient."""
        recipient_id = data.get('recipient_id')
        
        if recipient_id:
            try:
                recipient = User.objects.get(id=recipient_id)
                self.create_notification(
                    user=recipient,
                    template_key='message_received',
                    context={
                        'sender_name': data.get('sender_name', 'Someone'),
                        'content_preview': data.get('content_preview', 'New message'),
                        'room_id': data.get('room_id'),
                        'message_id': data.get('message_id')
                    }
                )
                logger.info(f"Created message_received notification for user {recipient_id}")
            except User.DoesNotExist:
                logger.error(f"Recipient not found: {recipient_id}")
    
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
                group_name = f'notifications_{user_id}'
                async_to_sync(self.channel_layer.group_send)(
                    group_name,
                    {
                        'type': 'notification_message',
                        'notification': notification_data
                    }
                )
                logger.info(f"Sent WebSocket notification to group: {group_name}")
        except Exception as e:
            logger.error(f"Error sending user notification: {e}")