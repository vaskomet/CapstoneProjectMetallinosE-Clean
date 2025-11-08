"""
Django management command to create test users (cleaners and clients).

Usage:
    python manage.py create_test_users
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Create test users for the system (cleaners and clients)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Creating test users...'))
        self.stdout.write('')

        # Default password for all test users
        default_password = 'Test1234!'

        # Cleaners with their locations (note: location data stored in user preferences as JSON)
        cleaners = [
            {
                'email': 'cleaner.central@test.gr',
                'username': 'cleaner.central',
                'first_name': 'Maria',
                'last_name': 'Papadopoulos',
                'phone_number': '+30 210 1234567',
            },
            {
                'email': 'cleaner.far.north@test.gr',
                'username': 'cleaner.far.north',
                'first_name': 'Dimitris',
                'last_name': 'Nikolaidis',
                'phone_number': '+30 210 1234568',
            },
            {
                'email': 'cleaner.far.south@test.gr',
                'username': 'cleaner.far.south',
                'first_name': 'Elena',
                'last_name': 'Georgiou',
                'phone_number': '+30 210 1234569',
            },
            {
                'email': 'cleaner.north@test.gr',
                'username': 'cleaner.north',
                'first_name': 'Kostas',
                'last_name': 'Dimitriou',
                'phone_number': '+30 210 1234570',
            },
            {
                'email': 'cleaner.piraeus@test.gr',
                'username': 'cleaner.piraeus',
                'first_name': 'Nikos',
                'last_name': 'Antonopoulos',
                'phone_number': '+30 210 1234571',
            },
            {
                'email': 'cleaner.south@test.gr',
                'username': 'cleaner.south',
                'first_name': 'Sofia',
                'last_name': 'Katsaros',
                'phone_number': '+30 210 1234572',
            },
            {
                'email': 'cleaner.wide@test.gr',
                'username': 'cleaner.wide',
                'first_name': 'Andreas',
                'last_name': 'Makris',
                'phone_number': '+30 210 1234573',
            },
            {
                'email': 'vaskoclean@mail.com',
                'username': 'vaskoclean',
                'first_name': 'Vasko',
                'last_name': 'Cleaner',
                'phone_number': '+30 210 1234574',
            },
            {
                'email': 'vaskoclean2@mail.com',
                'username': 'vaskoclean2',
                'first_name': 'Vasko',
                'last_name': 'Cleaner2',
                'phone_number': '+30 210 1234575',
            },
        ]

        # Clients
        clients = [
            {
                'email': 'client.glyfada@test.gr',
                'username': 'client.glyfada',
                'first_name': 'Giorgos',
                'last_name': 'Petridis',
                'phone_number': '+30 210 2234567',
            },
            {
                'email': 'client.kifisia@test.gr',
                'username': 'client.kifisia',
                'first_name': 'Katerina',
                'last_name': 'Apostolou',
                'phone_number': '+30 210 2234568',
            },
            {
                'email': 'client.kolonaki@test.gr',
                'username': 'client.kolonaki',
                'first_name': 'Alexandros',
                'last_name': 'Vlahos',
                'phone_number': '+30 210 2234569',
            },
            {
                'email': 'client.syntagma@test.gr',
                'username': 'client.syntagma',
                'first_name': 'Ioanna',
                'last_name': 'Papadaki',
                'phone_number': '+30 210 2234570',
            },
            {
                'email': 'vaskoclient@mail.com',
                'username': 'vaskoclient',
                'first_name': 'Vasko',
                'last_name': 'Client',
                'phone_number': '+30 210 2234571',
            },
        ]

        # Create cleaners
        self.stdout.write(self.style.SUCCESS('Creating cleaners:'))
        for cleaner_data in cleaners:
            email = cleaner_data.pop('email')
            username = cleaner_data.pop('username')
            
            if User.objects.filter(email=email).exists():
                self.stdout.write(f'  ⚠️  Cleaner {username} already exists - skipping')
                continue
            
            user = User.objects.create_user(
                email=email,
                username=username,
                password=default_password,
                role='cleaner',
                **cleaner_data
            )
            self.stdout.write(self.style.SUCCESS(f'  ✓ Created cleaner: {username} ({email})'))

        self.stdout.write('')

        # Create clients
        self.stdout.write(self.style.SUCCESS('Creating clients:'))
        for client_data in clients:
            email = client_data.pop('email')
            username = client_data.pop('username')
            
            if User.objects.filter(email=email).exists():
                self.stdout.write(f'  ⚠️  Client {username} already exists - skipping')
                continue
            
            user = User.objects.create_user(
                email=email,
                username=username,
                password=default_password,
                role='client',
                **client_data
            )
            self.stdout.write(self.style.SUCCESS(f'  ✓ Created client: {username} ({email})'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('✅ Test user creation complete!'))
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('📋 Login Credentials:'))
        self.stdout.write(f'   Default password for all users: {default_password}')
        self.stdout.write('')
        self.stdout.write(self.style.WARNING('🧹 Cleaners created: ' + str(len(cleaners))))
        self.stdout.write(self.style.WARNING('👤 Clients created: ' + str(len(clients))))
        self.stdout.write('')
