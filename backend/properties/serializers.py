from rest_framework import serializers
from .models import Property, ServiceType

class PropertySerializer(serializers.ModelSerializer):
    """
    Serializer for the Property model.
    Handles CRUD operations for client properties with geospatial support.
    """
    # Owner is read-only and displays basic user details
    owner = serializers.StringRelatedField(read_only=True)
    
    # Preferences field is read-only to prevent direct API updates, managed by views
    preferences = serializers.JSONField(read_only=True)

    class Meta:
        model = Property
        fields = [
            'id',
            'owner', 
            'address_line1', 
            'address_line2', 
            'city', 
            'state', 
            'postal_code', 
            'country', 
            'location',  # Location field serialized as GeoJSON for Leaflet.js integration, per CompatibilitySpecifics.rtf
            'property_type', 
            'size_sqft', 
            'preferences', 
            'notes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        depth = 1  # Include basic user details for owner

    def validate_location(self, value):
        """
        Location validation to ensure valid coordinates.
        Validates that coordinates are within valid ranges.
        """
        if value:
            # Validate longitude is between -180 and 180
            if value.x < -180 or value.x > 180:
                raise serializers.ValidationError("Longitude must be between -180 and 180")
            # Validate latitude is between -90 and 90
            if value.y < -90 or value.y > 90:
                raise serializers.ValidationError("Latitude must be between -90 and 90")
        return value

class ServiceTypeSerializer(serializers.ModelSerializer):
    """
    Serializer for the ServiceType model.
    ServiceType supports cleaner profile matching and future eco_impact_score field.
    """
    
    class Meta:
        model = ServiceType
        fields = [
            'id',
            'name', 
            'description',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

# Test with PropertySerializer(data={'address_line1': '123 Main St', 'location': {'type': 'Point', 'coordinates': [-73.935242, 40.730610]}}) using Django shell