"""
URL configuration for recommendations API endpoints.
"""
from django.urls import path
from . import views

app_name = 'recommendations'

urlpatterns = [
    # Algorithmic cleaner recommendations
    path('cleaners-for-location/', views.recommend_cleaners_for_location, name='cleaners-for-location'),
]
