from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

class CustomUserManager(BaseUserManager):
    """
    Custom manager for the User model.
    """
    def create_user(self, email, password=None, **extra_fields):
        """
        Creates and saves a User with the given email and password.
        """
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        
        # Generate username from email if not provided
        if 'username' not in extra_fields:
            username_base = email.split('@')[0]
            username = username_base
            counter = 1
            while self.model.objects.filter(username=username).exists():
                username = f"{username_base}{counter}"
                counter += 1
            extra_fields['username'] = username
        
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Creates and saves a superuser with the given email and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom User model for the e-clean platform.
    """
    ROLE_CHOICES = (
        ('client', 'Client'),
        ('cleaner', 'Cleaner'),
        ('admin', 'Admin'),
    )

    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True, db_index=True)
    email = models.EmailField(unique=True, db_index=True)
    password = models.CharField(max_length=128)  # Managed by AbstractBaseUser

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='client')
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    country_code = models.CharField(max_length=5, blank=True, null=True, help_text="Country code (e.g., +1, +30)")
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(blank=True, null=True)

    preferences = models.JSONField(blank=True, null=True)
    oauth_provider = models.CharField(max_length=50, blank=True, null=True)
    
    # Email verification fields
    email_verified = models.BooleanField(
        default=False,
        help_text="Whether user's email has been verified"
    )
    email_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When email was verified"
    )
    verification_token = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Token for email verification"
    )
    verification_token_expires = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Expiration time for verification token (30 minutes after generation)"
    )
    
    # Verified cleaner badge (admin-approved)
    is_verified_cleaner = models.BooleanField(
        default=False,
        help_text="Admin-verified cleaner (ID and resume checked)"
    )
    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When cleaner was verified by admin"
    )
    verified_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_cleaners',
        help_text="Admin who verified this cleaner"
    )
    verification_notes = models.TextField(
        blank=True,
        help_text="Admin notes about verification (private, not shown to user)"
    )
    
    # Stripe integration fields
    stripe_customer_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text="Stripe Customer ID for clients (payment processing)"
    )
    stripe_account_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        unique=True,
        help_text="Stripe Connect Account ID for cleaners (receiving payouts)"
    )
    
    # Future field placeholder
    # subscription_tier = models.CharField(max_length=50, blank=True, null=True)

    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        related_name="custom_user_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name="custom_user_set",
        related_query_name="user",
    )

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['role']

    class Meta:
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['username']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return self.email
    
    def is_oauth_user(self):
        """
        Check if this user registered via OAuth (Google, etc.)
        OAuth users don't have passwords and shouldn't be able to change password.
        """
        return bool(self.oauth_provider)
    
    def has_usable_password(self):
        """
        Override to check if user has a usable password.
        OAuth users have unusable passwords and can't log in with password.
        """
        if self.oauth_provider:
            return False
        return super().has_usable_password()
    
    def mark_email_verified(self):
        """Mark user's email as verified."""
        self.email_verified = True
        self.email_verified_at = timezone.now()
        self.verification_token = None  # Clear token after verification
        self.save(update_fields=['email_verified', 'email_verified_at', 'verification_token'])
    
    def can_post_jobs(self):
        """Check if client can post jobs (email must be verified)."""
        if self.role != 'client':
            return False
        # OAuth users are auto-verified
        if self.oauth_provider:
            return True
        return self.email_verified
    
    def can_bid_on_jobs(self):
        """Check if cleaner can bid on jobs (email must be verified)."""
        if self.role != 'cleaner':
            return False
        # OAuth users are auto-verified
        if self.oauth_provider:
            return True
        return self.email_verified


class ServiceArea(models.Model):
    """
    Service area model for cleaners to define their working locations.
    Supports both city-based and radius-based service areas.
    """
    AREA_TYPE_CHOICES = [
        ('city', 'City/Town'),
        ('radius', 'Radius from location'),
        ('postal_codes', 'Postal codes'),
    ]

    cleaner = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='service_areas',
        limit_choices_to={'role': 'cleaner'}
    )
    
    # Area type and name
    area_type = models.CharField(max_length=20, choices=AREA_TYPE_CHOICES, default='city')
    area_name = models.CharField(max_length=255, help_text="Name of the service area (e.g., 'Manhattan', 'Brooklyn')")
    
    # Geographic boundaries
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, default='US')
    
    # For radius-based areas
    center_latitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    center_longitude = models.DecimalField(max_digits=12, decimal_places=8, null=True, blank=True)
    radius_miles = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True, help_text="Service radius in miles (decimal allowed for km conversion)")
    
    # For postal code-based areas
    postal_codes = models.JSONField(default=list, blank=True, help_text="List of postal codes served")
    
    # Priority and status
    is_active = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(default=1, help_text="Priority order (1 = highest)")
    
    # Travel preferences
    max_travel_time_minutes = models.PositiveIntegerField(default=30, help_text="Maximum travel time to job site")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['cleaner', 'area_name']
        ordering = ['cleaner', 'priority', 'area_name']

    def __str__(self):
        return f"{self.cleaner.username} - {self.area_name}"

    def is_location_in_area(self, latitude, longitude):
        """
        Check if a given location is within this service area.
        """
        if self.area_type == 'radius' and all([
            self.center_latitude, self.center_longitude, self.radius_miles
        ]):
            # Calculate distance using Haversine formula
            from math import radians, cos, sin, asin, sqrt
            
            # Convert to radians
            lat1, lon1 = radians(float(latitude)), radians(float(longitude))
            lat2, lon2 = radians(float(self.center_latitude)), radians(float(self.center_longitude))
            
            # Haversine formula
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            r = 3956  # Radius of earth in miles
            distance = c * r
            
            return distance <= self.radius_miles
        
        # For other area types, return True for now
        # (can be enhanced with more complex geographic checks)
        return True

