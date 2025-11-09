"""
URL configuration for recommendations API endpoints.
"""
from django.urls import path
from . import views

app_name = 'recommendations'

urlpatterns = [
    # ML-powered cleaner recommendations
    path('cleaners-for-location/', views.recommend_cleaners_for_location, name='cleaners-for-location'),
    
    # Neural Network recommendations
    path('nn/', views.get_nn_recommendations, name='nn-recommendations'),
    path('nn/model-info/', views.get_nn_model_info, name='nn-model-info'),
    
    # ML service health check
    path('ml-status/', views.ml_service_status, name='ml-status'),
]
