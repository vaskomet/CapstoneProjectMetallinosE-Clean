"""
Location-based cleaner search utilities.
Helper functions for finding cleaners by geographic location.
"""

from math import radians, cos, sin, asin, sqrt
from django.db.models import Q
from .models import ServiceArea, User


def calculate_distance(lat1, lon1, lat2, lon2, unit='km'):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees).
    
    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates  
        unit: 'km' for kilometers (default) or 'mi' for miles
    
    Returns:
        Distance in specified unit (km or miles)
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    if unit == 'mi':
        r = 3956  # Radius of earth in miles
    else:  # default to km
        r = 6371  # Radius of earth in kilometers
    
    return c * r


def find_cleaners_by_location(latitude, longitude, max_radius=50, unit='km'):
    """
    Find all cleaners who service a given location.
    
    Args:
        latitude (float): Latitude of the location
        longitude (float): Longitude of the location
        max_radius (int/float): Maximum search radius
        unit (str): 'km' (default) or 'mi' for miles
    
    Returns:
        list: Cleaners who service this location, sorted by distance
    """
    # Convert radius to km if provided in miles
    max_radius_km = max_radius if unit == 'km' else max_radius * 1.60934
    
    # Find all radius-based service areas
    radius_areas = ServiceArea.objects.filter(
        is_active=True,
        area_type='radius',
        center_latitude__isnull=False,
        center_longitude__isnull=False,
        radius_miles__isnull=False
    ).select_related('cleaner')
    
    matching_cleaners = set()
    cleaner_distances = {}
    
    for area in radius_areas:
        # Convert service area radius from miles to km (DB stores in miles)
        area_radius_km = float(area.radius_miles) * 1.60934
        
        # Calculate distance from search location to service area center
        distance_km = calculate_distance(
            latitude, longitude,
            area.center_latitude, area.center_longitude,
            unit='km'
        )
        
        # Check if location is within the service area radius
        if distance_km <= area_radius_km:
            matching_cleaners.add(area.cleaner_id)
            # Store minimum distance for this cleaner (in requested unit)
            distance_in_unit = distance_km if unit == 'km' else distance_km * 0.621371
            if area.cleaner_id not in cleaner_distances or distance_in_unit < cleaner_distances[area.cleaner_id]:
                cleaner_distances[area.cleaner_id] = distance_in_unit
    
    # Get cleaners and add distance info
    cleaners = User.objects.filter(
        id__in=matching_cleaners,
        role='cleaner',
        is_active=True
    ).prefetch_related('service_areas')
    
    # Add distance to each cleaner object
    for cleaner in cleaners:
        cleaner.distance_miles = cleaner_distances.get(cleaner.id)
    
    # Sort by distance (None values go to end)
    cleaners = sorted(cleaners, key=lambda c: (c.distance_miles is None, c.distance_miles or 0))
    
    return cleaners


def find_cleaners_by_city(city, state=None, country='US'):
    """
    Find cleaners who service a specific city.
    
    Args:
        city (str): City name
        state (str, optional): State/province
        country (str): Country code (default: US)
    
    Returns:
        QuerySet: Cleaners who service this city
    """
    query = Q(
        service_areas__is_active=True,
        service_areas__city__iexact=city,
        service_areas__country__iexact=country
    )
    
    if state:
        query &= Q(service_areas__state__iexact=state)
    
    cleaners = User.objects.filter(
        query,
        role='cleaner',
        is_active=True
    ).distinct().prefetch_related('service_areas')
    
    return cleaners


def find_cleaners_by_postal_code(postal_code, country='US'):
    """
    Find cleaners who service a specific postal code.
    
    Args:
        postal_code (str): Postal/ZIP code
        country (str): Country code (default: US)
    
    Returns:
        QuerySet: Cleaners who service this postal code
    """
    cleaners = User.objects.filter(
        service_areas__is_active=True,
        service_areas__area_type='postal_codes',
        service_areas__postal_codes__contains=[postal_code],
        service_areas__country__iexact=country,
        role='cleaner',
        is_active=True
    ).distinct().prefetch_related('service_areas')
    
    return cleaners
