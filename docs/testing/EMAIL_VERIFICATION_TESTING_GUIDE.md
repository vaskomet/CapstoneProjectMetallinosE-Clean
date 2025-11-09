# Email Verification - Testing Guide

## Quick Start Testing

### Prerequisites
```bash
# Make sure Docker dev environment is running
docker compose -f docker-compose.dev.yml up -d

# Verify backend is running
docker compose -f docker-compose.dev.yml logs backend | tail -20

# Verify frontend is running
# Should be accessible at http://localhost:3000
```

---

## Test Scenario 1: New User Registration (Email/Password)

### Step 1: Register New User
1. Navigate to `http://localhost:3000/register`
2. Fill in form:
   - **Email**: `test.client@example.com`
   - **Password**: `TestPass123!`
   - **First Name**: `Test`
   - **Last Name**: `Client`
   - **User Type**: `Client`
3. Click "Register"

### Step 2: Check Verification Email
1. Open terminal showing backend logs:
   ```bash
   docker compose -f docker-compose.dev.yml logs -f backend
   ```
2. Look for email output in console:
   ```
   ------------------ EMAIL ------------------
   Subject: [E-Clean] Verify Your Email Address
   From: E-Clean <noreply@e-clean.com>
   To: test.client@example.com
   
   (Email HTML content with verification link)
   -------------------------------------------
   ```
3. Copy the verification token from URL:
   `http://localhost:3000/verify-email/{TOKEN_HERE}`

### Step 3: Verify Email
1. **Option A**: Click link in email (if email client supports it)
2. **Option B**: Manually navigate to:
   ```
   http://localhost:3000/verify-email/{TOKEN_FROM_EMAIL}
   ```
3. Should see:
   - ✅ Green checkmark icon
   - "Email Verified!" heading
   - Success message
   - Auto-redirect countdown
4. Wait 3 seconds → Redirected to `/settings/profile`

### Step 4: Verify Banner Disappeared
1. After redirect, check Profile Settings page
2. Yellow warning banner should be **GONE**
3. User can now post jobs

---

## Test Scenario 2: Unverified User Flow

### Step 1: Login as Unverified User
1. Use credentials from Test Scenario 1 **BEFORE** verifying
2. Navigate to `http://localhost:3000/settings/profile`
3. Should see **yellow warning banner**:
   ```
   ⚠️ Email Verification Required
   You cannot post jobs until you verify your email address.
   Please check your inbox for a verification email from E-Clean.
   
   [Resend Verification Email] button
   ```

### Step 2: Test Resend Button
1. Click "Resend Verification Email" button
2. Button should show loading state: "Sending..."
3. Should see toast notification: "Verification email sent! Check your inbox."
4. Check backend logs for new email output

### Step 3: Try to Post Job (Should Fail)
1. Navigate to `/properties` → Click "Post New Job"
2. Fill out job form and submit
3. Should see **403 error** with message:
   ```json
   {
     "error": "Email verification required",
     "message": "You must verify your email address before posting jobs...",
     "email_verified": false
   }
   ```

---

## Test Scenario 3: OAuth User (Auto-Verified)

### Step 1: Register with Google OAuth
1. Navigate to `http://localhost:3000/register`
2. Click "Continue with Google" button
3. Complete Google OAuth flow
4. Should be auto-logged in

### Step 2: Check Profile (No Banner)
1. Navigate to `/settings/profile`
2. Yellow warning banner should **NOT** appear
3. User is auto-verified (`email_verified: true`)

### Step 3: Verify Can Post Jobs
1. Navigate to `/properties` → "Post New Job"
2. Fill and submit form
3. Should work without verification prompt

---

## Test Scenario 4: Verified Cleaner Badge

### Step 1: Mark Cleaner as Verified (Admin)
1. Navigate to Django admin: `http://localhost:8000/admin/`
2. Login as admin (create superuser if needed):
   ```bash
   docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
   ```
3. Go to **Users** → Find a cleaner (e.g., `cleaner.central@test.gr`)
4. Scroll to **Cleaner Verification** section
5. Check ✅ **Is verified cleaner** checkbox
6. Click "Save"
7. Verify `verified_by` and `verified_at` auto-populated

### Step 2: View Badge on Profile
1. Logout from admin
2. Login as any client
3. Navigate to `/find-cleaners`
4. Search for cleaners
5. Click on verified cleaner's profile
6. Should see **blue verified badge** next to name:
   ```
   [Name] [✓ Verified]
   ```

### Step 3: View Badge in Search Results
1. Go back to `/find-cleaners`
2. Search for cleaners
3. Verified cleaners should have **small blue badge** in cards:
   ```
   [Cleaner Name] [✓ Verified]
   ```

---

## Test Scenario 5: Test Users (Auto-Verified)

### Step 1: Login as Synthetic Test User
1. Use credentials from `TEST_CREDENTIALS.md`:
   - **Client**: `client.kolonaki@test.gr` / `test1234`
   - **Cleaner**: `cleaner.central@test.gr` / `test1234`

### Step 2: Verify Auto-Verified
1. Navigate to `/settings/profile`
2. No yellow warning banner (already verified)
3. Check user object in browser console:
   ```javascript
   JSON.parse(localStorage.getItem('user'))
   // Should have: email_verified: true
   ```

### Step 3: Can Post/Bid Immediately
- **Client**: Can post jobs without verification
- **Cleaner**: Can bid on jobs without verification

---

## Debugging Commands

### Check User Verification Status
```bash
# Enter Django shell
docker compose -f docker-compose.dev.yml exec backend python manage.py shell

# Check user
from users.models import User
user = User.objects.get(email='test.client@example.com')
print(f"Email Verified: {user.email_verified}")
print(f"Verified At: {user.email_verified_at}")
print(f"Verification Token: {user.verification_token}")
```

