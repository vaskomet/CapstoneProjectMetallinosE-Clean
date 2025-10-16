from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from cleaning_jobs.models import CleaningJob
from .consumers import create_and_send_notification


@receiver(post_save, sender=CleaningJob)
def job_status_notification(sender, instance, created, **kwargs):
    """
    Send notifications when job status changes
    """
    if created:
        # New job created - notify potential cleaners
        notification_title = "New Cleaning Job Available"
        notification_message = f"A new {instance.service_type} cleaning job is available in {instance.address}."
        
        # Get cleaners in the area (simplified - you might want to add location filtering)
        from users.models import User
        cleaners = User.objects.filter(role='cleaner', is_active=True)
        
        for cleaner in cleaners:
            create_and_send_notification(
                recipient=cleaner,
                notification_type='job_created',
                title=notification_title,
                message=notification_message,
                content_object=instance,
                action_url=f"/jobs/{instance.id}/",
                metadata={
                    'job_id': instance.id,
                    'service_type': instance.service_type,
                    'location': instance.address
                }
            )
    
    else:
        # Job status updated
        original_job = CleaningJob.objects.get(pk=instance.pk)
        
        # Check if status changed
        if hasattr(instance, '_original_status') and instance.status != instance._original_status:
            handle_status_change(instance, instance._original_status)


@receiver(pre_save, sender=CleaningJob)
def track_job_changes(sender, instance, **kwargs):
    """
    Track original status before save
    """
    if instance.pk:
        try:
            original = CleaningJob.objects.get(pk=instance.pk)
            instance._original_status = original.status
            instance._original_cleaner = original.assigned_cleaner
        except CleaningJob.DoesNotExist:
            pass


def handle_status_change(job_instance, original_status):
    """
    Handle different job status changes
    """
    status = job_instance.status
    client = job_instance.client
    cleaner = job_instance.assigned_cleaner
    
    notifications_to_send = []
    
    if status == 'accepted' and original_status == 'pending':
        # Job accepted by cleaner
        notifications_to_send.append({
            'recipient': client,
            'type': 'job_accepted',
            'title': 'Your Cleaning Job Has Been Accepted',
            'message': f'Your {job_instance.service_type} cleaning job has been accepted by {cleaner.get_full_name() if cleaner else "a cleaner"}.',
            'action_url': f'/jobs/{job_instance.id}/'
        })
        
        if cleaner:
            notifications_to_send.append({
                'recipient': cleaner,
                'type': 'job_accepted',
                'title': 'Job Assignment Confirmed',
                'message': f'You have successfully accepted the {job_instance.service_type} cleaning job.',
                'action_url': f'/jobs/{job_instance.id}/'
            })
    
    elif status == 'in_progress' and original_status == 'accepted':
        # Job started
        notifications_to_send.append({
            'recipient': client,
            'type': 'job_started',
            'title': 'Your Cleaning Job Has Started',
            'message': f'Your cleaner has started working on your {job_instance.service_type} cleaning job.',
            'action_url': f'/jobs/{job_instance.id}/'
        })
    
    elif status == 'completed' and original_status == 'in_progress':
        # Job completed
        notifications_to_send.append({
            'recipient': client,
            'type': 'job_completed',
            'title': 'Your Cleaning Job Is Complete',
            'message': f'Your {job_instance.service_type} cleaning job has been completed! Please review and rate your experience.',
            'action_url': f'/jobs/{job_instance.id}/review/',
            'priority': 'high'
        })
        
        if cleaner:
            notifications_to_send.append({
                'recipient': cleaner,
                'type': 'job_completed',
                'title': 'Job Completed Successfully',
                'message': f'You have successfully completed the {job_instance.service_type} cleaning job. Payment will be processed shortly.',
                'action_url': f'/jobs/{job_instance.id}/'
            })
    
    elif status == 'cancelled':
        # Job cancelled
        message = f'The {job_instance.service_type} cleaning job has been cancelled.'
        
        if cleaner and cleaner != client:
            notifications_to_send.append({
                'recipient': cleaner,
                'type': 'job_cancelled',
                'title': 'Job Cancelled',
                'message': message,
                'action_url': f'/jobs/',
                'priority': 'medium'
            })
        
        notifications_to_send.append({
            'recipient': client,
            'type': 'job_cancelled',
            'title': 'Job Cancelled',
            'message': message,
            'action_url': f'/jobs/',
            'priority': 'medium'
        })
    
    # Send all notifications
    for notification_data in notifications_to_send:
        create_and_send_notification(
            recipient=notification_data['recipient'],
            notification_type=notification_data['type'],
            title=notification_data['title'],
            message=notification_data['message'],
            content_object=job_instance,
            action_url=notification_data.get('action_url'),
            priority=notification_data.get('priority', 'medium'),
            metadata={
                'job_id': job_instance.id,
                'service_type': job_instance.service_type,
                'status': job_instance.status
            }
        )