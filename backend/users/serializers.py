from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth.password_validation import validate_password
from django.core.validators import MinLengthValidator
from .models import User, ServiceArea
from .phone_utils import validate_international_phone, clean_phone_number

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.
    Used for displaying and updating user profile data.
    """
    # Email is read-only to prevent updates via API, managed by auth views.
    email = serializers.EmailField(read_only=True)
    # Username is read-only to prevent updates via API for security.
    username = serializers.CharField(read_only=True)
    # Role is read-only to ensure it's not changed accidentally.
    role = serializers.CharField(read_only=True)
    # Add helper field to check if user is OAuth user
    is_oauth_user = serializers.SerializerMethodField()
    # Add service areas count for cleaners
    service_areas_count = serializers.SerializerMethodField()
    # Add 2FA status
    two_factor_enabled = serializers.BooleanField(read_only=True)
    # Add cleaner statistics for bid comparison
    rating = serializers.SerializerMethodField()
    reviews_count = serializers.SerializerMethodField()
    jobs_completed = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',  # Include user ID for WebSocket connections and references
            'email', 
            'username',
            'role', 
            'first_name', 
            'last_name', 
            'phone_number', 
            'country_code',
            'profile_picture', 
            'user_timezone',  # User's timezone for scheduling
            'is_active',
            'oauth_provider',  # Show which OAuth provider (google, etc.) or null
            'is_oauth_user',  # Boolean helper field
            'email_verified',  # Email verification status
            'email_verified_at',  # When email was verified
            'is_verified_cleaner',  # Admin-verified cleaner badge
            'verified_at',  # When cleaner was verified
            'service_areas_count',  # Count of service areas (for cleaners)
            'rating',  # Average rating from reviews (for cleaners)
            'reviews_count',  # Total number of reviews (for cleaners)
            'jobs_completed',  # Total completed jobs (for cleaners)
            'two_factor_enabled',  # Whether 2FA is enabled
            'date_joined',  # When the user registered
        ]
        read_only_fields = [
            'email',
            'username',
            'role', 
            'is_active',
            'oauth_provider',
            'email_verified',
            'email_verified_at',
            'is_verified_cleaner',
            'verified_at',
            'date_joined',
        ]
    
    def get_is_oauth_user(self, obj):
        """Check if user registered via OAuth."""
        return obj.is_oauth_user()
    
    def get_service_areas_count(self, obj):
        """Get count of service areas for cleaners."""
        if obj.role == 'cleaner':
            return obj.service_areas.count()
        return None
    
    def get_rating(self, obj):
        """Get average rating from reviews (for cleaners)."""
        if obj.role != 'cleaner':
            return None
        
        try:
            from django.db.models import Avg
            from reviews.models import Review
            
            avg_rating = Review.objects.filter(reviewee=obj).aggregate(
                avg=Avg('overall_rating')
            )['avg']
            
            return round(avg_rating, 1) if avg_rating else None
        except ImportError:
            # Reviews app not available
            return None
    
    def get_reviews_count(self, obj):
        """Get total number of reviews (for cleaners)."""
        if obj.role != 'cleaner':
            return None
        
        try:
            from reviews.models import Review
            return Review.objects.filter(reviewee=obj).count()
        except ImportError:
            # Reviews app not available
            return 0
    
    def get_jobs_completed(self, obj):
        """Get total completed jobs (for cleaners)."""
        if obj.role != 'cleaner':
            return None
        
        try:
            from cleaning_jobs.models import CleaningJob
            return CleaningJob.objects.filter(
                cleaner=obj,
                status='completed'
            ).count()
        except ImportError:
            return 0
    
    def validate_first_name(self, value):
        """Validate first name format."""
        if value and len(value.strip()) > 0:
            # Check minimum length
            if len(value.strip()) < 2:
                raise serializers.ValidationError("First name must be at least 2 characters long.")
            # Check maximum length
            if len(value) > 150:
                raise serializers.ValidationError("First name cannot exceed 150 characters.")
            # Check for invalid characters (allow letters, spaces, hyphens, apostrophes)
            import re
            if not re.match(r"^[a-zA-ZÀ-ÿ\s\-']+$", value):
                raise serializers.ValidationError("First name can only contain letters, spaces, hyphens, and apostrophes.")
        return value.strip() if value else value
    
    def validate_last_name(self, value):
        """Validate last name format."""
        if value and len(value.strip()) > 0:
            # Check minimum length
            if len(value.strip()) < 2:
                raise serializers.ValidationError("Last name must be at least 2 characters long.")
            # Check maximum length
            if len(value) > 150:
                raise serializers.ValidationError("Last name cannot exceed 150 characters.")
            # Check for invalid characters (allow letters, spaces, hyphens, apostrophes)
            import re
            if not re.match(r"^[a-zA-ZÀ-ÿ\s\-']+$", value):
                raise serializers.ValidationError("Last name can only contain letters, spaces, hyphens, and apostrophes.")
        return value.strip() if value else value
    
    def validate_phone_number(self, value):
        """
        Validate phone number format - basic cleaning only.
        Full validation happens in validate() with country code.
        """
        if value:
            # Clean the phone number (remove spaces, dashes, etc.)
            cleaned = clean_phone_number(value)
            # Basic check: should only contain digits after cleaning
            if not cleaned.isdigit():
                raise serializers.ValidationError("Phone number can only contain digits, spaces, and dashes.")
            return cleaned
        return value
    
    def validate(self, attrs):
        """
        Cross-field validation using phonenumbers library.
        Validates phone number against country-specific rules.
        """
        # Get phone number and country code (from update or existing instance)
        phone_number = attrs.get('phone_number')
        country_code = attrs.get('country_code')
        
        # If updating, get existing values for fields not being changed
        if self.instance:
            if phone_number is None:
                phone_number = self.instance.phone_number
            if country_code is None:
                country_code = self.instance.country_code
        
        # Validate phone number with country code if both provided
        if phone_number and country_code:
            is_valid, formatted, error = validate_international_phone(country_code, phone_number)
            
            if not is_valid:
                raise serializers.ValidationError({
                    'phone_number': error
                })
        
        return attrs

class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    Serializer for creating new user accounts.
    Handles validation and creation of a new User instance, including password hashing.
    """
    # Override email to make it required and unique for registration.
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            message="A user with this email already exists."
        )]
    )
    # Override username to make it required and unique for registration.
    username = serializers.CharField(
        required=True,
        max_length=150,
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            message="A user with this username already exists."
        )]
    )
    # Password is write-only for security and required for registration.
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[MinLengthValidator(8)],
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        # Fields required for a new user registration.
        fields = ('email', 'username', 'password', 'role', 'first_name', 'last_name', 'phone_number', 'country_code')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
            'phone_number': {'required': False},
            'country_code': {'required': False},
            'role': {'required': False} # Defaults to 'client' in the model
        }

    def validate_password(self, value):
        """
        Validate the password against Django's password validators.
        """
        validate_password(value)
        return value

    def create(self, validated_data):
        """
        Create and return a new `User` instance, given the validated data.
        This method hashes the password for security before saving.
        """
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', ''),
            country_code=validated_data.get('country_code', ''),
            role=validated_data.get('role', 'client')
        )
        return user


