"""
OAuth-related views for seamless social authentication
"""
from django.shortcuts import render, redirect
from django.views import View
from django.middleware.csrf import get_token
from django.http import HttpResponse
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from urllib.parse import urlencode


class GoogleOAuthRedirectView(View):
    """
    Renders a page that auto-submits to Google OAuth
    This avoids the intermediate allauth login page
    """
    def get(self, request):
        """
        Render auto-submit form that triggers Google OAuth
        """
        # Get CSRF token
        csrf_token = get_token(request)
        
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Connecting to Google...</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                }}
                .loader {{
                    text-align: center;
                    color: white;
                }}
                .spinner {{
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                }}
                @keyframes spin {{
                    0% {{ transform: rotate(0deg); }}
                    100% {{ transform: rotate(360deg); }}
                }}
            </style>
        </head>
        <body>
            <div class="loader">
                <div class="spinner"></div>
                <h2>Connecting to Google...</h2>
                <p>Please wait while we redirect you</p>
            </div>
            <form id="googleForm" method="post" action="/accounts/google/login/">
                <input type="hidden" name="csrfmiddlewaretoken" value="{csrf_token}">
            </form>
            <script>
                // Auto-submit the form after a brief delay
                setTimeout(function() {{
                    document.getElementById('googleForm').submit();
                }}, 500);
            </script>
        </body>
        </html>
        """
        return HttpResponse(html)


class OAuthCallbackView(View):
    """
    Handle successful OAuth authentication
    Generate JWT tokens and redirect to frontend with tokens
    """
    def get(self, request):
        """
        After successful OAuth, check for 2FA and redirect accordingly
        """
        # Get frontend URL from settings (default to localhost for dev)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        # Check if user is authenticated
        if not request.user.is_authenticated:
            # Redirect back to register page with error
            return redirect(f'{frontend_url}/register?error=oauth_failed')
        
        user = request.user
        
        # Check if user has 2FA enabled
        if user.two_factor_enabled:
            # Redirect to frontend 2FA verification page
            params = {
                'requires_2fa': 'true',
                'email': user.email,
                'provider': 'google'
            }
            redirect_url = f'{frontend_url}/auth/2fa-verify?{urlencode(params)}'
            return redirect(redirect_url)
        
        # No 2FA - Generate JWT tokens and proceed with normal login
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        # Get user data
        user_data = {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
        }
        
        # Build redirect URL with tokens as URL parameters
        params = {
            'access': access_token,
            'refresh': refresh_token,
            'user': str(user_data),  # Will be parsed by frontend
        }
        
        redirect_url = f'{frontend_url}/auth/callback?{urlencode(params)}'
        
        return redirect(redirect_url)

