"""
Email verification utilities for E-Clean platform.
"""
import secrets
import uuid
import time
from datetime import datetime, timedelta
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

# Token expiration time: 30 minutes (industry standard for email verification)
TOKEN_EXPIRATION_MINUTES = 30

# Email retry configuration
MAX_EMAIL_RETRIES = 3
RETRY_DELAY_SECONDS = 2


def generate_verification_token():
    """Generate a secure random token for email verification."""
    return secrets.token_urlsafe(32)


def send_verification_email(user):
    """
    Send email verification email to user with retry logic.
    
    Args:
        user: User instance to send verification email to
        
    Returns:
        bool: True if email was sent successfully, False otherwise
    """
    # Don't send to OAuth users (already verified)
    if user.oauth_provider:
        logger.info(f"Skipping verification email for OAuth user: {user.email}")
        return False
    
    # Don't send if already verified
    if user.email_verified:
        logger.info(f"User {user.email} is already verified")
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
    subject = f'Verify your E-Clean email address'
    html_message = render_to_string('emails/verify_email.html', context)
    plain_message = strip_tags(html_message)
    
    # Retry logic with exponential backoff
    last_error = None
    for attempt in range(MAX_EMAIL_RETRIES):
        try:
            logger.info(f"📧 Sending verification email to {user.email} (attempt {attempt + 1}/{MAX_EMAIL_RETRIES}, ID: {email_id})")
            
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            
            logger.info(f"✅ Verification email sent successfully to {user.email} (ID: {email_id})")
            return True
            
        except Exception as e:
            last_error = e
            error_msg = str(e)
            logger.warning(
                f"❌ Failed to send verification email to {user.email} "
                f"(attempt {attempt + 1}/{MAX_EMAIL_RETRIES}): {error_msg}"
            )
            
            # If this isn't the last attempt, wait before retrying
            if attempt < MAX_EMAIL_RETRIES - 1:
                wait_time = RETRY_DELAY_SECONDS * (2 ** attempt)  # Exponential backoff
                logger.info(f"⏳ Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
    
    # All retries failed
    logger.error(
        f"❌ Failed to send verification email to {user.email} after {MAX_EMAIL_RETRIES} attempts. "
        f"Last error: {last_error}"
    )
    
    # In development, fall back to console logging if email fails
    if settings.DEBUG:
        # Print to both logger and stdout for visibility
        divider = "=" * 100
        message = f"""
{divider}
🚨 EMAIL DELIVERY FAILED - DEVELOPMENT MODE FALLBACK
{divider}

Email Service: SendGrid connection failed after {MAX_EMAIL_RETRIES} attempts
User Email: {user.email}

✅ YOU CAN STILL VERIFY YOUR EMAIL BY VISITING THIS URL:

{verification_url}

📋 COPY THE ABOVE URL AND PASTE IT IN YOUR BROWSER

{divider}
"""
        print(message)
        logger.warning(f"⚠️ DEVELOPMENT MODE: Email failed. Verification URL: {verification_url}")
    
    return False
