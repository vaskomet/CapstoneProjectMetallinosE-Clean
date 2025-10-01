from rest_framework import serializers
from .models import Property, ServiceType

class OwnerSerializer(serializers.ModelSerializer):
    """
    Simple serializer for user details in property ownership
    """
    class Meta:
        from users.models import User
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role']
        read_only_fields = ['id', 'email', 'first_name', 'last_name', 'role']

class PropertySerializer(serializers.ModelSerializer):
    """
    Serializer for the Property model.
    Handles CRUD operations for client properties with geospatial support.
    """
    # Owner with detailed user information for frontend ownership checks
    owner = OwnerSerializer(read_only=True)
    
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
            'latitude',  # Using latitude/longitude fields while PostGIS is disabled
            'longitude',
            'property_type', 
            'size_sqft', 
            'preferences', 
            'notes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        depth = 1  # Include basic user details for owner

    def validate_latitude(self, value):
        """
        Latitude validation to ensure valid coordinates.
        """
        if value is not None:
            if value < -90 or value > 90:
                raise serializers.ValidationError("Latitude must be between -90 and 90")
        return value

    def validate_longitude(self, value):
        """
        Longitude validation to ensure valid coordinates.
        """
        if value is not None:
            if value < -180 or value > 180:
                raise serializers.ValidationError("Longitude must be between -180 and 180")
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