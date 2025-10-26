from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.contrib.auth import get_user_model
from .models import ChatRoom, Message, ChatParticipant
from .serializers import (
    ChatRoomSerializer, MessageSerializer, ChatParticipantSerializer,
    CreateMessageSerializer
)

User = get_user_model()


class ChatRoomViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing chat rooms
    """
    serializer_class = ChatRoomSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        return ChatRoom.objects.filter(
            participants=user,
            is_active=True
        ).distinct()
    
    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        """
        Get messages for a specific chat room with cursor-based pagination.
        
        Query Parameters:
        - before: Message ID to fetch messages before (for loading older messages)
        - after: Message ID to fetch messages after (for loading newer messages)
        - limit: Number of messages to return (default: 50, max: 100)
        
        Returns messages in descending order by ID (newest first) by default.
        """
        room = self.get_object()
        
        # Get pagination parameters
        before_id = request.query_params.get('before')
        after_id = request.query_params.get('after')
        limit = min(int(request.query_params.get('limit', 50)), 100)  # Max 100
        
        # Base queryset
        queryset = Message.objects.filter(room=room).select_related('sender')
        
        # Apply cursor-based filtering
        if before_id:
            # Load older messages (scrolling up)
            queryset = queryset.filter(id__lt=before_id).order_by('-id')[:limit]
        elif after_id:
            # Load newer messages (scrolling down)
            queryset = queryset.filter(id__gt=after_id).order_by('id')[:limit]
        else:
            # Initial load - get most recent messages
            queryset = queryset.order_by('-id')[:limit]
        
        # Convert to list and reverse if needed to maintain chronological order for display
        messages = list(queryset)
        if before_id or not after_id:
            messages.reverse()  # Show oldest to newest
        
        # Mark unread messages as read
        unread_ids = [msg.id for msg in messages if not msg.is_read and msg.sender != request.user]
        if unread_ids:
            Message.objects.filter(id__in=unread_ids).update(is_read=True)
            
            # Update unread count for user
            try:
                participant = ChatParticipant.objects.get(room=room, user=request.user)
                participant.unread_count = max(0, participant.unread_count - len(unread_ids))
                participant.save(update_fields=['unread_count'])
            except ChatParticipant.DoesNotExist:
                pass
        
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        
        # Add pagination metadata
        has_more = queryset.count() == limit  # If we got full limit, there might be more
        return Response({
            'messages': serializer.data,
            'has_more': has_more,
            'count': len(messages),
            'oldest_id': messages[0].id if messages else None,
            'newest_id': messages[-1].id if messages else None,
        })
    
    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a message to a chat room"""
        room = self.get_object()
        
        serializer = CreateMessageSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if serializer.is_valid():
            message = serializer.save(room=room)
            response_serializer = MessageSerializer(message, context={'request': request})
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):
        """Get participants for a chat room"""
        room = self.get_object()
        participants = ChatParticipant.objects.filter(room=room)
        serializer = ChatParticipantSerializer(participants, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def start_dm(self, request):
        """
        Start or get existing direct message conversation with another user.
        
        POST /chat/rooms/start_dm/
        Body: { "user_id": 123 }
        
        Returns the DM room (existing or newly created)
        """
        other_user_id = request.data.get('user_id')
        if not other_user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            other_user = User.objects.get(id=other_user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if other_user == request.user:
            return Response(
                {'error': 'Cannot create DM with yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get or create DM room
        room, created = ChatRoom.get_or_create_direct_room(request.user, other_user)
        
        serializer = ChatRoomSerializer(room, context={'request': request})
        return Response({
            'room': serializer.data,
            'created': created,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def direct_messages(self, request):
        """
        List all direct message conversations for the current user.
        
        GET /chat/rooms/direct_messages/
        
        Returns list of DM rooms sorted by most recent activity
        """
        dm_rooms = ChatRoom.objects.filter(
            participants=request.user,
            room_type='direct',
            is_active=True
        ).prefetch_related('participants', 'last_message_sender').distinct()
        
        serializer = ChatRoomSerializer(dm_rooms, many=True, context={'request': request})
        return Response(serializer.data)


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing messages
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # Only show messages from rooms the user is part of
        return Message.objects.filter(
            room__participants=user
        ).select_related('sender', 'room')
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a message as read"""
        message = self.get_object()
        
        # Only allow marking as read if user is a participant
        if request.user in message.room.participants.all():
            message.mark_as_read()
            return Response({'status': 'message marked as read'})
        
        return Response(
            {'error': 'Permission denied'},
            status=status.HTTP_403_FORBIDDEN
        )
