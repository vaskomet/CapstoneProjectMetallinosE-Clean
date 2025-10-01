from django.db import models
# from django.contrib.gis.db import models as gis_models  # Temporarily disabled for development
from users.models import User

class Property(models.Model):
    """
    Property model for client-owned locations with geospatial support.
    Enables location-based search using GeoDjango and PostGIS.
    Note: Geographic fields temporarily disabled for development - will be re-enabled with PostGIS setup.
    """
    PROPERTY_TYPE_CHOICES = [
        ('house', 'House'),
        ('apartment', 'Apartment'),
        ('office', 'Office'),
    ]

    id = models.AutoField(primary_key=True)
    # Owner field limited to clients via role check in future views
    owner = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='properties'
    )
    
    # Address fields for complete location information
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='US')
    
    # Temporary coordinate fields (will be replaced with PointField when PostGIS is configured)
    latitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    # location = gis_models.PointField(null=True, blank=True)  # Will be re-enabled with PostGIS
    
    property_type = models.CharField(
        max_length=20, 
        choices=PROPERTY_TYPE_CHOICES
    )
    
    # Size for job duration estimation
    size_sqft = models.PositiveIntegerField(default=0)
    
    # Preferences for cleaner matching (e.g., {'eco_friendly': True, 'pet_present': True})
    preferences = models.JSONField(default=dict, blank=True)
    
    # Photos field to be linked to a Photo model in Phase 4
    # photos = models.ManyToManyField('photos.Photo', blank=True)
    
    # Notes for client instructions
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['city', 'state']),  # Geographic search optimization
            # GIST index on location will be re-enabled with PostGIS setup
            # models.Index(fields=['location'], name='properties_location_gist'),
        ]

    def __str__(self):
        return f"{self.address_line1}, {self.city}, {self.state}"

class ServiceType(models.Model):
    """
    ServiceType supports cleaner profile matching and future eco_impact_score field.
    Standardizes available cleaning services for matching algorithms.
    """
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)  # e.g., 'Standard Cleaning'
    description = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=8, decimal_places=2, default=50.00)  # Base pricing for calculations
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

# Run python manage.py makemigrations after adding 'properties' to INSTALLED_APPS.
