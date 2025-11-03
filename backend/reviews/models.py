from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from users.models import User
from cleaning_jobs.models import CleaningJob
from django.utils import timezone


class Review(models.Model):
    """
    Review model for bidirectional reviews between clients and cleaners.
    Supports x/10 rating system with detailed sub-ratings.
    Foundation for future ML-based recommendation engine.
    """
    id = models.AutoField(primary_key=True)
    
    # The job being reviewed
    job = models.ForeignKey(
        CleaningJob,
        on_delete=models.CASCADE,
        related_name='reviews',
        help_text="The completed job being reviewed"
    )
    
    # Who is writing the review
    reviewer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_written',
        help_text="User who wrote this review (client or cleaner)"
    )
    
    # Who is being reviewed
    reviewee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_received',
        help_text="User being reviewed (cleaner or client)"
    )
    
    # Overall rating (1-10 scale as requested by user)
    overall_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text="Overall rating from 1 to 10"
    )
    
    # Written review
    comment = models.TextField(
        help_text="Detailed written review"
    )
    
    # Visibility control for moderation
    is_visible = models.BooleanField(
        default=True,
        help_text="False if review is hidden by admin moderation"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        # Ensure each user can only review each job once
        unique_together = ['job', 'reviewer']
        
        # Indexes for common queries
        indexes = [
            models.Index(fields=['reviewee', '-created_at']),
            models.Index(fields=['job']),
            models.Index(fields=['reviewer']),
            models.Index(fields=['is_visible', '-created_at']),
        ]
        
        # Default ordering: newest first
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Review by {self.reviewer.username} for {self.reviewee.username} - {self.overall_rating}/10"
    
    def save(self, *args, **kwargs):
        """
        Override save to set reviewee automatically based on reviewer.
        If reviewer is client, reviewee is cleaner (and vice versa).
        """
        if not self.reviewee_id:
            if self.reviewer == self.job.client:
                self.reviewee = self.job.cleaner
            elif self.reviewer == self.job.cleaner:
                self.reviewee = self.job.client
        super().save(*args, **kwargs)


class ReviewRating(models.Model):
    """
    Detailed sub-ratings for a review.
    Allows granular feedback on specific aspects of service.
    """
    RATING_CATEGORY_CHOICES = [
        ('quality', 'Quality of Work'),
        ('communication', 'Communication'),
        ('professionalism', 'Professionalism'),
        ('timeliness', 'Timeliness'),
    ]
    
    id = models.AutoField(primary_key=True)
    
    # Parent review
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name='ratings',
        help_text="The review this rating belongs to"
    )
    
    # Category of rating
    category = models.CharField(
        max_length=20,
        choices=RATING_CATEGORY_CHOICES,
        help_text="Aspect being rated"
    )
    
    # Rating value (1-10 scale)
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text="Rating from 1 to 10"
    )
    
    class Meta:
        # Each review can have only one rating per category
        unique_together = ['review', 'category']
        
        # Index for aggregation queries
        indexes = [
            models.Index(fields=['review', 'category']),
        ]
    
    def __str__(self):
        return f"{self.get_category_display()}: {self.rating}/10"


class ReviewResponse(models.Model):
    """
    Response from reviewee to a review.
    Allows reviewees to respond professionally to feedback.
    """
    id = models.AutoField(primary_key=True)
    
    # Parent review
    review = models.OneToOneField(
        Review,
        on_delete=models.CASCADE,
        related_name='response',
        help_text="The review being responded to"
    )
    
    # Response text
    response_text = models.TextField(
        help_text="Reviewee's response to the review"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['review']),
        ]
    
    def __str__(self):
        return f"Response to review #{self.review.id}"


class ReviewFlag(models.Model):
    """
    Flag for inappropriate or concerning reviews.
    Enables community-driven moderation.
    """
    FLAG_REASON_CHOICES = [
        ('inappropriate', 'Inappropriate Content'),
        ('harassment', 'Harassment or Bullying'),
        ('spam', 'Spam'),
        ('false_info', 'False Information'),
        ('other', 'Other'),
    ]
    
    MODERATION_STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('reviewed', 'Reviewed'),
        ('action_taken', 'Action Taken'),
        ('dismissed', 'Dismissed'),
    ]
    
    id = models.AutoField(primary_key=True)
    
    # Review being flagged
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name='flags',
        help_text="The review being flagged"
    )
    
    # User who flagged the review
    flagger = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='review_flags',
        help_text="User who flagged this review"
    )
    
    # Reason for flag
    reason = models.CharField(
        max_length=20,
        choices=FLAG_REASON_CHOICES,
        help_text="Reason for flagging"
    )
    
    # Additional details
    details = models.TextField(
        blank=True,
        help_text="Optional additional details about why this review was flagged"
    )
    
    # Moderation status
    moderation_status = models.CharField(
        max_length=20,
        choices=MODERATION_STATUS_CHOICES,
        default='pending',
        help_text="Current moderation status"
    )
    
    # Admin notes
    admin_notes = models.TextField(
        blank=True,
        help_text="Admin notes about the flag"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When admin reviewed this flag"
    )
    
    class Meta:
        # Prevent duplicate flags from same user
        unique_together = ['review', 'flagger']
        
        # Index for admin moderation queries
        indexes = [
            models.Index(fields=['moderation_status', '-created_at']),
            models.Index(fields=['review']),
        ]
        
        # Default ordering: pending first, newest first
        ordering = ['moderation_status', '-created_at']
    
    def __str__(self):
        return f"Flag by {self.flagger.username} for review #{self.review.id} - {self.get_reason_display()}"
