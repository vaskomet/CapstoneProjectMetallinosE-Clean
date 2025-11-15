"""
Chat utility functions for sending messages programmatically
"""

import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from .models import ChatRoom, Message, ChatParticipant
from chat.serializers import MessageSerializer

logger = logging.getLogger(__name__)


def send_system_message(sender, recipient, message_content, job=None):
    """
    Send a system message as a direct message from one user to another.
    This is used for automated messages like job rejection notifications.
    
    Args:
        sender: User instance (the person the message is from)
        recipient: User instance (the person to receive the message)
        message_content: String - the message text
        job: Optional CleaningJob instance - if provided, includes context
        
    Returns:
        Message instance that was created
    """
    try:
        # Get or create direct message room
        room, created = ChatRoom.get_or_create_direct_room(sender, recipient)
        
        if created:
            logger.info(f"Created new DM room between {sender.username} and {recipient.username}")
        
        # Create the message
        message = Message.objects.create(
            room=room,
            sender=sender,
            message_type='system',
            content=message_content,
            timestamp=timezone.now()
        )
        
        # Update room's last message
        room.update_last_message(message)
        
        # Increment unread count for recipient
        try:
            participant, _ = ChatParticipant.objects.get_or_create(
                room=room,
                user=recipient
            )
            participant.increment_unread()
            logger.info(f"📊 Incremented unread count for {recipient.username}")
        except Exception as e:
            logger.error(f"Failed to increment unread count: {e}")
        
        # Send via WebSocket to chat room
        channel_layer = get_channel_layer()
        
        # Serialize the message
        serializer = MessageSerializer(message)
        message_data = serializer.data
        
        # Send to the room's group
        group_name = f'chat_room_{room.id}'
        
        logger.info(f"📨 Sending system message to room {room.id}: {message_content[:50]}...")
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'chat_message',
                'message': message_data,
                'room_id': room.id
            }
        )
        
        # Send notification to recipient
        try:
            from notifications.utils import send_message_notification
            job_id = job.id if job else 0
            send_message_notification(
                recipient=recipient,
                sender=sender,
                job_id=job_id,
                message_preview=message_content
            )
            logger.info(f"📬 Sent notification to {recipient.username}")
        except Exception as e:
            logger.error(f"Failed to send message notification: {e}")
        
        logger.info(f"✅ System message sent successfully")
        
        return message
        
    except Exception as e:
        logger.error(f"❌ Failed to send system message: {e}", exc_info=True)
        raise
