# Chat Architecture: Current vs Proposed - Code Examples

This document shows concrete code comparisons between the current and proposed simplified architecture.

---

## 📱 Example 1: Opening a Chat Room

### Current Implementation (Complex)

```jsx
// Step 1: User clicks chat icon in Navigation.jsx
const Navigation = () => {
  const { toggleChat } = useChat(); // From ChatContext
  
  return (
    <button onClick={toggleChat}>
      <ChatIcon />
    </button>
  );
};

// Step 2: ChatContext manages panel state
const ChatContext = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  
  // REST API polling every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchChatData(); // REST: GET /chat/rooms/
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const toggleChat = () => setIsChatOpen(!isChatOpen);
  
  return <ChatContext.Provider value={{ isChatOpen, toggleChat, chatRooms }}>
    {children}
  </ChatContext.Provider>;
};

// Step 3: FloatingChatPanel displays ChatList
const FloatingChatPanel = () => {
  const { isChatOpen, chatRooms } = useChat(); // ChatContext
  
  return isChatOpen && <div>
    <ChatList rooms={chatRooms} onSelect={handleSelectRoom} />
  </div>;
};

// Step 4: User selects room, ChatRoom component connects WebSocket
const ChatRoom = ({ jobId }) => {
  const { connectChatWebSocket } = useWebSocket(); // WebSocketContext
  const { messages, sendMessage } = useChat(jobId); // useChat hook
  
  useEffect(() => {
    const ws = connectChatWebSocket(jobId); // Creates WebSocket
    return () => ws?.close();
  }, [jobId]);
  
  return <div>
    {messages.map(msg => <Message key={msg.id} {...msg} />)}
  </div>;
};

// Step 5: Message arrives, complex event chain
// WebSocketContext.jsx
const handleChatMessage = (data) => {
  setChatMessages(prev => ({ ...prev, [roomId]: [...prev[roomId], data.message] }));
  // Custom event dispatch
  window.dispatchEvent(new CustomEvent('newChatMessage', { 
    detail: { roomId, message: data.message } 
  }));
};

// Step 6: ChatContext listens for custom event
useEffect(() => {
  const handleNewMessage = (event) => {
    incrementUnreadCount();
    fetchChatData(); // Another REST API call!
  };
  window.addEventListener('newChatMessage', handleNewMessage);
  return () => window.removeEventListener('newChatMessage', handleNewMessage);
}, []);
```

**Problems**:
- ❌ 3 separate contexts (ChatContext, WebSocketContext, useChat)
- ❌ Custom events for component communication
- ❌ REST API called twice (polling + after message)
- ❌ Complex WebSocket connection management
- ❌ State duplicated in multiple places

---

### Proposed Implementation (Simple)

```jsx
// Step 1: User clicks chat icon in Navigation.jsx
const Navigation = () => {
  const { togglePanel } = useChat(); // Single context
  
  return (
    <button onClick={togglePanel}>
      <ChatIcon />
    </button>
  );
};

// Step 2: Single ChatContext manages everything
const ChatProvider = ({ children }) => {
  const { user, token } = useUser();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const wsRef = useRef(null);
  
  // Single WebSocket connection on mount
  useEffect(() => {
    if (!user || !token) return;
    
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/?token=${token}`);
    
    ws.onopen = () => {
      console.log('Connected');
      // Server automatically sends room list on connect
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'room_list':
          setRooms(data.rooms);
          setUnreadCounts(data.unread_counts);
          break;
          
        case 'message':
          setMessages(prev => ({
            ...prev,
            [data.room_id]: [...(prev[data.room_id] || []), data.message]
          }));
          // Update unread if not from current user
          if (data.message.sender.id !== user.id) {
            setUnreadCounts(prev => ({
              ...prev,
              [data.room_id]: (prev[data.room_id] || 0) + 1
            }));
          }
          break;
          
        case 'unread_update':
          setUnreadCounts(prev => ({
            ...prev,
            [data.room_id]: data.count
          }));
          break;
      }
    };
    
    wsRef.current = ws;
    return () => ws.close();
  }, [user, token]);
  
  const togglePanel = () => setIsPanelOpen(!isPanelOpen);
  
  const sendMessage = (roomId, content) => {
    wsRef.current?.send(JSON.stringify({
      type: 'send_message',
      room_id: roomId,
      content
    }));
  };
  
  const value = {
    isPanelOpen,
    togglePanel,
    rooms,
    messages,
    unreadCounts,
    sendMessage
  };
  
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// Step 3: FloatingChatPanel - same as before, simpler data access
const FloatingChatPanel = () => {
  const { isPanelOpen, rooms } = useChat(); // Single source
  
  return isPanelOpen && <div>
    <ChatList rooms={rooms} />
  </div>;
};

