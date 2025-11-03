"""
Test review eligibility for debugging grey button issue.

Usage:
    python manage.py test_review_eligibility --job-id 8 --username vaskoclient
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from cleaning_jobs.models import CleaningJob
from reviews.models import Review
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


class Command(BaseCommand):
    help = 'Test review eligibility for debugging'

    def add_arguments(self, parser):
        parser.add_argument('--job-id', type=int, required=True, help='Job ID to check')
        parser.add_argument('--username', type=str, required=True, help='Username to check')

    def handle(self, *args, **options):
        job_id = options['job_id']
        username = options['username']

        try:
            job = CleaningJob.objects.get(id=job_id)
            user = User.objects.get(username=username)
        except CleaningJob.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Job #{job_id} not found'))
            return
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ User "{username}" not found'))
            return

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== REVIEW ELIGIBILITY CHECK ==='))
        self.stdout.write('')
        
        # Job details
        self.stdout.write(self.style.WARNING('📋 JOB DETAILS:'))
        self.stdout.write(f'  Job ID: {job.id}')
        self.stdout.write(f'  Status: {job.status}')
        self.stdout.write(f'  Client: {job.client.username}')
        self.stdout.write(f'  Cleaner: {job.cleaner.username}')
        self.stdout.write(f'  Actual End Time: {job.actual_end_time}')
        self.stdout.write('')

        # User details
        self.stdout.write(self.style.WARNING('👤 USER DETAILS:'))
        self.stdout.write(f'  Username: {user.username}')
        self.stdout.write(f'  Role: {user.role}')
        self.stdout.write(f'  Is Client: {user == job.client}')
        self.stdout.write(f'  Is Cleaner: {user == job.cleaner}')
        self.stdout.write('')

        # Run eligibility checks
        self.stdout.write(self.style.WARNING('✅ ELIGIBILITY CHECKS:'))
        
        # Check 1: Job completed
        check1 = job.status == 'completed'
        self.stdout.write(f'  1. Job is completed: {self._check_mark(check1)} ({job.status})')
        
        # Check 2: User is participant
        check2 = user == job.client or user == job.cleaner
        self.stdout.write(f'  2. User is participant: {self._check_mark(check2)}')
        
        # Check 3: Has completion date
        check3 = job.actual_end_time is not None
        self.stdout.write(f'  3. Has completion date: {self._check_mark(check3)}')
        
        # Check 4: Within 30-day window
        if job.actual_end_time:
            thirty_days_ago = timezone.now() - timedelta(days=30)
            check4 = job.actual_end_time > thirty_days_ago
            days_since = (timezone.now() - job.actual_end_time).days
            self.stdout.write(f'  4. Within 30-day window: {self._check_mark(check4)} ({days_since} days ago)')
        else:
            check4 = False
            self.stdout.write(f'  4. Within 30-day window: ❌ (no completion date)')
        
        # Check 5: Not already reviewed
        existing_review = Review.objects.filter(job=job, reviewer=user).first()
        check5 = not existing_review
        if existing_review:
            self.stdout.write(f'  5. Not already reviewed: ❌ (Review #{existing_review.id} exists)')
        else:
            self.stdout.write(f'  5. Not already reviewed: ✅')
        
        self.stdout.write('')
        
        # Final result
        all_checks_pass = check1 and check2 and check3 and check4 and check5
        
        if all_checks_pass:
            self.stdout.write(self.style.SUCCESS('🎉 RESULT: CAN REVIEW ✅'))
            self.stdout.write('')
            self.stdout.write('  The user SHOULD be able to leave a review.')
            self.stdout.write('  If button is grey, check browser console for errors.')
        else:
            self.stdout.write(self.style.ERROR('❌ RESULT: CANNOT REVIEW'))
            self.stdout.write('')
            self.stdout.write('  Reason:')
            if not check1:
                self.stdout.write('  • Job must be completed')
            if not check2:
                self.stdout.write('  • User must be a participant (client or cleaner)')
            if not check3:
                self.stdout.write('  • Job must have a completion date')
            if not check4:
                self.stdout.write('  • Review window (30 days) has expired')
            if not check5:
                self.stdout.write(f'  • User has already reviewed this job (Review #{existing_review.id})')
        
        self.stdout.write('')
        
        # API simulation
        self.stdout.write(self.style.WARNING('🔌 API WOULD RETURN:'))
        if all_checks_pass:
            self.stdout.write('  {')
            self.stdout.write('    "can_review": true,')
            self.stdout.write('    "reason": "You can review this job.",')
            self.stdout.write(f'    "job_id": {job.id},')
            self.stdout.write(f'    "job_status": "{job.status}"')
            self.stdout.write('  }')
        else:
            reason = "Unknown error"
            if not check1:
                reason = "Job must be completed before it can be reviewed."
            elif not check2:
                reason = "You can only review jobs you participated in."
            elif not check3:
                reason = "Job must have a completion date to be reviewed."
            elif not check4:
                reason = "Review window (30 days) has expired."
            elif not check5:
                reason = "You have already reviewed this job."
            
            self.stdout.write('  {')
            self.stdout.write('    "can_review": false,')
            self.stdout.write(f'    "reason": "{reason}",')
            self.stdout.write(f'    "job_id": {job.id},')
            self.stdout.write(f'    "job_status": "{job.status}"')
            if existing_review:
                self.stdout.write(f'    "existing_review_id": {existing_review.id}')
            self.stdout.write('  }')
        
        self.stdout.write('')

    def _check_mark(self, passed):
        return '✅' if passed else '❌'