class PasswordChangeSerializer(serializers.Serializer):
    """
    Serializer for changing user passwords.
    Requires current password for validation and new password confirmation.
    """
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    confirm_password = serializers.CharField(required=True)

    def validate_current_password(self, value):
        """
        Validate that the current password is correct.
        """
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        """
        Validate that new passwords match.
        """
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("New passwords do not match.")
        return attrs

    def save(self):
        """
        Update user password.
        """
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class ServiceAreaSerializer(serializers.ModelSerializer):
    """
    Serializer for ServiceArea model.
    Allows cleaners to manage their service areas.
    """
    cleaner = UserSerializer(read_only=True)

    class Meta:
        model = ServiceArea
        fields = [
            'id',
            'cleaner',
            'area_type',
            'area_name',
            'city',
            'state',
            'country',
            'center_latitude',
            'center_longitude',
            'radius_miles',
            'postal_codes',
            'is_active',
            'priority',
            'max_travel_time_minutes',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['cleaner', 'created_at', 'updated_at']

    def validate(self, data):
        """
        Validate service area data based on area type.
        """
        area_type = data.get('area_type')
        
        if area_type == 'radius':
            required_fields = ['center_latitude', 'center_longitude', 'radius_miles']
            for field in required_fields:
                if data.get(field) is None:  # Changed from 'not data.get(field)' to allow 0 values
                    raise serializers.ValidationError(
                        f"{field} is required for radius-based service areas."
                    )
        
        elif area_type == 'city':
            if not data.get('city'):
                raise serializers.ValidationError(
                    "City is required for city-based service areas."
                )
        
        elif area_type == 'postal_codes':
            if not data.get('postal_codes') or len(data.get('postal_codes', [])) == 0:
                raise serializers.ValidationError(
                    "At least one postal code is required for postal code-based service areas."
                )
        
        return data

    def create(self, validated_data):
        """
        Create service area with cleaner from request context.
        """
        validated_data['cleaner'] = self.context['request'].user
        return super().create(validated_data)
