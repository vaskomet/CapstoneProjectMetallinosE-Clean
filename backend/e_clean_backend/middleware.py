"""
Custom WebSocket authentication middleware for JWT tokens
"""
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_string):
    """Get user from JWT token"""
    try:
        # Validate token
        UntypedToken(token_string)
        
        # Decode token to get user_id
        decoded_data = jwt_decode(
            token_string, 
            settings.SECRET_KEY, 
            algorithms=["HS256"]
        )
        user_id = decoded_data["user_id"]
        
        # Get user
        user = User.objects.get(id=user_id)
        return user
        
    except (InvalidToken, TokenError, User.DoesNotExist, KeyError) as e:
        logger.warning(f"WebSocket authentication failed: {e}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens
    """
    
    async def __call__(self, scope, receive, send):
        # Get token from query string
        query_params = dict(scope.get('query_string', b'').decode().split('&'))
        token = None
        
        for param in query_params:
            if '=' in param:
                key, value = param.split('=', 1)
                if key == 'token':
                    token = value
                    break
        
        # Authenticate user
        if token:
            scope['user'] = await get_user_from_token(token)
        else:
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """Convenience function to apply JWT auth middleware"""
    return JWTAuthMiddleware(inner)