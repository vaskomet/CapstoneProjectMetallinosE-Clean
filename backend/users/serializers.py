from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth.password_validation import validate_password
from django.core.validators import MinLengthValidator
from .models import User

class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for the User model.
    Used for displaying user data in a read-only format.
    """
    # Email is read-only to prevent updates via API, managed by auth views.
    email = serializers.EmailField(read_only=True)
    # Role is read-only to ensure it's not changed accidentally.
    role = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'email', 
            'role', 
            'first_name', 
            'last_name', 
            'phone_number', 
            'profile_picture', 
            'is_active'
        ]
        read_only_fields = [
            'first_name', 
            'last_name', 
            'phone_number', 
            'profile_picture', 
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
        fields = ('email', 'password', 'role', 'first_name', 'last_name')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
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
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=validated_data.get('role', 'client')
        )
        return user
