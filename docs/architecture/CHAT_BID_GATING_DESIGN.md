# Chat Bid-Gating System Design

## Problem Statement

**Current Issue**: 
- A job can have multiple cleaners bidding on it
- Currently, ChatRoom has a OneToOne relationship with Job
- This means only ONE chat room exists per job
- Multiple bidders would all share the same chat room (not ideal for private discussions)
- Cleaners can access chat even without placing a bid

**User Requirements**:
1. Each bidder should have their own private chat with the client for that job
2. Chat should only be accessible AFTER a cleaner has submitted a bid
3. Client should see multiple chat threads (one per bidder) for jobs with multiple bids

---

## Current Architecture

### Database Schema (Current)
```python
class ChatRoom(models.Model):
    name = CharField(max_length=255)
    room_type = CharField(choices=['job', 'direct', 'support', 'general'])
    job = OneToOneField(CleaningJob, null=True, blank=True)  # ❌ OneToOne prevents multiple chats
    participants = ManyToManyField(User, related_name='chat_rooms')
    # ...
```

### Current Flow
1. Job created with status `open_for_bids`
2. Cleaners can place bids
3. Chat room created when someone accesses `/jobs/{job_id}/chat`
4. All participants (client + all bidders) share one room

---

## Proposed Solution

### 1. Database Schema Changes

**Modify ChatRoom Model**:
```python
class ChatRoom(models.Model):
    name = CharField(max_length=255)
    room_type = CharField(choices=['job', 'direct', 'support', 'general'])
    
    # CHANGED: OneToOne → ForeignKey (allows multiple chats per job)
    job = ForeignKey(
        CleaningJob, 
        on_delete=CASCADE, 
        null=True, 
        blank=True,
        related_name='chat_rooms'  # NOTE: plural now
    )
    
    # NEW: Track which bidder this chat is for
    bidder = ForeignKey(
        User,
        on_delete=CASCADE,
        null=True,
        blank=True,
        related_name='bidder_chat_rooms',
        help_text="The cleaner/bidder in this job chat"
    )
    
    participants = ManyToManyField(User, related_name='chat_rooms')
    
    # ... other fields
    
    class Meta:
        # Ensure unique chat per job-bidder pair
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'bidder'],
                condition=Q(room_type='job'),
                name='unique_job_bidder_chat'
            )
        ]
        indexes = [
            models.Index(fields=['job', 'bidder']),
            # ... other indexes
        ]
```

---

### 2. Business Logic Changes

#### **Chat Creation Rules**:
```python
def get_or_create_job_chat(job_id, cleaner_user):
    """
    Create or get chat room for a specific job-bidder pair.
    
    Requirements:
    1. Cleaner must have an active bid on the job
    2. Creates unique chat between client and that specific cleaner
    3. Only those two users are participants
    """
    # Validate bid exists
    bid = JobBid.objects.filter(
        job_id=job_id,
        cleaner=cleaner_user,
        status__in=['pending', 'accepted']  # Not withdrawn/rejected
    ).first()
    
    if not bid:
        raise PermissionDenied("Must place a bid before accessing chat")
    
    job = bid.job
    
    # Get or create chat for this specific job-bidder pair
    room, created = ChatRoom.objects.get_or_create(
        job=job,
        bidder=cleaner_user,  # NEW: Track the bidder
        room_type='job',
        defaults={
            'name': f'Job #{job.id} - {cleaner_user.username}'
        }
    )
    
    # Ensure only client and this bidder are participants
    room.participants.add(job.client, cleaner_user)
    
    return room
```

#### **Chat Access Rules**:
- **Clients**: Can see all chats for their jobs (one per bidder)
- **Cleaners**: Can only see chats for jobs they've bid on
- **Chat Creation**: Happens automatically when cleaner submits first bid
- **Chat Visibility**: Appears in UI only after bid exists

---

### 3. Backend Implementation

#### **A. Migration File** (`backend/chat/migrations/0004_add_bidder_to_chatroom.py`):
```python
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('chat', '0003_add_direct_message_type'),
        ('cleaning_jobs', '0005_jobbid_add_bid_system'),
        ('users', '0002_user_profile_fields'),
    ]

    operations = [
        # Change job from OneToOneField to ForeignKey
        migrations.AlterField(
            model_name='chatroom',
            name='job',
            field=models.ForeignKey(
                blank=True, 
                null=True, 
                on_delete=django.db.models.deletion.CASCADE, 
                related_name='chat_rooms',  # Changed from 'chat_room'
                to='cleaning_jobs.cleaningjob'
            ),
        ),
        
        # Add bidder field
        migrations.AddField(
            model_name='chatroom',
            name='bidder',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='bidder_chat_rooms',
                to=settings.AUTH_USER_MODEL,
                help_text='The cleaner/bidder in this job chat'
            ),
        ),
        
        # Add unique constraint for job-bidder pairs
        migrations.AddConstraint(
            model_name='chatroom',
            constraint=models.UniqueConstraint(
                fields=['job', 'bidder'],
                condition=models.Q(room_type='job'),
                name='unique_job_bidder_chat'
            ),
        ),
        
        # Add index for efficient queries
        migrations.AddIndex(
            model_name='chatroom',
            index=models.Index(fields=['job', 'bidder'], name='chat_job_bidder_idx'),
        ),
    ]
```

