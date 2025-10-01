from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Endpoint for new user registration.
    # Accepts POST requests with {'email': '...', 'password': '...', 'role': '...'}.
    path('register/', views.RegisterView.as_view(), name='register'),

    # Endpoint for user login.
    # Accepts POST requests with {'email': '...', 'password': '...'} and returns JWT tokens.
    path('login/', views.LoginView.as_view(), name='login'),

    # Endpoint for JWT token refresh
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Endpoint for user profile management.
    # GET: Returns current user profile data
    # PATCH: Updates user profile (requires authentication)
    path('profile/', views.ProfileView.as_view(), name='profile'),

    # Endpoint for changing user password.
    # POST: Changes user password with current password validation
    path('change-password/', views.PasswordChangeView.as_view(), name='change-password'),

    # Future endpoints for user profile management can be added here.
    # e.g., path('profile/', views.ProfileView.as_view(), name='profile'),
]
