# Database Configuration & Notification Fix Summary

**Date:** October 23, 2025  
**Issues Fixed:**
1. Notifications not appearing when creating jobs or placing bids
2. Mixed database usage (SQLite locally, PostgreSQL in Docker)

---

## 🐛 Issue 1: Notifications Not Working

### **Root Cause**
Django signals in `backend/cleaning_jobs/signals.py` were calling `user.get_full_name()` which doesn't exist on the custom User model. This caused all signal handlers to fail silently.

### **Error Found in Logs**
```
Error in job_post_save signal: 'User' object has no attribute 'get_full_name'
Error in job_bid_post_save signal: 'User' object has no attribute 'get_full_name'
```

### **Fix Applied**
Modified both signal handlers to construct names from `first_name` and `last_name` fields:

```python
# Before (BROKEN):
client_name = job.client.get_full_name() if job.client else 'Unknown'

# After (FIXED):
client_name = 'Unknown'
if job.client:
    if job.client.first_name or job.client.last_name:
        client_name = f"{job.client.first_name} {job.client.last_name}".strip()
    else:
        client_name = job.client.email  # Fallback to email
```

**Files Modified:**
- `backend/cleaning_jobs/signals.py` - Fixed `_handle_job_save()` and `_handle_bid_save()`

---

## 🗄️ Issue 2: Database Configuration

### **Problem**
- **Docker backend** uses PostgreSQL (`ecloud_dev` database)
- **Local backend** uses SQLite (`db.sqlite3` file)
- Changes in one environment didn't appear in the other
- You wanted only PostgreSQL everywhere

### **Solution**
Created configuration for local backend to use Docker's PostgreSQL database.

### **Files Created**

#### 1. **`backend/.env.local`**
Environment variables for local development:
```bash
POSTGRES_DB=ecloud_dev
POSTGRES_USER=ecloud_user
POSTGRES_PASSWORD=ecloud_dev_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
# ... etc
```

#### 2. **`backend/run-local.sh`**
Helper script to run Django locally with PostgreSQL:
```bash
#!/bin/bash
# Loads .env.local variables
# Starts Docker DB/Redis if needed
# Runs Django dev server connected to PostgreSQL
```

### **How to Use**

#### **Option 1: Run Everything in Docker (Recommended)**
```bash
docker-compose -f docker-compose.dev.yml up -d
```
- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Database: PostgreSQL (Docker)
- All services connected

#### **Option 2: Run Backend Locally with Docker Database**
```bash
# Terminal 1: Start Docker database & Redis
docker-compose -f docker-compose.dev.yml up -d db redis event-subscriber

# Terminal 2: Run local backend
cd backend
./run-local.sh

# Terminal 3: Run frontend
cd frontend
npm run dev
```

**Benefits:**
- ✅ Local backend connects to same PostgreSQL database as Docker
- ✅ No SQLite usage
- ✅ Changes reflect immediately across all environments
- ✅ Event subscriber still runs in Docker (handles notifications)

---

## 📊 Database State

### **Current Setup**
- **PostgreSQL Container:** `ecloud_db_dev`
- **Database Name:** `ecloud_dev`
- **Host (from Docker):** `db`
- **Host (from local):** `localhost`
- **Port:** `5432`
- **User:** `ecloud_user`
- **Password:** `ecloud_dev_password`

### **SQLite File**
The `backend/db.sqlite3` file is no longer used when following the new setup. You can:
- **Keep it:** As a backup or for quick local testing without Docker
- **Delete it:** If you never want to use SQLite

To ensure Django never uses SQLite, the `.env.local` file sets `POSTGRES_DB` which triggers PostgreSQL usage in `settings.py`.

---

## 🔧 How Notifications Work Now

### **Complete Flow**

1. **Job Created:**
   ```
   User creates job → Django signal fires → Event published to Redis
   → Event subscriber receives → Notification created in DB
   → WebSocket sends to eligible cleaners → Toast appears
   ```

2. **Bid Placed:**
   ```
   Cleaner submits bid → Django signal fires → Event published to Redis
   → Event subscriber receives → Notification created for client
   → WebSocket sends to client → Toast appears
   ```

### **Signal Processing**
Both signals now properly:
- ✅ Extract user names from `first_name`/`last_name` fields
- ✅ Fallback to email if name fields are empty
- ✅ Publish events to Redis without errors
- ✅ Include all necessary context (job details, user info, amounts)

---

## 🧪 Testing

### **Test Job Creation Notifications**
```bash
# Create a job in the frontend and watch for notifications
docker-compose -f docker-compose.dev.yml logs -f event-subscriber
```

You should see:
```
Published job_created event for job X
Received event on topic 'jobs': job_created
Created notification for user Y
```

### **Test Bid Notifications**
```bash
# Submit a bid and watch subscriber logs
docker-compose -f docker-compose.dev.yml logs -f event-subscriber
```

You should see:
```
Published bid_received event for bid X
Received event on topic 'jobs': bid_received
Created notification for client Y
```

### **Verify Database**
```bash
# Check notifications in database
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from notifications.models import Notification
print(f'Total notifications: {Notification.objects.count()}')
for n in Notification.objects.order_by('-created_at')[:5]:
    print(f'  {n.title} -> {n.recipient.email}')
"
```

---

## ⚠️ Important Notes

### **Event Subscriber Must Run**
The event subscriber processes Redis events and creates notifications. It MUST be running:
```bash
docker-compose -f docker-compose.dev.yml ps event-subscriber
# Should show "Up" status
```

If it's not running:
```bash
docker-compose -f docker-compose.dev.yml up -d event-subscriber
```

### **Redis Connection**
Both backend and event subscriber need Redis:
- **Backend:** Publishes events
- **Subscriber:** Listens and processes events

Ensure Redis is running:
```bash
docker-compose -f docker-compose.dev.yml ps redis
# Should show "Up (healthy)" status
```

### **WebSocket Connection**
For real-time notifications in browser, WebSocket must be connected:
- Check browser console for: `WebSocket connection established`
- If disconnected, refresh the page

---

## 📝 Summary

**Fixed:**
- ✅ Signal errors preventing notification creation
- ✅ Unified database configuration (PostgreSQL only)
- ✅ Created local development setup with Docker database
- ✅ Event publisher now works correctly

**Next Steps:**
1. Test job creation → Should see notifications for cleaners
2. Test bid submission → Should see notification for client
3. Check event subscriber logs for successful processing
4. Verify notifications appear in browser UI

**Database:**
- Use **Docker** for full stack (recommended)
- Use **`run-local.sh`** for local backend with Docker database
- PostgreSQL is now the single source of truth

---

**Status:** ✅ **READY FOR TESTING**
