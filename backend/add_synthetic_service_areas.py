"""
Add service areas to synthetic cleaners for testing.

This script creates service areas for the 200 synthetic cleaners
so they can be discovered via location-based search.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'e_clean_backend.settings')
django.setup()

from users.models import User, ServiceArea
import random

# Athens area coordinates
ATHENS_CENTER = (37.9838, 23.7275)
ATHENS_SUBURBS = [
    ('Athens Central', 37.9838, 23.7275, 5),
    ('Piraeus', 37.9413, 23.6464, 8),
    ('Glyfada', 37.8652, 23.7530, 6),
    ('Kifisia', 38.0746, 23.8098, 7),
    ('Marousi', 38.0508, 23.8084, 6),
    ('Chalandri', 38.0217, 23.8001, 5),
    ('Nea Smyrni', 37.9503, 23.7172, 4),
    ('Kallithea', 37.9503, 23.7024, 5),
]

def create_service_areas():
    """Create service areas for synthetic cleaners."""
    
    # Get synthetic cleaners (those without service areas)
    synthetic_cleaners = User.objects.filter(
        role='cleaner',
        service_areas__isnull=True
    ).distinct()
    
    print(f'Found {synthetic_cleaners.count()} cleaners without service areas')
    
    if synthetic_cleaners.count() == 0:
        print('All cleaners already have service areas!')
        return
    
    created_count = 0
    
    for cleaner in synthetic_cleaners:
        # Randomly assign 1-2 service areas
        num_areas = random.randint(1, 2)
        selected_areas = random.sample(ATHENS_SUBURBS, num_areas)
        
        for area_name, lat, lng, radius in selected_areas:
            ServiceArea.objects.create(
                cleaner=cleaner,
                area_type='radius',
                area_name=area_name,
                city='Athens',
                state='Attica',
                country='Greece',
                center_latitude=lat,
                center_longitude=lng,
                radius_miles=radius,
                is_active=True,
                priority=1,
                max_travel_time_minutes=30
            )
            created_count += 1
        
        if created_count % 50 == 0:
            print(f'  Created {created_count} service areas...')
    
    print(f'\n✓ Created {created_count} service areas for {synthetic_cleaners.count()} cleaners')
    
    # Verify
    cleaners_with_areas = User.objects.filter(
        role='cleaner',
        service_areas__isnull=False
    ).distinct().count()
    
    print(f'✓ Total cleaners with service areas: {cleaners_with_areas}')

if __name__ == '__main__':
    create_service_areas()
