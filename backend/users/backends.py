from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class EmailUsernameBackend(BaseBackend):
    """
    Custom authentication backend that supports both email and username login.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # Get the login identifier (could be email or username)
        login_identifier = username or kwargs.get('email') or kwargs.get('username')
        
        if login_identifier is None or password is None:
            return None
            
        try:
            # Try to find user by email first
            if '@' in login_identifier:
                user = User.objects.get(email=login_identifier)
            else:
                # Try to find user by username
                user = User.objects.get(username=login_identifier)
                
            if user.check_password(password):
                return user
        except User.DoesNotExist:
            return None
        
        return None

    def get_user(self, user_id):
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None