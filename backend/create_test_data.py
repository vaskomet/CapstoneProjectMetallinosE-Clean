"""
Comprehensive test data creation script for E-Clean platform.
Creates users, properties, jobs, bids, and verifies the complete flow.
"""

from django.contrib.auth import get_user_model
from django.db import transaction
from properties.models import Property
from cleaning_jobs.models import CleaningJob, JobBid
from notifications.models import NotificationTemplate
from users.models import ServiceArea
from decimal import Decimal
from datetime import datetime, timedelta, time as dt_time

User = get_user_model()

print('=' * 80)
print('CREATING TEST DATA')
print('=' * 80)

try:
    with transaction.atomic():
        # 1. Create Users
        print('\n👥 Creating users...')
        
        # Create admin
        admin = User.objects.create_superuser(
            email='admin@ecloud.com',
            password='admin123',
            first_name='Admin',
            last_name='User',
            role='admin'
        )
        print(f'✅ Created admin: {admin.email}')
        
        # Create clients
        client1 = User.objects.create_user(
            email='client1@test.com',
            password='client123',
            first_name='John',
            last_name='Doe',
            role='client',
            phone_number='+1234567890'
        )
        print(f'✅ Created client: {client1.email}')
        
        client2 = User.objects.create_user(
            email='client2@test.com',
            password='client123',
            first_name='Jane',
            last_name='Smith',
            role='client',
            phone_number='+1234567891'
        )
        print(f'✅ Created client: {client2.email}')
        
        # Create cleaners
        cleaner1 = User.objects.create_user(
            email='cleaner1@test.com',
            password='cleaner123',
            first_name='Maria',
            last_name='Garcia',
            role='cleaner',
            phone_number='+1234567892'
        )
        print(f'✅ Created cleaner: {cleaner1.email}')
        
        cleaner2 = User.objects.create_user(
            email='cleaner2@test.com',
            password='cleaner123',
            first_name='Carlos',
            last_name='Rodriguez',
            role='cleaner',
            phone_number='+1234567893'
        )
        print(f'✅ Created cleaner: {cleaner2.email}')
        
        # 2. Create Service Areas for cleaners
        print('\n📍 Creating service areas...')
        
        # Athens Center - cleaner1 services central Athens
        service_area1 = ServiceArea.objects.create(
            cleaner=cleaner1,
            area_name='Central Athens',
            area_type='radius',
            city='Athens',
            state='Attica',
            country='Greece',
            center_latitude=37.9838,  # Athens city center (Syntagma Square)
            center_longitude=23.7275,
            radius_miles=6.2,  # ~10 km radius covering central Athens
            is_active=True,
            max_travel_time_minutes=30
        )
        print(f'✅ Service area: {cleaner1.email} → Central Athens (10km radius)')
        
        # North Athens Suburbs - cleaner2 services northern suburbs
        service_area2 = ServiceArea.objects.create(
            cleaner=cleaner2,
            area_name='North Athens & Suburbs',
            area_type='radius',
            city='Athens',
            state='Attica',
            country='Greece',
            center_latitude=38.0487,  # Kifisia/Maroussi area
            center_longitude=23.8095,
            radius_miles=9.3,  # ~15 km radius covering northern suburbs
            is_active=True,
            max_travel_time_minutes=45
        )
        print(f'✅ Service area: {cleaner2.email} → North Athens & Suburbs (15km radius)')
        
        # Additional service area for cleaner1 - Southern coastal Athens
        service_area3 = ServiceArea.objects.create(
            cleaner=cleaner1,
            area_name='Piraeus & Coastal Athens',
            area_type='radius',
            city='Piraeus',
            state='Attica',
            country='Greece',
            center_latitude=37.9413,  # Piraeus port area
            center_longitude=23.6464,
            radius_miles=5.0,  # ~8 km radius covering Piraeus & coast
            is_active=True,
            max_travel_time_minutes=40
        )
        print(f'✅ Service area: {cleaner1.email} → Piraeus & Coastal (8km radius)')
        
        # 3. Create Properties
        print('\n🏠 Creating properties...')
        
        # Property in Kolonaki (upscale central Athens neighborhood)
        property1 = Property.objects.create(
            owner=client1,
            address_line1='45 Voukourestiou Street',
            address_line2='3rd Floor',
            city='Athens',
            state='Attica',
            postal_code='10671',
            country='Greece',
            property_type='apartment',
            bedrooms=2,
            bathrooms=1,
            square_footage=850,
            latitude=37.9795,  # Kolonaki area
            longitude=23.7404
        )
        print(f'✅ Property: {property1.address_line1}, Kolonaki, {property1.city}')
        
        # Property in Glyfada (coastal suburb)
        property2 = Property.objects.create(
            owner=client2,
            address_line1='23 Lakonias Avenue',
            city='Glyfada',
            state='Attica',
            postal_code='16674',
            country='Greece',
            property_type='house',
            bedrooms=3,
            bathrooms=2,
            square_footage=1200,
            latitude=37.8652,  # Glyfada area
            longitude=23.7537
        )
        print(f'✅ Property: {property2.address_line1}, {property2.city} (Coastal Athens)')
        
        # Property in Maroussi (northern suburbs)
        property3 = Property.objects.create(
            owner=client1,
            address_line1='12 Kifisias Avenue',
            city='Maroussi',
            state='Attica',
            postal_code='15124',
            country='Greece',
            property_type='apartment',
            bedrooms=1,
            bathrooms=1,
            square_footage=600,
            latitude=38.0561,  # Maroussi area
            longitude=23.8086
        )
        print(f'✅ Property: {property3.address_line1}, {property3.city} (North Athens)')
        
        # 4. Create Notification Templates
        print('\n📧 Creating notification templates...')
        
        templates = [
            {
                'name': 'Job Created',
                'notification_type': 'job_created',
                'title_template': 'New Job Available: {job_title}',
                'message_template': 'A new cleaning job is available in {property_city}. Budget: ${client_budget}',
            },
            {
                'name': 'Bid Received',
                'notification_type': 'bid_received',
                'title_template': 'New Bid on {job_title}',
                'message_template': '{cleaner_name} has submitted a bid of ${bid_amount} for your job.',
            },
        ]
        
        for template_data in templates:
            template, created = NotificationTemplate.objects.get_or_create(
                notification_type=template_data['notification_type'],
                defaults=template_data
            )
            if created:
                print(f'✅ Created template: {template.name}')
            else:
                print(f'ℹ️  Template exists: {template.name}')
        
        # 5. Create Jobs
        print('\n💼 Creating cleaning jobs...')
        
        job1 = CleaningJob.objects.create(
            client=client1,
            property=property1,
            services_description='Deep cleaning of 2-bedroom apartment',
            client_budget=Decimal('150.00'),
            scheduled_date=(datetime.now() + timedelta(days=3)).date(),
            start_time=dt_time(10, 0),
            status='open_for_bids',
            notes='Please bring eco-friendly cleaning products'
        )
        print(f'✅ Job #{job1.id}: {job1.services_description}')
        print(f'   📅 Scheduled: {job1.scheduled_date} at {job1.start_time}')
        print(f'   💰 Budget: ${job1.client_budget}')
        
        job2 = CleaningJob.objects.create(
            client=client2,
            property=property2,
            services_description='Standard house cleaning',
            client_budget=Decimal('200.00'),
            scheduled_date=(datetime.now() + timedelta(days=5)).date(),
            start_time=dt_time(14, 0),
            status='open_for_bids',
            notes='Please focus on kitchen and bathrooms'
        )
        print(f'✅ Job #{job2.id}: {job2.services_description}')
        print(f'   📅 Scheduled: {job2.scheduled_date} at {job2.start_time}')
        print(f'   💰 Budget: ${job2.client_budget}')
        
        # 6. Create Bids
        print('\n💵 Creating bids...')
        
        bid1 = JobBid.objects.create(
            job=job1,
            cleaner=cleaner1,
            bid_amount=Decimal('140.00'),
            estimated_duration=120,
            message='I have 5 years of experience with eco-friendly cleaning. I can start on time!',
            status='pending'
        )
        print(f'✅ Bid #{bid1.id}: {cleaner1.first_name} → Job #{job1.id} (${bid1.bid_amount})')
        
        bid2 = JobBid.objects.create(
            job=job1,
            cleaner=cleaner2,
            bid_amount=Decimal('145.00'),
            estimated_duration=150,
            message='Professional service guaranteed. References available.',
            status='pending'
        )
        print(f'✅ Bid #{bid2.id}: {cleaner2.first_name} → Job #{job1.id} (${bid2.bid_amount})')
        
        bid3 = JobBid.objects.create(
            job=job2,
            cleaner=cleaner2,
            bid_amount=Decimal('190.00'),
            estimated_duration=180,
            message='I specialize in house cleaning. Very thorough with kitchens!',
            status='pending'
        )
        print(f'✅ Bid #{bid3.id}: {cleaner2.first_name} → Job #{job2.id} (${bid3.bid_amount})')

    print('\n' + '=' * 80)
    print('✅ TEST DATA CREATED SUCCESSFULLY')
    print('=' * 80)

    # Print summary
    print('\n📊 SUMMARY:')
    print(f'  👥 Users: {User.objects.count()}')
    print(f'     - Admins: {User.objects.filter(role="admin").count()}')
    print(f'     - Clients: {User.objects.filter(role="client").count()}')
    print(f'     - Cleaners: {User.objects.filter(role="cleaner").count()}')
    print(f'  🏠 Properties: {Property.objects.count()}')
    print(f'  💼 Jobs: {CleaningJob.objects.count()}')
    print(f'  💵 Bids: {JobBid.objects.count()}')
    print(f'  📧 Templates: {NotificationTemplate.objects.count()}')
    print(f'  📍 Service Areas: {ServiceArea.objects.count()}')

    print('\n🔑 LOGIN CREDENTIALS:')
    print('  Admin:   admin@ecloud.com / admin123')
    print('  Client1: client1@test.com / client123')
    print('  Client2: client2@test.com / client123')
    print('  Cleaner1: cleaner1@test.com / cleaner123')
    print('  Cleaner2: cleaner2@test.com / cleaner123')

except Exception as e:
    print(f'\n❌ Error creating test data: {e}')
    import traceback
    traceback.print_exc()
