from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from cleaning_jobs.models import CleaningJob
from core.events import event_publisher
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=CleaningJob)
def job_status_notification(sender, instance, created, **kwargs):
    """
    Publish job lifecycle events to Pub/Sub system instead of direct notification creation.
    
    This enables decoupled event processing and allows multiple subscribers to react
    to job changes independently.
    """
    try:
        if created:
            # New job created - publish event for potential cleaners
            logger.info(f"Publishing job_created event for job {instance.id}")
            
            job_data = {
                'job_id': instance.id,
                'client_id': instance.client.id,
                'services_description': instance.services_description,
                'client_budget': str(instance.client_budget),
                'scheduled_date': instance.scheduled_date.isoformat() if instance.scheduled_date else None,
                'start_time': instance.start_time.isoformat() if instance.start_time else None,
                'property_id': instance.property.id,
                'property_address': f"{instance.property.address_line1}, {instance.property.city}",
                'property_latitude': str(instance.property.latitude) if instance.property.latitude else None,
                'property_longitude': str(instance.property.longitude) if instance.property.longitude else None,
                'status': instance.status
            }
            
            event_publisher.publish_job_event('job_created', job_data)
        
        else:
            # Job status updated - check what changed
            if hasattr(instance, '_original_status') and instance.status != instance._original_status:
                logger.info(f"Publishing job status change event: {instance.id} from {instance._original_status} to {instance.status}")
                
                job_data = {
                    'job_id': instance.id,
                    'client_id': instance.client.id,
                    'cleaner_id': instance.cleaner.id if instance.cleaner else None,
                    'services_description': instance.services_description,
                    'status': instance.status,
                    'previous_status': instance._original_status,
                    'property_address': f"{instance.property.address_line1}, {instance.property.city}",
                    'scheduled_date': instance.scheduled_date.isoformat() if instance.scheduled_date else None,
                    'client_budget': str(instance.client_budget)
                }
                
                # Publish specific status change events
                status_events = {
                    'confirmed': 'job_accepted',
                    'in_progress': 'job_started', 
                    'completed': 'job_completed',
                    'cancelled': 'job_cancelled'
                }
                
                event_type = status_events.get(instance.status)
                if event_type:
                    event_publisher.publish_job_event(event_type, job_data)
                
                # Also publish general status change event
                event_publisher.publish_job_event('job_status_changed', job_data)
    
    except Exception as e:
        logger.error(f"Error publishing job event for job {instance.id}: {e}")
        # Don't raise exception to avoid breaking the save operation


@receiver(pre_save, sender=CleaningJob)
def track_job_changes(sender, instance, **kwargs):
    """
    Track original status before save
    """
    if instance.pk:
        try:
            original = CleaningJob.objects.get(pk=instance.pk)
            instance._original_status = original.status
        except CleaningJob.DoesNotExist:
            pass