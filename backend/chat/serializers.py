from rest_framework import serializers
from .models import ChatRoom, Message, ChatParticipant
from users.serializers import UserSerializer


class ChatRoomSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    participant_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    last_message_sender = UserSerializer(read_only=True)
    bidder = UserSerializer(read_only=True)  # NEW: Include bidder information
    job_details = serializers.SerializerMethodField()  # NEW: Include job info
    
    class Meta:
        model = ChatRoom
        fields = [
            'id', 'name', 'room_type', 'job', 'bidder', 'job_details',
            'participants', 'participant_count', 'last_message', 'unread_count',
            'last_message_content', 'last_message_time', 'last_message_sender',
            'created_at', 'updated_at', 'is_active'
        ]
        read_only_fields = [
            'created_at', 'updated_at', 
            'last_message_content', 'last_message_time', 'last_message_sender'
        ]
    
    def get_job_details(self, obj):
        """Return basic job information if this is a job chat"""
        if obj.job:
            return {
                'id': obj.job.id,
                'service_type': obj.job.service_type if hasattr(obj.job, 'service_type') else None,
                'property_address': obj.job.property.address_line1 if obj.job.property else None,
                'status': obj.job.status
            }
        return None
    
    def get_participant_count(self, obj):
        return obj.participants.count()
    
    def get_last_message(self, obj):
        """
        Return last message info using denormalized fields for performance.
        Falls back to database query if denormalized fields not populated.
        """
        if obj.last_message_time and obj.last_message_content:
            # Use denormalized data (faster)
            return {
                'content': obj.last_message_content,
                'timestamp': obj.last_message_time.isoformat() if obj.last_message_time else None,  # ← Convert to string!
                'sender': UserSerializer(obj.last_message_sender).data if obj.last_message_sender else None
            }
        else:
            # Fallback to database query (slower, but works if not denormalized yet)
            last_message = obj.messages.order_by('-id').first()
            if last_message:
                return MessageSerializer(last_message).data
            return None
    
    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            participant = ChatParticipant.objects.filter(
                room=obj, user=request.user
            ).first()
            return participant.unread_count if participant else 0
        return 0


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    reply_to = serializers.SerializerMethodField()
    is_own_message = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = [
            'id', 'room', 'sender', 'message_type', 'content', 
            'attachment', 'timestamp', 'is_read', 'edited_at',
            'reply_to', 'is_own_message'
        ]
        read_only_fields = ['timestamp', 'sender']
    
    def get_reply_to(self, obj):
        if obj.reply_to:
            return {
                'id': obj.reply_to.id,
                'content': obj.reply_to.content[:100],
                'sender': obj.reply_to.sender.username
            }
        return None
    
    def get_is_own_message(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender == request.user
        return False


class ChatParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = ChatParticipant
        fields = [
            'id', 'room', 'user', 'joined_at', 'last_seen',
            'is_typing', 'unread_count'
        ]
        read_only_fields = ['joined_at']


class CreateMessageSerializer(serializers.ModelSerializer):
    """Serializer for creating new messages"""
    
    class Meta:
        model = Message
        fields = ['room', 'message_type', 'content', 'attachment', 'reply_to']
    
    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)