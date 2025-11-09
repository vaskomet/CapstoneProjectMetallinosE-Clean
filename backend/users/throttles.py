"""
Throttling classes for user-related endpoints.
"""
from rest_framework.throttling import UserRateThrottle


class ResendVerificationThrottle(UserRateThrottle):
    """
    Throttle for resend verification email endpoint.
    Limits users to 5 requests per hour to prevent abuse.
    """
    rate = '5/hour'
    scope = 'resend_verification'
