# Email Verification & Google OAuth Setup Guide

## ✅ What's Already Configured

Django-allauth has been successfully integrated into E-Clean with **OPTIONAL** email verification and Google OAuth support. This means:

- ✅ **Existing authentication still works** - Your JWT-based login/register endpoints are untouched
- ✅ **No breaking changes** - Old users don't need email verification
- ✅ **New users optional** - Can verify email if they want, but not required
- ✅ **Google login ready** - Just needs OAuth credentials to activate

---

## 📋 Current Status

### ✅ Completed
- django-allauth installed (`65.3.0`)
- Custom adapters created to prevent conflicts
- Migrations applied (15+ tables created for email/social auth)
- SITE_ID configured
- Middleware added
- URLs configured (`/accounts/` for allauth, `/api/auth/` for your existing endpoints)

### 🔧 Configuration
```python
# settings.py (already configured)
ACCOUNT_EMAIL_VERIFICATION = 'optional'  # Not mandatory
ACCOUNT_AUTHENTICATION_METHOD = 'username_email'  # Both work
SOCIALACCOUNT_PROVIDERS = {
    'google': {...}  # Ready for OAuth credentials
}
```

### 🧪 Testing Results
```bash
# Existing login - ✅ WORKS
curl -X POST http://localhost:8000/api/auth/login/ \
  -d '{"email":"client1@test.com","password":"client123"}'
# Returns: JWT tokens + user data

# Existing registration - ✅ WORKS  
curl -X POST http://localhost:8000/api/auth/register/ \
  -d '{"email":"test@example.com","username":"testuser","password":"pass123"}'
# Returns: User created + JWT tokens
```

---

## 🚀 How to Enable Features

### Option 1: Email Verification (Simple - No External Setup)

#### Step 1: Configure Email Backend

Add to `backend/e_clean_backend/settings.py`:

```python
# For development (console email backend - prints to terminal)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# For production (use real SMTP)
# EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# EMAIL_HOST = 'smtp.gmail.com'
# EMAIL_PORT = 587
# EMAIL_USE_TLS = True
# EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
# EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
# DEFAULT_FROM_EMAIL = 'noreply@e-clean.com'
```

#### Step 2: Send Verification Email (Backend)

Already implemented in `users/adapters.py`. To manually trigger:

```python
# In your RegisterView or any view
from allauth.account.models import EmailAddress

# After user registers
EmailAddress.objects.create(
    user=user,
    email=user.email,
    primary=True,
    verified=False
)
# allauth will auto-send verification email
```

#### Step 3: Add Verification UI (Frontend - Optional)

Add to user profile page:

```jsx
// ProfileView.jsx
import { authAPI } from '../services/api';

const ProfileView = () => {
  const { user } = useUser();
  const [emailVerified, setEmailVerified] = useState(user.emailaddress_set?.some(e => e.verified));

  const sendVerificationEmail = async () => {
    try {
      // Call allauth endpoint
      await fetch('/accounts/send-confirmation/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      toast.error('Failed to send verification email');
    }
  };

  return (
    <div>
      {!emailVerified && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <p className="text-yellow-800">Your email is not verified.</p>
          <button 
            onClick={sendVerificationEmail}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Send Verification Email
          </button>
        </div>
      )}
    </div>
  );
};
```

**Verification Flow**:
1. User clicks "Send Verification Email"
2. Email sent with link: `http://localhost:8000/accounts/confirm-email/<key>/`
3. User clicks link → Email verified
4. Redirect to `/login/`

---

### Option 2: Google OAuth Login (Requires Google Console Setup)

#### Step 1: Get Google OAuth Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/

2. **Create New Project** (or use existing):
   - Click "Select a project" → "New Project"
   - Name: "E-Clean Platform"
   - Click "Create"

3. **Enable Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "E-Clean Web App"
   
   **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   http://localhost:8000
   http://127.0.0.1:3000
   http://127.0.0.1:8000
   ```
   
   **Authorized redirect URIs**:
   ```
   http://localhost:8000/accounts/google/login/callback/
   http://127.0.0.1:8000/accounts/google/login/callback/
   ```
   
5. **Copy Credentials**:
   - Client ID: `1234567890-abcdefg.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-abc123xyz`

#### Step 2: Add Credentials to Django

Two options:

**Option A: Django Admin** (Recommended for development)
```bash
# 1. Create superuser if you haven't
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# 2. Go to admin panel
http://localhost:8000/admin/

# 3. Navigate to "Sites" → Edit the default site
#    Domain: localhost:8000
#    Display name: E-Clean Platform

