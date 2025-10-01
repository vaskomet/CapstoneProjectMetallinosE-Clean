"""
URL configuration for CleaningJob API endpoints.
Defines routing for CRUD operations and status updates with JWT authentication.
"""

from django.urls import path
from . import views

# API endpoints for CleaningJob management
urlpatterns = [
    # List all jobs for authenticated user or create new job
    # GET: Returns filtered jobs based on user role (clients see own jobs, admins see all)
    # POST: Creates new job with initial 'pending' status and client assignment
    # Requires: JWT authentication, role validation (clients/admins only)
    path('', views.CleaningJobListCreateView.as_view(), name='job-list'),
    
    # Retrieve, update, or delete specific job by primary key
    # GET: Returns detailed job information with nested property and service data
    # PATCH: Updates job details with ownership validation and pricing recalculation
    # DELETE: Removes job with ownership check (prevents deletion of active jobs)
    # pk parameter enables retrieval/update/deletion for specific jobs
    # Requires: JWT authentication, ownership validation (client/admin access only)
    path('<int:pk>/', views.CleaningJobDetailView.as_view(), name='job-detail'),
    
    # Status update endpoint for cleaner real-time updates
    # PATCH: Allows assigned cleaner to update job status during service execution
    # Supports transitions: confirmed->in_progress->completed
    # Automatically adds eco-impact metrics and completion timestamps
    # pk parameter enables status updates for specific jobs
    # Requires: JWT authentication, cleaner assignment validation
    path('<int:pk>/status/', views.CleaningJobStatusUpdateView.as_view(), name='job-status-update'),
]

# Testing endpoints with Postman examples:
#
# 1. Create Job (POST /api/jobs/):
#    URL: http://localhost:8000/api/jobs/
#    Headers: Authorization: Bearer <client_jwt_token>
#    Body: {
#        "property": 1,
#        "scheduled_date": "2025-10-02",
#        "start_time": "09:00:00",
#        "services_requested": [1, 2],
#        "checklist": ["kitchen", "bathroom"],
#        "notes": "Use eco-friendly products"
#    }
#
# 2. List Jobs (GET /api/jobs/):
#    URL: http://localhost:8000/api/jobs/
#    Headers: Authorization: Bearer <jwt_token>
#    Returns: Filtered jobs based on user role
#
# 3. Get Job Details (GET /api/jobs/1/):
#    URL: http://localhost:8000/api/jobs/1/
#    Headers: Authorization: Bearer <jwt_token>
#    Returns: Complete job details with property and service information
#
# 4. Update Job Status (PATCH /api/jobs/1/status/):
#    URL: http://localhost:8000/api/jobs/1/status/
#    Headers: Authorization: Bearer <cleaner_jwt_token>
#    Body: {
#        "status": "in_progress"
#    }
#    Note: Only assigned cleaner can update status
#
# 5. Update Job Details (PATCH /api/jobs/1/):
#    URL: http://localhost:8000/api/jobs/1/
#    Headers: Authorization: Bearer <client_jwt_token>
#    Body: {
#        "checklist": ["kitchen", "bathroom", "living room"],
#        "notes": "Added living room cleaning"
#    }
#    Note: Automatically recalculates pricing if services change