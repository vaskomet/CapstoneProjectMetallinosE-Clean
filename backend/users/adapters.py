"""
Custom django-allauth adapters to integrate with existing E-Clean authentication system.

This adapter prevents allauth from interfering with the existing custom JWT-based
registration and login system while enabling optional email verification and social login.
"""

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.conf import settings


class CustomAccountAdapter(DefaultAccountAdapter):
    """
    Custom account adapter to prevent allauth from taking over user registration.
    
    This ensures that:
    - The existing RegisterView continues to handle user registration
    - Allauth only provides email verification and social login features
    - No conflicts with existing JWT authentication system
    """
    
    def is_open_for_signup(self, request):
        """
        Disable allauth's built-in signup forms, but allow social login signup.
        
        We use our custom RegisterView for user registration.
        Allauth is only used for email verification and social login.
        
        Returns True for social login paths, False for regular signup forms.
        """
        # Allow signup for social authentication (OAuth)
        if request.path.startswith('/accounts/'):
            return True
        
        # Block allauth's built-in signup forms
        return False
    
    def get_login_redirect_url(self, request):
        """
        Redirect to frontend after email verification.
        """
        # For email verification, redirect to login page
        return settings.LOGIN_REDIRECT_URL
    
    def save_user(self, request, user, form, commit=True):
        """
        Save user instance - minimal override to maintain compatibility.
        
        This is called when creating users through social authentication.
        """
        user = super().save_user(request, user, form, commit=False)
        
        # Set default role for social login users
        if not user.role:
            user.role = 'client'
        
        if commit:
            user.save()
        
        return user


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom social account adapter for Google OAuth integration.
    
    Handles creation and linking of social accounts with existing User model.
    """
    
    def get_login_redirect_url(self, request):
        """
        Override redirect after successful social login.
        
        Instead of using the default LOGIN_REDIRECT_URL,
        redirect to our custom OAuth callback that generates JWT tokens.
        """
        return '/auth/oauth-callback/'
    
    def pre_social_login(self, request, sociallogin):
        """
        Invoked just after a user successfully authenticates via a social provider,
        but before the login is actually processed.
        
        This allows us to connect social accounts to existing user accounts
        if the email matches.
        """
        # If user is already logged in, connect this social account
        if request.user.is_authenticated:
            return
        
        # If email already exists in our system, connect the social account
        if sociallogin.is_existing:
            return
        
        # Check if user with this email exists
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            email = sociallogin.account.extra_data.get('email')
            if email:
                user = User.objects.get(email__iexact=email)
                # Connect this social account to the existing user
                sociallogin.connect(request, user)
        except User.DoesNotExist:
            pass
    
    def populate_user(self, request, sociallogin, data):
        """
        Populate user instance with data from social provider.
        
        Maps Google profile data to User model fields.
        """
        user = super().populate_user(request, sociallogin, data)
        
        # Set additional fields from Google profile
        if not user.role:
            user.role = 'client'  # Default role for social login users
        
        # Get name from Google profile
        if 'given_name' in data and not user.first_name:
            user.first_name = data.get('given_name', '')
        
        if 'family_name' in data and not user.last_name:
            user.last_name = data.get('family_name', '')
        
        # Store OAuth provider info
        user.oauth_provider = 'google'
        
        # OAuth users have their email verified by the provider
        user.email_verified = True
        from django.utils import timezone
        user.email_verified_at = timezone.now()
        
        return user
    
    def is_auto_signup_allowed(self, request, sociallogin):
        """
        Return whether automatic signup should be allowed after social login.
        
        We allow auto-signup for social logins to provide seamless experience.
        """
        return True
