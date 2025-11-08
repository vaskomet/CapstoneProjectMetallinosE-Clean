# 🔧 WebSocket & Redis Configuration Fixes

**Date**: November 2, 2025  
**Issue**: WebSocket connections dropping, messages not appearing in real-time  
**Status**: 🔴 CRITICAL - Requires immediate attention

---

## 🚨 Critical Problems Identified

### Problem 1: Redis Password Not in CHANNEL_LAYERS
**Impact**: Django Channels cannot connect to Redis properly  
**Symptoms**: WebSocket connections fail intermittently

**Current Issue**:
```python
# ❌ WRONG - No password!
CHANNEL_LAYERS = {
    'default': {
        'CONFIG': {
            'hosts': ['redis://localhost:6379/0'],  # Missing password!
        },
    },
}
```

**Fix Applied**:
```python
# ✅ CORRECT - Includes password from environment
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.environ.get('REDIS_URL', 'redis://:redis_dev_password@localhost:6379/0')],
            'capacity': 1500,  
            'expiry': 10,
        },
    },
}
```

---

### Problem 2: WebSocket Disconnections Every ~5 Minutes
**Impact**: Chat connections drop, messages lost  
**Symptoms**: Code 1006 (abnormal closure) in logs

**Root Causes**:
1. **No WebSocket ping/pong**: Idle connections timeout
2. **Redis Pub/Sub blocking**: Indefinite waits without keepalive
3. **Channel Layer message expiry**: Messages expire too quickly

---

### Problem 3: Channels vs. Native WebSockets Confusion
**Issue**: You're using Django Channels (Daphne) but the websockets.py documentation is for **native Python websockets library**

**Your Stack** (Correct for Django):
- ✅ Django Channels (with Daphne ASGI server)
- ✅ `channels_redis` for channel layer
- ✅ Redis Pub/Sub for events
- ✅ AsyncWebsocketConsumer

**What the Doc Showed** (Different approach):
- ❌ Native `websockets` library (standalone server)
- ❌ Direct Redis Pub/Sub connection
- ❌ No Django Channels involved

**Verdict**: Your architecture is **CORRECT** for Django. Don't switch to native websockets!

---

## ✅ Solutions

### Fix 1: Update CHANNEL_LAYERS (DONE ✅)

Location: `backend/e_clean_backend/settings.py`

Added:
- Password in Redis URL
- `capacity`: 1500 messages per channel
- `expiry`: 10 seconds message TTL

### Fix 2: Add WebSocket Keepalive

Add keepalive configuration to your unified consumer:

```python
# In UnifiedChatConsumer.__init__()
self.ping_interval = 30  # Send ping every 30 seconds
self.ping_timeout_task = None
```

```python
# Add ping/pong handler
async def websocket_receive(self, message):
    """Handle incoming WebSocket messages including pongs."""
    if message.get('type') == 'websocket.receive':
        text_data = message.get('text')
        if text_data:
            data = json.loads(text_data)
            
            # Handle pong response
            if data.get('type') == 'pong':
                logger.debug(f"Received pong from {self.user.username}")
                return
                
            # Handle other messages...
```

### Fix 3: Increase Daphne Timeout

Add to `docker-compose.dev.yml`:

```yaml
backend:
  command: >
    sh -c "python manage.py migrate &&
           daphne -b 0.0.0.0 -p 8000
           --ping-interval 25
           --ping-timeout 60
           e_clean_backend.asgi:application"
```

This tells Daphne to:
- Send WebSocket pings every 25 seconds
- Wait 60 seconds for pong before closing

---

## 📋 Step-by-Step Fix Implementation

### Step 1: Update Redis Connection Settings ✅ DONE

Already fixed `CHANNEL_LAYERS` with password.

### Step 2: Add WebSocket Ping/Pong

**File**: `backend/chat/unified_consumer.py`

Add automatic ping/pong to keep connections alive.

### Step 3: Update Docker Compose

**File**: `docker-compose.dev.yml`

Add Daphne ping configuration.

### Step 4: Restart All Services

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml build --no-cache backend
docker compose -f docker-compose.dev.yml up -d
```

---

## 🔍 Debugging Commands

### Check Redis Connection
```bash
# Connect to Redis container
docker exec -it ecloud_redis_dev redis-cli

# Authenticate
AUTH redis_dev_password

# Check connected clients
CLIENT LIST

# Monitor Pub/Sub
PUBSUB CHANNELS

# Monitor all commands
MONITOR
```

### Check Channel Layer
```bash
# Django shell in container
docker exec -it ecloud_backend_dev python manage.py shell

# Test channel layer
from channels.layers import get_channel_layer
channel_layer = get_channel_layer()
await channel_layer.send('test_channel', {'type': 'test.message', 'text': 'Hello'})
```

### Check WebSocket Connections
```bash
# Backend logs (live)
docker logs -f ecloud_backend_dev

# Look for:
# - "WebSocket connected"
# - "WebSocket disconnecting"
# - Any Redis errors
```

---

## 🎯 Expected Behavior After Fixes

### Before (Broken):
- ❌ WebSocket disconnects every ~5 minutes (code 1006)
- ❌ Messages don't appear in real-time
- ❌ Users must refresh to see messages
- ❌ Redis connection errors intermittent

### After (Fixed):
- ✅ WebSocket stays connected indefinitely
- ✅ Automatic reconnection if dropped
- ✅ Ping/pong every 25-30 seconds keeps connection alive
- ✅ Messages appear instantly in both windows
- ✅ No Redis authentication errors

---

## 📚 Key Takeaways

### Your Architecture is Correct! ✅

**Don't change**:
- Django Channels (perfect for Django integration)
- Daphne ASGI server
- `channels_redis` for messaging
- AsyncWebsocketConsumer pattern

**The websockets.py docs show a different approach** (standalone server). You're using the **better approach** for Django!

### Redis Best Practices

1. **Always use password authentication** in production
2. **Configure timeouts properly**:
   - `socket_timeout=None` for Pub/Sub (blocking operations)
   - `socket_keepalive=True` to prevent idle disconnects
3. **Use appropriate database numbers**:
   - DB 0: Channel Layer (WebSocket message passing)
   - DB 1: Pub/Sub events (optional separation)

### WebSocket Best Practices

1. **Implement ping/pong**: Keep connections alive
2. **Handle reconnection**: Client should auto-reconnect on drop
3. **Message deduplication**: Handle potential duplicates
4. **Graceful degradation**: Fall back to polling if WS fails

---

## 🚀 Next Steps

1. **Apply remaining fixes** (Steps 2-3 above)
2. **Restart services**
3. **Test with two browsers**:
   - Open chat in Window A and B
   - Leave open for 10+ minutes
   - Send messages back and forth
   - Verify no disconnections
4. **Monitor logs** for any errors
5. **Stress test**: 
   - Open 10+ browser tabs
   - Send messages from multiple users
   - Check connection stability

---

## 📖 References

- [Django Channels Docs](https://channels.readthedocs.io/)
- [channels-redis Configuration](https://github.com/django/channels_redis)
- [Daphne WebSocket Settings](https://github.com/django/daphne)
- [Redis Pub/Sub Best Practices](https://redis.io/docs/manual/pubsub/)

---

**Status**: Step 1 complete (Redis password fixed). Steps 2-4 pending.
**Priority**: 🔴 HIGH - Chat is core functionality
**Estimated Time**: 30 minutes to complete all fixes
