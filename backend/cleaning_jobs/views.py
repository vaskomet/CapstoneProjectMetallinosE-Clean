"""
CleaningJob API views for Django REST Framework.
Supports CRUD operations with role-based permissions, status management, and dynamic pricing.
"""

from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from django.db import transaction

from .models import CleaningJob
from .serializers import CleaningJobSerializer, CleaningJobCreateSerializer


class CleaningJobListCreateView(generics.ListCreateAPIView):
    """
    List and create CleaningJob instances with role-based filtering.
    
    - GET: Lists jobs based on user role (clients see their own, admins see all)
    - POST: Creates new job with initial pending status and pricing calculation
    
    IsAuthenticated ensures JWT token validation per CompatibilitySpecifics.rtf
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter queryset based on user role.
        - Clients: see their own jobs
        - Cleaners: see available jobs (pending, no cleaner) + their assigned jobs
        - Admins: see all jobs
        """
        user = self.request.user
        
        # Admin users can see all jobs for management purposes
        if hasattr(user, 'role') and user.role == 'admin':
            return CleaningJob.objects.all().select_related(
                'client', 'cleaner', 'property'
            ).prefetch_related('services_requested')
        
        # Cleaners can see available jobs (pending, no cleaner assigned) + their assigned jobs
        elif hasattr(user, 'role') and user.role == 'cleaner':
            from django.db.models import Q
            return CleaningJob.objects.filter(
                Q(cleaner=user) |  # Their assigned jobs
                Q(cleaner__isnull=True, status='pending')  # Available jobs
            ).select_related(
                'client', 'cleaner', 'property'
            ).prefetch_related('services_requested')
        
        # Clients can only see their own jobs
        else:
            return CleaningJob.objects.filter(
                client=user
            ).select_related(
                'client', 'cleaner', 'property'
            ).prefetch_related('services_requested')
    
    def get_serializer_class(self):
        """
        Use different serializers for create vs list operations.
        """
        if self.request.method == 'POST':
            return CleaningJobCreateSerializer
        return CleaningJobSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Create new CleaningJob with initial state and pricing.
        
        Clients can list/create their own jobs, admins can view all;
        post sets initial pending status and calculates pricing.
        """
        # Ensure only clients can create jobs
        if hasattr(request.user, 'role') and request.user.role not in ['client', 'admin']:
            raise PermissionDenied("Only clients can create cleaning jobs.")
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Create job with initial state
        with transaction.atomic():
            cleaning_job = serializer.save()
            
            # Log job creation for audit purposes
            print(f"Job #{cleaning_job.id} created by {request.user.email} "
                  f"for {cleaning_job.scheduled_date} at {cleaning_job.start_time}")
        
        # Return created job with full details
        response_serializer = CleaningJobSerializer(cleaning_job)
        return Response(
            response_serializer.data, 
            status=status.HTTP_201_CREATED
        )


class CleaningJobDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, and delete CleaningJob instances with ownership checks.
    
    Ownership check ensures only clients/admins can modify/delete jobs;
    status transitions managed here with validation.
    """
    queryset = CleaningJob.objects.all().select_related(
        'client', 'cleaner', 'property'
    ).prefetch_related('services_requested')
    serializer_class = CleaningJobSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """
        Get object with ownership validation.
        """
        obj = super().get_object()
        user = self.request.user
        
        # Check ownership or admin privileges
        if (obj.client != user and 
            not (hasattr(user, 'role') and user.role == 'admin')):
            raise PermissionDenied("You can only access your own jobs.")
        
        return obj
    
    def update(self, request, *args, **kwargs):
        """
        Update CleaningJob with status transition validation.
        
        Status transition from pending to confirmed requires client/admin;
        other transitions managed by cleaner in separate view.
        """
        instance = self.get_object()
        user = request.user
        
        # Validate permission to update
        if (instance.client != user and 
            not (hasattr(user, 'role') and user.role == 'admin')):
            raise PermissionDenied("You can only update your own jobs.")
        
        # Validate status transitions
        new_status = request.data.get('status')
        if new_status and new_status != instance.status:
            self._validate_status_transition(instance, new_status, user)
        
        # Update with pricing recalculation if services change
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            updated_instance = serializer.save()
            
            # Recalculate pricing if services changed
            if 'services_requested' in request.data:
                services = updated_instance.services_requested.all()
                total_cost = sum(service.base_price for service in services)
                updated_instance.total_cost = total_cost
                updated_instance.save()
        
        return Response(CleaningJobSerializer(updated_instance).data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete CleaningJob with ownership validation.
        Only clients or admins can delete jobs.
        """
        instance = self.get_object()
        user = request.user
        
        # Allow deletion only by client or admin
        if (instance.client != user and 
            not (hasattr(user, 'role') and user.role == 'admin')):
            raise PermissionDenied("You can only delete your own jobs.")
        
        # Prevent deletion of in-progress or completed jobs
        if instance.status in ['in_progress', 'completed']:
            raise ValidationError("Cannot delete jobs that are in progress or completed.")
        
        return super().destroy(request, *args, **kwargs)
    
    def _validate_status_transition(self, instance, new_status, user):
        """
        Validate status transitions based on current state and user role.
        """
        current_status = instance.status
        valid_transitions = {
            'pending': ['confirmed', 'cancelled'],
            'confirmed': ['in_progress', 'cancelled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [],  # No transitions from completed
            'cancelled': []   # No transitions from cancelled
        }
        
        if new_status not in valid_transitions.get(current_status, []):
            raise ValidationError(
                f"Invalid status transition from {current_status} to {new_status}"
            )


class CleaningJobStatusUpdateView(generics.UpdateAPIView):
    """
    Specialized view for cleaner status updates with real-time capabilities.
    
    Cleaner updates status with eco-metrics, prepares for Django Channels integration.
    Only cleaners assigned to the job can update status during service execution.
    """
    queryset = CleaningJob.objects.all()
    serializer_class = CleaningJobSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """
        Get object with cleaner authorization check.
        """
        obj = super().get_object()
        user = self.request.user
        
        # Only assigned cleaner can update status
        if obj.cleaner != user:
            raise PermissionDenied("Only the assigned cleaner can update job status.")
        
        return obj
    
    def update(self, request, *args, **kwargs):
        """
        Update job status with cleaner-specific validations.
        
        Supports status transitions during service execution:
        - confirmed -> in_progress (when cleaner starts)
        - in_progress -> completed (when cleaner finishes)
        """
        instance = self.get_object()
        new_status = request.data.get('status')
        
        if not new_status:
            raise ValidationError("Status field is required.")
        
        # Validate cleaner-specific status transitions
        self._validate_cleaner_status_transition(instance, new_status)
        
        # Update status with timestamp tracking
        with transaction.atomic():
            instance.status = new_status
            
            # Add completion timestamp for completed jobs
            if new_status == 'completed':
                instance.end_time = timezone.now().time()
                
                # Update eco-impact metrics for completed jobs
                # This will be enhanced with actual calculations in future iterations
                if not instance.eco_impact_metrics:
                    instance.eco_impact_metrics = {
                        'water_saved_liters': 25.0,
                        'chemicals_avoided_kg': 0.5,
                        'co2_reduced_kg': 1.2,
                        'completion_timestamp': timezone.now().isoformat()
                    }
            
            instance.save()
        
        # Log status update for real-time notifications
        print(f"Job #{instance.id} status updated to {new_status} by cleaner {request.user.email}")
        
        return Response(CleaningJobSerializer(instance).data)
    
    def _validate_cleaner_status_transition(self, instance, new_status):
        """
        Validate status transitions allowed for cleaners.
        """
        current_status = instance.status
        cleaner_transitions = {
            'confirmed': ['in_progress'],
            'in_progress': ['completed']
        }
        
        valid_next_statuses = cleaner_transitions.get(current_status, [])
        if new_status not in valid_next_statuses:
            raise ValidationError(
                f"Cleaners cannot transition from {current_status} to {new_status}"
            )


class CleaningJobClaimView(generics.UpdateAPIView):
    """
    Allow cleaners to claim available jobs.
    
    PATCH /api/jobs/{id}/claim/
    - Only cleaners can claim jobs
    - Job must be in 'pending' status with no assigned cleaner
    - Sets cleaner to authenticated user and status to 'confirmed'
    """
    permission_classes = [IsAuthenticated]
    serializer_class = CleaningJobSerializer
    
    def get_queryset(self):
        return CleaningJob.objects.filter(
            status='pending',
            cleaner__isnull=True
        )
    
    def update(self, request, *args, **kwargs):
        # Ensure only cleaners can claim jobs
        if not hasattr(request.user, 'role') or request.user.role != 'cleaner':
            raise PermissionDenied("Only cleaners can claim jobs.")
        
        job = self.get_object()
        
        # Double-check job is still available
        if job.cleaner is not None:
            return Response(
                {'error': 'Job has already been claimed by another cleaner'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if job.status != 'pending':
            return Response(
                {'error': 'Job is not available for claiming'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Claim the job
        job.cleaner = request.user
        job.status = 'confirmed'
        job.save()
        
        serializer = self.get_serializer(job)
        return Response(serializer.data, status=status.HTTP_200_OK)


# Testing with Postman examples:
# 
# 1. Create Job (POST /api/jobs/):
#    Headers: Authorization: Bearer <jwt_token>
#    Body: {
#        "property": 1,
#        "scheduled_date": "2025-10-02",
#        "start_time": "09:00:00",
#        "services_requested": [1, 2],
#        "checklist": ["kitchen", "bathroom"],
#        "notes": "Use eco-friendly products"
#    }
#
# 2. Update Job Status (PATCH /api/jobs/{id}/status/):
#    Headers: Authorization: Bearer <cleaner_jwt_token>
#    Body: {
#        "status": "in_progress"
#    }
#
# 3. List Jobs (GET /api/jobs/):
#    Headers: Authorization: Bearer <jwt_token>
#    Returns filtered jobs based on user role