### Manually Verify User (Bypass Email)
```python
# In Django shell
user.mark_email_verified()
print(f"Now verified: {user.email_verified}")
```

### Check Verification Email Log
```bash
# Watch backend logs in real-time
docker compose -f docker-compose.dev.yml logs -f backend | grep -A 20 "EMAIL"
```

### Reset User Verification (For Testing)
```python
# In Django shell
user.email_verified = False
user.email_verified_at = None
user.verification_token = None
user.save()
```

---

## Expected API Responses

### GET /api/auth/profile/ (Verified User)
```json
{
  "id": 123,
  "email": "test.client@example.com",
  "first_name": "Test",
  "last_name": "Client",
  "role": "client",
  "email_verified": true,
  "email_verified_at": "2025-11-09T12:34:56.789Z",
  "is_verified_cleaner": false,
  "verified_at": null,
  "oauth_provider": null,
  "is_oauth_user": false
}
```

### POST /api/auth/verify-email/ (Success)
```json
{
  "message": "Email verified successfully!",
  "email_verified": true
}
```

### POST /api/auth/verify-email/ (Invalid Token)
```json
{
  "error": "Invalid or expired verification token"
}
```

### POST /api/auth/resend-verification/ (Success)
```json
{
  "message": "Verification email sent to test.client@example.com"
}
```

### POST /api/cleaning-jobs/ (Unverified Client)
```json
{
  "error": "Email verification required",
  "message": "You must verify your email address before posting jobs. Please check your inbox for a verification email, or visit your profile to resend it.",
  "email_verified": false
}
```

---

## Common Issues & Solutions

### Issue 1: No Email in Console
**Problem**: Email not appearing in backend logs after registration

**Solutions**:
1. Check email backend setting:
   ```python
   # backend/e_clean_backend/settings.py
   EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
   ```
2. Restart backend:
   ```bash
   docker compose -f docker-compose.dev.yml restart backend
   ```
3. Check logs for errors:
   ```bash
   docker compose -f docker-compose.dev.yml logs backend | grep -i error
   ```

### Issue 2: Verification Link 404
**Problem**: Clicking link shows "Page not found"

**Solutions**:
1. Check route in App.jsx:
   ```javascript
   <Route path="/verify-email/:token" element={<VerifyEmail />} />
   ```
2. Verify frontend is running: `http://localhost:3000`
3. Check browser console for routing errors

### Issue 3: Banner Still Shows After Verification
**Problem**: Yellow banner visible even after verifying email

**Solutions**:
1. Refresh profile data:
   ```javascript
   // In browser console
   window.location.reload();
   ```
2. Check localStorage user object:
   ```javascript
   JSON.parse(localStorage.getItem('user')).email_verified
   // Should be true
   ```
3. If false, logout and login again to refresh user data

### Issue 4: Verified Badge Not Showing
**Problem**: Cleaner marked as verified in admin, but badge not visible

**Solutions**:
1. Check cleaner object in API response:
   ```javascript
   // In FindCleaners or CleanerProfile page
   console.log(cleaner.is_verified_cleaner); // Should be true
   ```
2. Verify VerifiedBadge component imported:
   ```javascript
   import VerifiedBadge from './VerifiedBadge';
   ```
3. Check conditional rendering:
   ```javascript
   {cleaner.is_verified_cleaner && <VerifiedBadge />}
   ```

---

## Test Coverage Checklist

### Email Verification ✅
- [ ] New user registration sends email
- [ ] Email appears in backend console logs
- [ ] Verification link in email is correct format
- [ ] Clicking link verifies email
- [ ] Page shows success message and redirects
- [ ] Banner disappears after verification
- [ ] Resend button works
- [ ] Resend button shows loading state
- [ ] Resend button triggers new email
- [ ] OAuth users skip verification
- [ ] OAuth users don't see banner
- [ ] Test users auto-verified

### Job/Bid Blocking ✅
- [ ] Unverified client cannot post jobs (403 error)
- [ ] Unverified cleaner cannot bid (403 error)
- [ ] Verified client can post jobs
- [ ] Verified cleaner can bid
- [ ] Error messages are user-friendly

### Verified Badge ✅
- [ ] Admin can mark cleaner verified
- [ ] `verified_by` auto-populated
- [ ] `verified_at` auto-populated
- [ ] Badge shows on cleaner profile page
- [ ] Badge shows in search result cards
- [ ] Badge hidden for unverified cleaners
- [ ] Badge sizing works (sm, md, lg, xl)
- [ ] Badge text optional (showText prop)

### User Experience ✅
- [ ] Verification page auto-verifies (no submit button)
- [ ] Success page auto-redirects after 3 seconds
- [ ] Loading states show during async operations
- [ ] Toast notifications appear for actions
- [ ] Banner only shows when needed
- [ ] Mobile responsive design works

---

## Manual Test Script

Copy/paste this script to test all scenarios:

```bash
# 1. Start environment
docker compose -f docker-compose.dev.yml up -d

# 2. Watch backend logs (separate terminal)
docker compose -f docker-compose.dev.yml logs -f backend

# 3. Open browser to http://localhost:3000

# 4. Test registration → verification flow
# 5. Test resend verification
# 6. Test job posting (unverified → fail, verified → success)
# 7. Test OAuth registration
# 8. Mark cleaner verified in admin
# 9. Check badge in profile and search

# 10. Clean up
docker compose -f docker-compose.dev.yml down
```

---

**Last Updated**: November 9, 2025  
**Status**: ✅ Ready for Testing  
**Estimated Test Time**: 15-20 minutes for full coverage
