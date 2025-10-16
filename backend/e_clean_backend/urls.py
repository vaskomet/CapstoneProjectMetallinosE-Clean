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
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API endpoints for user authentication
    path('api/auth/', include('users.urls')),
    
    # Endpoint for refreshing JWT access tokens
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

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
    path('', include('chat.urls')),
    
    # Real-time notifications
    # Endpoints: notifications, preferences, bulk sending
    path('', include('notifications.urls')),

    # Placeholder for future app URLs (payments, reviews)
    # path('api/payments/', include('payments.urls')),
    # path('api/reviews/', include('reviews.urls')),
]

