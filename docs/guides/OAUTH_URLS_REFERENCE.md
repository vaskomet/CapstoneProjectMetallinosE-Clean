# Django-Allauth URLs Configuration

## Purpose
This document explains which django-allauth URLs are available and their purpose in the E-Clean platform.

## Active OAuth URLs

### Google OAuth (USED)
- **`/accounts/google/login/`** - Initiates Google OAuth flow
  - **Method**: GET (shows form) / POST (redirects to Google)
  - **Purpose**: Start Google authentication
  - **Frontend**: Called from `/auth/google/` wrapper view
  
- **`/accounts/google/login/callback/`** - Handles Google OAuth callback
  - **Method**: GET
  - **Purpose**: Receives OAuth code from Google, creates/logs in user
  - **Redirect**: `/auth/oauth-callback/` (custom view that generates JWT)

### Custom OAuth Flow
1. User clicks "Continue with Google" → `/auth/google/`
2. Auto-submits form to → `/accounts/google/login/`
3. Redirects to → Google authorization page
4. Google redirects back to → `/accounts/google/login/callback/`
5. Creates/logs in user, redirects to → `/auth/oauth-callback/`
6. Generates JWT tokens, redirects to → `http://localhost:3000/auth/callback?access=...&refresh=...`
7. Frontend stores tokens → Dashboard

## Disabled URLs (Allauth Endpoints Not Used)

The following allauth URLs exist but are **disabled** or **not used** in our application:

### Account Management (DISABLED via CustomAccountAdapter)
- `/accounts/signup/` - We use `/api/auth/register/` (custom JWT-based)
- `/accounts/login/` - We use `/api/auth/login/` (custom JWT-based)
- `/accounts/logout/` - Handled in frontend (clear localStorage)
- `/accounts/password/change/` - Not implemented (future feature)
- `/accounts/password/reset/` - Not implemented (future feature)
- `/accounts/password/set/` - Not implemented
- `/accounts/inactive/` - Not used
- `/accounts/email/` - Not used (email management)
- `/accounts/confirm-email/` - Not used (optional email verification disabled)

### Social Account Management (NOT USED)
- `/accounts/3rdparty/` - Account connections page (not exposed to users)
- `/accounts/social/connections/` - Manage connected accounts (not needed)
- `/accounts/social/signup/` - Disabled (auto-signup enabled)

### Error Pages (Handled by Frontend)
- `/accounts/social/login/error/` - OAuth errors (backend handles with redirects)
- `/accounts/social/login/cancelled/` - User cancelled OAuth (backend handles)

## Configuration

### Settings
```python
# Prevent allauth from taking over authentication
ACCOUNT_ADAPTER = 'users.adapters.CustomAccountAdapter'
SOCIALACCOUNT_ADAPTER = 'users.adapters.CustomSocialAccountAdapter'

# Disable allauth signup forms
CustomAccountAdapter.is_open_for_signup() returns False

# Redirect after OAuth
CustomSocialAccountAdapter.get_login_redirect_url() returns '/auth/oauth-callback/'
```

### Frontend Integration
```javascript
// Login and Register forms
const handleGoogleOAuth = () => {
  window.location.href = 'http://localhost:8000/auth/google/';
};
```

## Security Notes

1. **CSRF Protection**: All allauth endpoints use CSRF tokens
2. **OAuth State Parameter**: Prevents CSRF attacks on OAuth flow
3. **JWT Tokens**: Our custom callback generates secure JWT tokens
4. **Session Cleanup**: OAuth session is used only temporarily, JWT is primary auth

## Testing

### Test Google OAuth Flow
1. Go to `/login` or `/register`
2. Click "Continue with Google"
3. Authenticate with Google
4. Should redirect to dashboard with JWT tokens

### Verify Disabled URLs Return 404 or Redirect
```bash
# These should return 404 or redirect to custom login
curl -I http://localhost:8000/accounts/signup/
curl -I http://localhost:8000/accounts/login/
curl -I http://localhost:8000/accounts/3rdparty/
```

## Production Checklist

- [ ] Update `LOGIN_REDIRECT_URL` to production frontend URL
- [ ] Update Google OAuth redirect URIs in Google Cloud Console
- [ ] Add production domain to `ALLOWED_HOSTS`
- [ ] Update Site domain in Django admin (not `localhost:8000`)
- [ ] Set `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'` if required
- [ ] Configure proper HTTPS for OAuth callbacks