// Step 4: ChatRoom - no WebSocket management needed!
const ChatRoom = ({ roomId }) => {
  const { messages, sendMessage } = useChat(); // Everything from one place
  const roomMessages = messages[roomId] || [];
  
  const handleSend = (content) => {
    sendMessage(roomId, content);
  };
  
  return <div>
    {roomMessages.map(msg => <Message key={msg.id} {...msg} />)}
    <MessageInput onSend={handleSend} />
  </div>;
};
```

**Benefits**:
- ✅ Single context - easy to understand
- ✅ No custom events - direct state updates
- ✅ No REST polling - WebSocket only
- ✅ Simple WebSocket management
- ✅ Clear data flow

---

## 📨 Example 2: Sending a Message

### Current Implementation

```jsx
// ChatRoom.jsx
const ChatRoom = ({ jobId }) => {
  const { user } = useUser();
  const { messages, isConnected, sendMessage } = useChat(jobId);
  const [newMessage, setNewMessage] = useState('');
  
  const handleSend = () => {
    // Calls useChat hook
    sendMessage(newMessage);
    setNewMessage('');
  };
  
  return <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} />;
};

// useChat hook (frontend/src/hooks/useWebSocket.js)
export const useChat = (roomId) => {
  const { connectChatWebSocket } = useWebSocket(); // WebSocketContext
  const wsRef = useRef(null);
  
  useEffect(() => {
    const ws = connectChatWebSocket(roomId);
    wsRef.current = ws;
    return () => ws?.close();
  }, [roomId]);
  
  const sendMessage = (content) => {
    // Sends to WebSocket
    wsRef.current?.send(JSON.stringify({
      type: 'message',
      message: content
    }));
  };
  
  return { sendMessage };
};

