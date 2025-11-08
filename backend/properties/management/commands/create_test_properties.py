"""
Django management command to create test properties for client users.

Usage:
    python manage.py create_test_properties
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from properties.models import Property
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Create test properties for client users'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Creating test properties for clients...'))
        self.stdout.write('')

        # Properties for each client with realistic Athens locations
        properties_data = [
            {
                'username': 'client.glyfada',
                'properties': [
                    {
                        'address_line1': 'Λεωφ. Αθηνών 45',
                        'address_line2': 'Διαμέρισμα 3',
                        'city': 'Glyfada',
                        'state': 'Attica',
                        'postal_code': '166 74',
                        'country': 'Greece',
                        'latitude': Decimal('37.8659'),
                        'longitude': Decimal('23.7510'),
                        'property_type': 'apartment',
                        'size_sqft': 1200,
                        'preferences': {'pet_present': False, 'eco_friendly': True},
                    },
                    {
                        'address_line1': 'Μεταξά 12',
                        'address_line2': '',
                        'city': 'Glyfada',
                        'state': 'Attica',
                        'postal_code': '166 75',
                        'country': 'Greece',
                        'latitude': Decimal('37.8645'),
                        'longitude': Decimal('23.7535'),
                        'property_type': 'house',
                        'size_sqft': 2500,
                        'preferences': {'pet_present': True, 'has_garden': True},
                    }
                ]
            },
            {
                'username': 'client.kifisia',
                'properties': [
                    {
                        'address_line1': 'Κασσαβέτη 28',
                        'address_line2': '',
                        'city': 'Kifisia',
                        'state': 'Attica',
                        'postal_code': '145 62',
                        'country': 'Greece',
                        'latitude': Decimal('38.0745'),
                        'longitude': Decimal('23.8113'),
                        'property_type': 'house',
                        'size_sqft': 3500,
                        'preferences': {'pet_present': False, 'luxury_materials': True},
                    }
                ]
            },
            {
                'username': 'client.kolonaki',
                'properties': [
                    {
                        'address_line1': 'Σκουφά 15',
                        'address_line2': '2ος Όροφος',
                        'city': 'Athens',
                        'state': 'Attica',
                        'postal_code': '106 73',
                        'country': 'Greece',
                        'latitude': Decimal('37.9762'),
                        'longitude': Decimal('23.7395'),
                        'property_type': 'apartment',
                        'size_sqft': 1500,
                        'preferences': {'eco_friendly': True, 'high_rise': True},
                    },
                    {
                        'address_line1': 'Πλουτάρχου 8',
                        'address_line2': '',
                        'city': 'Athens',
                        'state': 'Attica',
                        'postal_code': '106 76',
                        'country': 'Greece',
                        'latitude': Decimal('37.9775'),
                        'longitude': Decimal('23.7422'),
                        'property_type': 'office',
                        'size_sqft': 800,
                        'preferences': {'office_hours': True, 'eco_friendly': True},
                    }
                ]
            },
            {
                'username': 'client.syntagma',
                'properties': [
                    {
                        'address_line1': 'Φιλελλήνων 3',
                        'address_line2': '',
                        'city': 'Athens',
                        'state': 'Attica',
                        'postal_code': '105 57',
                        'country': 'Greece',
                        'latitude': Decimal('37.9756'),
                        'longitude': Decimal('23.7347'),
                        'property_type': 'apartment',
                        'size_sqft': 1000,
                        'preferences': {'historic_building': True},
                    }
                ]
            },
            {
                'username': 'vaskoclient',
                'properties': [
                    {
                        'address_line1': 'Λεωφ. Μεσογείων 234',
                        'address_line2': 'Διαμέρισμα 5Α',
                        'city': 'Agia Paraskevi',
                        'state': 'Attica',
                        'postal_code': '153 41',
                        'country': 'Greece',
                        'latitude': Decimal('37.9946'),
                        'longitude': Decimal('23.8204'),
                        'property_type': 'apartment',
                        'size_sqft': 1100,
                        'preferences': {'pet_present': False, 'balcony': True},
                    },
                    {
                        'address_line1': 'Αγίας Παρασκευής 67',
                        'address_line2': '',
                        'city': 'Agia Paraskevi',
                        'state': 'Attica',
                        'postal_code': '153 42',
                        'country': 'Greece',
                        'latitude': Decimal('37.9950'),
                        'longitude': Decimal('23.8180'),
                        'property_type': 'house',
                        'size_sqft': 2000,
                        'preferences': {'pet_present': True, 'has_garden': True},
                    }
                ]
            }
        ]

        created_count = 0
        skipped_count = 0

        for client_data in properties_data:
            username = client_data['username']
            
            try:
                client = User.objects.get(username=username, role='client')
            except User.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  ⚠️  Client {username} not found - skipping'))
                skipped_count += len(client_data['properties'])
                continue

            self.stdout.write(f'\n📍 Creating properties for {username}:')
            
            for prop_data in client_data['properties']:
                # Check if property already exists at this address
                if Property.objects.filter(
                    owner=client,
                    address_line1=prop_data['address_line1']
                ).exists():
                    self.stdout.write(f'  ⚠️  Property at {prop_data["address_line1"]} already exists - skipping')
                    skipped_count += 1
                    continue

                # Create property
                property_obj = Property.objects.create(
                    owner=client,
                    **prop_data
                )
                
                self.stdout.write(self.style.SUCCESS(
                    f'  ✓ Created {prop_data["property_type"]}: {prop_data["address_line1"]}, '
                    f'{prop_data["city"]} ({prop_data["size_sqft"]} sqft)'
                ))
                created_count += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'✅ Test property creation complete!'))
        self.stdout.write(f'   Created: {created_count}')
        self.stdout.write(f'   Skipped: {skipped_count}')
        self.stdout.write('')
        self.stdout.write('📊 Property Summary:')
        self.stdout.write(f'   client.glyfada: 2 properties (apartment + house)')
        self.stdout.write(f'   client.kifisia: 1 property (house)')
        self.stdout.write(f'   client.kolonaki: 2 properties (apartment + office)')
        self.stdout.write(f'   client.syntagma: 1 property (apartment)')
        self.stdout.write(f'   vaskoclient: 2 properties (apartment + house)')
        self.stdout.write('')
