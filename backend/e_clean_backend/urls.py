"""
URL configuration for e_clean_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from users.profile_views import CleanerPublicProfileView, ClientPublicProfileView
from users.oauth_views import GoogleOAuthRedirectView, OAuthCallbackView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API endpoints for user authentication (EXISTING - JWT-based)
    path('api/auth/', include('users.urls')),
    
    # Endpoint for refreshing JWT access tokens
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Custom Google OAuth redirect (auto-redirects to Google without intermediate page)
    path('auth/google/', GoogleOAuthRedirectView.as_view(), name='google_oauth_redirect'),
    
    # OAuth callback - generates JWT tokens and redirects to frontend
    path('auth/oauth-callback/', OAuthCallbackView.as_view(), name='oauth_callback'),
    
    # Google OAuth endpoints from django-allauth
    # ONLY these URLs are used (adapter prevents signup forms):
    # - /accounts/google/login/ - Initiates Google OAuth flow
    # - /accounts/google/login/callback/ - Handles Google OAuth callback
    # All other allauth URLs (signup, password reset, etc.) are disabled via CustomAccountAdapter
    path('accounts/', include('allauth.urls')),

    # Nests property and service type endpoints under /api/properties/ for modularity
    path('api/properties/', include('properties.urls')),

    # Nests job-related endpoints under /api/jobs/ for modularity, alongside /api/auth/ and /api/properties/
    # Supports CleaningJob CRUD operations with JWT authentication and role-based permissions
    # Endpoints: list/create jobs, job details management, cleaner status updates
    path('api/jobs/', include('cleaning_jobs.urls')),
    
    # Enhanced job lifecycle management with photos, notifications, and workflow tracking
    # Endpoints: photo uploads, workflow actions (confirm/start/finish), notifications
    path('api/lifecycle/', include('job_lifecycle.urls')),
    
    # Real-time chat functionality
    # Endpoints: chat rooms, messages, participants
    path('api/chat/', include('chat.urls')),
    
    # Real-time notifications
    # Endpoints: notifications, preferences, bulk sending
    path('', include('notifications.urls')),
    
    # Payment processing with Stripe
    # Endpoints: payment intents, confirmations, Stripe Connect, refunds
    path('api/payments/', include('payments.urls')),
    
    # Review and rating system
    # Endpoints: reviews, responses, statistics, flags, moderation
    path('api/reviews/', include('reviews.urls')),
    
    # ML-powered recommendation system
    # Endpoints: cleaner recommendations, job recommendations, ML service status
    path('api/recommendations/', include('recommendations.urls')),
    
    # Public user profiles (for viewing cleaner profiles and reviews)
    path('api/profile/cleaner/<int:user_id>/', CleanerPublicProfileView.as_view(), name='cleaner-public-profile'),
    path('api/profile/client/<int:user_id>/', ClientPublicProfileView.as_view(), name='client-public-profile'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

