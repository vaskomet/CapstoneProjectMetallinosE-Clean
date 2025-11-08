"""
Scoring Service

Calculates and updates cleaner scores based on historical performance data.
"""

from decimal import Decimal
from django.db.models import Avg, Count, Q, F
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

from recommendations.models import CleanerScore
from reviews.models import Review, ReviewRating
from cleaning_jobs.models import CleaningJob, JobBid
from job_lifecycle.models import JobPhoto
from payments.models import Payment

User = get_user_model()


class ScoringService:
    """
    Service for calculating and updating cleaner scores.
    """
    
    @staticmethod
    def calculate_cleaner_score(cleaner):
        """
        Calculate all metrics for a cleaner and update/create their CleanerScore.
        
        Args:
            cleaner: User instance with role='cleaner'
            
        Returns:
            CleanerScore instance
        """
        score, created = CleanerScore.objects.get_or_create(cleaner=cleaner)
        
        # Calculate all individual metrics
        ScoringService._calculate_quality_metrics(score)
        ScoringService._calculate_reliability_metrics(score)
        ScoringService._calculate_bidding_metrics(score)
        ScoringService._calculate_experience_metrics(score)
        ScoringService._calculate_specialization(score)
        ScoringService._calculate_activity_metrics(score)
        
        # Calculate overall composite score
        score.calculate_overall_score()
        score.save()
        
        return score
    
    @staticmethod
    def _calculate_quality_metrics(score):
        """Calculate quality metrics from reviews."""
        cleaner = score.cleaner
        
        # Get all reviews where cleaner is the reviewee
        reviews = Review.objects.filter(
            reviewee=cleaner,
            is_visible=True
        )
        
        review_count = reviews.count()
        score.review_count = review_count
        
        if review_count == 0:
            # No reviews yet - use default scores
            score.quality_score = Decimal('50.00')
            score.communication_score = Decimal('50.00')
            score.professionalism_score = Decimal('50.00')
            score.timeliness_score = Decimal('50.00')
            score.avg_rating = Decimal('0.00')
            return
        
        # Calculate average overall rating (1-10 scale)
        avg_overall = reviews.aggregate(Avg('overall_rating'))['overall_rating__avg'] or 0
        score.avg_rating = Decimal(str(avg_overall))
        
        # Get category-specific ratings
        quality_ratings = ReviewRating.objects.filter(
            review__in=reviews,
            category='quality'
        ).aggregate(Avg('rating'))['rating__avg']
        
        communication_ratings = ReviewRating.objects.filter(
            review__in=reviews,
            category='communication'
        ).aggregate(Avg('rating'))['rating__avg']
        
        professionalism_ratings = ReviewRating.objects.filter(
            review__in=reviews,
            category='professionalism'
        ).aggregate(Avg('rating'))['rating__avg']
        
        timeliness_ratings = ReviewRating.objects.filter(
            review__in=reviews,
            category='timeliness'
        ).aggregate(Avg('rating'))['rating__avg']
        
        # Convert from 1-10 scale to 0-100 scale
        score.quality_score = Decimal(str((quality_ratings or 5) * 10))
        score.communication_score = Decimal(str((communication_ratings or 5) * 10))
        score.professionalism_score = Decimal(str((professionalism_ratings or 5) * 10))
        score.timeliness_score = Decimal(str((timeliness_ratings or 5) * 10))
    
    @staticmethod
    def _calculate_reliability_metrics(score):
        """Calculate reliability metrics from job history."""
        cleaner = score.cleaner
        
        # Get all jobs assigned to this cleaner
        all_jobs = CleaningJob.objects.filter(cleaner=cleaner)
        total_assigned = all_jobs.count()
        
        if total_assigned == 0:
            score.completion_rate = Decimal('100.00')
            score.on_time_rate = Decimal('100.00')
            score.cancellation_rate = Decimal('0.00')
            score.photo_documentation_rate = Decimal('0.00')
            return
        
        # Completion rate
        completed_jobs = all_jobs.filter(status='completed')
        completion_rate = (completed_jobs.count() / total_assigned) * 100
        score.completion_rate = Decimal(str(completion_rate))
        
        # On-time rate (jobs started within 30 minutes of scheduled time)
        on_time_jobs = 0
        for job in completed_jobs.filter(
            actual_start_time__isnull=False,
            scheduled_date__isnull=False,
            start_time__isnull=False
        ):
            from datetime import datetime, timedelta
            scheduled_datetime = datetime.combine(job.scheduled_date, job.start_time)
            if hasattr(scheduled_datetime, 'replace'):
                scheduled_datetime = timezone.make_aware(scheduled_datetime)
            
            if job.actual_start_time:
                time_diff = abs((job.actual_start_time - scheduled_datetime).total_seconds() / 60)
                if time_diff <= 30:  # Within 30 minutes
                    on_time_jobs += 1
        
        if completed_jobs.count() > 0:
            on_time_rate = (on_time_jobs / completed_jobs.count()) * 100
            score.on_time_rate = Decimal(str(on_time_rate))
        else:
            score.on_time_rate = Decimal('100.00')
        
        # Cancellation rate
        cancelled_jobs = all_jobs.filter(status='cancelled').count()
        cancellation_rate = (cancelled_jobs / total_assigned) * 100
        score.cancellation_rate = Decimal(str(cancellation_rate))
        
        # Photo documentation rate
        jobs_with_photos = JobPhoto.objects.filter(
            job__cleaner=cleaner,
            job__status='completed'
        ).values('job').distinct().count()
        
        completed_count = completed_jobs.count()
        if completed_count > 0:
            photo_rate = (jobs_with_photos / completed_count) * 100
            score.photo_documentation_rate = Decimal(str(photo_rate))
        else:
            score.photo_documentation_rate = Decimal('0.00')
    
    @staticmethod
    def _calculate_bidding_metrics(score):
        """Calculate bidding behavior metrics."""
        cleaner = score.cleaner
        
        # Get all bids
        all_bids = JobBid.objects.filter(cleaner=cleaner)
        total_bids = all_bids.count()
        
        if total_bids == 0:
            score.bid_win_rate = Decimal('0.00')
            score.avg_bid_amount = Decimal('0.00')
            return
        
        # Bid win rate
        accepted_bids = all_bids.filter(status='accepted').count()
        win_rate = (accepted_bids / total_bids) * 100
        score.bid_win_rate = Decimal(str(win_rate))
        
        # Average bid amount
        avg_bid = all_bids.aggregate(Avg('bid_amount'))['bid_amount__avg'] or 0
        score.avg_bid_amount = Decimal(str(avg_bid))
        
        # TODO: Calculate avg_response_time_minutes from chat messages
        # This would require analyzing chat message timestamps
        score.avg_response_time_minutes = 0
    
    @staticmethod
    def _calculate_experience_metrics(score):
        """Calculate experience metrics."""
        cleaner = score.cleaner
        
        # Total completed jobs
        completed_jobs = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed'
        )
        score.total_jobs = completed_jobs.count()
        
        # Total earnings
        total_earnings = Payment.objects.filter(
            cleaner=cleaner,
            status='succeeded'
        ).aggregate(total=models.Sum('cleaner_payout'))['total'] or Decimal('0.00')
        score.total_earnings = total_earnings
    
    @staticmethod
    def _calculate_specialization(score):
        """Determine cleaner's specialization."""
        cleaner = score.cleaner
        
        # Find most common property type
        property_types = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed'
        ).values('property__property_type').annotate(
            count=Count('id')
        ).order_by('-count').first()
        
        if property_types:
            score.primary_property_type = property_types['property__property_type']
        else:
            score.primary_property_type = ''
        
        # Calculate eco-friendly jobs percentage
        total_jobs = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed'
        ).count()
        
        if total_jobs > 0:
            eco_jobs = CleaningJob.objects.filter(
                cleaner=cleaner,
                status='completed',
                property__preferences__eco_friendly=True
            ).count()
            eco_percentage = (eco_jobs / total_jobs) * 100
            score.eco_friendly_jobs_percentage = Decimal(str(eco_percentage))
        else:
            score.eco_friendly_jobs_percentage = Decimal('0.00')
    
    @staticmethod
    def _calculate_activity_metrics(score):
        """Calculate recent activity metrics."""
        cleaner = score.cleaner
        now = timezone.now()
        
        # Jobs in last 30 days
        thirty_days_ago = now - timedelta(days=30)
        score.jobs_last_30_days = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed',
            actual_end_time__gte=thirty_days_ago
        ).count()
        
        # Jobs in last 90 days
        ninety_days_ago = now - timedelta(days=90)
        score.jobs_last_90_days = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed',
            actual_end_time__gte=ninety_days_ago
        ).count()
        
        # Is active (has jobs in last 90 days)
        score.is_active = score.jobs_last_90_days > 0
    
    @staticmethod
    def update_all_cleaner_scores():
        """
        Update scores for all cleaners.
        Should be run periodically (e.g., daily via cron job).
        
        Returns:
            dict: Summary of updates
        """
        cleaners = User.objects.filter(role='cleaner')
        updated_count = 0
        errors = []
        
        for cleaner in cleaners:
            try:
                ScoringService.calculate_cleaner_score(cleaner)
                updated_count += 1
            except Exception as e:
                errors.append(f"Error updating {cleaner.username}: {str(e)}")
        
        return {
            'total_cleaners': cleaners.count(),
            'updated': updated_count,
            'errors': errors
        }


# Import Django models at module level (after class definition to avoid circular imports)
from django.db import models
