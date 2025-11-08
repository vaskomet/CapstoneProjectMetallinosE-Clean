from django.contrib import admin
from .models import ChatRoom, Message, ChatParticipant

@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    """
    ChatRoom admin interface with denormalized last message info.
    """
    list_display = ('name', 'room_type', 'job', 'is_active', 'last_message_time', 'created_at')
    list_filter = ('room_type', 'is_active', 'created_at')
    search_fields = ('name', 'job__id', 'participants__username', 'last_message_content')
    date_hierarchy = 'created_at'
    readonly_fields = ('last_message_content', 'last_message_time', 'last_message_sender', 'created_at', 'updated_at')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """
    Message admin interface.
    """
    list_display = ('sender', 'room', 'message_type', 'is_read', 'timestamp')
    list_filter = ('message_type', 'is_read', 'timestamp')
    search_fields = ('sender__username', 'content', 'room__name')
    date_hierarchy = 'timestamp'

@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    """
    ChatParticipant admin interface.
    Note: is_typing removed - typing is now handled in-memory for performance.
    """
    list_display = ('user', 'room', 'joined_at', 'last_seen', 'unread_count')
    list_filter = ('joined_at', 'last_seen')
    search_fields = ('user__username', 'room__name')
    date_hierarchy = 'joined_at'
    readonly_fields = ('joined_at',)
