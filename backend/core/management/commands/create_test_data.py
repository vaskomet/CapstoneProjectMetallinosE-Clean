from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from datetime import datetime, timedelta
from decimal import Decimal
from properties.models import Property
from users.models import ServiceArea
from cleaning_jobs.models import CleaningJob, JobBid
from notifications.models import NotificationTemplate

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates comprehensive test data for the E-Clean platform'

    def handle(self, *args, **options):
        self.stdout.write('=' * 80)
        self.stdout.write('🚀 CREATING TEST DATA FOR E-CLEAN PLATFORM')
        self.stdout.write('=' * 80)

        try:
            # ========== STEP 0: CLEAR EXISTING DATA ==========
            self.stdout.write('\n🗑️  Step 0: Clearing existing data...')
            
            # Delete in correct order to avoid FK constraints
            from notifications.models import Notification
            Notification.objects.all().delete()
            JobBid.objects.all().delete()
            CleaningJob.objects.all().delete()
            Property.objects.all().delete()
            ServiceArea.objects.all().delete()
            User.objects.all().delete()
            
            self.stdout.write('✅ Existing data cleared')

            # ========== STEP 1: CREATE USERS ==========
            self.stdout.write('\n📝 Step 1: Creating Users...')

            # Admin User
            admin = User.objects.create_superuser(
                email='admin@ecloud.com',
                password='admin123',
                first_name='Admin',
                last_name='User',
                phone_number='+306901234567'
            )
            self.stdout.write(f'✅ Admin: {admin.email}')

            # Client Users
            client1 = User.objects.create_user(
                email='client1@test.com',
                password='client123',
                first_name='John',
                last_name='Papadopoulos',
                phone_number='+306907654321',
                role='client',
                is_active=True
            )
            self.stdout.write(f'✅ Client 1: {client1.email}')

            client2 = User.objects.create_user(
                email='client2@test.com',
                password='client123',
                first_name='Maria',
                last_name='Konstantinou',
                phone_number='+306901111111',
                role='client',
                is_active=True
            )
            self.stdout.write(f'✅ Client 2: {client2.email}')

            # Cleaner Users
            cleaner1 = User.objects.create_user(
                email='cleaner1@test.com',
                password='cleaner123',
                first_name='Dimitris',
                last_name='Georgiou',
                phone_number='+306902222222',
                role='cleaner',
                is_active=True
            )
            self.stdout.write(f'✅ Cleaner 1: {cleaner1.email}')

            cleaner2 = User.objects.create_user(
                email='cleaner2@test.com',
                password='cleaner123',
                first_name='Elena',
                last_name='Nikolaou',
                phone_number='+306903333333',
                role='cleaner',
                is_active=True
            )
            self.stdout.write(f'✅ Cleaner 2: {cleaner2.email}')

            # ========== STEP 2: CREATE SERVICE AREAS ==========
            self.stdout.write('\n📍 Step 2: Creating Service Areas...')

            area_athens = ServiceArea.objects.create(
                cleaner=cleaner1,
                area_type='city',
                area_name='Athens Central',
                city='Athens',
                country='GR',
                is_active=True
            )
            self.stdout.write(f'✅ Service Area: {area_athens.area_name} (Cleaner: {cleaner1.first_name})')

            area_thessaloniki = ServiceArea.objects.create(
                cleaner=cleaner2,
                area_type='city',
                area_name='Thessaloniki Central',
                city='Thessaloniki',
                country='GR',
                is_active=True
            )
            self.stdout.write(f'✅ Service Area: {area_thessaloniki.area_name} (Cleaner: {cleaner2.first_name})')

            # ========== STEP 3: CREATE PROPERTIES ==========
            self.stdout.write('\n🏠 Step 3: Creating Properties...')

            property1 = Property.objects.create(
                owner=client1,
                property_type='apartment',
                address_line1='Voukourestiou 25',
                city='Athens',
                state='Attica',
                postal_code='106 71',
                country='GR',
                size_sqft=915,  # ~85 sqm
                notes='Modern apartment in city center, easy access'
            )
            self.stdout.write(f'✅ Property #{property1.id}: {property1.property_type} ({property1.size_sqft} sqft) - Owner: {client1.first_name}')

            property2 = Property.objects.create(
                owner=client2,
                property_type='house',
                address_line1='Vasilissis Olgas 120',
                city='Thessaloniki',
                state='Central Macedonia',
                postal_code='546 45',
                country='GR',
                size_sqft=1615,  # ~150 sqm
                notes='Large house with garden, requires thorough cleaning'
            )
            self.stdout.write(f'✅ Property #{property2.id}: {property2.property_type} ({property2.size_sqft} sqft) - Owner: {client2.first_name}')

            # ========== STEP 4: CREATE CLEANING JOBS ==========
            self.stdout.write('\n💼 Step 4: Creating Cleaning Jobs...')

            scheduled_date1 = datetime.now().date() + timedelta(days=3)
            job1 = CleaningJob.objects.create(
                client=client1,
                property=property1,
                scheduled_date=scheduled_date1,
                start_time='10:00:00',
                services_description='Deep cleaning needed - kitchen, bathrooms, all rooms',
                client_budget=Decimal('150.00'),
                notes='Please use eco-friendly products',
                status='open_for_bids'
            )
            self.stdout.write(f'✅ Job #{job1.id}: Deep cleaning at {property1.address_line1} (Status: {job1.status})')

            scheduled_date2 = datetime.now().date() + timedelta(days=5)
            job2 = CleaningJob.objects.create(
                client=client2,
                property=property2,
                scheduled_date=scheduled_date2,
                start_time='14:00:00',
                services_description='Regular cleaning of house including garden area',
                client_budget=Decimal('120.00'),
                notes='Garden furniture needs cleaning too',
                status='open_for_bids'
            )
            self.stdout.write(f'✅ Job #{job2.id}: Regular cleaning at {property2.address_line1} (Status: {job2.status})')

            # ========== STEP 5: CREATE JOB BIDS ==========
            self.stdout.write('\n💵 Step 5: Creating Job Bids...')

            # Bids for Job 1
            bid1 = JobBid.objects.create(
                job=job1,
                cleaner=cleaner1,
                bid_amount=Decimal('120.00'),
                estimated_duration=timedelta(hours=4),
                message='I can handle this deep cleaning job professionally. I have 5 years experience.'
            )
            self.stdout.write(f'✅ Bid #{bid1.id}: {cleaner1.first_name} → Job #{job1.id} (${bid1.bid_amount})')

            bid2 = JobBid.objects.create(
                job=job1,
                cleaner=cleaner2,
                bid_amount=Decimal('110.00'),
                estimated_duration=timedelta(hours=4),
                message='Competitive price with excellent quality. Eco-friendly products available.'
            )
            self.stdout.write(f'✅ Bid #{bid2.id}: {cleaner2.first_name} → Job #{job1.id} (${bid2.bid_amount})')

            # Bid for Job 2
            bid3 = JobBid.objects.create(
                job=job2,
                cleaner=cleaner2,
                bid_amount=Decimal('90.00'),
                estimated_duration=timedelta(hours=3),
                message='I am based in Thessaloniki and can easily reach your location.'
            )
            self.stdout.write(f'✅ Bid #{bid3.id}: {cleaner2.first_name} → Job #{job2.id} (${bid3.bid_amount})')

            # ========== STEP 6: CREATE NOTIFICATION TEMPLATES ==========
            self.stdout.write('\n📧 Step 6: Creating Notification Templates...')

            templates = [
                {
                    'name': 'job_created_for_cleaners',
                    'notification_type': 'job_created',
                    'title_template': 'New Job Available',
                    'message_template': 'A new cleaning job has been posted in {city}.',
                    'default_priority': 'medium'
                },
                {
                    'name': 'job_accepted_for_clients',
                    'notification_type': 'job_accepted',
                    'title_template': 'Job Accepted',
                    'message_template': 'Your cleaning job has been accepted by {cleaner_name}.',
                    'default_priority': 'high'
                },
                {
                    'name': 'job_started_for_clients',
                    'notification_type': 'job_started',
                    'title_template': 'Job Started',
                    'message_template': '{cleaner_name} has started working on your cleaning job.',
                    'default_priority': 'high'
                },
                {
                    'name': 'job_completed_for_clients',
                    'notification_type': 'job_completed',
                    'title_template': 'Job Completed',
                    'message_template': 'Your cleaning job has been completed. Please review.',
                    'default_priority': 'high'
                },
            ]

            for template_data in templates:
                template, created = NotificationTemplate.objects.get_or_create(
                    name=template_data['name'],
                    defaults={
                        'notification_type': template_data['notification_type'],
                        'title_template': template_data['title_template'],
                        'message_template': template_data['message_template'],
                        'default_priority': template_data['default_priority']
                    }
                )
                status = 'Created' if created else 'Already exists'
                self.stdout.write(f'✅ Template: {template.name} ({status})')

            self.stdout.write('\n' + '=' * 80)
            self.stdout.write(self.style.SUCCESS('✅ TEST DATA CREATED SUCCESSFULLY'))
            self.stdout.write('=' * 80)

            # Print summary
            self.stdout.write('\n📊 SUMMARY:')
            self.stdout.write(f'  👥 Users: {User.objects.count()}')
            self.stdout.write(f'     - Admins: {User.objects.filter(role="admin").count()}')
            self.stdout.write(f'     - Clients: {User.objects.filter(role="client").count()}')
            self.stdout.write(f'     - Cleaners: {User.objects.filter(role="cleaner").count()}')
            self.stdout.write(f'  🏠 Properties: {Property.objects.count()}')
            self.stdout.write(f'  💼 Jobs: {CleaningJob.objects.count()}')
            self.stdout.write(f'  💵 Bids: {JobBid.objects.count()}')
            self.stdout.write(f'  📧 Templates: {NotificationTemplate.objects.count()}')
            self.stdout.write(f'  📍 Service Areas: {ServiceArea.objects.count()}')

            self.stdout.write('\n🔑 LOGIN CREDENTIALS:')
            self.stdout.write('  Admin:   admin@ecloud.com / admin123')
            self.stdout.write('  Client1: client1@test.com / client123')
            self.stdout.write('  Client2: client2@test.com / client123')
            self.stdout.write('  Cleaner1: cleaner1@test.com / cleaner123')
            self.stdout.write('  Cleaner2: cleaner2@test.com / cleaner123')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Error creating test data: {e}'))
            import traceback
            traceback.print_exc()
