"""
Quick reference command to show test credentials.

Usage:
    python manage.py test_credentials
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Display test credentials for quick reference'

    def handle(self, *args, **options):
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('╔════════════════════════════════════════════════╗'))
        self.stdout.write(self.style.SUCCESS('║     REVIEW SYSTEM - TEST CREDENTIALS          ║'))
        self.stdout.write(self.style.SUCCESS('╚════════════════════════════════════════════════╝'))
        self.stdout.write('')
        
        self.stdout.write(self.style.WARNING('🔑 DEFAULT PASSWORD FOR ALL USERS:'))
        self.stdout.write(self.style.SUCCESS('   Test1234!'))
        self.stdout.write('')
        
        self.stdout.write(self.style.WARNING('👤 CLIENT ACCOUNTS (for reviewing cleaners):'))
        clients = User.objects.filter(role='client')[:5]
        for client in clients:
            self.stdout.write(f'   • Username: {client.username}')
        self.stdout.write('')
        
        self.stdout.write(self.style.WARNING('🧹 CLEANER ACCOUNTS (for reviewing clients):'))
        cleaners = User.objects.filter(role='cleaner')[:5]
        for cleaner in cleaners:
            self.stdout.write(f'   • Username: {cleaner.username}')
        self.stdout.write('')
        
        self.stdout.write(self.style.WARNING('🔗 QUICK LINKS:'))
        self.stdout.write('   • Login: http://localhost:3000/login')
        self.stdout.write('   • Completed Jobs: http://localhost:3000/completed-jobs')
        self.stdout.write('   • Django Admin: http://localhost:8000/admin/')
        self.stdout.write('')
        
        self.stdout.write(self.style.SUCCESS('📚 For detailed testing instructions, see:'))
        self.stdout.write('   REVIEW_SYSTEM_TESTING_GUIDE.md')
        self.stdout.write('')
