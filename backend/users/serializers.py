from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth.password_validation import validate_password
from django.core.validators import MinLengthValidator
from .models import User, ServiceArea

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
            'is_active'
        ]
        read_only_fields = [
            'email',
            'username',
            'role', 
            'is_active'
        ]

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

    # Add username field with unique validation
    username = serializers.CharField(
        required=True,
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            message="A user with this username already exists."
        )]
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
