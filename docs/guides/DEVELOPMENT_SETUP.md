# E-Clean Development Guide

## Two Development Options

### Option 1: Full Docker Development (Hot Reload) ⭐ **RECOMMENDED**

**Pros:**
- ✅ All services in Docker (consistent environment)
- ✅ Hot reload works (immediate changes)
- ✅ Redis/WebSocket notifications work perfectly
- ✅ No local Node.js installation needed

**How to use:**
```bash
# Stop any running containers
docker compose -f docker-compose.dev.yml down

# Start all services with hot reload
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs frontend -f
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:8000  
- Admin: http://localhost:8000/admin

### Option 2: Local Frontend + Docker Services

**Pros:**
- ✅ Fastest hot reload
- ✅ Native development tools
- ✅ Still connects to Redis/DB in Docker

**Cons:**
- ❌ Requires local Node.js installation
- ❌ More complex setup

**How to use:**
```bash
# Option A: Use the script
./scripts/dev-local.sh

# Option B: Manual setup
docker compose -f docker-compose.dev.yml up -d backend db redis
cd frontend
npm install
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## Important Notes

### WebSocket/Redis Requirements
- **Redis is REQUIRED** for WebSocket notifications
- Both options include Redis in Docker
- Never run frontend without Redis - notifications won't work

### Unified Chat Architecture
- Active chat endpoint: `ws/chat/` (single persistent connection, room subscription messages)
- Notifications endpoint: `ws/notifications/<user_id>/`
- Legacy chat endpoints (`ws/chat/<room_name>/`, `ws/job_chat/<job_id>/`) are **deprecated** and slated for removal.

### Database Behavior
- **Docker dev**: PostgreSQL container (recommended for parity with production)
- **Pure local run** (no Docker db): Falls back to SQLite automatically if `POSTGRES_*` variables are removed/commented in `.env.dev.local`
- Switching: comment/uncomment `POSTGRES_DB` (and related vars) → restart backend

### Event System
- Redis also powers a lightweight Pub/Sub event bus via `core/events.py` (no Celery workers configured despite older doc references)
- Update any legacy references to “Celery background tasks” unless you introduce Celery explicitly.

### File Changes
- **Option 1**: Changes reflect immediately in Docker (hot reload enabled)
- **Option 2**: Changes reflect immediately in local server

### Which Option to Choose?

**Use Option 1 (Docker) if:**
- You want consistent environment
- Team collaboration
- Easier setup
- Don't want to install Node.js locally

**Use Option 2 (Local) if:**
- You prefer native development tools
- Want absolute fastest reload times
- Advanced debugging needs

## Current Status: ✅ Both Options Ready

The "Docker not updating" issue has been resolved! Option 1 now includes hot reload.

## Quick Commands

### Docker Development (Option 1)
```bash
# Start everything
docker compose -f docker-compose.dev.yml up -d

# Restart just frontend
docker compose -f docker-compose.dev.yml restart frontend

# View frontend logs
docker compose -f docker-compose.dev.yml logs frontend -f

# Stop everything
docker compose -f docker-compose.dev.yml down
```

### Local Development (Option 2)
```bash
# Start services only
docker compose -f docker-compose.dev.yml up -d backend db redis

# Start frontend locally
cd frontend && npm run dev

# Stop services
docker compose -f docker-compose.dev.yml down
```

## Environment Variables

Both options use the same environment variables:
- `REACT_APP_API_URL=http://localhost:8000/api`
- `REACT_APP_WS_URL=ws://localhost:8000/ws`
 - PostgreSQL (Docker): `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5432`
 - Redis: `REDIS_URL=redis://:redis_dev_password@localhost:6379/0`
 - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

## Troubleshooting

### Frontend not updating in Docker?
- Make sure you're using `docker-compose.dev.yml` (not production)
- Check that Dockerfile.dev is being used
- Verify volumes are mounted correctly

### WebSocket notifications not working?
- Ensure Redis is running in Docker
- Check WebSocket URL matches backend port
- Verify user is authenticated

### Local development issues?
- Install Node.js 20+
- Run `npm install` in frontend directory
- Ensure Docker services are running