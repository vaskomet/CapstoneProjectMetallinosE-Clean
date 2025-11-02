# Chat Real-Time Debugging Guide

**Date:** November 2, 2025

## Quick Diagnostic Steps

### Step 1: Check WebSocket Connection

**In Browser Console (Both Windows):**
```javascript
// Check if WebSocket is connected
window.__UNIFIED_CHAT_WS__?.readyState
// Expected: 1 (OPEN)
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

// Check debug info
window.__UNIFIED_CHAT_DEBUG__
// Should show: messages, subscribedRooms, isConnected, connectionStatus
```

### Step 2: Check Room Subscription

**Expected Console Logs When Opening Chat:**
```
🔌 Connecting to unified chat WebSocket...
✅ WebSocket connected
📥 Received: connection_established {user_id: 26, username: 'cleaner1'}
✅ Connected as cleaner1 (ID: 26)
📤 Sent: get_room_list {}
📥 Received: room_list {rooms: Array(4)}
📋 Received 4 rooms

// When you select a room:
🔔 Auto-subscribing to room 4
📤 Sent: subscribe_to_room {room_id: 4}
📥 Received: subscribed {room_id: 4}
✅ Subscribed to room 4
```

### Step 3: Check Message Sending

**Expected Console Logs When Sending "Hello":**

**Window A (Sender):**
```
📤 Sending message to room 4
  ✓ Optimistic message added (temp_1730987654321_abc123)
  ↳ Using WebSocket
📥 Received: new_message {room_id: 4, message: {id: 456, ...}}
💬 New message in room 4 {id: 456, content: "Hello"}
  ✓ Confirming optimistic message (temp_... → 456)
  ✅ Messages state updated (optimistic replacement)
```

**Window B (Receiver):**
```
📥 Received: new_message {room_id: 4, message: {id: 456, ...}}
💬 New message in room 4 {id: 456, content: "Hello"}
  ➕ Adding new message to state (not optimistic)
  ✅ Messages state updated (new message added)
🔍 WebSocket merge effect running: {roomId: 4, wsMessagesCount: 1, paginatedCount: 5}
  ✅ Processing WebSocket messages
  🔍 Found 1 new messages to add
📨 Adding 1 WebSocket messages to room 4: [{id: 456, content: "Hello"}]
```

### Step 4: Check Typing Indicators

**Expected Console Logs When Typing:**

**Window A (Typing):**
```
📤 Sent: typing {room_id: 4}
```

**Window B (Watching):**
```
📥 Received: typing {room_id: 4, user_id: 26, username: 'cleaner1', is_typing: true}
```

## Common Issues and Fixes

### Issue 1: WebSocket Not Connecting

**Symptoms:**
- `window.__UNIFIED_CHAT_WS__?.readyState` returns `undefined` or `3` (CLOSED)
- No `✅ WebSocket connected` log
- Error: `❌ WebSocket error`

**Solutions:**
1. Check backend is running: `docker ps | grep backend`
2. Check auth token exists: `localStorage.getItem('access_token')`
3. Refresh browser window
4. Check backend logs: `docker logs ecloud_backend_dev --tail 50`

### Issue 2: Not Subscribed to Room

**Symptoms:**
- `window.__UNIFIED_CHAT_DEBUG__.subscribedRooms` is empty `[]`
- No `✅ Subscribed to room X` log
- Messages not received

**Solutions:**
1. Check if room is selected in FloatingChatPanel
2. Verify `useUnifiedChatRoom` is being called with correct `roomId`
3. Check console for `🔔 Auto-subscribing to room X`
4. Manually subscribe: `window.__UNIFIED_CHAT_WS__.send(JSON.stringify({type: 'subscribe_to_room', room_id: 4}))`

### Issue 3: Messages Not Appearing

**Symptoms:**
- WebSocket connected ✅
- Room subscribed ✅
- But messages don't appear in UI

**Debug Steps:**
1. **Check if messages are being received:**
   ```javascript
   // In console, check messages state:
   window.__UNIFIED_CHAT_DEBUG__.messages
   // Should show: {4: [msg1, msg2, msg3, ...]}
   ```

2. **Check if effect is running:**
   - Look for: `🔍 WebSocket merge effect running`
   - If missing, `contextMessages` might not be updating

3. **Check if messages are being added:**
   - Look for: `📨 Adding X WebSocket messages to room Y`
   - If you see: `🔍 Found 0 new messages to add`, there's a duplicate detection issue

4. **Force refresh messages:**
   ```javascript
   // In console:
   window.location.reload()
   ```

### Issue 4: Typing Indicators Not Working