// WebSocketContext.jsx
const connectChatWebSocket = useCallback((jobId) => {
  const ws = new WebSocket(`ws://localhost:8000/ws/job_chat/${jobId}/?token=${token}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleChatMessage(data); // Processes message
  };
  
  return ws;
}, [token]);

const handleChatMessage = (data) => {
  // Updates state in WebSocketContext
  setChatMessages(prev => ({
    ...prev,
    [roomId]: [...(prev[roomId] || []), data.message]
  }));
  
  // Dispatches custom event
  window.dispatchEvent(new CustomEvent('newChatMessage', {
    detail: { roomId, message: data.message }
  }));
};

// ChatContext.jsx - listens for custom event
useEffect(() => {
  const handleNewMessage = (event) => {
    const { roomId, message } = event.detail;
    if (message.sender?.id !== user?.id) {
      incrementUnreadCount();
    }
    fetchChatData(); // REST API call!
  };
  
  window.addEventListener('newChatMessage', handleNewMessage);
  return () => window.removeEventListener('newChatMessage', handleNewMessage);
}, [user]);
```

**Flow**: Component → useChat → WebSocketContext → WebSocket → Backend → Redis → WebSocket → handleChatMessage → Custom Event → ChatContext listener → REST API call → State update → UI update

**Steps**: 11 steps, 4 different files

---

### Proposed Implementation

```jsx
// ChatRoom.jsx
const ChatRoom = ({ roomId }) => {
  const { user, messages, sendMessage } = useChat();
  const [newMessage, setNewMessage] = useState('');
  
  const handleSend = () => {
    // Direct call to context
    sendMessage(roomId, newMessage);
    setNewMessage('');
  };
  
  const roomMessages = messages[roomId] || [];
  
  return (
    <div>
      {roomMessages.map(msg => <Message key={msg.id} {...msg} />)}
      <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};

// ChatContext.jsx - single source of truth
const ChatProvider = ({ children }) => {
  const { user, token } = useUser();
  const [messages, setMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const wsRef = useRef(null);
  
  useEffect(() => {
    if (!user || !token) return;
    
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/?token=${token}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'message') {
        // Direct state update
        setMessages(prev => ({
          ...prev,
          [data.room_id]: [...(prev[data.room_id] || []), data.message]
        }));
        
        // Update unread count if message from someone else
        if (data.message.sender.id !== user.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [data.room_id]: (prev[data.room_id] || 0) + 1
          }));
        }
      }
    };
    
    wsRef.current = ws;
    return () => ws.close();
  }, [user, token]);
  
  const sendMessage = (roomId, content) => {
    wsRef.current?.send(JSON.stringify({
      type: 'send_message',
      room_id: roomId,
      content
    }));
  };
  
  return <ChatContext.Provider value={{ messages, unreadCounts, sendMessage }}>
    {children}
  </ChatContext.Provider>;
};
```

**Flow**: Component → ChatContext.sendMessage → WebSocket → Backend → Redis → WebSocket → onmessage → Direct state update → UI update

**Steps**: 7 steps, 2 files

**Difference**: -4 steps, -2 files, no custom events, no REST API call

---

## 🔢 Example 3: Unread Count Updates

### Current Implementation

```jsx
// Navigation.jsx
const Navigation = () => {
  const { totalUnreadCount } = useChat(); // ChatContext
  
  return <button>
    <ChatIcon />
    {totalUnreadCount > 0 && <Badge>{totalUnreadCount}</Badge>}
  </button>;
};

// ChatContext.jsx
const ChatProvider = ({ children }) => {
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [chatRooms, setChatRooms] = useState([]);
  
  // REST polling every 30 seconds
  const fetchChatData = useCallback(async () => {
    const rooms = await chatAPI.getAllRooms(); // REST API call
    setChatRooms(rooms);
    
    // Calculate unread count
    const total = rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
    setTotalUnreadCount(total);
  }, []);
  
  useEffect(() => {
    fetchChatData(); // Initial fetch
    const interval = setInterval(fetchChatData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchChatData]);
  
  // Listen for custom events from WebSocket
  useEffect(() => {
    const handleNewMessage = (event) => {
      const { message } = event.detail;
      if (message.sender?.id !== user?.id) {
        incrementUnreadCount(); // Optimistic update
      }
      fetchChatData(); // Fetch to sync with server
    };
    
    window.addEventListener('newChatMessage', handleNewMessage);
    return () => window.removeEventListener('newChatMessage', handleNewMessage);
  }, [user]);
  
  const incrementUnreadCount = () => {
    setTotalUnreadCount(prev => prev + 1);
  };
  
  return <ChatContext.Provider value={{ totalUnreadCount }}>
    {children}
  </ChatContext.Provider>;
};

// backend/chat/serializers.py
class ChatRoomSerializer(serializers.ModelSerializer):
    unread_count = serializers.SerializerMethodField()
    
    def get_unread_count(self, obj):
        # Database query for each room!
        user = self.context['request'].user
        try:
            participant = ChatParticipant.objects.get(room=obj, user=user)
            return participant.unread_count
        except ChatParticipant.DoesNotExist:
            return 0
```

**Problems**:
- ❌ REST polling every 30 seconds (unnecessary load)
- ❌ Database query for each room on every poll
- ❌ Optimistic update + server sync (potential inconsistency)
- ❌ Custom events add complexity
- ❌ Max 30 second delay for unread count update

---

### Proposed Implementation

```jsx
// Navigation.jsx (same)
const Navigation = () => {
  const { unreadCounts } = useChat(); // Single context
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  
  return <button>
    <ChatIcon />
    {totalUnread > 0 && <Badge>{totalUnread}</Badge>}
  </button>;
};

// ChatContext.jsx - WebSocket-based updates
const ChatProvider = ({ children }) => {
  const { user, token } = useUser();
  const [unreadCounts, setUnreadCounts] = useState({});
  
  useEffect(() => {
    if (!user || !token) return;
    
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/?token=${token}`);
    
    ws.onopen = () => {
      // Server sends initial unread counts on connect
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'initial_state':
          // Received on connection
          setUnreadCounts(data.unread_counts);
          break;
          
        case 'message':
          // Real-time message received
          if (data.message.sender.id !== user.id) {
            setUnreadCounts(prev => ({
              ...prev,
              [data.room_id]: (prev[data.room_id] || 0) + 1
            }));
          }
          break;
          
        case 'mark_read':
          // Room marked as read
          setUnreadCounts(prev => ({
            ...prev,
            [data.room_id]: 0
          }));
          break;
      }
    };
    
    wsRef.current = ws;
    return () => ws.close();
  }, [user, token]);
  
  const markRoomAsRead = (roomId) => {
    wsRef.current?.send(JSON.stringify({
      type: 'mark_read',
      room_id: roomId
    }));
  };
  
  return <ChatContext.Provider value={{ unreadCounts, markRoomAsRead }}>
    {children}
  </ChatContext.Provider>;
};

