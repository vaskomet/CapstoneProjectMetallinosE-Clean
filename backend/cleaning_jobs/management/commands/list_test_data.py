"""
Django management command to list test data for review system testing.

Usage:
    python manage.py list_test_data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from cleaning_jobs.models import CleaningJob

User = get_user_model()


class Command(BaseCommand):
    help = 'List test data (users and completed jobs) for review system testing'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=== TEST DATA FOR REVIEW SYSTEM ==='))
        self.stdout.write('')

        # List clients
        self.stdout.write(self.style.WARNING('📋 CLIENTS:'))
        clients = User.objects.filter(role='client')
        for client in clients:
            jobs_count = CleaningJob.objects.filter(
                client=client,
                status='completed'
            ).count()
            self.stdout.write(f'  • {client.username} ({client.email}) - {jobs_count} completed jobs')
        self.stdout.write('')

        # List cleaners
        self.stdout.write(self.style.WARNING('🧹 CLEANERS:'))
        cleaners = User.objects.filter(role='cleaner')
        for cleaner in cleaners:
            jobs_count = CleaningJob.objects.filter(
                cleaner=cleaner,
                status='completed'
            ).count()
            self.stdout.write(f'  • {cleaner.username} ({cleaner.email}) - {jobs_count} completed jobs')
        self.stdout.write('')

        # List completed jobs with details
        self.stdout.write(self.style.WARNING('✅ COMPLETED JOBS (Recent 20):'))
        completed_jobs = CleaningJob.objects.filter(
            status='completed'
        ).select_related('client', 'cleaner', 'property').order_by('-actual_end_time')[:20]

        for job in completed_jobs:
            days_ago = (job.actual_end_time.date() - job.actual_end_time.date()).days if job.actual_end_time else 'N/A'
            self.stdout.write(
                f'  Job #{job.id}: '
                f'{job.client.username} → {job.cleaner.username} | '
                f'${job.final_price} | '
                f'{job.actual_end_time.strftime("%Y-%m-%d") if job.actual_end_time else "N/A"}'
            )
        self.stdout.write('')

        # Show testing instructions
        self.stdout.write(self.style.SUCCESS('🧪 TESTING INSTRUCTIONS:'))
        self.stdout.write('1. Log in as any client listed above')
        self.stdout.write('2. Navigate to: http://localhost:3000/completed-jobs')
        self.stdout.write('3. Select a completed job from the list')
        self.stdout.write('4. Click "Leave a Review" button')
        self.stdout.write('5. Fill out the review form (overall rating + 4 sub-ratings)')
        self.stdout.write('6. Submit and verify the review appears')
        self.stdout.write('7. Log in as the cleaner and test responding')
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('💡 TIP: Use default password "Test1234!" for all test users'))
        self.stdout.write('')