#### **B. Update Consumers** (`backend/chat/consumers.py`):
```python
class JobChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope['user']
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        
        # Determine bidder based on user role
        if hasattr(self.user, 'role') and self.user.role == 'cleaner':
            self.bidder = self.user
        else:
            # For clients, get bidder from query params or URL
            bidder_id = self.scope['query_string'].decode().get('bidder_id')
            self.bidder = await self.get_user(bidder_id)
        
        # Validate access
        if not await self.can_access_chat():
            await self.close()
            return
        
        # Create unique room group name for this job-bidder pair
        self.room_group_name = f'job_chat_{self.job_id}_bidder_{self.bidder.id}'
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
    
    @database_sync_to_async
    def can_access_chat(self):
        """Check if user has permission to access this chat"""
        from cleaning_jobs.models import JobBid
        
        try:
            job = CleaningJob.objects.get(id=self.job_id)
            
            # Client must own the job
            if self.user == job.client:
                # Client can access any bidder's chat
                return True
            
            # Cleaner must have an active bid
            if self.user == self.bidder:
                bid_exists = JobBid.objects.filter(
                    job=job,
                    cleaner=self.bidder,
                    status__in=['pending', 'accepted']
                ).exists()
                return bid_exists
            
            return False
        except CleaningJob.DoesNotExist:
            return False
```

#### **C. Update Views** (`backend/chat/views.py`):
```python
class ChatRoomViewSet(viewsets.ModelViewSet):
    @action(detail=False, methods=['post'])
    def start_job_chat(self, request):
        """
        Start or get existing job chat for a specific bidder.
        
        POST /chat/rooms/start_job_chat/
        Body: { "job_id": 123, "bidder_id": 456 }
        
        For cleaners: bidder_id defaults to themselves
        For clients: bidder_id required to specify which bidder to chat with
        """
        job_id = request.data.get('job_id')
        bidder_id = request.data.get('bidder_id')
        
        if not job_id:
            return Response(
                {'error': 'job_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            job = CleaningJob.objects.get(id=job_id)
        except CleaningJob.DoesNotExist:
            return Response(
                {'error': 'Job not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Determine bidder
        if hasattr(request.user, 'role') and request.user.role == 'cleaner':
            bidder = request.user
        elif bidder_id:
            try:
                bidder = User.objects.get(id=bidder_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'Bidder not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            return Response(
                {'error': 'bidder_id required for clients'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate bid exists
        bid = JobBid.objects.filter(
            job=job,
            cleaner=bidder,
            status__in=['pending', 'accepted']
        ).first()
        
        if not bid:
            return Response(
                {'error': 'Cleaner must place a bid before chatting'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Validate access
        if request.user not in [job.client, bidder]:
            return Response(
                {'error': 'Not authorized to access this chat'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get or create chat room
        room, created = ChatRoom.objects.get_or_create(
            job=job,
            bidder=bidder,
            room_type='job',
            defaults={
                'name': f'Job #{job.id} - {bidder.username}'
            }
        )
        
        # Ensure participants
        room.participants.add(job.client, bidder)
        
        serializer = self.get_serializer(room)
        return Response(serializer.data, status=status.HTTP_200_OK)
```

---

### 4. Frontend Implementation

#### **A. Update CleaningJobsPool.jsx**:

**Current (One chat button per job)**:
```jsx
{/* Chat Button */}
<button
  onClick={() => {
    navigate(`/jobs/${selectedJob.id}/chat`);
  }}
>
  Chat
</button>
```

**New (Chat button per bidder)**:
```jsx
{/* Bids Section */}
{jobBids.length > 0 && (
  <div className="mt-6">
    <h3 className="text-lg font-semibold mb-3">Bids Received</h3>
    {jobBids.map((bid) => (
      <div key={bid.id} className="border rounded-lg p-4 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium">{bid.cleaner_name}</p>
            <p className="text-2xl font-bold text-green-600">
              ${bid.bid_amount}
            </p>
            <p className="text-sm text-gray-600">
              Est. Duration: {bid.estimated_duration}
            </p>
            {bid.message && (
              <p className="text-sm text-gray-700 mt-2">{bid.message}</p>
            )}
          </div>
          
          <div className="flex space-x-2">
            {/* Chat with this specific bidder */}
            <button
              onClick={() => navigate(
                `/jobs/${selectedJob.id}/chat?bidder=${bid.cleaner_id}`
              )}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
            
            {/* Accept bid button */}
            {selectedJob.status === 'open_for_bids' && (
              <button
                onClick={() => handleAcceptBid(bid.id, bid)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Accept & Pay
              </button>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
)}
```

#### **B. Update Chat URL Routes**:

**Route Pattern**: `/jobs/:jobId/chat?bidder=:bidderId`

