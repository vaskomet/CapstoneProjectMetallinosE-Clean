"""
Email verification utilities for E-Clean platform.
"""
import secrets
import uuid
from datetime import datetime, timedelta
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone

# Token expiration time: 30 minutes (industry standard for email verification)
TOKEN_EXPIRATION_MINUTES = 30


def generate_verification_token():
    """Generate a secure random token for email verification."""
    return secrets.token_urlsafe(32)


def send_verification_email(user):
    """
    Send email verification email to user.
    
    Args:
        user: User instance to send verification email to
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    # Don't send to OAuth users (already verified)
    if user.oauth_provider:
        return False
    
    # Don't send if already verified
    if user.email_verified:
        return False
    
    # Generate new token if not exists or if expired
    if not user.verification_token or not user.verification_token_expires or \
       timezone.now() >= user.verification_token_expires:
        user.verification_token = generate_verification_token()
        user.verification_token_expires = timezone.now() + timedelta(minutes=TOKEN_EXPIRATION_MINUTES)
        user.save(update_fields=['verification_token', 'verification_token_expires'])
    
    # Build verification URL
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
    verification_url = f"{frontend_url}/verify-email/{user.verification_token}"
    
    # Generate unique email ID for tracking and preventing duplicates
    email_id = f"{uuid.uuid4()}-{int(datetime.now().timestamp())}"
    
    # Email context
    context = {
        'user': user,
        'verification_url': verification_url,
        'site_name': 'E-Clean',
        'email_id': email_id,  # Unique ID for this specific email
    }
    
    # Render email templates
    subject = f'Verify your E-Clean email address (ID: {email_id[:8]})'
    html_message = render_to_string('emails/verify_email.html', context)
    plain_message = strip_tags(html_message)
    
    try:
        print(f"📧 Sending verification email to {user.email} with ID: {email_id}")
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        print(f"✅ Verification email sent successfully to {user.email} (ID: {email_id})")
        return True
    except Exception as e:
        print(f"❌ Failed to send verification email to {user.email}: {str(e)}")
        return False
    except Exception as e:
        print(f"Failed to send verification email to {user.email}: {e}")
        return False
