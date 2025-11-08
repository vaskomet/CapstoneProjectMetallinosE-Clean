"""
Core event publishing service for Pub/Sub messaging architecture.

This module provides centralized event publishing capabilities using Redis Pub/Sub,
enabling decoupled communication between different parts of the application.

Key Features:
- Topic-based event routing
- User-specific event targeting
- Error handling and logging
- Event payload standardization
"""

import json
import redis
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class EventPublisher:
    """
    Centralized event publisher for Pub/Sub messaging.
    
    Provides methods to publish events to Redis Pub/Sub channels with topic-based
    routing and user-specific targeting capabilities.
    
    Usage:
        publisher = EventPublisher()
        publisher.publish_event(
            topic='jobs',
            event_type='job_created',
            data={'job_id': 123, 'title': 'House Cleaning'},
            user_id=456
        )
    """
    
    def __init__(self):
        """Initialize without connecting to Redis. Connection happens on first use."""
        self.redis_client = None
        self._initialized = False
    
    def _ensure_connection(self):
        """Ensure Redis connection is established."""
        if self._initialized:
            return
            
        try:
            # Parse Redis URL if provided, otherwise use individual settings
            redis_url = getattr(settings, 'REDIS_URL', None)
            
            if redis_url:
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            else:
                self.redis_client = redis.Redis(
                    host=getattr(settings, 'REDIS_HOST', 'localhost'),
                    port=getattr(settings, 'REDIS_PORT', 6379),
                    db=getattr(settings, 'REDIS_DB', 0),
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            
            # Test connection
            self.redis_client.ping()
            self._initialized = True
            logger.info("EventPublisher: Redis connection established")
            
        except Exception as e:
            logger.error(f"EventPublisher: Failed to connect to Redis: {e}")
            # Don't raise exception during Django startup
            self.redis_client = None
    
    def publish_event(
        self, 
        topic: str, 
        event_type: str, 
        data: Dict[str, Any], 
        user_id: Optional[int] = None,
        target_users: Optional[list] = None
    ) -> bool:
        """
        Publish event to Redis Pub/Sub channels.
        
        Args:
            topic: Event topic (e.g., 'jobs', 'notifications', 'payments')
            event_type: Specific event type (e.g., 'job_created', 'payment_processed')
            data: Event payload dictionary
            user_id: Optional user ID for user-specific events
            target_users: Optional list of user IDs to target specifically
            
        Returns:
            bool: True if event was published successfully, False otherwise
        """
        self._ensure_connection()
        
        if not self.redis_client:
            logger.error("Redis connection not available, cannot publish event")
            return False
        
        event_message = {
            'topic': topic,
            'event_type': event_type,
            'data': data,
            'user_id': user_id,
            'target_users': target_users,
            'timestamp': timezone.now().isoformat(),
            'event_id': self._generate_event_id()
        }
        
        try:
            message_json = json.dumps(event_message)
            
            # Publish to topic-specific channel
            topic_channel = f'topic:{topic}'
            subscribers = self.redis_client.publish(topic_channel, message_json)
            
            # Publish to user-specific channels if specified
            if user_id:
                user_channel = f'user:{user_id}'
                self.redis_client.publish(user_channel, message_json)
            
            # Publish to multiple specific users if specified
            if target_users:
                for uid in target_users:
                    user_channel = f'user:{uid}'
                    self.redis_client.publish(user_channel, message_json)
            
            logger.info(
                f"Published event '{event_type}' to topic '{topic}' "
                f"(subscribers: {subscribers}, user_id: {user_id})"
            )
            
            return True
            
        except redis.RedisError as e:
            logger.error(f"Redis error publishing event {event_type}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to publish event {event_type}: {e}")
            return False
    
    def publish_job_event(self, event_type: str, job_data: Dict[str, Any]) -> bool:
        """
        Convenience method for publishing job-related events.
        
        Args:
            event_type: Job event type (e.g., 'job_created', 'job_accepted')
            job_data: Job-related data
            
        Returns:
            bool: True if published successfully
        """
        return self.publish_event(
            topic='jobs',
            event_type=event_type,
            data=job_data,
            user_id=job_data.get('client_id')
        )
    
    def publish_notification_event(
        self, 
        event_type: str, 
        notification_data: Dict[str, Any], 
        target_users: list
    ) -> bool:
        """
        Convenience method for publishing notification events.
        
        Args:
            event_type: Notification event type
            notification_data: Notification payload
            target_users: List of user IDs to notify
            
        Returns:
            bool: True if published successfully
        """
        return self.publish_event(
            topic='notifications',
            event_type=event_type,
            data=notification_data,
            target_users=target_users
        )
    
    def publish_chat_event(
        self, 
        event_type: str, 
        message_data: Dict[str, Any], 
        room_id: str
    ) -> bool:
        """
        Convenience method for publishing chat-related events.
        
        Args:
            event_type: Chat event type (e.g., 'message_sent', 'user_typing')
            message_data: Message payload
            room_id: Chat room identifier
            
        Returns:
            bool: True if published successfully
        """
        return self.publish_event(
            topic='chat',
            event_type=event_type,
            data={**message_data, 'room_id': room_id}
        )
    
    def _generate_event_id(self) -> str:
        """Generate unique event ID for tracking."""
        return f"evt_{int(timezone.now().timestamp() * 1000000)}"
    
    def health_check(self) -> bool:
        """
        Check if Redis connection is healthy.
        
        Returns:
            bool: True if connection is healthy
        """
        try:
            self._ensure_connection()
            if self.redis_client:
                self.redis_client.ping()
                return True
            return False
        except Exception:
            return False


# Global event publisher instance
event_publisher = EventPublisher()


def publish_event(topic: str, event_type: str, data: Dict[str, Any], **kwargs) -> bool:
    """
    Global function for publishing events using the singleton publisher.
    
    Args:
        topic: Event topic
        event_type: Event type
        data: Event data
        **kwargs: Additional arguments (user_id, target_users, etc.)
        
    Returns:
        bool: True if published successfully
    """
    return event_publisher.publish_event(topic, event_type, data, **kwargs)