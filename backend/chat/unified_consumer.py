"""
Unified Chat Consumer - Simplified Pub/Sub WebSocket

This consumer implements a clean pub/sub architecture for real-time chat:

- Single persistent connection per user
- Multiplexed message routing (one connection handles multiple rooms)
- Pure pub/sub pattern: send → save → broadcast (no optimistic UI support)
- WebSocket is single source of truth
- Minimal logging (errors only)

Architecture:
- User connects once: ws/chat/
- Sends typed messages: {"type": "subscribe_room", "room_id": 1}
- Receives typed responses: {"type": "new_message", "room_id": 1, "message": {...}}
- Automatically joins/leaves room groups based on subscriptions

Message Types (Client → Server):
- subscribe_room: Join a room and receive real-time updates
- unsubscribe_room: Leave a room
- send_message: Send a message to a room
- mark_read: Mark messages as read
- typing: Send typing indicator
- stop_typing: Stop typing indicator
- get_room_list: Request list of user's rooms

Message Types (Server → Client):
- room_list: List of user's chat rooms
- new_message: New message in subscribed room
- message_read: Message read receipt
- typing: User typing indicator
- room_updated: Room metadata changed
- error: Error message

Simplified from original:
- Removed optimistic UI support (no _tempId handling)
- Removed excessive logging (only critical errors)
- Pure pub/sub: all clients receive messages equally
"""

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, ChatParticipant
from .serializers import ChatRoomSerializer, MessageSerializer, UserSerializer

User = get_user_model()
logger = logging.getLogger(__name__)


