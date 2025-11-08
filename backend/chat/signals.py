"""
Signals for chat messages

Handles notification creation when messages are sent.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import Message
from core.events import event_publisher
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Message)
def message_post_save(sender, instance, created, **kwargs):
    """
    Signal handler for Message post_save.
    
    Publishes event and creates notification when a message is sent.
    """
    if created:
        # Only process after transaction commits
        transaction.on_commit(lambda: _handle_message_created(instance))


def _handle_message_created(message):
    """Handle message creation - notify the recipient."""
    try:
        # Get the room to find the recipient
        room = message.room
        
        # Determine recipient (the other person in the conversation)
        if room.room_type == 'direct':
            # For direct messages, notify the other participant
            participants = room.participants.exclude(id=message.sender.id)
            
            for recipient in participants:
                # Prepare message data
                sender_name = message.sender.get_full_name() or message.sender.email
                
                event_data = {
                    'message_id': message.id,
                    'room_id': room.id,
                    'sender_id': message.sender.id,
                    'sender_name': sender_name,
                    'recipient_id': recipient.id,
                    'content_preview': message.content[:50] + '...' if len(message.content) > 50 else message.content,
                }
                
                # Publish event for notification creation
                event_publisher.publish_event(
                    topic='chat',
                    event_type='message_received',
                    data=event_data
                )
                
                logger.info(f"Published message_received event for message {message.id} to user {recipient.id}")
        
        elif room.room_type == 'job':
            # For job chats, notify all participants except sender
            participants = room.participants.exclude(id=message.sender.id)
            
            for recipient in participants:
                sender_name = message.sender.get_full_name() or message.sender.email
                
                event_data = {
                    'message_id': message.id,
                    'room_id': room.id,
                    'job_id': room.job.id if room.job else None,
                    'sender_id': message.sender.id,
                    'sender_name': sender_name,
                    'recipient_id': recipient.id,
                    'content_preview': message.content[:50] + '...' if len(message.content) > 50 else message.content,
                }
                
                event_publisher.publish_event(
                    topic='chat',
                    event_type='message_received',
                    data=event_data
                )
                
                logger.info(f"Published message_received event for job chat message {message.id} to user {recipient.id}")
                
    except Exception as e:
        logger.error(f"Error handling message creation for message {message.id}: {e}")
