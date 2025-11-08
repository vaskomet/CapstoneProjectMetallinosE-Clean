"""
Script to create notification templates for E-Clean application
Run this with: python manage.py shell < create_notification_templates.py
"""

from notifications.models import NotificationTemplate

# Job Lifecycle Templates
templates = [
    {
        'name': 'new_job_available',
        'notification_type': 'job_created',
        'title_template': 'New {service_type} Job Available',
        'message_template': 'A new {service_type} cleaning job is available in {location} for ${budget}. Click to view details.',
        'default_priority': 'medium'
    },
    {
        'name': 'job_accepted',
        'notification_type': 'job_accepted',
        'title_template': 'Job Accepted by {cleaner_name}',
        'message_template': '{cleaner_name} has accepted your cleaning job. They will contact you soon to confirm details.',
        'default_priority': 'high'
    },
    {
        'name': 'job_started',
        'notification_type': 'job_started',
        'title_template': 'Cleaning Started',
        'message_template': '{cleaner_name} has started cleaning your {property_type} at {address}.',
        'default_priority': 'high'
    },
    {
        'name': 'job_completed',
        'notification_type': 'job_completed',
        'title_template': 'Cleaning Completed',
        'message_template': 'Your cleaning job has been completed! Please review and rate the service.',
        'default_priority': 'high'
    },
    {
        'name': 'job_cancelled',
        'notification_type': 'job_cancelled',
        'title_template': 'Job Cancelled',
        'message_template': 'Your cleaning job scheduled for {date} has been cancelled. Reason: {reason}',
        'default_priority': 'urgent'
    },
    {
        'name': 'payment_received',
        'notification_type': 'payment_received',
        'title_template': 'Payment Received',
        'message_template': 'Payment of ${amount} has been received for Job #{job_id}. Funds will be available in 2-3 business days.',
        'default_priority': 'medium'
    },
    {
        'name': 'new_message',
        'notification_type': 'message_received',
        'title_template': 'New Message from {sender_name}',
        'message_template': 'You have a new message about Job #{job_id}: "{message_preview}"',
        'default_priority': 'medium'
    },
    {
        'name': 'profile_updated',
        'notification_type': 'system_alert',
        'title_template': 'Profile Updated',
        'message_template': 'Your profile has been successfully updated. Changes are now live.',
        'default_priority': 'low'
    }
]

print("Creating notification templates...")

for template_data in templates:
    template, created = NotificationTemplate.objects.get_or_create(
        name=template_data['name'],
        defaults=template_data
    )
    
    if created:
        print(f"✅ Created: {template.name}")
    else:
        print(f"ℹ️ Already exists: {template.name}")

print(f"\n🎉 Notification templates setup complete!")
print(f"Total templates: {NotificationTemplate.objects.count()}")