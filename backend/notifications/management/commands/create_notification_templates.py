"""
Create notification templates for job and bid events
"""

from django.core.management.base import BaseCommand
from notifications.models import NotificationTemplate


class Command(BaseCommand):
    help = 'Create notification templates for E-Clean platform'

    def handle(self, *args, **options):
        templates = [
            # Job-related templates
            {
                'name': 'Job Created',
                'notification_type': 'job_created',
                'title_template': 'New Job Available: {job_title}',
                'message_template': 'A new cleaning job is available in {property_city}. Budget: ${client_budget}. Check it out!',
                'default_priority': 'medium',
                'is_active': True,
            },
            {
                'name': 'Job Accepted',
                'notification_type': 'job_accepted',
                'title_template': '{cleaner_name} Accepted Your Job',
                'message_template': '{cleaner_name} has accepted your cleaning job: {job_title}.',
                'default_priority': 'high',
                'is_active': True,
            },
            {
                'name': 'Job Started',
                'notification_type': 'job_started',
                'title_template': 'Job Started: {job_title}',
                'message_template': 'Your cleaner has started working on: {job_title}.',
                'default_priority': 'high',
                'is_active': True,
            },
            {
                'name': 'Job Completed',
                'notification_type': 'job_completed',
                'title_template': 'Job Completed: {job_title}',
                'message_template': 'Your cleaning job has been completed! Please review and rate the service.',
                'default_priority': 'high',
                'is_active': True,
            },
            {
                'name': 'Job Cancelled',
                'notification_type': 'job_cancelled',
                'title_template': 'Job Cancelled: {job_title}',
                'message_template': 'The cleaning job "{job_title}" has been cancelled.',
                'default_priority': 'medium',
                'is_active': True,
            },
            
            # Bid-related templates
            {
                'name': 'Bid Received',
                'notification_type': 'bid_received',
                'title_template': 'New Bid from {cleaner_name}',
                'message_template': '{cleaner_name} has submitted a bid of ${bid_amount} for your job: {job_title}.',
                'default_priority': 'high',
                'is_active': True,
            },
            {
                'name': 'Bid Accepted',
                'notification_type': 'bid_accepted',
                'title_template': 'Your Bid Was Accepted!',
                'message_template': 'Congratulations! Your bid of ${bid_amount} for "{job_title}" has been accepted by {client_name}.',
                'default_priority': 'urgent',
                'is_active': True,
            },
            {
                'name': 'Bid Rejected',
                'notification_type': 'bid_rejected',
                'title_template': 'Bid Not Accepted',
                'message_template': 'Your bid for "{job_title}" was not accepted. Keep bidding on other jobs!',
                'default_priority': 'low',
                'is_active': True,
            },
            
            # Message/Chat templates
            {
                'name': 'New Message',
                'notification_type': 'message_received',
                'title_template': 'New Message from {sender_name}',
                'message_template': 'You have a new message regarding: {job_title}.',
                'default_priority': 'medium',
                'is_active': True,
            },
            
            # Payment templates
            {
                'name': 'Payment Received',
                'notification_type': 'payment_received',
                'title_template': 'Payment Received: ${amount}',
                'message_template': 'You have received a payment of ${amount} for job: {job_title}.',
                'default_priority': 'high',
                'is_active': True,
            },
            {
                'name': 'Payment Made',
                'notification_type': 'payment_made',
                'title_template': 'Payment Processed: ${amount}',
                'message_template': 'Your payment of ${amount} for "{job_title}" has been processed.',
                'default_priority': 'high',
                'is_active': True,
            },
        ]

        created_count = 0
        updated_count = 0

        for template_data in templates:
            template, created = NotificationTemplate.objects.update_or_create(
                notification_type=template_data['notification_type'],
                defaults=template_data
            )
            
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✓ Created: {template.name} ({template.notification_type})')
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'⟳ Updated: {template.name} ({template.notification_type})')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone! Created {created_count} templates, updated {updated_count} templates.'
            )
        )
