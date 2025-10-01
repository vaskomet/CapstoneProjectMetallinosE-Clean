from django.urls import path
from . import views

urlpatterns = [
    # Endpoint for new user registration.
    # Accepts POST requests with {'email': '...', 'password': '...', 'role': '...'}.
    path('register/', views.RegisterView.as_view(), name='register'),

    # Endpoint for user login.
    # Accepts POST requests with {'email': '...', 'password': '...'} and returns JWT tokens.
    path('login/', views.LoginView.as_view(), name='login'),

    # Future endpoints for user profile management can be added here.
    # e.g., path('profile/', views.ProfileView.as_view(), name='profile'),
]
