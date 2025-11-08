# API Service Layer Refactoring

## Overview
The monolithic `api.js` (1415 lines) has been split into domain-specific modules for better maintainability and organization.

## New Structure

```
frontend/src/services/
├── index.js              # Barrel export (recommended entry point)
├── api.js                # Backwards compatibility export (deprecated)
├── core.js               # Shared infrastructure
├── auth.js               # Authentication module
├── properties.js         # Property management
├── jobs.js               # Job and bid management
├── serviceAreas.js       # Service area management
├── chat.js               # Chat and messaging
├── cleaners.js           # Cleaner search
└── payments.js           # Payment processing
```

## Module Breakdown

### `core.js` (223 lines)
**Shared infrastructure for all API modules**

Exports:
- `api` (default): Configured axios instance
- `API_BASE_URL`: Base URL constant
- `apiCall`: Wrapper function with loading/error/toast integration

Features:
- JWT token injection via request interceptor
- Automatic token refresh on 401 responses
- Retry logic with exponential backoff
- Loading state management integration
- Toast notification integration
- Error handling and user-friendly messages

### `auth.js` (189 lines)
**Authentication and profile management**

API Object: `authAPI`

Methods:
- `login(credentials)`: Email/password authentication
- `register(userData)`: New user registration
- `getProfile()`: Fetch current user profile
- `updateProfile(data)`: Update user profile
- `changePassword(passwords)`: Change user password
- `logout()`: Clear authentication data
- `getCurrentUser()`: Get user from localStorage

### `properties.js` (140 lines)
**Property CRUD operations**

API Object: `propertiesAPI`

Methods:
- `getAll()`: Fetch all properties
- `getById(id)`: Fetch single property
- `create(data)`: Create new property
- `update(id, data)`: Update existing property
- `delete(id)`: Delete property
- `getServiceTypes()`: Fetch available service types

### `jobs.js` (250 lines)
**Job and bid management**

API Objects: `cleaningJobsAPI`, `jobBidsAPI`

cleaningJobsAPI Methods:
- `getAll(params)`: Fetch jobs with filtering
- `getById(id)`: Fetch single job
- `create(data)`: Create new job
- `update(id, data)`: Update job
- `delete(id)`: Delete job
- `updateStatus(id, status)`: Update job status

jobBidsAPI Methods:
- `getAll()`: Fetch all bids
- `getById(id)`: Fetch single bid
- `create(data)`: Submit new bid
- `acceptBid(id)`: Accept a bid (client action)
- `withdrawBid(id)`: Withdraw a bid (cleaner action)

### `serviceAreas.js` (116 lines)
**Service area management**

API Object: `serviceAreasAPI`

Methods:
- `getAll()`: Fetch all service areas
- `getById(id)`: Fetch single service area
- `create(data)`: Create new service area
- `update(id, data)`: Update service area
- `delete(id)`: Delete service area

### `chat.js` (280 lines)
**Chat rooms and messaging**

API Object: `chatAPI`

Methods:
- `getAllRooms()`: Fetch all chat rooms
- `getRoomById(id)`: Fetch single room
- `getMessages(roomId, options)`: Fetch messages with cursor pagination
- `sendMessage(roomId, data)`: Send message
- `markAsRead(messageId)`: Mark message as read
- `getJobChatRoom(jobId)`: Get chat room for job (deprecated)
- `startJobChat(jobId, bidderId)`: Start or get job chat
- `getJobChats(jobId)`: Get all job-related chats
- `startDirectMessage(userId)`: Start or get DM conversation
- `getDirectMessages()`: Get all DM conversations

### `cleaners.js` (96 lines)
**Cleaner search and geolocation**

API Object: `cleanerSearchAPI`

Methods:
- `searchByLocation(params)`: Search cleaners by location (lat/lng, city, postal code)
- `getCurrentLocation()`: Get user's geolocation via browser API

### `payments.js` (185 lines)
**Payment processing and Stripe integration**

API Object: `paymentsAPI`

Methods:
- `createPaymentIntent(bidId, amount)`: Create Stripe payment intent
- `confirmPayment(paymentIntentId)`: Confirm payment after Stripe processing
- `getPayments(params)`: Fetch payment list
- `getPaymentDetails(paymentId)`: Fetch single payment
- `startConnectOnboarding(urls)`: Start Stripe Connect onboarding for cleaners
- `getConnectAccountStatus()`: Get Stripe Connect account status
- `getTransactions(params)`: Fetch transaction history
- `createRefund(refundData)`: Create refund request
- `getRefunds(params)`: Fetch refund list

## Import Patterns

### Option 1: Backwards Compatible (current components use this)
```javascript
import { authAPI, cleaningJobsAPI, chatAPI } from '../services/api';
```
✅ **Works**: api.js re-exports all modules  
⚠️ **Deprecated**: Use direct imports for better tree-shaking

### Option 2: Direct Module Import (recommended)
```javascript
import { authAPI } from '../services/auth';
import { cleaningJobsAPI } from '../services/jobs';
import { chatAPI } from '../services/chat';
```
✅ **Benefits**: Clear dependencies, better tree-shaking, faster IDE autocomplete

### Option 3: Barrel Export
```javascript
import { authAPI, cleaningJobsAPI, chatAPI } from '../services';
```
✅ **Benefits**: Clean imports, centralized entry point  
❓ **Trade-off**: Slightly larger bundle (imports index.js which imports all modules)

## Usage Examples

### Authentication
```javascript
import { authAPI } from '../services/auth';

// Login
const { access, refresh, user } = await authAPI.login({ email, password });

// Get profile
const profile = await authAPI.getProfile();

// Update profile
await authAPI.updateProfile({ first_name: 'John' });
```

