from django.db import models
from django.conf import settings
from cleaning_jobs.models import CleaningJob


class ChatRoom(models.Model):
    """
    Chat room for communication between clients and cleaners
    Can be job-specific, direct message, or general support chat
    
    For job chats: Each job can have multiple chat rooms (one per bidder)
    This allows private conversations between client and each bidder
    """
    ROOM_TYPES = (
        ('job', 'Job Chat'),
        ('direct', 'Direct Message'),
        ('support', 'Support Chat'),
        ('general', 'General Chat'),
    )
    
    name = models.CharField(max_length=255)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES, default='job')
    
    # Changed from OneToOneField to ForeignKey to allow multiple chats per job
    job = models.ForeignKey(
        CleaningJob, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='chat_rooms'  # Changed from 'chat_room' (singular) to 'chat_rooms' (plural)
    )
    
    # NEW: Track which bidder/cleaner this chat is with (for job chats)
    bidder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='bidder_chat_rooms',
        help_text='The cleaner/bidder in this job chat. Required for job-type rooms.'
    )
    
    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL, 
        related_name='chat_rooms'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # Denormalized fields for efficient room list queries
    last_message_content = models.TextField(blank=True, default='')
    last_message_time = models.DateTimeField(null=True, blank=True)
    last_message_sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'  # No reverse relation needed
    )
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['-updated_at'], name='chat_room_updated_idx'),
            models.Index(fields=['job'], name='chat_room_job_idx'),
            models.Index(fields=['room_type', '-updated_at'], name='chat_room_type_idx'),
            models.Index(fields=['job', 'bidder'], name='chat_job_bidder_idx'),
        ]
        constraints = [
            # Ensure unique chat per job-bidder pair (for job-type rooms only)
            models.UniqueConstraint(
                fields=['job', 'bidder'],
                condition=models.Q(room_type='job'),
                name='unique_job_bidder_chat'
            )
        ]
    
    def __str__(self):
        if self.room_type == 'job':
            return f"Job Chat: Job #{self.job.id}" if self.job else "Job Chat (No Job)"
        elif self.room_type == 'direct':
            participant_names = ', '.join([f"{p.first_name} {p.last_name}".strip() or p.username for p in self.participants.all()[:2]])
            return f"Direct Message: {participant_names or 'No participants'}"
        return f"{self.room_type.title()} Chat: {self.name}"
    
    @classmethod
    def get_or_create_job_chat(cls, job, bidder):
        """
        Get or create a job chat for a specific job-bidder pair.
        Ensures the bidder has an active bid on the job.
        
        Args:
            job: CleaningJob instance
            bidder: User instance (the cleaner who bid)
            
        Returns:
            tuple: (ChatRoom, created) where created is a boolean
            
        Raises:
            PermissionError: If bidder doesn't have an active bid
        """
        from cleaning_jobs.models import JobBid
        
        # Validate that bidder has an active bid
        bid_exists = JobBid.objects.filter(
            job=job,
            cleaner=bidder,
            status__in=['pending', 'accepted']  # Not withdrawn/rejected
        ).exists()
        
        if not bid_exists:
            raise PermissionError(
                f"User {bidder.username} must place a bid on Job #{job.id} before accessing chat"
            )
        
        # Get or create the chat room
        room, created = cls.objects.get_or_create(
            job=job,
            bidder=bidder,
            room_type='job',
            defaults={
                'name': f'Job #{job.id} - {bidder.username}'
            }
        )
        
        # Ensure both client and bidder are participants
        room.participants.add(job.client, bidder)
        
        return room, created
    
    @classmethod
    def get_or_create_direct_room(cls, user1, user2):
        """
        Get or create a direct message room between two users.
        Returns (room, created) tuple.
        """
        if user1.id == user2.id:
            raise ValueError("Cannot create DM room with yourself")
        
        # Look for existing DM room between these users
        # Query rooms where both users are participants
        user1_rooms = set(user1.chat_rooms.filter(room_type='direct').values_list('id', flat=True))
        user2_rooms = set(user2.chat_rooms.filter(room_type='direct').values_list('id', flat=True))
        common_rooms = user1_rooms & user2_rooms
        
        if common_rooms:
            # Verify it's actually a 2-person DM (not a group)
            for room_id in common_rooms:
                room = cls.objects.prefetch_related('participants').get(id=room_id)
                if room.participants.count() == 2:
                    return room, False
        
        # Create new DM room
        room = cls.objects.create(
            name=f"DM: {user1.username} & {user2.username}",
            room_type='direct'
        )
        room.participants.add(user1, user2)
        return room, True
    
    def update_last_message(self, message):
        """
        Update denormalized last message fields for efficient room list queries.
        Called when a new message is created.
        """
        self.last_message_content = message.content[:200]  # Truncate to 200 chars
        self.last_message_time = message.timestamp
        self.last_message_sender = message.sender
        self.updated_at = message.timestamp
        self.save(update_fields=[
            'last_message_content',
            'last_message_time',
            'last_message_sender',
            'updated_at'
        ])
    
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
        indexes = [
            # Critical for message list queries with pagination
            models.Index(fields=['room', '-timestamp'], name='chat_room_time_idx'),
            # For cursor-based pagination by ID
            models.Index(fields=['room', '-id'], name='chat_room_id_idx'),
            # For unread count queries
            models.Index(fields=['room', 'is_read', 'sender'], name='chat_unread_idx'),
            # For user's sent messages
            models.Index(fields=['sender', '-timestamp'], name='chat_sender_time_idx'),
        ]
    
    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}..."
    
    def mark_as_read(self):
        """Mark message as read"""
        self.is_read = True
        self.save(update_fields=['is_read'])


class ChatParticipant(models.Model):
    """
    Track participant status in chat rooms.
    Note: is_typing removed - typing indicators are ephemeral and handled in-memory via WebSocket.
    """
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='chat_participants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    # Removed: is_typing - now handled in Redis/memory for better performance
    unread_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        unique_together = ['room', 'user']
        indexes = [
            models.Index(fields=['room', 'user'], name='chat_part_room_user_idx'),
            models.Index(fields=['user', '-last_seen'], name='chat_part_user_seen_idx'),
        ]
    
    def __str__(self):
        return f"{self.user.username} in {self.room.name}"
    
    def increment_unread(self):
        """Increment unread count efficiently"""
        self.unread_count += 1
        self.save(update_fields=['unread_count'])
    
    def reset_unread(self):
        """Mark all messages in room as read"""
        self.unread_count = 0
        self.save(update_fields=['unread_count'])