// Backend consumer (simplified)
class UnifiedChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        
        # Send initial state on connect
        rooms = await self.get_user_rooms()
        unread_counts = await self.get_unread_counts()
        
        await self.send(text_data=json.dumps({
            'type': 'initial_state',
            'rooms': rooms,
            'unread_counts': unread_counts
        }))
    
    async def receive(self, text_data):
        data = json.loads(text_data)
        
        if data['type'] == 'mark_read':
            await self.mark_room_read(data['room_id'])
            await self.send(text_data=json.dumps({
                'type': 'mark_read',
                'room_id': data['room_id']
            }))
```

**Benefits**:
- ✅ Instant updates (no 30s delay)
- ✅ No REST polling (no server load)
- ✅ Single source of truth (WebSocket)
- ✅ No custom events
- ✅ Always in sync

---

## 📦 Code Size Comparison

### Current Implementation

```
frontend/src/contexts/ChatContext.jsx       118 lines
frontend/src/contexts/WebSocketContext.jsx  464 lines
frontend/src/hooks/useWebSocket.js          360 lines
backend/chat/consumers.py                   364 lines
backend/chat/views.py                        94 lines
backend/chat/serializers.py                 150 lines
───────────────────────────────────────────────────
Total:                                     1550 lines
```

### Proposed Implementation (Estimated)

```
frontend/src/contexts/ChatContext.jsx       280 lines (consolidated)
backend/chat/consumers.py                   200 lines (simplified)
backend/chat/serializers.py                  50 lines (minimal)
───────────────────────────────────────────────────
Total:                                      530 lines
```

**Reduction**: -1020 lines (-66%)

---

## 🎯 Summary of Changes

| Aspect | Current | Proposed | Impact |
|--------|---------|----------|--------|
| **Frontend Contexts** | 3 (Chat, WebSocket, useChat) | 1 (Chat) | -66% complexity |
| **WebSocket Connections** | N+1 (1 notification + N chats) | 1 (unified) | -N connections |
| **REST API Calls** | 1 per 30s | 0 | -100% polling |
| **Custom Events** | Yes | No | Cleaner React patterns |
| **Lines of Code** | ~1550 | ~530 | -66% code |
| **Files to Maintain** | 6 | 3 | -50% files |
| **State Duplication** | 3 places | 1 place | Single source of truth |
| **Update Latency** | Up to 30s | <100ms | 300x faster |
| **Database Queries/min** | ~20 (polling) | 0 (push only) | -100% load |

---

## 🚀 Migration Strategy

### Step 1: Create New Context (Don't Touch Old)
```jsx
// frontend/src/contexts/ChatContextV2.jsx
// Implement new simplified version alongside old
```

### Step 2: Test New Context in Isolation
```jsx
// Create test page that uses ChatContextV2
// Verify all features work
```

### Step 3: Gradual Component Migration
```jsx
// Migrate FloatingChatPanel to use ChatContextV2
// Keep Navigation using old ChatContext temporarily
// Test thoroughly
```

### Step 4: Complete Migration
```jsx
// Migrate remaining components
// Remove old ChatContext, WebSocketContext, useChat hook
// Delete unused code
```

### Step 5: Backend Updates
```python
# Update consumers to support new message types
# Add pagination support
# Remove unused REST endpoints
```

**Total Time**: 6-7 days

---

## ✅ Conclusion

The proposed simplified architecture provides:

1. **Cleaner Code**: -66% lines of code
2. **Better Performance**: Real-time updates, no polling
3. **Easier Maintenance**: Single context to manage
4. **Better UX**: Instant updates instead of 30s delay
5. **Lower Server Load**: No REST polling

**Recommended Action**: Implement simplified architecture over 1 week sprint.

---

*Document Version: 1.0*
*Date: October 25, 2025*