**Symptoms:**
- Messages work ✅
- But typing indicators don't show

**Debug Steps:**
1. **Check typing is being sent:**
   ```javascript
   // Should see when typing:
   📤 Sent: typing {room_id: 4}
   ```

2. **Check typing is being received:**
   ```javascript
   // Other window should see:
   📥 Received: typing {room_id: 4, ...}
   ```

3. **Check typing state:**
   ```javascript
   // In console:
   window.__UNIFIED_CHAT_DEBUG__
   // Look for typingUsers property
   ```

## Backend Verification

### Check WebSocket Connections

```bash
docker logs ecloud_backend_dev --tail 100 | grep -E "WebSocket|unified_consumer"
```

**Expected:**
```
INFO unified_consumer WebSocket connected: user=cleaner1 (ID: 26)
INFO unified_consumer User cleaner1 subscribed to room 4
INFO unified_consumer Message sent: room=4, user=cleaner1, content_length=5
```

### Check Message Broadcasting

**Backend should show:**
```
INFO unified_consumer Message sent: room=4, user=cleaner1, content_length=5
```

**Frontend should receive shortly after:**
```
📥 Received: new_message {room_id: 4, ...}
```

If backend shows message sent but frontend doesn't receive, there's a channel layer issue.

## Manual Testing Commands

### Test WebSocket Connection
```javascript
// In browser console:
const ws = window.__UNIFIED_CHAT_WS__;
if (!ws) console.error('WebSocket not initialized!');
else if (ws.readyState !== 1) console.error('WebSocket not open!', ws.readyState);
else console.log('✅ WebSocket ready!');
```

### Test Message Sending
```javascript
// Manually send a message:
window.__UNIFIED_CHAT_WS__.send(JSON.stringify({
  type: 'send_message',
  room_id: 4,
  content: 'Test message'
}));
```

### Test Subscription
```javascript
// Manually subscribe to room:
window.__UNIFIED_CHAT_WS__.send(JSON.stringify({
  type: 'subscribe_to_room',
  room_id: 4
}));

// Check subscription:
setTimeout(() => {
  console.log('Subscribed rooms:', window.__UNIFIED_CHAT_DEBUG__.subscribedRooms);
}, 1000);
```

### Test Message Reception
```javascript
// Check messages in context:
console.log('Messages:', window.__UNIFIED_CHAT_DEBUG__.messages);

// Check messages for specific room:
console.log('Room 4 messages:', window.__UNIFIED_CHAT_DEBUG__.messages[4]);
```

## Complete Test Scenario

**Window A (cleaner1):**
1. Open console (F12)
2. Navigate to chat
3. Open FloatingChatPanel
4. Select a room
5. Run: `window.__UNIFIED_CHAT_DEBUG__`
6. Verify: `isConnected: true`, `subscribedRooms: [4]`
7. Type a message but don't send
8. Check Window B for typing indicator

**Window B (client1):**
1. Open console (F12)
2. Navigate to chat
3. Open FloatingChatPanel
4. Select SAME room
5. Run: `window.__UNIFIED_CHAT_DEBUG__`
6. Verify: `isConnected: true`, `subscribedRooms: [4]`
7. Watch console for: `📥 Received: typing`
8. Watch UI for typing indicator

**Send Message (Window A):**
1. Complete typing message
2. Click Send
3. Watch console for: `📤 Sending message`, `📥 Received: new_message`
4. Message should appear instantly

**Receive Message (Window B):**
1. Watch console for: `📥 Received: new_message`
2. Watch console for: `🔍 WebSocket merge effect running`
3. Watch console for: `📨 Adding 1 WebSocket messages`
4. Message should appear instantly in UI

## Still Not Working?

If after all these steps messages still don't appear in real-time:

1. **Check React StrictMode**:
   - StrictMode causes double-mounting in development
   - This can cause subscription issues
   - Temporarily disable in main.jsx for testing

2. **Check Browser Tab Focus**:
   - Some browsers throttle WebSockets in background tabs
   - Keep both windows visible side-by-side

3. **Check Network Tab**:
   - Open Dev Tools → Network → WS (WebSocket)
   - Should see WebSocket connection
   - Click on it to see frames (messages)
   - Verify messages are being sent/received

4. **Nuclear Option - Full Restart**:
   ```bash
   docker-compose -f docker-compose.dev.yml restart backend frontend
   ```
   Then refresh both browser windows

---

**Next Steps:**
Please run through these diagnostic steps and share:
1. Output of `window.__UNIFIED_CHAT_DEBUG__` from both windows
2. Console logs when sending a message
3. Any errors in console or Network tab
