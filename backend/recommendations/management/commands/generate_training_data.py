"""
Management command to generate synthetic training data for recommendation system.

Creates realistic marketplace patterns:
- Jobs with varying property types, sizes, locations
- Cleaner bids with pricing strategies (aggressive, market-rate, premium)
- Bid outcomes based on realistic factors (price, quality, distance)
- Reviews correlated with cleaner quality tier
- Complete job lifecycle events

Usage:
    python manage.py generate_training_data --jobs 5000 --cleaners 200 --clients 500
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from decimal import Decimal
import random
from datetime import timedelta, datetime

from cleaning_jobs.models import CleaningJob, JobBid
from reviews.models import Review, ReviewRating
from payments.models import Payment
from job_lifecycle.models import JobLifecycleEvent, JobAction
from properties.models import Property

User = get_user_model()

# Speed up password hashing for synthetic data generation
# This is safe for test data, DO NOT use in production
ORIGINAL_HASHERS = None

def use_fast_hasher():
    """Temporarily use MD5 hasher for fast synthetic data generation"""
    global ORIGINAL_HASHERS
    ORIGINAL_HASHERS = settings.PASSWORD_HASHERS
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

def restore_hasher():
    """Restore original password hashers"""
    global ORIGINAL_HASHERS
    if ORIGINAL_HASHERS:
        settings.PASSWORD_HASHERS = ORIGINAL_HASHERS


class Command(BaseCommand):
    help = 'Generate synthetic training data for recommendation system'

    def add_arguments(self, parser):
        parser.add_argument('--jobs', type=int, default=5000, help='Number of jobs to create')
        parser.add_argument('--cleaners', type=int, default=200, help='Number of cleaners to create')
        parser.add_argument('--clients', type=int, default=500, help='Number of clients to create')
        parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')

    def handle(self, *args, **options):
        # Use fast password hasher for synthetic data
        use_fast_hasher()
        
        try:
            random.seed(options['seed'])
            
            self.stdout.write(self.style.SUCCESS('Starting synthetic data generation...'))
            self.stdout.write(self.style.WARNING('Using fast password hasher for test data generation'))
            
            # Create users
            cleaners = self._create_cleaners(options['cleaners'])
            clients = self._create_clients(options['clients'])
            
            # Create properties for clients
            properties = self._create_properties(clients)
            
            # Create jobs, bids, reviews
            self._create_jobs_and_marketplace_activity(
                options['jobs'],
                clients,
                cleaners,
                properties
            )
            
            self.stdout.write(self.style.SUCCESS(
                f'Successfully generated {options["jobs"]} jobs with complete marketplace data'
            ))
        finally:
            # Restore original password hashers
            restore_hasher()
            self.stdout.write(self.style.SUCCESS('Restored production password hashers'))

    def _create_cleaners(self, count):
        """Create cleaners with different quality tiers"""
        self.stdout.write('Creating cleaners...')
        cleaners = []
        
        # Define quality tiers (affects pricing, win rate, reviews)
        tiers = {
            'premium': 0.15,  # 15% premium cleaners
            'experienced': 0.30,  # 30% experienced
            'average': 0.40,  # 40% average
            'budget': 0.15,  # 15% budget/new
        }
        
        for i in range(count):
            # Assign tier
            rand = random.random()
            if rand < tiers['premium']:
                tier = 'premium'
            elif rand < tiers['premium'] + tiers['experienced']:
                tier = 'experienced'
            elif rand < tiers['premium'] + tiers['experienced'] + tiers['average']:
                tier = 'average'
            else:
                tier = 'budget'
            
            cleaner = User.objects.create_user(
                email=f'cleaner_{i}@synthetic.test',
                password='testpass123',
                role='cleaner',
                first_name=f'Cleaner{i}',
                last_name=f'Test{tier.title()}',
                phone_number=f'+30210{random.randint(1000000, 9999999)}',
                is_active=True
            )
            
            # Store tier as metadata for later use
            cleaner._tier = tier
            cleaner._experience_years = self._tier_to_experience(tier)
            cleaner._base_hourly_rate = self._tier_to_rate(tier)
            cleaner._response_time = self._tier_to_response_time(tier)
            
            cleaners.append(cleaner)
        
        self.stdout.write(self.style.SUCCESS(f'Created {count} cleaners'))
        return cleaners

    def _create_clients(self, count):
        """Create clients with different budget levels"""
        self.stdout.write('Creating clients...')
        clients = []
        
        budget_tiers = {
            'high': 0.20,  # Willing to pay premium
            'medium': 0.50,  # Market-rate focused
            'low': 0.30,  # Budget-conscious
        }
        
        for i in range(count):
            rand = random.random()
            if rand < budget_tiers['high']:
                budget = 'high'
            elif rand < budget_tiers['high'] + budget_tiers['medium']:
                budget = 'medium'
            else:
                budget = 'low'
            
            client = User.objects.create_user(
                email=f'client_{i}@synthetic.test',
                password='testpass123',
                role='client',
                first_name=f'Client{i}',
                last_name='Test',
                phone_number=f'+30210{random.randint(1000000, 9999999)}',
                is_active=True
            )
            
            client._budget_tier = budget
            clients.append(client)
        
        self.stdout.write(self.style.SUCCESS(f'Created {count} clients'))
        return clients

    def _create_properties(self, clients):
        """Create properties with realistic Athens locations"""
        self.stdout.write('Creating properties...')
        properties = []
        
        # Athens area coordinates (rough bounds)
        athens_center = {'lat': 37.9838, 'lng': 23.7275}
        
        property_types = ['apartment', 'house', 'office']
        size_ranges = {
            'apartment': (400, 1500),  # sqft
            'house': (800, 3000),
            'office': (500, 5000),
        }
        
        for client in clients:
            # Each client has 1-3 properties
            num_properties = random.choices([1, 2, 3], weights=[0.7, 0.25, 0.05])[0]
            
            for _ in range(num_properties):
                prop_type = random.choice(property_types)
                size_min, size_max = size_ranges[prop_type]
                
                # Random location within ~20km of Athens center
                lat_offset = random.uniform(-0.15, 0.15)
                lng_offset = random.uniform(-0.15, 0.15)
                
                prop = Property.objects.create(
                    owner=client,
                    address_line1=f'{random.randint(1, 200)} Synthetic St',
                    city='Athens',
                    state='Attica',
                    postal_code=f'{random.randint(10000, 19999)}',
                    country='Greece',
                    latitude=athens_center['lat'] + lat_offset,
                    longitude=athens_center['lng'] + lng_offset,
                    property_type=prop_type,
                    size_sqft=random.randint(size_min, size_max),
                )
                properties.append(prop)
        
        self.stdout.write(self.style.SUCCESS(f'Created {len(properties)} properties'))
        return properties

    def _create_jobs_and_marketplace_activity(self, job_count, clients, cleaners, properties):
        """Create jobs with realistic bidding, selection, and review patterns"""
        self.stdout.write('Creating jobs and marketplace activity...')
        
        base_date = timezone.now() - timedelta(days=365)  # Start 1 year ago
        
        for i in range(job_count):
            if i % 500 == 0:
                self.stdout.write(f'Progress: {i}/{job_count} jobs...')
            
            # Select random client and property
            client = random.choice(clients)
            client_properties = [p for p in properties if p.owner == client]
            if not client_properties:
                continue
            property_obj = random.choice(client_properties)
            
            # Create job
            job_date = base_date + timedelta(days=random.randint(0, 365))
            scheduled_date = job_date.date()
            start_time = job_date.replace(hour=random.randint(8, 16), minute=0).time()
            
            # Generate services description and checklist
            services_desc = self._generate_job_description(property_obj)
            checklist = self._generate_checklist(property_obj)
            
            job = CleaningJob.objects.create(
                client=client,
                property=property_obj,
                scheduled_date=scheduled_date,
                start_time=start_time,
                services_description=services_desc,
                client_budget=Decimal(random.randint(30, 200)),
                checklist=checklist,
                notes=self._generate_special_instructions(),
                status='open_for_bids',
                created_at=job_date,
            )
            
            # Generate bids (3-8 bids per job)
            num_bids = random.randint(3, 8)
            bidding_cleaners = random.sample(cleaners, min(num_bids, len(cleaners)))
            
            bids = []
            for cleaner in bidding_cleaners:
                bid = self._create_bid(job, cleaner, property_obj, job_date)
                if bid:
                    bids.append(bid)
            
            if not bids:
                continue
            
            # Select winning bid (realistic selection logic)
            winning_bid = self._select_winning_bid(bids, client._budget_tier)
            
            if winning_bid:
                # Accept bid and progress job
                self._progress_job_lifecycle(job, winning_bid, job_date)

    def _create_bid(self, job, cleaner, property_obj, base_date):
        """Create realistic bid based on cleaner tier and job characteristics"""
        # Base calculation: property size * hourly rate * estimated hours
        # Convert sqft to size factor (normalize by 1000)
        size_factor = property_obj.size_sqft / 1000
        
        # Estimate hours based on property size
        if property_obj.size_sqft < 800:
            estimated_hours = random.uniform(2, 3)
        elif property_obj.size_sqft < 1500:
            estimated_hours = random.uniform(3, 5)
        else:
            estimated_hours = random.uniform(5, 8)
        
        base_cost = size_factor * cleaner._base_hourly_rate * estimated_hours
        
        # Add random variation (-10% to +15%)
        variation = random.uniform(0.9, 1.15)
        bid_amount = base_cost * variation
        
        # Round to nearest 5 euros
        bid_amount = round(bid_amount / 5) * 5
        
        # Bid timing affects win rate (earlier = better)
        hours_after_posting = random.randint(1, 72)
        bid_date = base_date + timedelta(hours=hours_after_posting)
        
        # Generate estimated duration based on property size
        base_hours = 2 if job.property.size_sqft < 800 else (4 if job.property.size_sqft < 1500 else 6)
        estimated_hours = base_hours + random.randint(-1, 2)
        
        bid = JobBid.objects.create(
            job=job,
            cleaner=cleaner,
            bid_amount=Decimal(str(bid_amount)),
            estimated_duration=timedelta(hours=estimated_hours),
            message=self._generate_bid_message(cleaner),
            status='pending',
            created_at=bid_date,
        )
        
        # Store metadata for selection logic
        bid._hours_after_posting = hours_after_posting
        bid._cleaner_tier = cleaner._tier
        
        return bid

    def _select_winning_bid(self, bids, client_budget_tier):
        """Select winning bid based on realistic client behavior"""
        if not bids:
            return None
        
        # Score each bid
        scored_bids = []
        prices = [float(b.bid_amount) for b in bids]
        avg_price = sum(prices) / len(prices)
        
        for bid in bids:
            score = 0
            
            # Price factor (varies by client budget tier)
            price_ratio = float(bid.bid_amount) / avg_price
            if client_budget_tier == 'low':
                # Budget clients: heavily favor lower prices
                score += max(0, 50 * (1.5 - price_ratio))
            elif client_budget_tier == 'medium':
                # Medium clients: balance price and quality
                score += max(0, 30 * (1.3 - price_ratio))
                score += {'premium': 25, 'experienced': 20, 'average': 10, 'budget': 5}[bid._cleaner_tier]
            else:  # high budget
                # High-budget clients: favor quality over price
                score += {'premium': 40, 'experienced': 30, 'average': 15, 'budget': 5}[bid._cleaner_tier]
                score += max(0, 10 * (1.2 - price_ratio))  # Still consider price somewhat
            
            # Early bird bonus (first bids get advantage)
            if bid._hours_after_posting < 6:
                score += 15
            elif bid._hours_after_posting < 24:
                score += 10
            elif bid._hours_after_posting < 48:
                score += 5
            
            # Add small random factor
            score += random.uniform(0, 10)
            
            scored_bids.append((score, bid))
        
        # Select winner (highest score wins)
        scored_bids.sort(reverse=True, key=lambda x: x[0])
        return scored_bids[0][1]

    def _progress_job_lifecycle(self, job, winning_bid, base_date):
        """Progress job through realistic lifecycle with reviews"""
        # Accept bid
        winning_bid.status = 'accepted'
        winning_bid.save()
        
        job.status = 'bid_accepted'
        # Accept winning bid
        winning_bid.status = 'accepted'
        winning_bid.save()
        
        job.cleaner = winning_bid.cleaner
        job.accepted_bid = winning_bid
        job.final_price = winning_bid.bid_amount
        job.save()
        
        # Create payment
        payment = Payment.objects.create(
            job=job,
            client=job.client,
            cleaner=winning_bid.cleaner,
            amount=winning_bid.bid_amount,
            platform_fee=winning_bid.bid_amount * Decimal('0.10'),
            cleaner_payout=winning_bid.bid_amount * Decimal('0.90'),
            status='succeeded',
            stripe_payment_intent_id=f'pi_synthetic_{job.id}_{random.randint(100000, 999999)}',
            created_at=base_date + timedelta(hours=2),
        )
        
        job.status = 'confirmed'
        job.save()
        
        # 90% completion rate (10% cancelled/failed)
        if random.random() < 0.9:
            # Job completed
            # Convert scheduled date + time to datetime for calculations
            scheduled_datetime = timezone.make_aware(
                datetime.combine(job.scheduled_date, job.start_time)
            )
            
            job.actual_start_time = scheduled_datetime + timedelta(minutes=random.randint(-15, 30))
            job.actual_end_time = job.actual_start_time + winning_bid.estimated_duration + timedelta(minutes=random.randint(-30, 60))
            job.status = 'completed'
            job.save()
            
            # Create review (tier affects ratings)
            completion_date = job.actual_end_time
            self._create_review(job, winning_bid.cleaner, completion_date)
        else:
            # Job cancelled
            job.status = 'cancelled'
            job.save()

    def _create_review(self, job, cleaner, review_date):
        """Create realistic review based on cleaner tier"""
        tier_ratings = {
            'premium': (9, 10),  # Premium cleaners get 9-10
            'experienced': (7, 9),  # Experienced get 7-9
            'average': (6, 8),  # Average get 6-8
            'budget': (5, 7),  # Budget get 5-7
        }
        
        min_rating, max_rating = tier_ratings[cleaner._tier]
        
        # Overall rating
        overall_rating = random.randint(min_rating, max_rating)
        
        # Create review
        review = Review.objects.create(
            job=job,
            reviewer=job.client,
            reviewee=cleaner,
            overall_rating=overall_rating,
            comment=self._generate_review_comment(overall_rating, cleaner._tier),
            created_at=review_date + timedelta(hours=random.randint(2, 48)),
        )
        
        # Create detailed ratings (correlated with overall)
        ReviewRating.objects.create(
            review=review,
            category='quality',
            rating=min(10, max(1, overall_rating + random.randint(-1, 1))),
        )
        ReviewRating.objects.create(
            review=review,
            category='communication',
            rating=min(10, max(1, overall_rating + random.randint(-1, 1))),
        )
        ReviewRating.objects.create(
            review=review,
            category='professionalism',
            rating=min(10, max(1, overall_rating + random.randint(-1, 1))),
        )
        ReviewRating.objects.create(
            review=review,
            category='timeliness',
            rating=min(10, max(1, overall_rating + random.randint(-2, 1))),
        )

    # Helper methods for generating realistic text
    
    def _tier_to_experience(self, tier):
        """Map tier to years of experience"""
        return {
            'premium': random.randint(5, 15),
            'experienced': random.randint(2, 5),
            'average': random.randint(1, 2),
            'budget': random.uniform(0, 1),
        }[tier]

    def _tier_to_rate(self, tier):
        """Map tier to hourly rate (euros)"""
        return {
            'premium': random.uniform(25, 35),
            'experienced': random.uniform(18, 25),
            'average': random.uniform(12, 18),
            'budget': random.uniform(8, 12),
        }[tier]

    def _tier_to_response_time(self, tier):
        """Map tier to average response time (hours)"""
        return {
            'premium': random.uniform(0.5, 2),
            'experienced': random.uniform(1, 4),
            'average': random.uniform(2, 8),
            'budget': random.uniform(4, 24),
        }[tier]

    def _generate_job_description(self, property_obj):
        """Generate realistic job description"""
        templates = [
            f"Need thorough cleaning of {property_obj.size_sqft}sqft {property_obj.property_type}",
            f"Deep cleaning required for {property_obj.property_type} in {property_obj.city}",
            f"Regular cleaning service needed for {property_obj.size_sqft}sqft space",
        ]
        return random.choice(templates)

    def _generate_special_instructions(self):
        """Generate random special instructions"""
        instructions = [
            "Please bring eco-friendly products",
            "Keys with building manager",
            "Pet-friendly products required - we have a dog",
            "Focus on kitchen and bathrooms",
            "Windows need special attention",
            "",  # Most have no special instructions
        ]
        return random.choice(instructions)

    def _generate_checklist(self, property_obj):
        """Generate realistic cleaning checklist based on property type"""
        base_items = ['living_room', 'kitchen', 'bathroom']
        
        if property_obj.property_type == 'house':
            additional = ['bedroom', 'hallway', 'stairs', 'garage']
        elif property_obj.property_type == 'apartment':
            additional = ['bedroom', 'balcony']
        else:  # office
            additional = ['conference_room', 'break_room', 'restrooms']
        
        # Select 3-6 items randomly
        all_items = base_items + additional
        num_items = random.randint(3, min(6, len(all_items)))
        return random.sample(all_items, num_items)

    def _generate_bid_message(self, cleaner):
        """Generate realistic bid message"""
        templates = [
            f"Hello! I have {int(cleaner._experience_years)} years of experience and would love to help.",
            "Available for your requested time. Professional service guaranteed!",
            "Experienced cleaner with excellent references. Happy to discuss your needs.",
            f"Specialized in {random.choice(['residential', 'commercial', 'eco-friendly'])} cleaning.",
        ]
        return random.choice(templates)

    def _generate_review_comment(self, rating, tier):
        """Generate realistic review comment"""
        if rating >= 9:
            comments = [
                "Excellent service! Very thorough and professional.",
                "Outstanding work. Will definitely hire again!",
                "Perfect cleaning, exceeded expectations.",
            ]
        elif rating >= 7:
            comments = [
                "Good job overall, minor issues but satisfied.",
                "Professional and on time. Recommended.",
                "Quality work, would use again.",
            ]
        elif rating >= 5:
            comments = [
                "Acceptable service but room for improvement.",
                "Got the job done but not exceptional.",
                "Average cleaning, met basic expectations.",
            ]
        else:
            comments = [
                "Disappointed with the quality.",
                "Not thorough enough, had to re-clean some areas.",
                "Below expectations, communication issues.",
            ]
        
        return random.choice(comments)
