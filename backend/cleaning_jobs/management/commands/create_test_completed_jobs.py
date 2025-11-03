"""
Django management command to create completed test jobs for review system testing.

Usage:
    python manage.py create_test_completed_jobs

Options:
    --count N           Number of completed jobs to create (default: 5)
    --days-ago N        Days ago the jobs were completed (default: 1-10 random)
    --client USERNAME   Specific client username (optional)
    --cleaner USERNAME  Specific cleaner username (optional)
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import datetime, timedelta
from decimal import Decimal
import random

from cleaning_jobs.models import CleaningJob, JobBid
from properties.models import Property

User = get_user_model()


class Command(BaseCommand):
    help = 'Create completed test jobs for review system testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=5,
            help='Number of completed jobs to create (default: 5)'
        )
        parser.add_argument(
            '--days-ago',
            type=int,
            default=None,
            help='Days ago the jobs were completed (default: random 1-10)'
        )
        parser.add_argument(
            '--client',
            type=str,
            help='Specific client username'
        )
        parser.add_argument(
            '--cleaner',
            type=str,
            help='Specific cleaner username'
        )

    def handle(self, *args, **options):
        count = options['count']
        days_ago_fixed = options['days_ago']
        client_username = options['client']
        cleaner_username = options['cleaner']

        self.stdout.write(self.style.WARNING(f'Creating {count} completed test jobs...'))

        # Get or filter users
        clients = User.objects.filter(role='client')
        cleaners = User.objects.filter(role='cleaner')

        if client_username:
            clients = clients.filter(username=client_username)
            if not clients.exists():
                raise CommandError(f'Client with username "{client_username}" not found')

        if cleaner_username:
            cleaners = cleaners.filter(username=cleaner_username)
            if not cleaners.exists():
                raise CommandError(f'Cleaner with username "{cleaner_username}" not found')

        if not clients.exists():
            raise CommandError('No clients found in database. Create clients first.')

        if not cleaners.exists():
            raise CommandError('No cleaners found in database. Create cleaners first.')

        # Get properties
        properties = Property.objects.all()
        if not properties.exists():
            raise CommandError('No properties found in database. Create properties first.')

        # Job descriptions for variety
        job_descriptions = [
            "Deep clean entire house including kitchen and bathrooms",
            "Standard cleaning service for 2-bedroom apartment",
            "Move-out cleaning with carpet shampooing",
            "Post-renovation deep cleaning",
            "Regular weekly cleaning service",
            "Spring cleaning with window washing",
            "Office space cleaning and sanitization",
            "Kitchen deep clean and appliance detailing",
            "Bathroom deep clean and grout restoration",
            "Living areas and bedroom cleaning"
        ]

        created_jobs = []

        for i in range(count):
            # Random selections
            client = random.choice(clients)
            cleaner = random.choice(cleaners)
            property_obj = random.choice(properties)

            # Ensure client owns the property (or assign any property if they don't have one)
            client_properties = properties.filter(owner=client)
            if client_properties.exists():
                property_obj = random.choice(client_properties)
            else:
                # If client has no properties, we'll use any property for testing
                property_obj = random.choice(properties)

            # Calculate completion date
            if days_ago_fixed:
                days_ago = days_ago_fixed
            else:
                days_ago = random.randint(1, 10)  # Within last 10 days (within 30-day review window)

            completion_date = timezone.now() - timedelta(days=days_ago)
            scheduled_date = completion_date.date() - timedelta(days=1)  # Job was scheduled day before completion

            # Random job details
            client_budget = Decimal(str(round(random.uniform(50, 200), 2)))
            final_price = Decimal(str(round(random.uniform(40, float(client_budget)), 2)))
            start_time = datetime.strptime(f"{random.randint(8, 16)}:00", "%H:%M").time()
            
            # Calculate actual start and end times
            actual_start = completion_date.replace(
                hour=start_time.hour,
                minute=0,
                second=0,
                microsecond=0
            )
            actual_end = actual_start + timedelta(hours=random.randint(2, 5))

            # Create the job
            job = CleaningJob.objects.create(
                client=client,
                cleaner=cleaner,
                property=property_obj,
                status='completed',
                scheduled_date=scheduled_date,
                start_time=start_time,
                services_description=random.choice(job_descriptions),
                client_budget=client_budget,
                final_price=final_price,
                checklist=['kitchen', 'bathroom', 'living_room', 'bedrooms'],
                notes=f"Test completed job {i+1}",
                eco_impact_metrics={
                    'water_saved_liters': random.randint(20, 100),
                    'chemicals_avoided_kg': round(random.uniform(0.5, 3.0), 2),
                    'co2_saved_kg': round(random.uniform(1.0, 5.0), 2)
                },
                actual_start_time=actual_start,
                actual_end_time=actual_end,
                cleaner_confirmed_at=actual_start - timedelta(hours=2)
            )

            # Create and accept a bid (for completeness)
            bid = JobBid.objects.create(
                job=job,
                cleaner=cleaner,
                bid_amount=final_price,
                estimated_duration=timedelta(hours=3),
                message=f"I can complete this job professionally!",
                status='accepted'
            )
            job.accepted_bid = bid
            job.save()

            created_jobs.append(job)

            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Created Job #{job.id}: {client.username} → {cleaner.username} '
                    f'(completed {days_ago} days ago, ${final_price})'
                )
            )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} completed test jobs!'))
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('Job IDs created: ') + 
                         ', '.join([str(job.id) for job in created_jobs]))
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('Testing Instructions:'))
        self.stdout.write('1. Log in as a client from the completed jobs above')
        self.stdout.write('2. Navigate to "Completed Jobs" dashboard')
        self.stdout.write('3. Select a completed job')
        self.stdout.write('4. Click "Leave a Review" button')
        self.stdout.write('5. Submit a review with ratings and comment')
        self.stdout.write('6. Verify review appears in the review list')
        self.stdout.write('7. Log in as the cleaner and test responding to the review')
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Happy testing! 🧪'))
