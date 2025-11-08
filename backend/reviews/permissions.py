from rest_framework import permissions
from .models import Review
from django.utils import timezone
from datetime import timedelta


class IsReviewer(permissions.BasePermission):
    """
    Permission class to check if user is the reviewer (author) of the review.
    Allows reviewer to edit/delete their own reviews.
    """
    message = "Only the reviewer can edit or delete this review."
    
    def has_object_permission(self, request, view, obj):
        """Check if request user is the reviewer"""
        return obj.reviewer == request.user


class IsReviewee(permissions.BasePermission):
    """
    Permission class to check if user is the reviewee (subject) of the review.
    Allows reviewee to respond to reviews about them.
    """
    message = "Only the reviewee can respond to this review."
    
    def has_object_permission(self, request, view, obj):
        """Check if request user is the reviewee"""
        # For Review objects
        if isinstance(obj, Review):
            return obj.reviewee == request.user
        # For ReviewResponse objects
        if hasattr(obj, 'review'):
            return obj.review.reviewee == request.user
        return False


class CanReviewJob(permissions.BasePermission):
    """
    Permission class to check if user can leave a review for a job.
    Validates:
    - Job is completed
    - User is a participant (client or cleaner)
    - Within 30-day review window
    - No duplicate review
    """
    message = "You cannot review this job."
    
    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """
        Check if user can review the job.
        This is called when accessing a specific job object.
        """
        user = request.user
        
        # Job must be completed
        if obj.status != 'completed':
            self.message = "Only completed jobs can be reviewed."
            return False
        
        # User must be a participant
        if user != obj.client and user != obj.cleaner:
            self.message = "You can only review jobs you participated in."
            return False
        
        # Job must have completion date
        if not obj.actual_end_time:
            self.message = "Job must have a completion date to be reviewed."
            return False
        
        # Must be within 30-day window
        thirty_days_ago = timezone.now() - timedelta(days=30)
        if obj.actual_end_time < thirty_days_ago:
            self.message = "Reviews must be submitted within 30 days of job completion."
            return False
        
        # Check if user has already reviewed this job
        existing_review = Review.objects.filter(job=obj, reviewer=user).exists()
        if existing_review:
            self.message = "You have already reviewed this job."
            return False
        
        return True


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission class for admin-only write operations.
    Anyone can read, but only admins can write.
    Useful for moderation endpoints.
    """
    message = "Only administrators can perform this action."
    
    def has_permission(self, request, view):
        """Allow read for everyone, write for admins only"""
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_staff


class CanFlagReview(permissions.BasePermission):
    """
    Permission class to check if user can flag a review.
    Prevents users from flagging their own reviews.
    """
    message = "You cannot flag your own review."
    
    def has_permission(self, request, view):
        """Check if user is authenticated"""
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        """Prevent reviewer from flagging their own review"""
        if isinstance(obj, Review):
            if obj.reviewer == request.user:
                self.message = "You cannot flag your own review."
                return False
        return True
