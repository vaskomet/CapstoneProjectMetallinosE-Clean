"""
Athens Metro Area Test Users - GPS-Based Service Areas Only
Creates diverse test users with realistic Athens locations and GPS + radius service areas.
Deletes any users with city-based (non-GPS) service areas.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from users.models import ServiceArea
from properties.models import Property
from decimal import Decimal

User = get_user_model()

print('=' * 80)
print('ATHENS METRO TEST USERS - GPS ONLY')
print('=' * 80)

try:
    with transaction.atomic():
        # 1. Delete users with city-based service areas
        print('\n🗑️  Cleaning up users with city-based service areas...')
        city_based_areas = ServiceArea.objects.filter(area_type='city')
        city_cleaners = set(area.cleaner for area in city_based_areas)
        
        for cleaner in city_cleaners:
            print(f'   ❌ Deleting: {cleaner.email} (had city-based service area)')
            cleaner.delete()
        
        city_based_areas.delete()
        print(f'✅ Cleaned up {len(city_cleaners)} cleaners with city-based service areas')
        
        # 2. Create Admin
        print('\n👑 Creating admin...')
        admin, created = User.objects.get_or_create(
            email='admin@eclean.gr',
            defaults={
                'first_name': 'Admin',
                'last_name': 'Metallinos',
                'role': 'admin'
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
            print(f'✅ Created admin: {admin.email}')
        else:
            print(f'ℹ️  Admin exists: {admin.email}')
        
        # 3. Create Clients (spread across Athens metro)
        print('\n👥 Creating clients...')
        
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
                    'area': 'Glyfada Center',
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
                'email': 'client.piraeus@test.gr',
                'password': 'client123',
                'first_name': 'Elena',
                'last_name': 'Makri',
                'phone': '+302101234570',
                'property': {
                    'address': '34 Akti Miaouli',
                    'city': 'Piraeus',
                    'area': 'Piraeus Port',
                    'postal': '18538',
                    'lat': 37.9413,
                    'lng': 23.6464,
                    'type': 'apartment',
                    'bedrooms': 2,
                    'bathrooms': 1,
                    'sqft': 900
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
                    'area': 'Kifisia Center',
                    'postal': '14562',
                    'lat': 38.0746,
                    'lng': 23.8114,
                    'type': 'house',
                    'bedrooms': 5,
                    'bathrooms': 3,
                    'sqft': 2500
                }
            },
            {
                'email': 'client.chalandri@test.gr',
                'password': 'client123',
                'first_name': 'Sofia',
                'last_name': 'Antoniou',
                'phone': '+302101234572',
                'property': {
                    'address': '23 Agiou Georgiou',
                    'city': 'Chalandri',
                    'area': 'Chalandri',
                    'postal': '15234',
                    'lat': 38.0213,
                    'lng': 23.7990,
                    'type': 'apartment',
                    'bedrooms': 2,
                    'bathrooms': 1,
                    'sqft': 750
                }
            }
        ]
        
        for client_data in clients_data:
            client, created = User.objects.get_or_create(
                email=client_data['email'],
                defaults={
                    'first_name': client_data['first_name'],
                    'last_name': client_data['last_name'],
                    'role': 'client',
                    'phone_number': client_data['phone']
                }
            )
            if created:
                client.set_password(client_data['password'])
                client.save()
                
                # Create property
                property_data = client_data['property']
                property_obj = Property.objects.create(
                    owner=client,
                    address_line1=property_data['address'],
                    city=property_data['city'],
                    state='Attica',
                    postal_code=property_data['postal'],
                    country='Greece',
                    property_type=property_data['type'],
                    bedrooms=property_data['bedrooms'],
                    bathrooms=property_data['bathrooms'],
                    square_footage=property_data['sqft'],
                    latitude=property_data['lat'],
                    longitude=property_data['lng']
                )
                print(f'✅ Client: {client.email} → {property_data["area"]}')
            else:
                print(f'ℹ️  Client exists: {client.email}')
        
        # 4. Create Cleaners with GPS-based service areas
        print('\n🧹 Creating cleaners with GPS service areas...')
        
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
                'email': 'cleaner.northwest@test.gr',
                'password': 'cleaner123',
                'first_name': 'Eleni',
                'last_name': 'Vasiliou',
                'phone': '+306901234571',
                'service_areas': [
                    {
                        'name': 'Chalandri & Northeast',
                        'center_lat': 38.0213,  # Chalandri
                        'center_lng': 23.7990,
                        'radius_km': 7,
                        'radius_miles': 4.3,
                        'travel_time': 35
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
                'email': 'cleaner.east@test.gr',
                'password': 'cleaner123',
                'first_name': 'Dimitra',
                'last_name': 'Christou',
                'phone': '+306901234573',
                'service_areas': [
                    {
                        'name': 'East Athens',
                        'center_lat': 37.9947,  # Zografou area
                        'center_lng': 23.7728,
                        'radius_km': 6,
                        'radius_miles': 3.7,
                        'travel_time': 35
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
                        'name': 'Far North Suburbs (Ekali/Drosia)',
                        'center_lat': 38.0950,  # Ekali area - outside typical search range
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
                        'name': 'Vouliagmeni & Far South Coast',
                        'center_lat': 37.8167,  # Vouliagmeni - further south
                        'center_lng': 23.7833,
                        'radius_km': 5,
                        'radius_miles': 3.1,
                        'travel_time': 30
                    }
                ]
            },
            {
                'email': 'cleaner.peristeri@test.gr',
                'password': 'cleaner123',
                'first_name': 'Kostas',
                'last_name': 'Markou',
                'phone': '+306901234576',
                'service_areas': [
                    {
                        'name': 'Peristeri & West Athens',
                        'center_lat': 38.0156,  # Peristeri
                        'center_lng': 23.6914,
                        'radius_km': 6,
                        'radius_miles': 3.7,
                        'travel_time': 35
                    }
                ]
            }
        ]
        
        for cleaner_data in cleaners_data:
            cleaner, created = User.objects.get_or_create(
                email=cleaner_data['email'],
                defaults={
                    'first_name': cleaner_data['first_name'],
                    'last_name': cleaner_data['last_name'],
                    'role': 'cleaner',
                    'phone_number': cleaner_data['phone']
                }
            )
            if created:
                cleaner.set_password(cleaner_data['password'])
                cleaner.save()
                
                # Create service areas
                for area_data in cleaner_data['service_areas']:
                    service_area = ServiceArea.objects.create(
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
                    print(f'✅ Cleaner: {cleaner.first_name} {cleaner.last_name} → {area_data["name"]} ({area_data["radius_km"]}km)')
            else:
                print(f'ℹ️  Cleaner exists: {cleaner.email}')

    print('\n' + '=' * 80)
    print('✅ ATHENS TEST USERS CREATED SUCCESSFULLY')
    print('=' * 80)

    # Print summary
    print('\n📊 SUMMARY:')
    print(f'  👥 Total Users: {User.objects.count()}')
    print(f'     - Admins: {User.objects.filter(role="admin").count()}')
    print(f'     - Clients: {User.objects.filter(role="client").count()}')
    print(f'     - Cleaners: {User.objects.filter(role="cleaner").count()}')
    print(f'  🏠 Properties: {Property.objects.count()}')
    print(f'  📍 Service Areas (ALL GPS-based): {ServiceArea.objects.filter(area_type="radius").count()}')
    print(f'  ❌ City-based Service Areas: {ServiceArea.objects.filter(area_type="city").count()} (should be 0)')

    print('\n🔑 LOGIN CREDENTIALS (All passwords: respective role + 123):')
    print('\n  ADMIN:')
    print('    admin@eclean.gr / admin123')
    
    print('\n  CLIENTS (by area):')
    print('    client.kolonaki@test.gr    → Kolonaki (Central Athens)')
    print('    client.syntagma@test.gr    → Syntagma (Central Athens)')
    print('    client.glyfada@test.gr     → Glyfada (South Coast)')
    print('    client.piraeus@test.gr     → Piraeus (Port Area)')
    print('    client.kifisia@test.gr     → Kifisia (North Suburbs)')
    print('    client.chalandri@test.gr   → Chalandri (Northeast)')
    
    print('\n  CLEANERS (by service area):')
    print('    cleaner.central@test.gr    → Central Athens (5km radius)')
    print('    cleaner.north@test.gr      → Kifisia & North (10km radius)')
    print('    cleaner.south@test.gr      → Glyfada & Coast (8km radius)')
    print('    cleaner.piraeus@test.gr    → Piraeus Port (5km radius)')
    print('    cleaner.northwest@test.gr  → Chalandri & Northeast (7km radius)')
    print('    cleaner.wide@test.gr       → Wide Athens Metro (20km radius)')
    print('    cleaner.east@test.gr       → East Athens (6km radius)')
    print('    cleaner.far.north@test.gr  → Far North - Ekali (5km - OUT OF RANGE)')
    print('    cleaner.far.south@test.gr  → Far South - Vouliagmeni (5km - OUT OF RANGE)')
    print('    cleaner.peristeri@test.gr  → Peristeri & West (6km radius)')

    print('\n📍 TESTING GUIDE:')
    print('  • Login as client.syntagma@test.gr (Central Athens)')
    print('  • Go to "Find Cleaners" → GPS search (15km radius)')
    print('  • Should see: central, wide, east, northwest cleaners')
    print('  • Should NOT see: far.north, far.south (outside range)')
    print('')
    print('  • Login as client.kifisia@test.gr (North Suburbs)')
    print('  • GPS search should show: north, wide, northwest cleaners')
    print('  • Should NOT see: south, piraeus, far.south')

except Exception as e:
    print(f'\n❌ Error creating test data: {e}')
    import traceback
    traceback.print_exc()
