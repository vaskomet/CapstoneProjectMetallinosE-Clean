import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, ChatParticipant
from .serializers import MessageSerializer
from notifications.utils import send_message_notification

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for general chat rooms
    """
    
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Update user's online status in room
        await self.update_participant_status(online=True)
        
        # Notify others that user joined
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_status',
                'user': self.user.username,
                'status': 'joined'
            }
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            # Update user's offline status
            await self.update_participant_status(online=False)
            
            # Notify others that user left
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_status',
                    'user': self.user.username,
                    'status': 'left'
                }
            )
            
            # Leave room group
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')
            
            if message_type == 'message':
                await self.handle_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            elif message_type == 'read_message':
                await self.handle_read_message(data)
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
    
    async def handle_message(self, data):
        """Handle incoming chat message"""
        content = data.get('message', '').strip()
        reply_to_id = data.get('reply_to')
        
        if not content:
            return
        
        # Save message to database
        message = await self.save_message(content, reply_to_id)
        
        if message:
            # Broadcast message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': await self.serialize_message(message)
                }
            )
    
    async def handle_typing(self, data):
        """Handle typing indicators"""
        is_typing = data.get('is_typing', False)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_status',
                'user': self.user.username,
                'is_typing': is_typing
            }
        )
    
    async def handle_read_message(self, data):
        """Handle message read status"""
        message_id = data.get('message_id')
        if message_id:
            await self.mark_message_read(message_id)
    
    async def chat_message(self, event):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',  # Changed from 'message' to 'chat_message' to match frontend
            'message': event['message']  # Changed from 'data' to 'message' to match frontend
        }))
    
    async def user_status(self, event):
        """Send user status update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'user': event['user'],
            'status': event['status']
        }))
    
    async def typing_status(self, event):
        """Send typing status to WebSocket"""
        # Don't send typing status to the user who is typing
        if event['user'] != self.user.username:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user': event['user'],
                'is_typing': event['is_typing']
            }))
    
    @database_sync_to_async
    def save_message(self, content, reply_to_id=None):
        """Save message to database and update room's last message"""
        try:
            room, created = ChatRoom.objects.get_or_create(
                name=self.room_name,
                defaults={'room_type': 'general'}
            )
            
            # Add user to room participants if not already added
            room.participants.add(self.user)
            
            reply_to = None
            if reply_to_id:
                try:
                    reply_to = Message.objects.get(id=reply_to_id, room=room)
                except Message.DoesNotExist:
                    pass
            
            message = Message.objects.create(
                room=room,
                sender=self.user,
                content=content,
                reply_to=reply_to
            )
            
            # Update denormalized last_message fields on room
            room.update_last_message(message)
            
            # Increment unread count for other participants and send notifications
            participants = ChatParticipant.objects.filter(room=room).exclude(user=self.user)
            for participant in participants:
                participant.increment_unread()
                
                # Send notification to the participant
                try:
                    # For general chat, job_id might not be available
                    job_id = room.job_id if hasattr(room, 'job_id') and room.job_id else 0
                    send_message_notification(
                        recipient=participant.user,
                        sender=self.user,
                        job_id=job_id,
                        message_preview=content
                    )
                except Exception as e:
                    print(f"Error sending message notification: {e}")
            
            return message
        except Exception as e:
            print(f"Error saving message: {e}")
            return None
    
    @database_sync_to_async
    def serialize_message(self, message):
        """Serialize message for WebSocket transmission"""
        serializer = MessageSerializer(message)
        return serializer.data
    
    @database_sync_to_async
    def update_participant_status(self, online=True):
        """Update participant status in room"""
        try:
            room = ChatRoom.objects.get(name=self.room_name)
            participant, created = ChatParticipant.objects.get_or_create(
                room=room,
                user=self.user
            )
            # Update last seen time
            participant.save()
        except ChatRoom.DoesNotExist:
            pass
    
    @database_sync_to_async
    def mark_message_read(self, message_id):
        """Mark message as read"""
        try:
            message = Message.objects.get(id=message_id)
            if message.room.participants.filter(id=self.user.id).exists():
                message.mark_as_read()
        except Message.DoesNotExist:
            pass


class JobChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for job-specific chat rooms.
    Now supports per-bidder chats (multiple chats per job).
    
    URL: ws://domain/ws/chat/job/{job_id}/?bidder_id={bidder_id}
    
    Query param 'bidder_id' is required for clients to specify which bidder's chat
    For cleaners, bidder_id defaults to themselves
    """
    
    async def connect(self):
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        self.user = self.scope['user']
        
        if not self.user.is_authenticated:
            await self.close()
            return
        
        # Get bidder from query params
        query_string = self.scope.get('query_string', b'').decode()
        query_params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
        bidder_id = query_params.get('bidder_id')
        
        # Determine bidder based on user role
        if hasattr(self.user, 'role') and self.user.role == 'cleaner':
            # Cleaners are bidders for their own chats
            self.bidder_id = self.user.id
        elif bidder_id:
            # Clients must specify which bidder they're chatting with
            self.bidder_id = int(bidder_id)
        else:
            # Missing bidder_id for client
            await self.send(text_data=json.dumps({
                'error': 'bidder_id query parameter required for clients'
            }))
            await self.close()
            return
        
        # Create unique room group name for this job-bidder pair
        self.room_group_name = f'job_chat_{self.job_id}_bidder_{self.bidder_id}'
        
        # Check if user has access to this specific job-bidder chat
        if not await self.check_job_access():
            await self.close()
            return
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Create or get chat room for this job-bidder pair
        await self.ensure_chat_room_exists()
    
    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')
            
            if message_type == 'message':
                await self.handle_job_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
    
    async def handle_job_message(self, data):
        """Handle incoming job chat message"""
        content = data.get('message', '').strip()
        
        if not content:
            return
        
        # Save message to database
        message = await self.save_job_message(content)
        
        if message:
            # Broadcast message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': await self.serialize_message(message)
                }
            )
    
    async def handle_typing(self, data):
        """Handle typing indicators"""
        is_typing = data.get('is_typing', False)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_status',
                'user': self.user.username,
                'is_typing': is_typing
            }
        )
    
    async def chat_message(self, event):
        """Send message to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',  # Changed from 'message' to 'chat_message' to match frontend
            'message': event['message']  # Changed from 'data' to 'message' to match frontend
        }))
    
    async def typing_status(self, event):
        """Send typing status to WebSocket"""
        if event['user'] != self.user.username:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user': event['user'],
                'is_typing': event['is_typing']
            }))
    
    @database_sync_to_async
    def check_job_access(self):
        """
        Restrict chat access after job is confirmed: only client and winning cleaner can access.
        """
        from cleaning_jobs.models import CleaningJob, JobBid
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            job = CleaningJob.objects.get(id=self.job_id)
            bidder = User.objects.get(id=self.bidder_id)
            # Admin has access to all chats
            if hasattr(self.user, 'role') and self.user.role == 'admin':
                return True
            # If job is confirmed, only client and winning cleaner can access
            if job.status == 'confirmed':
                if self.user == job.client:
                    return True
                if job.accepted_bid and self.user == job.accepted_bid.cleaner:
                    return True
                return False
            # If job is not confirmed, allow client and any active bidder
            if job.client == self.user:
                return JobBid.objects.filter(
                    job=job,
                    cleaner=bidder,
                    status__in=['pending', 'accepted']
                ).exists()
            if self.user == bidder:
                return JobBid.objects.filter(
                    job=job,
                    cleaner=bidder,
                    status__in=['pending', 'accepted']
                ).exists()
            return False
        except (CleaningJob.DoesNotExist, User.DoesNotExist):
            return False
    
    @database_sync_to_async
    def ensure_chat_room_exists(self):
        """
        Create or get chat room for this specific job-bidder pair.
        Uses the new get_or_create_job_chat method with bid validation.
        """
        from cleaning_jobs.models import CleaningJob
        from django.contrib.auth import get_user_model
        
        User = get_user_model()
        
        try:
            job = CleaningJob.objects.get(id=self.job_id)
            bidder = User.objects.get(id=self.bidder_id)
            
            # This will validate the bid exists and create/get the room
            room, created = ChatRoom.get_or_create_job_chat(job, bidder)
            return room
            
        except (CleaningJob.DoesNotExist, User.DoesNotExist, PermissionError):
            return None
    
    @database_sync_to_async
    def save_job_message(self, content):
        """Save job chat message to database for this specific job-bidder chat"""
        try:
            # Get the specific room for this job-bidder pair
            room = ChatRoom.objects.get(
                job_id=self.job_id,
                bidder_id=self.bidder_id,
                room_type='job'
            )
            message = Message.objects.create(
                room=room,
                sender=self.user,
                content=content
            )
            
            # Update denormalized last_message fields on room
            room.update_last_message(message)
            
            # Increment unread count for other participants and send notifications
            participants = ChatParticipant.objects.filter(room=room).exclude(user=self.user)
            for participant in participants:
                participant.increment_unread()
                
                # Send notification to the participant
                try:
                    send_message_notification(
                        recipient=participant.user,
                        sender=self.user,
                        job_id=self.job_id,
                        message_preview=content
                    )
                except Exception as e:
                    print(f"Error sending message notification: {e}")
            
            return message
        except ChatRoom.DoesNotExist:
            return None
    
    @database_sync_to_async
    def serialize_message(self, message):
        """Serialize message for WebSocket transmission"""
        serializer = MessageSerializer(message)
        return serializer.data