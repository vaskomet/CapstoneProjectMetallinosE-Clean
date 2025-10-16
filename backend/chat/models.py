from django.db import models
from django.conf import settings
from cleaning_jobs.models import CleaningJob


class ChatRoom(models.Model):
    """
    Chat room for communication between clients and cleaners
    Can be job-specific or general support chat
    """
    ROOM_TYPES = (
        ('job', 'Job Chat'),
        ('support', 'Support Chat'),
        ('general', 'General Chat'),
    )
    
    name = models.CharField(max_length=255)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES, default='job')
    job = models.OneToOneField(
        CleaningJob, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='chat_room'
    )
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, 
        related_name='chat_rooms'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-updated_at']
    
    def __str__(self):
        if self.job:
            return f"Chat for Job #{self.job.id}"
        return f"{self.room_type.title()} Chat: {self.name}"
    
    @property
    def room_group_name(self):
        """Generate group name for WebSocket"""
        if self.job:
            return f'job_chat_{self.job.id}'
        return f'chat_room_{self.id}'


class Message(models.Model):
    """
    Individual messages within chat rooms
    """
    MESSAGE_TYPES = (
        ('text', 'Text Message'),
        ('image', 'Image'),
        ('file', 'File'),
        ('system', 'System Message'),
        ('job_update', 'Job Status Update'),
    )
    
    room = models.ForeignKey(
        ChatRoom, 
        on_delete=models.CASCADE, 
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    content = models.TextField()
    attachment = models.FileField(upload_to='chat_attachments/', null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    reply_to = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='replies'
    )
    
    class Meta:
        ordering = ['timestamp']
    
    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}..."
    
    def mark_as_read(self):
        """Mark message as read"""
        self.is_read = True
        self.save(update_fields=['is_read'])


class ChatParticipant(models.Model):
    """
    Track participant status in chat rooms
    """
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    is_typing = models.BooleanField(default=False)
    unread_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        unique_together = ['room', 'user']
    
    def __str__(self):
        return f"{self.user.username} in {self.room.name}"
