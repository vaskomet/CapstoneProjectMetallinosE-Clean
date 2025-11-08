"""
URL configuration for recommendations API endpoints.
"""
from django.urls import path
from . import views

app_name = 'recommendations'

urlpatterns = [
    # ML-powered cleaner recommendations
    path('cleaners-for-location/', views.recommend_cleaners_for_location, name='cleaners-for-location'),
    
    # ML service health check
    path('ml-status/', views.ml_service_status, name='ml-status'),
]