**Chat Component Updates**:
```jsx
function JobChat() {
  const { jobId } = useParams();
  const [searchParams] = useSearchParams();
  const bidderId = searchParams.get('bidder');
  
  useEffect(() => {
    // Connect to specific job-bidder chat
    const wsUrl = `ws://localhost:8000/ws/chat/job/${jobId}/?bidder_id=${bidderId}`;
    // ... WebSocket connection
  }, [jobId, bidderId]);
  
  // ...
}
```

---

### 5. UI/UX Flow

#### **Scenario 1: Cleaner Perspective**

1. **Browse Jobs** → Cleaner sees open jobs in job pool
2. **Place Bid** → Cleaner submits bid with price and message
3. **Chat Available** → After bid submission, "Chat with Client" button appears
4. **Click Chat** → Opens chat with client for that specific job
5. **Private Conversation** → Only cleaner and client see messages

#### **Scenario 2: Client Perspective (Multiple Bidders)**

1. **Job Posted** → Client creates job, status `open_for_bids`
2. **Bids Come In** → Multiple cleaners submit bids
3. **View Bids** → Client sees list of bids with details:
   ```
   Bid from John ($150) [Chat] [Accept & Pay]
   Bid from Sarah ($140) [Chat] [Accept & Pay]
   Bid from Mike ($160) [Chat] [Accept & Pay]
   ```
4. **Multiple Chats** → Client can chat with each bidder separately
5. **Compare & Decide** → Client evaluates bids, asks questions via chat
6. **Accept Bid** → Client accepts one bid, proceeds to payment

#### **Scenario 3: No Bid Yet**

1. **Before Bid** → Cleaner views job details, NO chat button visible
2. **Prompt to Bid** → UI shows: "Submit a bid to start chatting with the client"
3. **After Bid** → Chat button appears immediately

---

### 6. Database Queries

#### **Get all chats for a job (client view)**:
```python
chats = ChatRoom.objects.filter(
    job_id=job_id,
    room_type='job'
).select_related('bidder').prefetch_related('participants')

# Returns multiple rooms, one per bidder
```

#### **Get chat for specific job-bidder pair**:
```python
chat = ChatRoom.objects.get(
    job_id=job_id,
    bidder_id=bidder_id,
    room_type='job'
)
```

#### **Get all chats for a cleaner**:
```python
chats = ChatRoom.objects.filter(
    bidder=cleaner_user,
    room_type='job'
).select_related('job')
```

---

### 7. Benefits

1. **Privacy**: Each client-bidder pair has private conversation
2. **Security**: Chat only accessible after bid exists
3. **Clarity**: Client can compare bids and chat separately with each cleaner
4. **Scalability**: System handles jobs with many bidders efficiently
5. **Clean UX**: No confusion about who you're chatting with

---

### 8. Migration Strategy

#### **Data Migration** (for existing chats):
```python
from django.db import migrations

def migrate_existing_chats(apps, schema_editor):
    """
    For existing OneToOne chat rooms:
    1. Find the accepted bid for that job (if exists)
    2. Set bidder to accepted bid's cleaner
    3. For jobs with multiple participants but no accepted bid, 
       create separate chats per bidder
    """
    ChatRoom = apps.get_model('chat', 'ChatRoom')
    JobBid = apps.get_model('cleaning_jobs', 'JobBid')
    
    for room in ChatRoom.objects.filter(room_type='job', job__isnull=False):
        job = room.job
        
        # Find accepted bid
        accepted_bid = JobBid.objects.filter(
            job=job, 
            status='accepted'
        ).first()
        
        if accepted_bid:
            room.bidder = accepted_bid.cleaner
            room.save()
        else:
            # If no accepted bid, find all bids and create separate rooms
            bids = JobBid.objects.filter(job=job, status='pending')
            
            if bids.count() == 1:
                # Single bidder, assign to them
                room.bidder = bids.first().cleaner
                room.save()
            elif bids.count() > 1:
                # Multiple bidders - create separate rooms
                # Keep first room for first bidder
                first_bid = bids.first()
                room.bidder = first_bid.cleaner
                room.participants.clear()
                room.participants.add(job.client, first_bid.cleaner)
                room.save()
                
                # Create new rooms for other bidders
                for bid in bids[1:]:
                    ChatRoom.objects.create(
                        job=job,
                        bidder=bid.cleaner,
                        room_type='job',
                        name=f'Job #{job.id} - {bid.cleaner.username}'
                    )
```

---

## Summary

**Key Changes**:
1. ✅ ChatRoom.job: OneToOneField → ForeignKey (many chats per job)
2. ✅ ChatRoom.bidder: NEW ForeignKey (track which bidder)
3. ✅ Unique constraint: (job, bidder) pair must be unique
4. ✅ Chat creation: Requires active bid to exist
5. ✅ UI: Chat button appears per bidder, not per job
6. ✅ Access control: Enforced at WebSocket and API levels

**Result**: 
- Clients can have separate private conversations with each bidder
- Cleaners can only chat about jobs they've bid on
- System is scalable and maintains privacy