class UnifiedChatConsumer(AsyncWebsocketConsumer):
    """
    Unified WebSocket consumer for all chat operations.
    Single connection per user handles all rooms and chat functionality.
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.user_id = None
        self.subscribed_rooms = set()  # Track which rooms user is subscribed to
        
    async def connect(self):
        """
        Accept WebSocket connection for authenticated users.
        """
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            logger.warning("Unauthenticated WebSocket connection attempt")
            await self.close(code=4001)  # 4001 = Authentication required
            return
        
        self.user_id = self.user.id
        self.user_channel_name = f'user_{self.user_id}'
        
        # Add to user's personal channel for direct messages
        await self.channel_layer.group_add(
            self.user_channel_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'user_id': self.user_id,
            'username': self.user.username,
            'timestamp': self._get_timestamp()
        }))
        
    async def disconnect(self, close_code):
        """
        Clean up when WebSocket connection closes.
        """
        # Unsubscribe from all rooms
        for room_id in list(self.subscribed_rooms):
            await self._unsubscribe_from_room(room_id, silent=True)
        
        # Remove from user's personal channel
        if hasattr(self, 'user_channel_name'):
            await self.channel_layer.group_discard(
                self.user_channel_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """
        Route incoming messages based on type.
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if not message_type:
                await self._send_error("Missing 'type' field in message")
                return
            
            # Route to appropriate handler
            handler_map = {
                'subscribe_room': self.handle_subscribe_room,
                'unsubscribe_room': self.handle_unsubscribe_room,
                'send_message': self.handle_send_message,
                'mark_read': self.handle_mark_read,
                'typing': self.handle_typing,
                'stop_typing': self.handle_stop_typing,
                'get_room_list': self.handle_get_room_list,
                'ping': self.handle_ping,  # Heartbeat
            }
            
            handler = handler_map.get(message_type)
            if handler:
                await handler(data)
            else:
                await self._send_error(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON received: {e}")
            await self._send_error("Invalid JSON format")
        except Exception as e:
            logger.error(f"Error processing message: {e}", exc_info=True)
            await self._send_error(f"Internal error: {str(e)}")
    
    # =============================================================================
    # Message Handlers (Client → Server)
    # =============================================================================
    
    async def handle_subscribe_room(self, data):
        """
        Subscribe to a room to receive real-time updates.
        
        Message format:
        {
            "type": "subscribe_room",
            "room_id": 123
        }
        """
        room_id = data.get('room_id')
        
        if not room_id:
            await self._send_error("Missing 'room_id' field")
            return
        
        # Check if user has access to this room
        has_access = await self._check_room_access(room_id)
        if not has_access:
            await self._send_error(f"Access denied to room {room_id}", room_id=room_id)
            return
        
        # Add to room group
        room_group_name = f'chat_room_{room_id}'
        await self.channel_layer.group_add(
            room_group_name,
            self.channel_name
        )
        
        self.subscribed_rooms.add(room_id)
        
        # Send subscription confirmation
        await self.send(text_data=json.dumps({
            'type': 'subscribed',
            'room_id': room_id,
            'timestamp': self._get_timestamp()
        }))
        
        # Update last seen for this room
        await self._update_last_seen(room_id)
    
    async def handle_unsubscribe_room(self, data):
        """
        Unsubscribe from a room.
        
        Message format:
        {
            "type": "unsubscribe_room",
            "room_id": 123
        }
        """
        room_id = data.get('room_id')
        
        if not room_id:
            await self._send_error("Missing 'room_id' field")
            return
        
        await self._unsubscribe_from_room(room_id)
    
    async def handle_send_message(self, data):
        """
        Send a message to a room.
        
        Message format:
        {
            "type": "send_message",
            "room_id": 123,
            "content": "Hello, world!",
            "reply_to": 456  # Optional
        }
        
        Pure pub/sub pattern: save → broadcast to all subscribed clients
        """
        room_id = data.get('room_id')
        content = data.get('content', '').strip()
        reply_to_id = data.get('reply_to')
        
        if not room_id:
            await self._send_error("Missing 'room_id' field")
            return
        
        if not content:
            await self._send_error("Message content cannot be empty", room_id=room_id)
            return
        
        # Check if user has access to this room
        has_access = await self._check_room_access(room_id)
        if not has_access:
            await self._send_error(f"Access denied to room {room_id}", room_id=room_id)
            return
        
        # Save message to database
        message = await self._save_message(room_id, content, reply_to_id)
        
        if not message:
            await self._send_error("Failed to save message", room_id=room_id)
            return
        
        # Serialize message
        message_data = await self._serialize_message(message)
        
        # Broadcast to all users in the room (pure pub/sub)
        room_group_name = f'chat_room_{room_id}'
        await self.channel_layer.group_send(
            room_group_name,
            {
                'type': 'broadcast_new_message',
                'room_id': room_id,
                'message': message_data
            }
        )
    
    async def handle_mark_read(self, data):
        """
        Mark messages as read.
        
        Message format:
        {
            "type": "mark_read",
            "room_id": 123,
            "message_ids": [1, 2, 3]  # Optional, if empty marks all as read
        }
        """
        room_id = data.get('room_id')
        message_ids = data.get('message_ids', [])
        
        if not room_id:
            await self._send_error("Missing 'room_id' field")
            return
        
        # Mark messages as read
        count = await self._mark_messages_read(room_id, message_ids)
        
        # Send confirmation
        await self.send(text_data=json.dumps({
            'type': 'messages_marked_read',
            'room_id': room_id,
            'count': count,
            'timestamp': self._get_timestamp()
        }))
        
        # Broadcast read receipt to other participants
        room_group_name = f'chat_room_{room_id}'
        await self.channel_layer.group_send(
            room_group_name,
            {
                'type': 'broadcast_read_receipt',
                'room_id': room_id,
                'user_id': self.user_id,
                'message_ids': message_ids
            }
        )
    
    async def handle_typing(self, data):
        """
        Send typing indicator.
        
        Message format:
        {
            "type": "typing",
            "room_id": 123
        }
        """
        room_id = data.get('room_id')
        
        if not room_id:
            return
        
        # Broadcast to room (excluding self)
        room_group_name = f'chat_room_{room_id}'
        await self.channel_layer.group_send(
            room_group_name,
            {
                'type': 'broadcast_typing',
                'room_id': room_id,
                'user_id': self.user_id,
                'username': self.user.username,
                'is_typing': True
            }
        )
    
    async def handle_stop_typing(self, data):
        """
        Stop typing indicator.
        
        Message format:
        {
            "type": "stop_typing",
            "room_id": 123
        }
        """
        room_id = data.get('room_id')
        
        if not room_id:
            return
        
        # Broadcast to room (excluding self)
        room_group_name = f'chat_room_{room_id}'
        await self.channel_layer.group_send(
            room_group_name,
            {
                'type': 'broadcast_typing',
                'room_id': room_id,
                'user_id': self.user_id,
                'username': self.user.username,
                'is_typing': False
            }
        )
    
    async def handle_get_room_list(self, data):
        """
        Get list of user's chat rooms.
        
        Message format:
        {
            "type": "get_room_list"
        }
        """
        rooms = await self._get_user_rooms()
        
        await self.send(text_data=json.dumps({
            'type': 'room_list',
            'rooms': rooms,
            'timestamp': self._get_timestamp()
        }))
    
    async def handle_ping(self, data):
        """
        Respond to ping (heartbeat).
        """
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'timestamp': self._get_timestamp()
        }))
    
    # =============================================================================
    # Broadcast Handlers (Server → Client via Channel Layer)
    # =============================================================================
    
    async def broadcast_new_message(self, event):
        """
        Broadcast new message to all subscribed clients.
        """
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'room_id': event['room_id'],
            'message': event['message'],
            'timestamp': self._get_timestamp()
        }))
    
    async def broadcast_typing(self, event):
        """
        Broadcast typing indicator (don't send to self).
        """
        if event['user_id'] != self.user_id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'room_id': event['room_id'],
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing'],
                'timestamp': self._get_timestamp()
            }))
    
    async def broadcast_read_receipt(self, event):
        """
        Broadcast read receipt (don't send to self).
        """
        if event['user_id'] != self.user_id:
            await self.send(text_data=json.dumps({
                'type': 'message_read',
                'room_id': event['room_id'],
                'user_id': event['user_id'],
                'message_ids': event['message_ids'],
                'timestamp': self._get_timestamp()
            }))
    
    async def broadcast_room_update(self, event):
        """
        Broadcast room metadata update.
        """
        await self.send(text_data=json.dumps({
            'type': 'room_updated',
            'room_id': event['room_id'],
            'updates': event['updates'],
            'timestamp': self._get_timestamp()
        }))
    
    # =============================================================================
    # Database Operations
    # =============================================================================
    
    @database_sync_to_async
    def _check_room_access(self, room_id):
        """Check if user has access to a room."""
        try:
            room = ChatRoom.objects.get(id=room_id)
            
            # Check if user is a participant
            if room.participants.filter(id=self.user_id).exists():
                return True
            
            # Check if it's a job room and user is client or cleaner
            if room.job:
                return (room.job.client_id == self.user_id or 
                       room.job.cleaner_id == self.user_id)
            
            return False
        except ChatRoom.DoesNotExist:
            return False
    
    @database_sync_to_async
    def _get_user_rooms(self):
        """Get all rooms user has access to."""
        rooms = ChatRoom.objects.filter(
            participants=self.user,
            is_active=True
        ).select_related(
            'job', 'last_message_sender'
        ).prefetch_related('participants').order_by('-updated_at')
        
        serializer = ChatRoomSerializer(rooms, many=True)
        return serializer.data
    
    @database_sync_to_async
    def _save_message(self, room_id, content, reply_to_id=None):
        """Save message to database and update room."""
        try:
            room = ChatRoom.objects.get(id=room_id)
            
            # Get reply_to message if specified
            reply_to = None
            if reply_to_id:
                try:
                    reply_to = Message.objects.get(id=reply_to_id, room=room)
                except Message.DoesNotExist:
                    pass
            
            # Create message
            message = Message.objects.create(
                room=room,
                sender=self.user,
                content=content,
                reply_to=reply_to
            )
            
            # Update denormalized last_message fields
            room.update_last_message(message)
            
            # Increment unread count for other participants
            participants = ChatParticipant.objects.filter(room=room).exclude(user=self.user)
            for participant in participants:
                participant.increment_unread()
            
            return message
        except ChatRoom.DoesNotExist:
            logger.error(f"Room {room_id} does not exist")
            return None
        except Exception as e:
            logger.error(f"Error saving message: {e}", exc_info=True)
            return None
    
    @database_sync_to_async
    def _serialize_message(self, message):
        """Serialize message for transmission."""
        serializer = MessageSerializer(message)
        return serializer.data
    
    @database_sync_to_async
    def _mark_messages_read(self, room_id, message_ids=None):
        """Mark messages as read."""
        try:
            room = ChatRoom.objects.get(id=room_id)
            
            # Get messages to mark as read
            messages_query = Message.objects.filter(room=room).exclude(sender=self.user)
            
            if message_ids:
                messages_query = messages_query.filter(id__in=message_ids)
            
            # Mark as read
            count = messages_query.update(is_read=True)
            
            # Reset unread count for user
            try:
                participant = ChatParticipant.objects.get(room=room, user=self.user)
                participant.reset_unread()
            except ChatParticipant.DoesNotExist:
                pass
            
            return count
        except ChatRoom.DoesNotExist:
            return 0
    
    @database_sync_to_async
    def _update_last_seen(self, room_id):
        """Update user's last seen timestamp in room."""
        try:
            room = ChatRoom.objects.get(id=room_id)
            participant, created = ChatParticipant.objects.get_or_create(
                room=room,
                user=self.user
            )
            participant.save()  # Updates last_seen automatically
        except ChatRoom.DoesNotExist:
            pass
    
    @database_sync_to_async
    def _get_user_rooms(self):
        """Get all rooms user has access to."""
        rooms = ChatRoom.objects.filter(
            participants=self.user,
            is_active=True
        ).select_related(
            'job', 'last_message_sender'
        ).prefetch_related('participants').order_by('-updated_at')
        
        # Create a mock request object for serializer context
        class MockRequest:
            def __init__(self, user):
                self.user = user
        
        mock_request = MockRequest(self.user)
        serializer = ChatRoomSerializer(rooms, many=True, context={'request': mock_request})
        return serializer.data
    
    # =============================================================================
    # Helper Methods
    # =============================================================================
    
    async def _unsubscribe_from_room(self, room_id, silent=False):
        """Unsubscribe from a room."""
        if room_id in self.subscribed_rooms:
            room_group_name = f'chat_room_{room_id}'
            await self.channel_layer.group_discard(
                room_group_name,
                self.channel_name
            )
            self.subscribed_rooms.remove(room_id)
            
            if not silent:
                await self.send(text_data=json.dumps({
                    'type': 'unsubscribed',
                    'room_id': room_id,
                    'timestamp': self._get_timestamp()
                }))
    
    async def _send_error(self, message, room_id=None):
        """Send error message to client."""
        error_data = {
            'type': 'error',
            'message': message,
            'timestamp': self._get_timestamp()
        }
        if room_id:
            error_data['room_id'] = room_id
        
        await self.send(text_data=json.dumps(error_data))
    
    def _get_timestamp(self):
        """Get current timestamp in ISO format."""
        from django.utils import timezone
        return timezone.now().isoformat()