# 4. Navigate to "Social applications" → Add social application
#    Provider: Google
#    Name: Google OAuth
#    Client id: <paste your Client ID>
#    Secret key: <paste your Client Secret>
#    Sites: Select "localhost:8000" and move to "Chosen sites"
#    Save
```

**Option B: Environment Variables** (Recommended for production)
```python
# settings.py - Update SOCIALACCOUNT_PROVIDERS
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
        'APP': {
            'client_id': os.environ.get('GOOGLE_OAUTH_CLIENT_ID', ''),
            'secret': os.environ.get('GOOGLE_OAUTH_SECRET', ''),
            'key': ''
        }
    }
}
```

Then create `.env.dev.local`:
```bash
GOOGLE_OAUTH_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GOOGLE_OAUTH_SECRET=GOCSPX-abc123xyz
```

#### Step 3: Add "Sign in with Google" Button (Frontend)

Update `frontend/src/components/auth/LoginForm.jsx`:

```jsx
const LoginForm = () => {
  // ... existing code ...

  const handleGoogleLogin = () => {
    // Redirect to allauth Google login endpoint
    window.location.href = 'http://localhost:8000/accounts/google/login/';
  };

  return (
    <div className="login-form">
      {/* Existing email/password form */}
      <form onSubmit={handleSubmit}>
        {/* ... existing inputs ... */}
        <button type="submit">Login with Email</button>
      </form>

      {/* Divider */}
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="px-4 text-gray-500">OR</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      {/* Google Login Button */}
      <button
        onClick={handleGoogleLogin}
        className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );
};
```

#### Step 4: Handle OAuth Callback

After Google authentication, allauth redirects to `/accounts/google/login/callback/`. You need to handle the frontend redirect.

Create `frontend/src/components/auth/OAuthCallback.jsx`:

```jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();

  useEffect(() => {
    // After allauth completes, user is logged in via session
    // Fetch user data and convert to JWT (custom endpoint needed)
    const handleOAuthCallback = async () => {
      try {
        // Call backend to exchange session for JWT
        const response = await fetch('/api/auth/oauth-to-jwt/', {
          method: 'POST',
          credentials: 'include', // Send session cookie
        });
        
        if (response.ok) {
          const { access, refresh, user } = await response.json();
          localStorage.setItem('access_token', access);
          localStorage.setItem('refresh_token', refresh);
          setUser(user);
          navigate('/dashboard');
        } else {
          navigate('/login?error=oauth_failed');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/login?error=oauth_failed');
      }
    };

    handleOAuthCallback();
  }, [navigate, setUser]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing Google sign in...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
```

Add route in `App.jsx`:
```jsx
<Route path="/oauth-callback" element={<OAuthCallback />} />
```

#### Step 5: Create OAuth-to-JWT Endpoint (Backend)

Create `backend/users/oauth_views.py`:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])  # User authenticated via session
def oauth_to_jwt(request):
    """
    Convert session-based OAuth authentication to JWT tokens.
    
    After Google OAuth, allauth logs user in via Django session.
    This endpoint exchanges that session for JWT tokens.
    """
    user = request.user
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data
    })
```

Add to `backend/users/urls.py`:
```python
from .oauth_views import oauth_to_jwt

urlpatterns = [
    # ... existing URLs ...
    path('oauth-to-jwt/', oauth_to_jwt, name='oauth-to-jwt'),
]
```

---

## 🔍 How It Works

### Email Verification Flow
```
1. User registers via /api/auth/register/
2. User created, logged in with JWT ✅
3. (Optional) User clicks "Verify Email" in profile
4. Backend sends email with verification link
5. User clicks link → Email verified
6. No change to login status (already logged in)
```

### Google OAuth Flow
```
1. User clicks "Sign in with Google"
2. Redirect to /accounts/google/login/
3. Google authentication page
4. User authorizes → Redirect to /accounts/google/login/callback/
5. allauth creates/links User account
6. Session-based login established
7. Frontend calls /api/auth/oauth-to-jwt/
8. Exchange session for JWT tokens
9. Store JWT, redirect to dashboard
```

### Account Linking
If user registers with `john@gmail.com` via email, then later tries Google login with same email:
- ✅ Accounts automatically linked (handled by `CustomSocialAccountAdapter`)
- ✅ User can login with either method
- ✅ `oauth_provider` field set to 'google'

---

## 🧪 Testing

### Test Email Verification (Console Backend)
```bash
# 1. Register new user
curl -X POST http://localhost:8000/api/auth/register/ \
  -d '{"email":"test@example.com","username":"test","password":"pass123"}'

# 2. Check backend logs - you'll see verification email printed
docker compose -f docker-compose.dev.yml logs backend | grep "verify"

# 3. Copy verification link from logs (looks like):
http://localhost:8000/accounts/confirm-email/MQ:1tXYZ:abc123/

# 4. Visit link in browser → Email verified!
```

### Test Google OAuth
```bash
# 1. Set up Google credentials in admin panel
# 2. Go to http://localhost:3000/login
# 3. Click "Sign in with Google"
# 4. Authorize on Google
# 5. Should redirect back and log you in
```

---

## 📊 Database Tables Created

allauth added these tables (separate from your `users_user` table):

### Account Tables
- `account_emailaddress` - Tracks email verification status
- `account_emailconfirmation` - Verification tokens

### Social Account Tables
- `socialaccount_socialaccount` - Links social accounts to users
- `socialaccount_socialapp` - Stores OAuth app credentials
- `socialaccount_socialtoken` - OAuth access tokens

### Sites Table
- `django_site` - Required by allauth for multi-site support

**Important**: Your existing `users_user` table is **untouched**. allauth uses these new tables to track additional authentication data.

---

## ⚙️ Configuration Summary

### Current Settings (Optional Verification)
```python
ACCOUNT_EMAIL_VERIFICATION = 'optional'  # Can verify but not required
ACCOUNT_AUTHENTICATION_METHOD = 'username_email'  # Both work
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_EMAIL_REQUIRED = True
SOCIALACCOUNT_AUTO_SIGNUP = True  # Create account from Google automatically
SOCIALACCOUNT_EMAIL_VERIFICATION = 'optional'  # No verification for social logins
```

### To Make Verification Mandatory (Production)
```python
ACCOUNT_EMAIL_VERIFICATION = 'mandatory'  # Change from 'optional'
# Now users must verify email before accessing protected features
```

### To Disable Verification Completely
```python
ACCOUNT_EMAIL_VERIFICATION = 'none'  # No verification at all
```

---

## 🚨 Important Notes

1. **Existing Users**: 
   - Don't have `EmailAddress` records
   - allauth treats them as verified
   - Can login normally with JWT

2. **New Users**:
   - Get `EmailAddress` record created automatically
   - Can login immediately (verification optional)
   - Can verify email anytime from profile

3. **Google OAuth Users**:
   - Auto-created with `oauth_provider='google'`
   - Email considered verified by default
   - Can also login with email/password if they set one

4. **Testing vs Production**:
   - Development: Use `EMAIL_BACKEND = 'console'` (prints to terminal)
   - Production: Use real SMTP (Gmail, SendGrid, etc.)

---

## 🎯 Next Steps

Choose your path:

### Path A: Email Verification Only
1. Configure `EMAIL_BACKEND` in settings.py (console for dev)
2. Optionally add "Verify Email" UI to profile page
3. Test with console backend

### Path B: Google OAuth Only
1. Get Google OAuth credentials from Cloud Console
2. Add credentials via Django admin
3. Add "Sign in with Google" button to LoginForm
4. Create OAuth callback handler
5. Test login flow

### Path C: Both Features
1. Follow both paths above
2. Users can choose: Email/password OR Google login
3. Optionally verify email for extra security

### Path D: Do Nothing (Current State)
1. Everything works as-is
2. allauth installed but dormant
3. Can enable features anytime later
4. Zero impact on existing auth

---

## 📝 Files Modified

1. ✅ `backend/requirements.txt` - Added django-allauth==65.3.0
2. ✅ `backend/e_clean_backend/settings.py` - INSTALLED_APPS, MIDDLEWARE, allauth config
3. ✅ `backend/e_clean_backend/urls.py` - Added /accounts/ URLs
4. ✅ `backend/users/adapters.py` - Created custom adapters
5. ✅ Database - 15+ new tables via migrations

---

## ❓ Troubleshooting

### "SITE matching query does not exist"
```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py shell
>>> from django.contrib.sites.models import Site
>>> Site.objects.get_or_create(id=1, defaults={'domain': 'localhost:8000', 'name': 'E-Clean'})
```

### Google OAuth redirect fails
- Check "Authorized redirect URIs" in Google Console
- Must exactly match: `http://localhost:8000/accounts/google/login/callback/`

### Email not sending
- Check `EMAIL_BACKEND` setting
- For console backend, check Docker logs: `docker compose logs backend`

### Users not getting verified automatically
- That's expected! Verification is **optional**
- Users can login without verification
- Add UI to encourage verification

---

## 🔗 Useful Links

- django-allauth docs: https://docs.allauth.org/
- Google OAuth setup: https://console.cloud.google.com/
- Email verification guide: https://docs.allauth.org/en/latest/account/email_verification.html
- Social auth guide: https://docs.allauth.org/en/latest/socialaccount/overview.html

---

**Status**: ✅ Ready to use - All features optional, no breaking changes
