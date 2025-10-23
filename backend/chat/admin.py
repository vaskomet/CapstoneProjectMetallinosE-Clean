from django.contrib import admin
from .models import ChatRoom, Message, ChatParticipant


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    """Admin interface for ChatRoom model"""
    list_display = ('name', 'room_type', 'job', 'is_active', 'created_at', 'participants_count')
    list_filter = ('room_type', 'is_active', 'created_at')
    search_fields = ('name', 'job__id', 'participants__username')
    readonly_fields = ('created_at', 'updated_at', 'room_group_name')
    filter_horizontal = ('participants',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'room_type', 'job', 'is_active')
        }),
        ('Participants', {
            'fields': ('participants',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at', 'room_group_name'),
            'classes': ('collapse',)
        }),
    )
    
    def participants_count(self, obj):
        return obj.participants.count()
    participants_count.short_description = 'Participants'
    
    def room_group_name(self, obj):
        return obj.room_group_name
    room_group_name.short_description = 'WebSocket Group Name'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Admin interface for Message model"""
    list_display = ('sender', 'room', 'message_type', 'content_preview', 'is_read', 'timestamp')
    list_filter = ('message_type', 'is_read', 'timestamp', 'room__room_type')
    search_fields = ('sender__username', 'content', 'room__name')
    readonly_fields = ('timestamp', 'edited_at')
    date_hierarchy = 'timestamp'
    
    fieldsets = (
        ('Message Details', {
            'fields': ('room', 'sender', 'message_type', 'content', 'attachment')
        }),
        ('Status', {
            'fields': ('is_read', 'reply_to')
        }),
        ('Timestamps', {
            'fields': ('timestamp', 'edited_at'),
            'classes': ('collapse',)
        }),
    )
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content Preview'


@admin.register(ChatParticipant)
class ChatParticipantAdmin(admin.ModelAdmin):
    """Admin interface for ChatParticipant model"""
    list_display = ('user', 'room', 'joined_at', 'last_seen', 'is_typing', 'unread_count')
    list_filter = ('is_typing', 'joined_at', 'last_seen', 'room__room_type')
    search_fields = ('user__username', 'room__name')
    readonly_fields = ('joined_at',)
    
    fieldsets = (
        ('Participant Info', {
            'fields': ('room', 'user', 'joined_at')
        }),
        ('Status', {
            'fields': ('last_seen', 'is_typing', 'unread_count')
        }),
    )