### Jobs
```javascript
import { cleaningJobsAPI, jobBidsAPI } from '../services/jobs';

// Get all jobs
const jobs = await cleaningJobsAPI.getAll({ status: 'open_for_bids' });

// Submit bid
await jobBidsAPI.create({ job: jobId, amount: 150, notes: 'Available today' });
```

### Chat
```javascript
import { chatAPI } from '../services/chat';

// Start job chat
const room = await chatAPI.startJobChat(jobId, bidderId);

// Get messages with pagination
const { messages, has_more, oldest_id } = await chatAPI.getMessages(roomId, { limit: 50 });

// Send message
await chatAPI.sendMessage(roomId, { content: 'Hello!' });
```

### Payments
```javascript
import { paymentsAPI } from '../services/payments';

// Create payment intent
const { client_secret } = await paymentsAPI.createPaymentIntent(bidId, amount);

// Confirm payment after Stripe processing
await paymentsAPI.confirmPayment(paymentIntentId);
```

## Migration Guide

### No Immediate Changes Required
All existing component imports continue to work via the backwards-compatible `api.js` barrel export.

### Gradual Migration (Optional)
1. **Identify module usage**: Review component imports
2. **Update to direct imports**: Replace `from '../services/api'` with `from '../services/auth'`, etc.
3. **Verify functionality**: Test component after changing imports
4. **Benefits**: Better tree-shaking, clearer dependencies, faster IDE performance

### Example Migration
**Before:**
```javascript
import { authAPI, cleaningJobsAPI, paymentsAPI } from '../services/api';
```

**After:**
```javascript
import { authAPI } from '../services/auth';
import { cleaningJobsAPI } from '../services/jobs';
import { paymentsAPI } from '../services/payments';
```

## Development Guidelines

### When to Edit Which Module

- **core.js**: Axios config, interceptors, retry logic, apiCall wrapper changes
- **auth.js**: Authentication endpoints, profile management, password changes
- **properties.js**: Property-related endpoints
- **jobs.js**: Job and bid endpoints
- **chat.js**: Chat room and messaging endpoints
- **cleaners.js**: Cleaner search and geolocation
- **payments.js**: Payment processing, Stripe integration, refunds

### Adding New Endpoints

1. **Identify domain**: Determine which module the endpoint belongs to
2. **Add method**: Add method to appropriate API object
3. **Use apiCall wrapper**: Ensures consistent error handling and loading states
4. **Update exports**: Exports are automatic (no changes needed)

Example:
```javascript
// In jobs.js
export const cleaningJobsAPI = {
  // ... existing methods
  
  // New method
  cancelJob: async (id, reason) => {
    return apiCall(
      async () => {
        const response = await api.post(`/jobs/${id}/cancel/`, { reason });
        return response.data;
      },
      {
        loadingKey: `job_cancel_${id}`,
        successMessage: 'Job cancelled successfully!',
        showSuccess: true
      }
    );
  },
};
```

### Testing Changes

1. **Syntax check**: VS Code will show errors automatically
2. **Import check**: Verify exports work: `import { authAPI } from './services/auth';`
3. **Runtime check**: Test in browser with component that uses the API
4. **Error handling**: Verify loading states and toast notifications work

## Technical Details

### Dependency Flow
```
Component
    ↓
api.js (backwards compatibility)
    ↓
index.js (barrel export)
    ↓
[domain].js (auth, jobs, etc.)
    ↓
core.js (axios, interceptors, apiCall)
```

### Shared Infrastructure (core.js)
All domain modules import from `core.js`:
```javascript
import { apiCall } from './core';
import api from './core';
```

This ensures:
- Single axios instance (one connection pool)
- Consistent interceptors (JWT, refresh, retry)
- Unified error handling and loading states
- No circular dependencies

### Backwards Compatibility Strategy
`api.js` acts as a simple re-export:
```javascript
export { authAPI } from './auth';
export { chatAPI } from './chat';
// ... etc
```

This means:
- ✅ All existing imports work without changes
- ✅ Components don't need updates
- ✅ No runtime changes (same functionality)
- ✅ Can migrate gradually over time

## Benefits

### Before (Monolithic)
- ❌ 1415 lines in single file
- ❌ Hard to navigate
- ❌ Slower IDE autocomplete
- ❌ Unclear module boundaries
- ❌ Large git diffs on changes

### After (Modular)
- ✅ 8 focused modules (140-280 lines each)
- ✅ Clear separation of concerns
- ✅ Easier to find and edit code
- ✅ Better IDE performance
- ✅ Smaller, focused git diffs
- ✅ Better tree-shaking potential
- ✅ Clearer dependencies
- ✅ Backwards compatible

## Files Changed
- `frontend/src/services/api.js`: Replaced with re-export (37 lines, was 1415 lines)
- `frontend/src/services/core.js`: NEW - Shared infrastructure (223 lines)
- `frontend/src/services/auth.js`: NEW - Authentication module (189 lines)
- `frontend/src/services/properties.js`: NEW - Properties module (140 lines)
- `frontend/src/services/jobs.js`: NEW - Jobs module (250 lines)
- `frontend/src/services/serviceAreas.js`: NEW - Service areas module (116 lines)
- `frontend/src/services/chat.js`: NEW - Chat module (280 lines)
- `frontend/src/services/cleaners.js`: NEW - Cleaners module (96 lines)
- `frontend/src/services/payments.js`: NEW - Payments module (185 lines)
- `frontend/src/services/index.js`: NEW - Barrel export (22 lines)

**Total**: 1556 new lines, 1412 deleted lines (net +144 due to documentation and module structure)
