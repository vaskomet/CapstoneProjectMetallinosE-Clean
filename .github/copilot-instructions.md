# E-Clean Platform - AI Agent Instructions

## Project Overview
E-Clean is a marketplace connecting clients with professional cleaners. Django REST + React stack with real-time chat (WebSockets), Stripe payments, bidding system, and photo documentation workflow.

## Critical Architecture Patterns

### Dual-App Job Management
The platform uses TWO Django apps for job management:
- **`cleaning_jobs/`**: Core job model (`CleaningJob`), bidding system (`JobBid`), status management
- **`job_lifecycle/`**: Enhanced workflow (`JobAction`, `JobLifecycleEvent`), photo documentation (`JobPhoto`), timing validation

**Why**: Separation of core business logic from advanced workflow features. Always check BOTH apps when modifying job-related functionality.

### Hybrid Real-Time Architecture
- **REST API**: Primary data operations (CRUD, listing, filtering)
- **WebSockets**: Real-time updates only (chat, notifications, presence)
- **Redis Pub/Sub**: Event bus for cross-component communication (`core/events.py` → topic-based routing)

**Key Files**:
- `backend/e_clean_backend/routing.py` - WebSocket URL patterns
- `backend/chat/unified_consumer.py` - Single WebSocket connection for all chat operations (NEW pattern)
- `frontend/src/contexts/WebSocketContext.jsx` - Connection management with auto-reconnect

### Payment Flow (Critical Business Logic)
Payment happens when client accepts a cleaner's bid:
1. Client clicks "Accept & Pay" → Opens `PaymentModal.jsx`
2. Stripe checkout processes payment → Backend creates `Payment` record
3. Job status: `open_for_bids` → `bid_accepted` → `confirmed`
4. Start/Finish actions validate payment status (see `JobWorkflowModal.jsx` lines 97-101)
5. Completion triggers payout to cleaner's Stripe Connect account

**Never allow job progression without payment validation**. See `PAYMENT_FLOW_EXPLANATION.md` for full flow.

## Development Workflows

### Starting Development
```bash
# Option 1: Full Docker with hot reload (RECOMMENDED)
docker compose -f docker-compose.dev.yml up -d

# Option 2: Local frontend + Docker services
./scripts/dev-local.sh
```

**Important**: Redis is REQUIRED for WebSocket features. Never run frontend without Redis.

### Database Operations
```bash
# Always use docker-compose prefix in dev
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

# After manual SQL or scripts, ALWAYS reset sequences
python manage.py reset_sequences
```

**Critical**: PostgreSQL sequences don't auto-update after manual data insertion. Always run `reset_sequences` after using `create_test_data.py` or SQL scripts to prevent ID collision errors.

## Project-Specific Conventions

### Authentication Pattern
- **Email-based login**: Custom auth backend in `users/backends.py` uses email instead of username
- **JWT tokens**: Store in localStorage, auto-refresh via axios interceptors in `services/api.js`
- **UserContext**: Global auth state - use `useUser()` hook, never access localStorage directly
- **Protected routes**: Wrap with `<ProtectedRoute>` component, not manual auth checks

### API Service Layer
All API calls go through `frontend/src/services/api.js`:
```javascript
// Use domain-specific APIs, not direct axios calls
import { cleaningJobsAPI, authAPI } from './services/api';
await cleaningJobsAPI.getAll({ status: 'open_for_bids' });
```

**Benefits**: Automatic JWT injection, retry logic, error handling, loading states, toast notifications. See module docstring for `apiCall()` wrapper options.

### Error Handling Strategy
Three-layer approach:
1. **API layer**: `utils/errorHandling.js` - retry logic, network errors
2. **Component level**: Try/catch with user-friendly messages via toast
3. **Global boundary**: `utils/globalSetup.js` - catches uncaught errors

**Never throw raw errors to users**. Always transform to user-friendly messages.

### Role-Based Access
User roles: `client`, `cleaner`, `admin`
- Check with: `user.role === 'cleaner'` (NOT `user.is_cleaner`)
- Backend: Use `request.user.role` in views, not permissions classes
- Frontend: Conditional rendering based on `user.role` from UserContext
- Navigation: See `Navigation.jsx` for role-based link patterns

## Key Integration Points

### Chat System (Job-Centric)
- **One chat room per job**: ChatRoom has `OneToOneField` to CleaningJob
- **Auto-creation**: Created when bid accepted, NOT when job posted
- **Access control**: Only client, assigned cleaner, and admins can access
- **WebSocket URL**: `ws/chat/` (unified) or legacy `ws/job_chat/{job_id}/`

**Migration in progress**: Unified consumer replacing per-room connections (see `CHAT_ARCHITECTURE_ANALYSIS.md`).

### Photo Upload Workflow
- **Drag & drop component**: `PhotoUpload.jsx` with preview
- **Timing validation**: Backend enforces photo requirements based on job status
- **Storage**: `media/jobs/{job_id}/{before|after}/{filename}`
- **API**: Multipart form data via `jobLifecycleAPI.uploadPhoto()`

### Notification System
- **Database**: `notifications/` app - `Notification`, `NotificationTemplate`, `NotificationPreference`
- **Real-time**: Redis Pub/Sub → WebSocket delivery to `ws/notifications/{user_id}/`
- **Event-driven**: Jobs publish events via `EventPublisher` (`core/events.py`)
- **Subscribers**: Background listeners in `notifications/subscribers.py`

## Testing & Debugging

### Test Data Creation
Use management commands in `backend/create_*.py`:
```bash
docker compose -f docker-compose.dev.yml exec backend python create_athens_test_users.py
docker compose -f docker-compose.dev.yml exec backend python manage.py reset_sequences
```

Test credentials in `TEST_CREDENTIALS.md`.

### Common Issues
- **WebSocket not connecting**: Check Redis is running, JWT token valid, CORS settings
- **ID collision errors**: Run `python manage.py reset_sequences`
- **Payment validation failing**: Check `payment_info.status === 'succeeded'` in job object
- **Hot reload not working in Docker**: Ensure volumes mounted in `docker-compose.dev.yml`

## Critical Files Reference
- `backend/e_clean_backend/settings.py` - Redis config, CORS, JWT settings, CHANNEL_LAYERS
- `frontend/src/services/api.js` - All API communication (1400+ lines with comprehensive docs)
- `frontend/src/contexts/UserContext.jsx` - Global auth state management
- `backend/cleaning_jobs/models.py` - Core job model with status choices and bidding
- `backend/core/events.py` - Pub/Sub event system for decoupled communication

## Documentation Resources
Extensive markdown docs in project root covering:
- `DEVELOPMENT_SETUP.md` - Two development options with pros/cons
- `DOCKER_DEV_COMMANDS.md` - All Docker commands for daily workflow
- `DATABASE_BEST_PRACTICES.md` - Sequence management and data creation patterns
- `CHAT_ARCHITECTURE_ANALYSIS.md` - Complete chat system architecture (571 lines)
- `PAYMENT_FLOW_EXPLANATION.md` - Step-by-step payment integration
- `PROJECT_STATUS.md` - Current implementation status and feature overview

When unclear about any system, check these docs first before making assumptions.
