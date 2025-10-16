from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import ChatRoom, Message, ChatParticipant
from .serializers import (
    ChatRoomSerializer, MessageSerializer, ChatParticipantSerializer,
    CreateMessageSerializer
)


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
        """Get messages for a specific chat room"""
        room = self.get_object()
        messages = Message.objects.filter(room=room).order_by('timestamp')
        
        # Mark messages as read
        unread_messages = messages.filter(is_read=False).exclude(sender=request.user)
        unread_messages.update(is_read=True)
        
        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)
    
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
