from rest_framework import status, generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserRegistrationSerializer, UserSerializer, PasswordChangeSerializer, ServiceAreaSerializer
from .models import ServiceArea
from .location_utils import find_cleaners_by_location, find_cleaners_by_city, find_cleaners_by_postal_code
from .email_verification import send_verification_email
from .throttles import ResendVerificationThrottle

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token obtain pair serializer to include user data in the response.
    """
    username_field = 'email'  # Keep using 'email' field for API compatibility
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['email'] = user.email
        token['username'] = user.username
        token['role'] = user.role
        return token

    def validate(self, attrs):
        # Get login identifier (email or username) from the email field
        login_identifier = attrs.get('email')
        password = attrs.get('password')
        
        if not login_identifier or not password:
            raise serializers.ValidationError('Email and password are required.')
        
        # Check if user exists by email or username
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        user = None
        try:
            if '@' in login_identifier:
                # Login with email
                user = User.objects.get(email=login_identifier)
            else:
                # Login with username
                user = User.objects.get(username=login_identifier)
        except User.DoesNotExist:
            # Use generic error message to prevent user enumeration
            raise serializers.ValidationError('Invalid credentials. Please check your email/username and password.')
        
        # User exists, now check password
        if not user.check_password(password):
            # Use same generic error message to prevent user enumeration
            raise serializers.ValidationError('Invalid credentials. Please check your email/username and password.')
        
        # Check if user account is active
        if not user.is_active:
            raise serializers.ValidationError('Your account has been disabled. Please contact support.')
        
        # All checks passed, generate tokens
        refresh = self.get_token(user)
        data = {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        }
        return data

class LoginView(TokenObtainPairView):
    """
    Login view using email and password.
    """
    serializer_class = MyTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    """
    Register a new user.
    """
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        """
        Handles new user creation.
        """
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Send verification email to non-OAuth users
            if not user.oauth_provider:
                send_verification_email(user)
            
            # Generate JWT tokens for the new user
            refresh = RefreshToken.for_user(user)
            access = refresh.access_token
            
            # Return success response with tokens and user data
            return Response({
                "user": UserSerializer(user, context=self.get_serializer_context()).data,
                "access": str(access),
                "refresh": str(refresh),
                "message": "User created successfully. Please check your email to verify your account.",
                "email_sent": not user.oauth_provider  # True if verification email was sent
            }, status=status.HTTP_201_CREATED)
        # Return 400 for invalid registration data
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    Get and update user profile.
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class PasswordChangeView(APIView):
    """
    Change user password with current password validation.
    OAuth users cannot change passwords as they authenticate through their provider.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Check if user is OAuth user
        if request.user.is_oauth_user():
            return Response(
                {
                    "error": "OAuth users cannot change passwords. You log in through your OAuth provider (e.g., Google).",
                    "oauth_provider": request.user.oauth_provider
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "Password changed successfully."}, 
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ServiceAreaListCreateView(generics.ListCreateAPIView):
    """
    List and create service areas for cleaners.
    """
    serializer_class = ServiceAreaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return service areas for the authenticated cleaner.
        """
        user = self.request.user
        if hasattr(user, 'role') and user.role == 'cleaner':
            return ServiceArea.objects.filter(cleaner=user)
        elif hasattr(user, 'role') and user.role == 'admin':
            return ServiceArea.objects.all()
        else:
            return ServiceArea.objects.none()

    def perform_create(self, serializer):
        """
        Create service area for the authenticated cleaner.
        """
        if not (hasattr(self.request.user, 'role') and self.request.user.role == 'cleaner'):
            raise serializers.ValidationError("Only cleaners can create service areas.")
        serializer.save(cleaner=self.request.user)


class ServiceAreaDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, and delete service areas.
    """
    serializer_class = ServiceAreaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return service areas for the authenticated cleaner.
        """
        user = self.request.user
        if hasattr(user, 'role') and user.role == 'cleaner':
            return ServiceArea.objects.filter(cleaner=user)
        elif hasattr(user, 'role') and user.role == 'admin':
            return ServiceArea.objects.all()
        else:
            return ServiceArea.objects.none()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_cleaners_by_location(request):
    """
    Search for cleaners who service a specific location.
    
    Query parameters:
        - latitude (required): Latitude of location
        - longitude (required): Longitude of location
        - max_radius (optional): Maximum search radius (default: 50)
        - unit (optional): 'km' for kilometers (default) or 'mi' for miles
        - city (optional): City name for city-based search
        - state (optional): State/province
        - postal_code (optional): Postal/ZIP code
    
    Returns:
        List of cleaners with their service areas and distance information
    """
    # Get search parameters
    latitude = request.query_params.get('latitude')
    longitude = request.query_params.get('longitude')
    max_radius = request.query_params.get('max_radius', 50)
    unit = request.query_params.get('unit', 'km')  # Default to km for Athens
    city = request.query_params.get('city')
    state = request.query_params.get('state')
    postal_code = request.query_params.get('postal_code')
    
    cleaners = []
    
    # Priority 1: Lat/lng search (most accurate)
    if latitude and longitude:
        try:
            lat = float(latitude)
            lng = float(longitude)
            radius = float(max_radius)
            cleaners = find_cleaners_by_location(lat, lng, radius, unit=unit)
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid latitude, longitude, or max_radius'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Priority 2: Postal code search
    elif postal_code:
        cleaners = find_cleaners_by_postal_code(postal_code)
    
    # Priority 3: City search
    elif city:
        cleaners = find_cleaners_by_city(city, state)
    
    else:
        return Response(
            {'error': 'Please provide latitude/longitude, city, or postal_code'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Serialize cleaners with additional info
    results = []
    for cleaner in cleaners:
        cleaner_data = UserSerializer(cleaner).data
        cleaner_data['service_areas'] = ServiceAreaSerializer(
            cleaner.service_areas.filter(is_active=True), 
            many=True
        ).data
        
        # Add distance if available (attribute name is generic regardless of unit)
        if hasattr(cleaner, 'distance_miles') and cleaner.distance_miles is not None:
            distance_key = f'distance_{unit}'  # 'distance_km' or 'distance_mi'
            cleaner_data[distance_key] = round(cleaner.distance_miles, 2)
        
        results.append(cleaner_data)
    
    return Response({
        'count': len(results),
        'cleaners': results,
        'unit': unit
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email_view(request):
    """
    Verify user's email with token.
    
    POST /api/auth/verify-email/
    Body: {"token": "verification_token"}
    """
    from django.utils import timezone
    
    token = request.data.get('token')
    
    if not token:
        return Response(
            {'error': 'Verification token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(verification_token=token)
        
        # Check if already verified
        if user.email_verified:
            return Response({
                'message': 'Email already verified',
                'email_verified': True,
                'user_role': user.role
            }, status=status.HTTP_200_OK)
        
        # Check if token has expired
        if user.verification_token_expires and timezone.now() >= user.verification_token_expires:
            return Response({
                'error': 'Verification link has expired',
                'expired': True,
                'message': 'This verification link has expired. Please request a new one.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Mark as verified
        user.mark_email_verified()
        
        return Response({
            'message': 'Email verified successfully!',
            'email_verified': True,
            'user_role': user.role
        }, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid verification token'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([ResendVerificationThrottle])
def resend_verification_email_view(request):
    """
    Resend verification email to authenticated user.
    Rate limited to 5 requests per hour per user.
    
    POST /api/auth/resend-verification/
    """
    user = request.user
    
    # Check if OAuth user
    if user.oauth_provider:
        return Response(
            {'error': 'OAuth users are automatically verified'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if already verified
    if user.email_verified:
        return Response(
            {'error': 'Email is already verified'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Send verification email
    success = send_verification_email(user)
    
    if success:
        return Response({
            'message': 'Verification email sent successfully. Please check your inbox.'
        }, status=status.HTTP_200_OK)
    else:
        return Response(
            {'error': 'Failed to send verification email. Please try again later.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
