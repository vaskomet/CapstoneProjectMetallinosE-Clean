"""
Dashboard Stats API

Provides summary statistics for client and cleaner dashboards
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q, Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta

from cleaning_jobs.models import CleaningJob, JobBid
from payments.models import Payment, PayoutRequest
from reviews.models import Review


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def client_dashboard_stats(request):
    """
    Get dashboard statistics for clients
    
    Returns:
    - active_jobs: Count of jobs in progress or confirmed
    - pending_jobs: Jobs waiting for bid acceptance
    - completed_jobs: Count of completed jobs
    - total_spent: Total amount spent on completed jobs
    - pending_payments: Amount awaiting payment
    - recent_bids: Latest bids received (limit 5)
    - upcoming_jobs: Jobs scheduled to start soon
    """
    user = request.user
    
    if user.role != 'client':
        return Response(
            {'error': 'This endpoint is for clients only'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Active jobs (confirmed or in progress)
    active_jobs = CleaningJob.objects.filter(
        client=user,
        status__in=['confirmed', 'in_progress']
    ).count()
    
    # Pending jobs (open for bids or bid accepted, not yet confirmed)
    pending_jobs = CleaningJob.objects.filter(
        client=user,
        status__in=['open_for_bids', 'bid_accepted']
    ).count()
    
    # Completed jobs
    completed_jobs = CleaningJob.objects.filter(
        client=user,
        status='completed'
    ).count()
    
    # Total spent (sum of completed payments)
    total_spent = Payment.objects.filter(
        job__client=user,
        status='succeeded'
    ).aggregate(total=Sum('amount'))['total'] or 0
    
    # Pending payments (jobs with accepted bid but no successful payment yet)
    # Count jobs where payment is not 'succeeded'
    from django.db.models import Q
    pending_payment_jobs = CleaningJob.objects.filter(
        client=user,
        status='bid_accepted'
    ).exclude(
        payments__status='succeeded'
    ).distinct()
    pending_payments = sum(job.accepted_bid.bid_amount for job in pending_payment_jobs if job.accepted_bid)
    
    # Recent bids (last 5 bids on client's jobs)
    recent_bids = JobBid.objects.filter(
        job__client=user
    ).select_related(
        'job', 'cleaner'
    ).order_by('-created_at')[:5]
    
    recent_bids_data = [{
        'id': bid.id,
        'job_id': bid.job.id,
        'job_title': bid.job.services_description[:50] + '...' if len(bid.job.services_description) > 50 else bid.job.services_description,
        'cleaner_name': f"{bid.cleaner.first_name} {bid.cleaner.last_name}",
        'amount': float(bid.bid_amount),
        'status': bid.status,
        'created_at': bid.created_at.isoformat()
    } for bid in recent_bids]
    
    # Upcoming jobs (confirmed jobs with scheduled date in next 7 days)
    next_week = timezone.now() + timedelta(days=7)
    upcoming_jobs = CleaningJob.objects.filter(
        client=user,
        status__in=['confirmed', 'in_progress'],
        scheduled_date__lte=next_week,
        scheduled_date__gte=timezone.now()
    ).select_related('cleaner').order_by('scheduled_date')[:5]
    
    upcoming_jobs_data = [{
        'id': job.id,
        'title': job.services_description[:50] + '...' if len(job.services_description) > 50 else job.services_description,
        'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
        'cleaner_name': f"{job.cleaner.first_name} {job.cleaner.last_name}" if job.cleaner else None,
        'status': job.status
    } for job in upcoming_jobs]
    
    return Response({
        'active_jobs': active_jobs,
        'pending_jobs': pending_jobs,
        'completed_jobs': completed_jobs,
        'total_spent': float(total_spent),
        'pending_payments': float(pending_payments),
        'recent_bids': recent_bids_data,
        'upcoming_jobs': upcoming_jobs_data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cleaner_dashboard_stats(request):
    """
    Get dashboard statistics for cleaners
    
    Returns:
    - active_jobs: Count of jobs in progress
    - pending_bids: Count of submitted bids awaiting decision
    - completed_jobs: Count of completed jobs
    - total_earned: Total earnings from completed jobs
    - pending_earnings: Amount from completed jobs not yet paid out
    - average_rating: Average rating from reviews
    - available_jobs_nearby: Count of open jobs in cleaner's service areas
    - recent_jobs: Latest 5 jobs (active or recently completed)
    """
    user = request.user
    
    if user.role != 'cleaner':
        return Response(
            {'error': 'This endpoint is for cleaners only'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Active jobs (confirmed or in progress)
    active_jobs = CleaningJob.objects.filter(
        cleaner=user,
        status__in=['confirmed', 'in_progress']
    ).count()
    
    # Pending bids (submitted but not accepted/rejected)
    pending_bids = JobBid.objects.filter(
        cleaner=user,
        status='pending'
    ).count()
    
    # Completed jobs
    completed_jobs = CleaningJob.objects.filter(
        cleaner=user,
        status='completed'
    ).count()
    
    # Total earned (sum of completed payouts)
    total_earned = PayoutRequest.objects.filter(
        cleaner=user,
        status='completed'
    ).aggregate(total=Sum('amount'))['total'] or 0
    
    # Pending earnings (pending payout requests)
    pending_payouts = PayoutRequest.objects.filter(
        cleaner=user,
        status__in=['pending', 'approved', 'processing']
    ).aggregate(total=Sum('amount'))['total'] or 0
    
    # Average rating (reviews where this cleaner is the reviewee)
    avg_rating = Review.objects.filter(
        reviewee=user
    ).aggregate(avg=Avg('overall_rating'))['avg'] or 0
    
    # Available jobs in cleaner's service areas
    from users.models import ServiceArea
    
    # Get cities from cleaner's service areas
    service_cities = ServiceArea.objects.filter(
        cleaner=user,
        is_active=True
    ).values_list('city', flat=True)
    
    # Count jobs in those cities
    available_jobs_nearby = CleaningJob.objects.filter(
        status='open_for_bids',
        property__city__in=service_cities
    ).count()
    
    # Recent jobs (last 5 active or recently completed)
    recent_jobs = CleaningJob.objects.filter(
        cleaner=user
    ).select_related(
        'client', 'property'
    ).order_by('-created_at')[:5]
    
    recent_jobs_data = [{
        'id': job.id,
        'title': job.services_description[:50] + '...' if len(job.services_description) > 50 else job.services_description,
        'client_name': f"{job.client.first_name} {job.client.last_name}",
        'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
        'status': job.status,
        'amount': float(job.accepted_bid.bid_amount) if job.accepted_bid else None
    } for job in recent_jobs]
    
    # Upcoming jobs (confirmed jobs with scheduled date in next 7 days)
    next_week = timezone.now() + timedelta(days=7)
    upcoming_jobs = CleaningJob.objects.filter(
        cleaner=user,
        status__in=['confirmed', 'in_progress'],
        scheduled_date__lte=next_week,
        scheduled_date__gte=timezone.now()
    ).select_related('client').order_by('scheduled_date')[:5]
    
    upcoming_jobs_data = [{
        'id': job.id,
        'title': job.services_description[:50] + '...' if len(job.services_description) > 50 else job.services_description,
        'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
        'client_name': f"{job.client.first_name} {job.client.last_name}",
        'status': job.status
    } for job in upcoming_jobs]
    
    return Response({
        'active_jobs': active_jobs,
        'pending_bids': pending_bids,
        'completed_jobs': completed_jobs,
        'total_earned': float(total_earned),
        'pending_earnings': float(pending_payouts),
        'average_rating': round(float(avg_rating), 2) if avg_rating else 0,
        'available_jobs_nearby': available_jobs_nearby,
        'recent_jobs': recent_jobs_data,
        'upcoming_jobs': upcoming_jobs_data
    })
