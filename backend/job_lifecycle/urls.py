"""
Job Lifecycle URL Configuration

Defines URL patterns for the enhanced job workflow management.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    JobPhotoViewSet, JobWorkflowView,
    JobLifecycleEventViewSet, JobStatusCheckView
)

# Create router for ViewSets
router = DefaultRouter()
router.register(r'photos', JobPhotoViewSet, basename='job-photos')
# Notifications endpoint REMOVED - use /api/notifications/ instead (consolidated)
router.register(r'events', JobLifecycleEventViewSet, basename='job-events')

urlpatterns = [
    # Job workflow actions (confirm, start, finish)
    path('jobs/<int:job_id>/workflow/', JobWorkflowView.as_view(), name='job-workflow'),
    
    # Job status and timing check
    path('jobs/<int:job_id>/status/', JobStatusCheckView.as_view(), name='job-status-check'),
    
    # Include router URLs
    path('', include(router.urls)),
]