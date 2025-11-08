"""
Recommendation System Models

This app provides intelligent matching between clients and cleaners using:
- Machine learning-style scoring algorithms
- Historical performance data
- Location-based matching
- Preference compatibility
- Pricing optimization
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta

User = get_user_model()


class CleanerScore(models.Model):
    """
    Aggregated scoring metrics for cleaners.
    Cached scores updated periodically (daily) for performance.
    """
    cleaner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='score',
        limit_choices_to={'role': 'cleaner'}
    )
    
    # Overall composite score (0-100)
    overall_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('50.00'),
        help_text="Composite score from 0-100"
    )
    
    # Quality metrics (from reviews)
    quality_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('50.00'),
        help_text="Average quality rating (normalized to 0-100)"
    )
    communication_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('50.00')
    )
    professionalism_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('50.00')
    )
    timeliness_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('50.00')
    )
    
    # Reliability metrics
    completion_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('100.00'),
        help_text="Percentage of jobs completed (0-100)"
    )
    on_time_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('100.00'),
        help_text="Percentage of jobs started on time"
    )
    cancellation_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Percentage of jobs cancelled by cleaner"
    )
    photo_documentation_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Percentage of jobs with before/after photos"
    )
    
    # Bidding behavior metrics
    bid_win_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Percentage of bids that were accepted"
    )
    avg_bid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Average bid amount in dollars"
    )
    avg_response_time_minutes = models.IntegerField(
        default=0,
        help_text="Average time to respond to messages (minutes)"
    )
    
    # Experience metrics
    total_jobs = models.IntegerField(
        default=0,
        help_text="Total number of completed jobs"
    )
    total_earnings = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    review_count = models.IntegerField(
        default=0,
        help_text="Total number of reviews received"
    )
    avg_rating = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Average overall rating (1-10 scale)"
    )
    
    # Specialization indicators
    primary_property_type = models.CharField(
        max_length=20,
        blank=True,
        help_text="Most frequently cleaned property type"
    )
    eco_friendly_jobs_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    # Activity metrics
    jobs_last_30_days = models.IntegerField(default=0)
    jobs_last_90_days = models.IntegerField(default=0)
    is_active = models.BooleanField(
        default=True,
        help_text="False if no jobs in last 90 days"
    )
    
    # Metadata
    last_calculated = models.DateTimeField(auto_now=True)
    calculation_version = models.IntegerField(
        default=1,
        help_text="Version of scoring algorithm used"
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['-overall_score']),
            models.Index(fields=['-quality_score']),
            models.Index(fields=['is_active', '-overall_score']),
        ]
    
    def __str__(self):
        return f"{self.cleaner.username} - Score: {self.overall_score}"
    
    def calculate_overall_score(self):
        """
        Calculate composite overall score using weighted factors.
        
        Weights:
        - Quality: 30%
        - Reliability: 25%
        - Experience: 20%
        - Bidding Success: 15%
        - Activity: 10%
        """
        # Quality component (average of 4 quality metrics)
        quality_component = (
            self.quality_score +
            self.communication_score +
            self.professionalism_score +
            self.timeliness_score
        ) / 4 * Decimal('0.30')
        
        # Reliability component
        reliability_component = (
            (self.completion_rate * Decimal('0.4')) +
            (self.on_time_rate * Decimal('0.3')) +
            ((Decimal('100') - self.cancellation_rate) * Decimal('0.2')) +
            (self.photo_documentation_rate * Decimal('0.1'))
        ) * Decimal('0.25')
        
        # Experience component (logarithmic scaling for jobs)
        import math
        if self.total_jobs > 0:
            # Scale 1-100 jobs to 0-100 score (logarithmic)
            experience_score = min(Decimal('100'), Decimal(str(math.log(self.total_jobs + 1) * 20)))
        else:
            experience_score = Decimal('0')
        experience_component = experience_score * Decimal('0.20')
        
        # Bidding success component
        bidding_component = self.bid_win_rate * Decimal('0.15')
        
        # Activity component
        if self.jobs_last_30_days > 0:
            activity_score = Decimal('100')
        elif self.jobs_last_90_days > 0:
            activity_score = Decimal('50')
        else:
            activity_score = Decimal('0')
        activity_component = activity_score * Decimal('0.10')
        
        # Sum all components
        self.overall_score = (
            quality_component +
            reliability_component +
            experience_component +
            bidding_component +
            activity_component
        )
        
        return self.overall_score


class JobRecommendation(models.Model):
    """
    Tracks job recommendations shown to cleaners.
    Used for analytics and improving algorithm.
    """
    job = models.ForeignKey(
        'cleaning_jobs.CleaningJob',
        on_delete=models.CASCADE,
        related_name='recommendations'
    )
    cleaner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='job_recommendations'
    )
    
    # Recommendation metadata
    recommendation_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Matching score (0-100)"
    )
    recommendation_rank = models.IntegerField(
        help_text="Rank in recommendation list (1 = top recommendation)"
    )
    
    # Scoring breakdown
    location_score = models.DecimalField(max_digits=5, decimal_places=2)
    pricing_score = models.DecimalField(max_digits=5, decimal_places=2)
    specialization_score = models.DecimalField(max_digits=5, decimal_places=2)
    availability_score = models.DecimalField(max_digits=5, decimal_places=2)
    
    # Outcome tracking
    was_viewed = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(null=True, blank=True)
    
    was_bid_placed = models.BooleanField(default=False)
    bid_placed_at = models.DateTimeField(null=True, blank=True)
    bid = models.ForeignKey(
        'cleaning_jobs.JobBid',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recommendation'
    )
    
    was_bid_accepted = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['job', 'cleaner']
        indexes = [
            models.Index(fields=['cleaner', '-recommendation_score']),
            models.Index(fields=['job', '-recommendation_score']),
            models.Index(fields=['-created_at']),
        ]
    
    def __str__(self):
        return f"Job #{self.job.id} → {self.cleaner.username} (Score: {self.recommendation_score})"


class CleanerRecommendation(models.Model):
    """
    Tracks cleaner recommendations shown to clients.
    Used for analytics and improving algorithm.
    """
    job = models.ForeignKey(
        'cleaning_jobs.CleaningJob',
        on_delete=models.CASCADE,
        related_name='cleaner_recommendations'
    )
    cleaner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='recommended_for_jobs'
    )
    client = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='received_recommendations'
    )
    
    # Recommendation metadata
    recommendation_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Matching score (0-100)"
    )
    recommendation_rank = models.IntegerField(
        help_text="Rank in recommendation list"
    )
    
    # Scoring breakdown
    quality_score = models.DecimalField(max_digits=5, decimal_places=2)
    location_score = models.DecimalField(max_digits=5, decimal_places=2)
    pricing_score = models.DecimalField(max_digits=5, decimal_places=2)
    specialization_score = models.DecimalField(max_digits=5, decimal_places=2)
    reliability_score = models.DecimalField(max_digits=5, decimal_places=2)
    
    # Outcome tracking
    was_viewed = models.BooleanField(default=False)
    was_contacted = models.BooleanField(default=False)
    was_hired = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['job', 'cleaner', 'client']
        indexes = [
            models.Index(fields=['job', '-recommendation_score']),
            models.Index(fields=['client', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.cleaner.username} → Client {self.client.username} for Job #{self.job.id}"


class BidSuggestion(models.Model):
    """
    Smart bid amount suggestions for cleaners.
    Based on historical data and market conditions.
    """
    job = models.ForeignKey(
        'cleaning_jobs.CleaningJob',
        on_delete=models.CASCADE,
        related_name='bid_suggestions'
    )
    cleaner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='bid_suggestions'
    )
    
    # Suggested bid amounts
    suggested_min = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Minimum suggested bid (likely to win but lower profit)"
    )
    suggested_optimal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Optimal bid (best balance of win probability and profit)"
    )
    suggested_max = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Maximum suggested bid (less likely to win but higher profit)"
    )
    
    # Calculation inputs
    client_budget = models.DecimalField(max_digits=10, decimal_places=2)
    market_avg_bid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Average accepted bid for similar jobs"
    )
    cleaner_avg_bid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Cleaner's historical average bid"
    )
    cleaner_win_rate_at_suggested = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Estimated win probability at optimal bid"
    )
    
    # Competition data
    current_bid_count = models.IntegerField(default=0)
    current_lowest_bid = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Outcome tracking
    actual_bid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Actual bid amount if cleaner placed a bid"
    )
    was_bid_placed = models.BooleanField(default=False)
    was_suggestion_used = models.BooleanField(
        default=False,
        help_text="True if actual bid is within 10% of suggested optimal"
    )
    did_win = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['job', 'cleaner']
        indexes = [
            models.Index(fields=['cleaner', '-created_at']),
            models.Index(fields=['job']),
        ]
    
    def __str__(self):
        return f"Bid suggestion for {self.cleaner.username} on Job #{self.job.id}: ${self.suggested_optimal}"


class RecommendationFeedback(models.Model):
    """
    User feedback on recommendations.
    Helps improve algorithm over time.
    """
    FEEDBACK_TYPE_CHOICES = [
        ('helpful', 'Helpful'),
        ('not_relevant', 'Not Relevant'),
        ('too_expensive', 'Too Expensive'),
        ('too_far', 'Too Far'),
        ('wrong_specialty', 'Wrong Specialty'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='recommendation_feedback'
    )
    
    # Can reference either type of recommendation
    job_recommendation = models.ForeignKey(
        JobRecommendation,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    cleaner_recommendation = models.ForeignKey(
        CleanerRecommendation,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    
    feedback_type = models.CharField(
        max_length=20,
        choices=FEEDBACK_TYPE_CHOICES
    )
    comment = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['feedback_type']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.feedback_type}"
