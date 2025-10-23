"""
Notification utility functions for E-Clean application
"""

from .models import Notification, NotificationTemplate
from .serializers import NotificationSerializer
from cleaning_jobs.models import CleaningJob
from users.models import User
import logging

logger = logging.getLogger(__name__)


def create_and_send_notification(recipient, notification_type, title, message, 
                                sender=None, content_object=None, priority='medium',
                                action_url=None, metadata=None):
    """Create notification and send via WebSocket"""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    
    # Create notification
    notification = Notification.objects.create(
        recipient=recipient,
        sender=sender,
        notification_type=notification_type,
        title=title,
        message=message,
        priority=priority,
        content_object=content_object,
        action_url=action_url,
        metadata=metadata or {}
    )
    
    # Serialize notification
    serializer = NotificationSerializer(notification)
    notification_data = serializer.data
    
    # Send via WebSocket
    channel_layer = get_channel_layer()
    group_name = f'notifications_{recipient.id}'
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'notification_message',
            'notification': notification_data
        }
    )
    
    return notification


def send_job_notification(job, notification_type, recipient=None, **context):
    """
    Send job-related notifications using templates
    
    Args:
        job: CleaningJob instance
        notification_type: Type of notification (job_created, job_accepted, etc.)
        recipient: User to receive notification (if None, auto-determined)
        **context: Additional context variables for template rendering
    """
    try:
        # Get notification template
        template = NotificationTemplate.objects.filter(
            notification_type=notification_type,
            is_active=True
        ).first()
        
        if not template:
            logger.warning(f"No template found for notification type: {notification_type}")
            return
        
        # Determine recipient if not provided
        if not recipient:
            if notification_type == 'job_created':
                # Notify all active cleaners in the area
                recipients = User.objects.filter(role='cleaner', is_active=True)
            elif notification_type in ['job_accepted', 'job_started', 'job_completed']:
                # Notify the client
                recipients = [job.client] if job.client else []
            else:
                logger.warning(f"Cannot determine recipient for notification type: {notification_type}")
                return
        else:
            recipients = [recipient]
        
        # Prepare context for template rendering
        template_context = {
            'job_id': job.id,
            'service_type': getattr(job, 'service_type', 'cleaning'),
            'location': getattr(job.property, 'city', 'Unknown') if job.property else 'Unknown',
            'budget': str(job.client_budget) if job.client_budget else 'TBD',
            'cleaner_name': job.cleaner.first_name if job.cleaner else 'Cleaner',
            'client_name': job.client.first_name if job.client else 'Client',
            'address': str(job.property) if job.property else 'Property',
            'date': job.scheduled_date.strftime('%B %d, %Y') if job.scheduled_date else 'TBD',
            **context
        }
        
        # Render template
        title, message = template.render(template_context)
        
        # Send notification to each recipient
        for recipient in recipients:
            create_and_send_notification(
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                content_object=job,
                action_url=f"/jobs/{job.id}/",
                priority=template.default_priority,
                metadata={
                    'job_id': job.id,
                    'template_used': template.name,
                    **template_context
                }
            )
            
        logger.info(f"Sent {notification_type} notification for job {job.id} to {len(recipients)} recipients")
        
    except Exception as e:
        logger.error(f"Error sending job notification: {str(e)}")


def send_payment_notification(user, amount, job_id, status='received'):
    """
    Send payment-related notifications
    """
    try:
        notification_type = 'payment_received' if status == 'received' else 'system_alert'
        
        create_and_send_notification(
            recipient=user,
            notification_type=notification_type,
            title=f"Payment {status.title()}",
            message=f"Payment of ${amount} has been {status} for Job #{job_id}.",
            action_url="/payments/",
            priority='medium',
            metadata={
                'amount': amount,
                'job_id': job_id,
                'payment_status': status
            }
        )
        
        logger.info(f"Sent payment notification to {user.email}")
        
    except Exception as e:
        logger.error(f"Error sending payment notification: {str(e)}")


def send_message_notification(recipient, sender, job_id, message_preview):
    """
    Send chat message notifications
    """
    try:
        create_and_send_notification(
            recipient=recipient,
            notification_type='message_received',
            title=f"New Message from {sender.first_name or sender.email}",
            message=f'Message about Job #{job_id}: "{message_preview[:50]}..."',
            action_url=f"/jobs/{job_id}/chat/",
            priority='medium',
            metadata={
                'sender_id': sender.id,
                'job_id': job_id,
                'message_preview': message_preview
            }
        )
        
        logger.info(f"Sent message notification from {sender.email} to {recipient.email}")
        
    except Exception as e:
        logger.error(f"Error sending message notification: {str(e)}")