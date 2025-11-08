"""
Django management command to create service areas for test cleaners.

Usage:
    python manage.py create_service_areas
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from users.models import ServiceArea
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Create service areas for test cleaners'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Creating service areas for cleaners...'))
        self.stdout.write('')

        # Service areas for each cleaner
        service_areas = [
            {
                'username': 'cleaner.central',
                'area_name': 'Central Athens',
                'area_type': 'radius',
                'city': 'Athens',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('37.9838'),
                'center_longitude': Decimal('23.7275'),
                'radius_miles': Decimal('5.0'),  # ~8 km
            },
            {
                'username': 'cleaner.far.north',
                'area_name': 'Far North Athens (Ekali)',
                'area_type': 'radius',
                'city': 'Ekali',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('38.0861'),
                'center_longitude': Decimal('23.8381'),
                'radius_miles': Decimal('3.0'),  # Small radius - out of range from center
            },
            {
                'username': 'cleaner.far.south',
                'area_name': 'Vouliagmeni & Coastal South',
                'area_type': 'radius',
                'city': 'Vouliagmeni',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('37.8228'),
                'center_longitude': Decimal('23.7837'),
                'radius_miles': Decimal('5.0'),  # ~8 km
            },
            {
                'username': 'cleaner.north',
                'area_name': 'Kifisia & North Suburbs',
                'area_type': 'radius',
                'city': 'Kifisia',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('38.0745'),
                'center_longitude': Decimal('23.8113'),
                'radius_miles': Decimal('6.0'),  # ~10 km
            },
            {
                'username': 'cleaner.piraeus',
                'area_name': 'Piraeus Port Area',
                'area_type': 'radius',
                'city': 'Piraeus',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('37.9421'),
                'center_longitude': Decimal('23.6464'),
                'radius_miles': Decimal('5.0'),  # ~8 km
            },
            {
                'username': 'cleaner.south',
                'area_name': 'Glyfada & Coastal South',
                'area_type': 'radius',
                'city': 'Glyfada',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('37.8659'),
                'center_longitude': Decimal('23.7510'),
                'radius_miles': Decimal('5.0'),  # ~8 km
            },
            {
                'username': 'cleaner.wide',
                'area_name': 'Wide Athens Metro Coverage',
                'area_type': 'radius',
                'city': 'Athens',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('37.9838'),
                'center_longitude': Decimal('23.7275'),
                'radius_miles': Decimal('15.0'),  # ~24 km - covers most of Athens metro
            },
            {
                'username': 'vaskoclean',
                'area_name': 'Agia Paraskevi Area',
                'area_type': 'radius',
                'city': 'Agia Paraskevi',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('37.9946'),
                'center_longitude': Decimal('23.8204'),
                'radius_miles': Decimal('5.0'),  # ~8 km
            },
            {
                'username': 'vaskoclean2',
                'area_name': 'Central Athens',
                'area_type': 'radius',
                'city': 'Athens',
                'state': 'Attica',
                'country': 'Greece',
                'center_latitude': Decimal('37.9838'),
                'center_longitude': Decimal('23.7275'),
                'radius_miles': Decimal('5.0'),  # ~8 km
            },
        ]

        created_count = 0
        skipped_count = 0

        for area_data in service_areas:
            username = area_data.pop('username')
            
            try:
                cleaner = User.objects.get(username=username, role='cleaner')
            except User.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  ⚠️  Cleaner {username} not found - skipping'))
                skipped_count += 1
                continue

            # Check if service area already exists
            if ServiceArea.objects.filter(cleaner=cleaner, area_name=area_data['area_name']).exists():
                self.stdout.write(f'  ⚠️  Service area for {username} already exists - skipping')
                skipped_count += 1
                continue

            # Create service area
            service_area = ServiceArea.objects.create(
                cleaner=cleaner,
                **area_data
            )
            
            self.stdout.write(self.style.SUCCESS(
                f'  ✓ Created service area: {username} - {area_data["area_name"]} '
                f'({area_data["radius_miles"]} miles radius)'
            ))
            created_count += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'✅ Service area creation complete!'))
        self.stdout.write(f'   Created: {created_count}')
        self.stdout.write(f'   Skipped: {skipped_count}')
        self.stdout.write('')
