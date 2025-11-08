"""
Signals for cleaning jobs and bids

Handles automatic event publishing and notification triggering for job-related actions.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.db import transaction
from .models import CleaningJob, JobBid
from core.events import event_publisher
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=CleaningJob)
def job_post_save(sender, instance, created, **kwargs):
    """
    Signal handler for CleaningJob post_save.
    
    Publishes events when:
    - Job is created
    - Job status changes
    - Job is assigned to a cleaner
    """
    # Only process after transaction commits to ensure data consistency
    transaction.on_commit(lambda: _handle_job_save(instance, created))


def _handle_job_save(job, created):
    """Handle job save event after transaction commit."""
    try:
        if created:
            # New job created - notify all eligible cleaners
            logger.info(f"Job created: {job.id}")
            
            # Prepare job data
            client_name = 'Unknown'
            if job.client:
                if job.client.first_name or job.client.last_name:
                    client_name = f"{job.client.first_name} {job.client.last_name}".strip()
                else:
                    client_name = job.client.email
            
            job_data = {
                'job_id': job.id,
                'client_id': job.client.id if job.client else None,
                'client_name': client_name,
                'services_description': job.services_description,
                'client_budget': str(job.client_budget) if job.client_budget else '0',
                'scheduled_date': job.scheduled_date.isoformat() if job.scheduled_date else None,
                'start_time': str(job.start_time) if job.start_time else None,
                'property_id': job.property.id if job.property else None,
                'property_address': str(job.property) if job.property else 'Unknown',
                'property_city': job.property.city if job.property else 'Unknown',
                'status': job.status,
            }
            
            # Publish job_created event
            event_publisher.publish_event(
                topic='jobs',
                event_type='job_created',
                data=job_data
            )
            logger.info(f"Published job_created event for job {job.id}")
        
        else:
            # Job updated - check for status changes
            try:
                # Get previous state from database
                old_job = CleaningJob.objects.get(pk=job.pk)
                
                # Check if status changed
                if hasattr(old_job, 'status') and old_job.status != job.status:
                    logger.info(f"Job {job.id} status changed: {old_job.status} -> {job.status}")
                    
                    cleaner_name = 'Cleaner'
                    if job.cleaner:
                        if job.cleaner.first_name or job.cleaner.last_name:
                            cleaner_name = f"{job.cleaner.first_name} {job.cleaner.last_name}".strip()
                        else:
                            cleaner_name = job.cleaner.email
                    
                    job_data = {
                        'job_id': job.id,
                        'old_status': old_job.status,
                        'new_status': job.status,
                        'client_id': job.client.id if job.client else None,
                        'cleaner_id': job.cleaner.id if job.cleaner else None,
                        'cleaner_name': cleaner_name,
                        'services_description': job.services_description,
                    }
                    
                    # Publish status change event
                    event_publisher.publish_event(
                        topic='jobs',
                        event_type='job_status_changed',
                        data=job_data
                    )
                    
                    # Publish specific events based on new status
                    if job.status == 'bid_accepted' and job.cleaner:
                        event_publisher.publish_event(
                            topic='jobs',
                            event_type='job_accepted',
                            data=job_data
                        )
                    elif job.status == 'in_progress':
                        event_publisher.publish_event(
                            topic='jobs',
                            event_type='job_started',
                            data=job_data
                        )
                    elif job.status == 'completed':
                        event_publisher.publish_event(
                            topic='jobs',
                            event_type='job_completed',
                            data=job_data
                        )
                    elif job.status == 'cancelled':
                        event_publisher.publish_event(
                            topic='jobs',
                            event_type='job_cancelled',
                            data=job_data
                        )
                    
            except CleaningJob.DoesNotExist:
                # This shouldn't happen, but handle gracefully
                logger.warning(f"Could not find previous state for job {job.id}")
    
    except Exception as e:
        logger.error(f"Error in job_post_save signal: {e}", exc_info=True)


@receiver(post_save, sender=JobBid)
def job_bid_post_save(sender, instance, created, **kwargs):
    """
    Signal handler for JobBid post_save.
    
    Publishes events when:
    - New bid is submitted
    - Bid status changes (accepted, rejected)
    """
    transaction.on_commit(lambda: _handle_bid_save(instance, created))


def _handle_bid_save(bid, created):
    """Handle bid save event after transaction commit."""
    try:
        if created:
            # New bid submitted - notify job owner (client)
            logger.info(f"Bid created: {bid.id} for job {bid.job.id}")
            
            # Get client name
            client_name = 'Client'
            if bid.job.client:
                if bid.job.client.first_name or bid.job.client.last_name:
                    client_name = f"{bid.job.client.first_name} {bid.job.client.last_name}".strip()
                else:
                    client_name = bid.job.client.email
            
            # Get cleaner name
            cleaner_name = 'Cleaner'
            if bid.cleaner:
                if bid.cleaner.first_name or bid.cleaner.last_name:
                    cleaner_name = f"{bid.cleaner.first_name} {bid.cleaner.last_name}".strip()
                else:
                    cleaner_name = bid.cleaner.email
            
            bid_data = {
                'bid_id': bid.id,
                'job_id': bid.job.id,
                'job_title': bid.job.services_description,
                'client_id': bid.job.client.id if bid.job.client else None,
                'client_name': client_name,
                'cleaner_id': bid.cleaner.id,
                'cleaner_name': cleaner_name,
                'bid_amount': str(bid.bid_amount),
                'estimated_duration': str(bid.estimated_duration),
                'message': bid.message,
                'status': bid.status,
            }
            
            # Publish bid_received event
            event_publisher.publish_event(
                topic='jobs',
                event_type='bid_received',
                data=bid_data,
                user_id=bid.job.client.id if bid.job.client else None
            )
            logger.info(f"Published bid_received event for bid {bid.id}")
        
        else:
            # Bid updated - check for status changes
            try:
                old_bid = JobBid.objects.get(pk=bid.pk)
                
                if hasattr(old_bid, 'status') and old_bid.status != bid.status:
                    logger.info(f"Bid {bid.id} status changed: {old_bid.status} -> {bid.status}")
                    
                    cleaner_name = 'Cleaner'
                    if bid.cleaner.first_name or bid.cleaner.last_name:
                        cleaner_name = f"{bid.cleaner.first_name} {bid.cleaner.last_name}".strip()
                    else:
                        cleaner_name = bid.cleaner.email
                    
                    bid_data = {
                        'bid_id': bid.id,
                        'job_id': bid.job.id,
                        'old_status': old_bid.status,
                        'new_status': bid.status,
                        'client_id': bid.job.client.id if bid.job.client else None,
                        'cleaner_id': bid.cleaner.id,
                        'cleaner_name': cleaner_name,
                        'bid_amount': str(bid.bid_amount),
                    }
                    
                    if bid.status == 'accepted':
                        # Notify the cleaner their bid was accepted
                        event_publisher.publish_event(
                            topic='jobs',
                            event_type='bid_accepted',
                            data=bid_data,
                            user_id=bid.cleaner.id
                        )
                    elif bid.status == 'rejected':
                        # Notify the cleaner their bid was rejected
                        event_publisher.publish_event(
                            topic='jobs',
                            event_type='bid_rejected',
                            data=bid_data,
                            user_id=bid.cleaner.id
                        )
                    
            except JobBid.DoesNotExist:
                logger.warning(f"Could not find previous state for bid {bid.id}")
    
    except Exception as e:
        logger.error(f"Error in job_bid_post_save signal: {e}", exc_info=True)
