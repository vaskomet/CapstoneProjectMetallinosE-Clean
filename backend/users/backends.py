from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class EmailBackend(BaseBackend):
    """
    Custom authentication backend that uses email instead of username.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # Check if username is actually an email or use email from kwargs
        email = username or kwargs.get('email')
        
        if email is None:
            return None
            
        try:
            user = User.objects.get(email=email)
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