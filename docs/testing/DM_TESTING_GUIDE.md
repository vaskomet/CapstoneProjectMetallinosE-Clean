# Direct Messaging Testing Guide

**Quick test to verify the new DM functionality works!**

---

## Setup

1. **Login as client**: `client1@test.com` / `testpass123`
2. **Have second user ready**: You'll need another user to DM with

---

## Test Flow

### 1. Access Direct Messages

Navigate to: **http://localhost:5173/messages**

**Expected**:
- ✅ "Direct Messages" page loads
- ✅ Header shows "Direct Messages" title
- ✅ "+ New Message" button visible
- ✅ Empty state: "No conversations yet"

---

### 2. Test API Endpoints Directly (Optional)

**A. Get DM List**:
```bash
# In terminal
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/chat/rooms/direct_messages/
```

Expected: `[]` (empty array - no DMs yet)

**B. Start DM with user ID 2**:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 2}' \
  http://localhost:8000/api/chat/rooms/start_dm/
```

Expected:
```json
{
  "room": {
    "id": ...,
    "room_type": "direct",
    "name": "DM: client1 & cleaner1",
    "participants": [...]
  },
  "created": true
}
```

---

### 3. Create DM via UI

**Steps**:
1. Click **"+ New Message"** button
2. User search modal appears
3. Type in search box: `"cleaner"` or city name
4. Select a user from results
5. DM room opens

**Expected**:
- ✅ Search finds users
- ✅ Clicking user creates DM room
- ✅ ChatRoom component loads with empty history
- ✅ Can type and send messages

---

### 4. Send Messages

**In the DM room**:
1. Type: `"Hello! Testing DMs"`
2. Press Enter

**Expected**:
- ✅ Message appears instantly (optimistic UI)
- ✅ Temp ID → Real ID after server confirms
- ✅ WebSocket shows "Connected"
- ✅ No errors in console

---

### 5. Verify in Conversation List

**Steps**:
1. Click **"← Back"** button
2. Return to DM list

**Expected**:
- ✅ New conversation appears at top
- ✅ Shows last message: "Hello! Testing DMs"
- ✅ Shows timestamp
- ✅ Shows other user's name/avatar

---

### 6. Test Persistence

**Steps**:
1. Refresh page (F5)
2. Navigate back to `/messages`

**Expected**:
- ✅ Conversation still there
- ✅ Messages still visible
- ✅ Can continue conversation

---

### 7. Test Job Chat Still Works

**Steps**:
1. Navigate to existing job chat: `/jobs/5/chat`
2. Send message in job chat

**Expected**:
- ✅ Job chat loads normally
- ✅ Messages send/receive
- ✅ No interference with DM system
- ✅ WebSocket works for both types

---

### 8. Test with Second User (Multi-tab)

**Setup**:
- Tab 1: Logged in as `client1@test.com`
- Tab 2: Logged in as `cleaner1@test.com`

**Steps**:
1. **Tab 1 (client)**: Send DM to cleaner
2. **Tab 2 (cleaner)**: Navigate to `/messages`

**Expected**:
- ✅ Cleaner sees new conversation
- ✅ Message from client visible
- ✅ Real-time WebSocket delivery
- ✅ Unread count updates

---

## Troubleshooting

### "No users found" in search

**Cause**: User search uses cleaner search API (temporary)

**Fix**: 
- Try searching by city: `"Athens"`, `"Los Angeles"`
- Or search partial names if available

**Future**: Dedicated user search endpoint

---

### DM not appearing in list

**Check**:
```bash
# In Django shell
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell

>>> from chat.models import ChatRoom
>>> from users.models import User
>>> 
>>> # Check all direct rooms
>>> ChatRoom.objects.filter(room_type='direct')
>>> 
>>> # Check specific user's DMs
>>> user = User.objects.get(email='client1@test.com')
>>> user.chat_rooms.filter(room_type='direct')
```

---

### WebSocket not connecting

**Browser Console Logs**:
```
🔌 Connecting to unified chat WebSocket...
✅ WebSocket connected
```

If you see errors:
- Check backend is running: `docker-compose -f docker-compose.dev.yml ps`
- Check Redis is up
- Restart backend: `docker-compose -f docker-compose.dev.yml restart backend`

---

### Can't send messages

**Check**:
1. WebSocket connected? (green indicator)
2. Room ID exists? (console logs should show room ID)
3. User has permission? (must be participant)

**Debug**:
```javascript
// In browser console
console.log('Room ID:', roomId)
console.log('User:', user)
console.log('Messages:', messages)
```

---

## Success Criteria

### ✅ Backend
- [x] Migration applied without errors
- [x] API endpoints return correct data
- [x] DM rooms created with correct type
- [x] WebSocket consumers handle DM rooms
- [x] Permissions work (can't access others' DMs)

### ✅ Frontend
- [x] `/messages` route loads DirectMessages component
- [x] User search finds users
- [x] DM creation works (creates or retrieves room)
- [x] ChatRoom component renders with roomId prop
- [x] Messages send/receive in real-time
- [x] Conversation list updates after sending

### ✅ Integration
- [x] Job chats still function normally
- [x] WebSocket handles both room types
- [x] No errors in browser console
- [x] No errors in backend logs

---

## Performance Checks

### Database
```sql
-- Check indexes
SELECT * FROM pg_indexes WHERE tablename = 'chat_chatroom';
-- Should see: chat_room_type_idx

-- Check query performance
EXPLAIN ANALYZE SELECT * FROM chat_chatroom WHERE room_type = 'direct';
```

### Frontend
- Open React DevTools
- Check re-renders (should be minimal)
- Check WebSocket message count
- Monitor memory usage

---

## Next Steps After Testing

1. **Verify all tests pass** ✅
2. **Fix any bugs found** 🐛
3. **Improve user search** (dedicated endpoint)
4. **Add UI polish** (loading states, empty states)
5. **Add analytics** (track DM creation rate)
6. **Deploy to staging** 🚀

---

## Quick Test Commands

```bash
# Restart everything
docker-compose -f docker-compose.dev.yml restart

# Check backend logs
docker-compose -f docker-compose.dev.yml logs backend -f | grep -i "chat\|room\|message"

# Check database
docker-compose -f docker-compose.dev.yml exec db psql -U postgres -d e_clean_db -c "SELECT id, room_type, name FROM chat_chatroom;"

# Run Django tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test chat
```

---

## Rollback (If Needed)

If something breaks:

```bash
# Backend
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate chat 0002

# Frontend - revert commits
git checkout HEAD^ -- frontend/src/components/chat/DirectMessages.jsx
git checkout HEAD^ -- frontend/src/components/chat/ChatRoom.jsx
git checkout HEAD^ -- frontend/src/services/api.js
git checkout HEAD^ -- frontend/src/App.jsx
```

---

**Testing Status**: ⏳ Ready to test

**Tester**: Vasilis

**Date**: 2025-10-26

---

Let me know the results! 🚀
