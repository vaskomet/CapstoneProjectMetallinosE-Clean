from rest_framework import status, generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .serializers import UserRegistrationSerializer, UserSerializer

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom token obtain pair serializer to include user data in the response.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims
        token['email'] = user.email
        token['role'] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        # Add user data to the response
        data['user'] = {
            'email': self.user.email,
            'role': self.user.role,
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
            # Return a success response with the serialized user data (excluding password)
            return Response({
                "user": UserSerializer(user, context=self.get_serializer_context()).data,
                "message": "User created successfully."
            }, status=status.HTTP_201_CREATED)
        # Return 400 for invalid registration data
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

