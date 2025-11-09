"""
Management command to create Athens Metro test users with GPS-based service areas only.
Deletes any users with city-based service areas.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from users.models import ServiceArea
from properties.models import Property
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates Athens Metro test users with GPS service areas and removes city-based ones'

    def handle(self, *args, **options):
        self.stdout.write('=' * 80)
        self.stdout.write(self.style.SUCCESS('ATHENS METRO TEST USERS - GPS ONLY'))
        self.stdout.write('=' * 80)

        try:
            with transaction.atomic():
                # 1. Delete users with city-based service areas
                self.stdout.write('\n🗑️  Cleaning up users with city-based service areas...')
                city_based_areas = ServiceArea.objects.filter(area_type='city')
                city_cleaners = set(area.cleaner for area in city_based_areas)
                
                for cleaner in city_cleaners:
                    self.stdout.write(f'   ❌ Deleting: {cleaner.email} (had city-based service area)')
                    cleaner.delete()
                
                city_based_areas.delete()
                self.stdout.write(self.style.SUCCESS(f'✅ Cleaned up {len(city_cleaners)} cleaners with city-based service areas'))
                
                # 2. Create cleaners with GPS-based service areas
                self.stdout.write('\n🧹 Creating cleaners with GPS service areas...')
                
                cleaners_data = [
                    {
                        'email': 'cleaner.central@test.gr',
                        'password': 'cleaner123',
                        'first_name': 'Maria',
                        'last_name': 'Katsarou',
                        'phone': '+306901234567',
                        'service_areas': [
                            {
                                'name': 'Central Athens',
                                'center_lat': 37.9838,  # Syntagma Square
                                'center_lng': 23.7275,
                                'radius_km': 5,
                                'radius_miles': 3.1,
                                'travel_time': 30
                            }
                        ]
                    },
                    {
                        'email': 'cleaner.north@test.gr',
                        'password': 'cleaner123',
                        'first_name': 'Giorgos',
                        'last_name': 'Nikolaou',
                        'phone': '+306901234568',
                        'service_areas': [
                            {
                                'name': 'Kifisia & North Suburbs',
                                'center_lat': 38.0746,  # Kifisia
                                'center_lng': 23.8114,
                                'radius_km': 10,
                                'radius_miles': 6.2,
                                'travel_time': 45
                            }
                        ]
                    },
                    {
                        'email': 'cleaner.south@test.gr',
                        'password': 'cleaner123',
                        'first_name': 'Katerina',
                        'last_name': 'Papadaki',
                        'phone': '+306901234569',
                        'service_areas': [
                            {
                                'name': 'Glyfada & Coastal South',
                                'center_lat': 37.8652,  # Glyfada
                                'center_lng': 23.7537,
                                'radius_km': 8,
                                'radius_miles': 5.0,
                                'travel_time': 40
                            }
                        ]
                    },
                    {
                        'email': 'cleaner.piraeus@test.gr',
                        'password': 'cleaner123',
                        'first_name': 'Yannis',
                        'last_name': 'Dimitriou',
                        'phone': '+306901234570',
                        'service_areas': [
                            {
                                'name': 'Piraeus Port Area',
                                'center_lat': 37.9413,  # Piraeus Port
                                'center_lng': 23.6464,
                                'radius_km': 5,
                                'radius_miles': 3.1,
                                'travel_time': 30
                            }
                        ]
                    },
                    {
                        'email': 'cleaner.wide@test.gr',
                        'password': 'cleaner123',
                        'first_name': 'Andreas',
                        'last_name': 'Petrou',
                        'phone': '+306901234572',
                        'service_areas': [
                            {
                                'name': 'Wide Athens Metro Coverage',
                                'center_lat': 37.9838,  # Central Athens
                                'center_lng': 23.7275,
                                'radius_km': 20,
                                'radius_miles': 12.4,
                                'travel_time': 60
                            }
                        ]
                    },
                    {
                        'email': 'cleaner.far.north@test.gr',
                        'password': 'cleaner123',
                        'first_name': 'Michalis',
                        'last_name': 'Stavrou',
                        'phone': '+306901234574',
                        'service_areas': [
                            {
                                'name': 'Far North (Ekali - OUT OF RANGE)',
                                'center_lat': 38.0950,  # Ekali area
                                'center_lng': 23.8350,
                                'radius_km': 5,
                                'radius_miles': 3.1,
                                'travel_time': 30
                            }
                        ]
                    },
                    {
                        'email': 'cleaner.far.south@test.gr',
                        'password': 'cleaner123',
                        'first_name': 'Ioanna',
                        'last_name': 'Alexiou',
                        'phone': '+306901234575',
                        'service_areas': [
                            {
                                'name': 'Far South (Vouliagmeni)',
                                'center_lat': 37.8167,  # Vouliagmeni
                                'center_lng': 23.7833,
                                'radius_km': 5,
                                'radius_miles': 3.1,
                                'travel_time': 30
                            }
                        ]
                    }
                ]
                
                for cleaner_data in cleaners_data:
                    # Delete if exists
                    User.objects.filter(email=cleaner_data['email']).delete()
                    
                    # Create fresh
                    cleaner = User.objects.create_user(
                        email=cleaner_data['email'],
                        password=cleaner_data['password'],
                        first_name=cleaner_data['first_name'],
                        last_name=cleaner_data['last_name'],
                        role='cleaner',
                        phone_number=cleaner_data['phone']
                    )
                    
                    # Auto-verify synthetic test users (no email verification needed for testing)
                    cleaner.email_verified = True
                    from django.utils import timezone
                    cleaner.email_verified_at = timezone.now()
                    cleaner.save()
                    
                    # Create service areas
                    for area_data in cleaner_data['service_areas']:
                        ServiceArea.objects.create(
                            cleaner=cleaner,
                            area_name=area_data['name'],
                            area_type='radius',  # GPS only!
                            city='Athens',
                            state='Attica',
                            country='Greece',
                            center_latitude=area_data['center_lat'],
                            center_longitude=area_data['center_lng'],
                            radius_miles=area_data['radius_miles'],
                            max_travel_time_minutes=area_data['travel_time'],
                            is_active=True
                        )
                        self.stdout.write(self.style.SUCCESS(
                            f'✅ {cleaner.first_name} {cleaner.last_name} → {area_data["name"]} ({area_data["radius_km"]}km)'
                        ))

                # 3. Create clients
                self.stdout.write('\n👥 Creating test clients...')
                
                clients_data = [
                    {
                        'email': 'client.kolonaki@test.gr',
                        'password': 'client123',
                        'first_name': 'Dimitris',
                        'last_name': 'Papadopoulos',
                        'phone': '+302101234567',
                        'property': {
                            'address': '45 Voukourestiou Street',
                            'city': 'Athens',
                            'area': 'Kolonaki',
                            'postal': '10671',
                            'lat': 37.9795,
                            'lng': 23.7404,
                            'type': 'apartment',
                            'bedrooms': 2,
                            'bathrooms': 1,
                            'sqft': 850
                        }
                    },
                    {
                        'email': 'client.syntagma@test.gr',
                        'password': 'client123',
                        'first_name': 'Maria',
                        'last_name': 'Georgiou',
                        'phone': '+302101234568',
                        'property': {
                            'address': '12 Mitropoleos Street',
                            'city': 'Athens',
                            'area': 'Syntagma',
                            'postal': '10557',
                            'lat': 37.9755,
                            'lng': 23.7348,
                            'type': 'apartment',
                            'bedrooms': 3,
                            'bathrooms': 2,
                            'sqft': 1200
                        }
                    },
                    {
                        'email': 'client.glyfada@test.gr',
                        'password': 'client123',
                        'first_name': 'Nikos',
                        'last_name': 'Konstantinou',
                        'phone': '+302101234569',
                        'property': {
                            'address': '89 Lakonias Avenue',
                            'city': 'Glyfada',
                            'area': 'Glyfada',
                            'postal': '16674',
                            'lat': 37.8652,
                            'lng': 23.7537,
                            'type': 'house',
                            'bedrooms': 4,
                            'bathrooms': 3,
                            'sqft': 2000
                        }
                    },
                    {
                        'email': 'client.kifisia@test.gr',
                        'password': 'client123',
                        'first_name': 'Alexandros',
                        'last_name': 'Vlahos',
                        'phone': '+302101234571',
                        'property': {
                            'address': '56 Kolokotroni Street',
                            'city': 'Kifisia',
                            'area': 'Kifisia',
                            'postal': '14562',
                            'lat': 38.0746,
                            'lng': 23.8114,
                            'type': 'house',
                            'bedrooms': 5,
                            'bathrooms': 3,
                            'sqft': 2500
                        }
                    }
                ]
                
                for client_data in clients_data:
                    # Delete if exists
                    User.objects.filter(email=client_data['email']).delete()
                    
                    # Create fresh
                    client = User.objects.create_user(
                        email=client_data['email'],
                        password=client_data['password'],
                        first_name=client_data['first_name'],
                        last_name=client_data['last_name'],
                        role='client',
                        phone_number=client_data['phone']
                    )
                    
                    # Auto-verify synthetic test users (no email verification needed for testing)
                    client.email_verified = True
                    from django.utils import timezone
                    client.email_verified_at = timezone.now()
                    client.save()
                    
                    # Create property
                    prop_data = client_data['property']
                    Property.objects.create(
                        owner=client,
                        address_line1=prop_data['address'],
                        city=prop_data['city'],
                        state='Attica',
                        postal_code=prop_data['postal'],
                        country='Greece',
                        property_type=prop_data['type'],
                        size_sqft=prop_data['sqft'],
                        latitude=prop_data['lat'],
                        longitude=prop_data['lng']
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f'✅ Client: {client.email} → {prop_data["area"]}'
                    ))

            self.stdout.write('\n' + '=' * 80)
            self.stdout.write(self.style.SUCCESS('✅ ATHENS TEST USERS CREATED SUCCESSFULLY'))
            self.stdout.write('=' * 80)

            # Print summary
            self.stdout.write('\n📊 SUMMARY:')
            self.stdout.write(f'  🧹 Cleaners: {User.objects.filter(role="cleaner").count()}')
            self.stdout.write(f'  👥 Clients: {User.objects.filter(role="client").count()}')
            self.stdout.write(f'  📍 GPS Service Areas: {ServiceArea.objects.filter(area_type="radius").count()}')
            self.stdout.write(f'  ❌ City Service Areas: {ServiceArea.objects.filter(area_type="city").count()} (should be 0)')

            self.stdout.write('\n🔑 CREDENTIALS (all: respective + 123):')
            self.stdout.write('\n  CLEANERS:')
            for cleaner in User.objects.filter(role='cleaner').order_by('email'):
                areas = cleaner.service_areas.all()
                area_info = f' → {areas[0].area_name}' if areas else ''
                self.stdout.write(f'    {cleaner.email}{area_info}')
            
            self.stdout.write('\n  CLIENTS:')
            for client in User.objects.filter(role='client').order_by('email'):
                props = client.properties.all()
                prop_info = f' → {props[0].city}' if props else ''
                self.stdout.write(f'    {client.email}{prop_info}')

            self.stdout.write('\n📍 TEST SCENARIO:')
            self.stdout.write('  1. Login as: client.syntagma@test.gr')
            self.stdout.write('  2. Go to "Find Cleaners" → GPS search (15km radius)')
            self.stdout.write('  3. Should see: central, wide cleaners')
            self.stdout.write('  4. Should NOT see: far.north, far.south')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error: {e}'))
            import traceback
            traceback.print_exc()
