"""
CleaningJob and JobBid API views for Django REST Framework.
Supports CRUD operations with role-based permissions, bidding system, and job lifecycle management.
"""

from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.decorators import action
from django.utils import timezone
from django.db import transaction

from .models import CleaningJob, JobBid
from .serializers import (
    CleaningJobSerializer, 
    CleaningJobCreateSerializer,
    JobBidSerializer,
    JobBidCreateSerializer
)


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
        Filter queryset based on user role for bidding system.
        - Clients: see their own jobs
        - Cleaners: see available jobs (open_for_bids) + their assigned jobs
        - Admins: see all jobs
        """
        user = self.request.user
        
        # Admin users can see all jobs for management purposes
        if hasattr(user, 'role') and user.role == 'admin':
            return CleaningJob.objects.all().select_related(
                'client', 'cleaner', 'property', 'accepted_bid'
            ).prefetch_related('bids__cleaner')
        
        # Cleaners can see available jobs (open_for_bids) within their service areas + their assigned jobs
        elif hasattr(user, 'role') and user.role == 'cleaner':
            from django.db.models import Q
            from users.models import ServiceArea
            import math
            
            # Check for query parameters for filtering
            service_area_id = self.request.query_params.get('service_area_id')
            distance_km = self.request.query_params.get('distance_km')
            
            # Get cleaner's service areas
            if service_area_id:
                # Filter by specific service area
                try:
                    service_areas = ServiceArea.objects.filter(
                        id=service_area_id, 
                        cleaner=user, 
                        is_active=True
                    )
                except (ValueError, ServiceArea.DoesNotExist):
                    service_areas = ServiceArea.objects.none()
            else:
                # Get all active service areas
                service_areas = ServiceArea.objects.filter(cleaner=user, is_active=True)
            
            # Handle distance-based filtering
            if distance_km:
                try:
                    distance_km_value = float(distance_km)
                    # Get cleaner's current location (we'll use the first service area center as fallback)
                    first_area = service_areas.filter(
                        area_type='radius',
                        center_latitude__isnull=False,
                        center_longitude__isnull=False
                    ).first()
                    
                    if first_area:
                        # Create a single large radius filter based on requested distance
                        from django.db.models import F
                        
                        # Simple distance filtering - in production, use PostGIS
                        # Convert Decimal to float for math operations
                        center_lat_float = float(first_area.center_latitude)
                        center_lng_float = float(first_area.center_longitude)
                        
                        lat_range = distance_km_value / 111.0  # Rough km to degrees conversion
                        lng_range = distance_km_value / (111.0 * math.cos(math.radians(center_lat_float)))
                        
                        location_filter = Q(
                            property__latitude__gte=center_lat_float - lat_range,
                            property__latitude__lte=center_lat_float + lat_range,
                            property__longitude__gte=center_lng_float - lng_range,
                            property__longitude__lte=center_lng_float + lng_range,
                            property__latitude__isnull=False,
                            property__longitude__isnull=False
                        )
                        
                        return CleaningJob.objects.filter(
                            Q(cleaner=user) |  # Their assigned jobs
                            (Q(status='open_for_bids') & location_filter)  # Available jobs within distance
                        ).select_related(
                            'client', 'cleaner', 'property', 'accepted_bid'
                        ).prefetch_related('bids__cleaner')
                except (ValueError, TypeError):
                    pass  # Fall back to normal service area filtering
            
            if service_areas.exists():
                # Filter jobs within service areas
                location_filter = Q()
                for area in service_areas:
                    if area.area_type == 'city' and area.city:
                        location_filter |= Q(property__city__icontains=area.city)
                    elif area.area_type == 'radius' and all([
                        area.center_latitude, area.center_longitude, area.radius_miles
                    ]):
                        # For radius-based filtering, we'll use a simple approach
                        # In production, you'd want to use PostGIS for proper distance calculations
                        # Convert Decimal to float for math operations
                        radius_miles_float = float(area.radius_miles)
                        center_lat_float = float(area.center_latitude)
                        center_lng_float = float(area.center_longitude)
                        
                        lat_range = radius_miles_float * 1.609 / 111.0  # Convert miles to km to degrees
                        lng_range = lat_range / math.cos(math.radians(center_lat_float))
                        
                        location_filter |= Q(
                            property__latitude__gte=center_lat_float - lat_range,
                            property__latitude__lte=center_lat_float + lat_range,
                            property__longitude__gte=center_lng_float - lng_range,
                            property__longitude__lte=center_lng_float + lng_range,
                            property__latitude__isnull=False,
                            property__longitude__isnull=False
                        )
                    elif area.area_type == 'postal_codes' and area.postal_codes:
                        location_filter |= Q(property__postal_code__in=area.postal_codes)
                
                return CleaningJob.objects.filter(
                    Q(cleaner=user) |  # Their assigned jobs
                    (Q(status='open_for_bids') & location_filter)  # Available jobs in their areas
                ).select_related(
                    'client', 'cleaner', 'property', 'accepted_bid'
                ).prefetch_related('bids__cleaner')
            else:
                # If cleaner has no service areas, show only their assigned jobs
                return CleaningJob.objects.filter(
                    cleaner=user
                ).select_related(
                    'client', 'cleaner', 'property', 'accepted_bid'
                ).prefetch_related('bids__cleaner')
        
        # Clients can only see their own jobs
        else:
            return CleaningJob.objects.filter(
                client=user
            ).select_related(
                'client', 'cleaner', 'property', 'accepted_bid'
            ).prefetch_related('bids__cleaner')
    
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
        
        # Create job with initial state for bidding
        with transaction.atomic():
            cleaning_job = serializer.save()
            
            # Log job creation for audit purposes
            print(f"Job #{cleaning_job.id} created by {request.user.email} "
                  f"for {cleaning_job.scheduled_date} - Budget: ${cleaning_job.client_budget}")
        
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
        'client', 'cleaner', 'property', 'accepted_bid'
    ).prefetch_related('bids__cleaner')
    serializer_class = CleaningJobSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """
        Get object with ownership validation.
        """
        obj = super().get_object()
        user = self.request.user
        
        # Check ownership or admin privileges
        # Allow access for: job client, assigned cleaner, or admin
        if (obj.client != user and 
            obj.cleaner != user and
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
        # Allow updates by: job client, assigned cleaner, or admin
        if (instance.client != user and 
            instance.cleaner != user and
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
            
            # Note: Service-based pricing was replaced with bidding system
            # Pricing is now determined by accepted bids rather than service selection
        
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
        
        # Define valid transitions based on the actual STATUS_CHOICES from the model
        valid_transitions = {
            'open_for_bids': ['bid_accepted', 'cancelled'],
            'bid_accepted': ['confirmed', 'cancelled'],
            'confirmed': ['ready_to_start', 'cancelled'],
            'ready_to_start': ['in_progress', 'cancelled'],
            'in_progress': ['awaiting_review', 'cancelled'],
            'awaiting_review': ['completed', 'cancelled'],
            'completed': [],  # No transitions from completed
            'cancelled': []   # No transitions from cancelled
        }
        
        if new_status not in valid_transitions.get(current_status, []):
            raise ValidationError(
                f"Invalid status transition from {current_status} to {new_status}"
            )
        
        # Role-based transition restrictions
        if hasattr(user, 'role'):
            if user.role == 'cleaner' and instance.cleaner == user:
                # Cleaners can only make specific transitions
                cleaner_allowed_transitions = {
                    'confirmed': ['ready_to_start'],
                    'ready_to_start': ['in_progress'],
                    'in_progress': ['awaiting_review']
                }
                
                if current_status in cleaner_allowed_transitions:
                    if new_status not in cleaner_allowed_transitions[current_status]:
                        raise ValidationError(
                            f"Cleaners cannot transition from {current_status} to {new_status}"
                        )
            elif user.role == 'client' and instance.client == user:
                # Clients can make certain transitions
                client_allowed_transitions = {
                    'awaiting_review': ['completed'],
                    'open_for_bids': ['cancelled'],
                    'bid_accepted': ['cancelled'],
                    'confirmed': ['cancelled']
                }
                
                if current_status in client_allowed_transitions:
                    if new_status not in client_allowed_transitions[current_status]:
                        raise ValidationError(
                            f"Clients cannot transition from {current_status} to {new_status}"
                        )
            # Admins can make any valid transition


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


class JobBidListCreateView(generics.ListCreateAPIView):
    """
    List and create JobBid instances.
    
    - GET: Lists bids (cleaners see their own, clients see bids on their jobs)
    - POST: Creates new bid (only cleaners can create bids)
    """
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Filter bids based on user role.
        """
        user = self.request.user
        
        if hasattr(user, 'role') and user.role == 'admin':
            return JobBid.objects.all().select_related('job', 'cleaner')
        elif hasattr(user, 'role') and user.role == 'cleaner':
            return JobBid.objects.filter(cleaner=user).select_related('job', 'cleaner')
        else:  # client
            return JobBid.objects.filter(job__client=user).select_related('job', 'cleaner')
    
    def get_serializer_class(self):
        """
        Use different serializers for create vs list operations.
        """
        if self.request.method == 'POST':
            return JobBidCreateSerializer
        return JobBidSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Create new bid (only cleaners can bid).
        """
        if not (hasattr(request.user, 'role') and request.user.role == 'cleaner'):
            raise PermissionDenied("Only cleaners can submit bids.")
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check if job is open for bids
        job = serializer.validated_data['job']
        if job.status != 'open_for_bids':
            raise ValidationError("This job is not accepting bids.")
        
        # Check if cleaner already has a bid on this job
        if JobBid.objects.filter(job=job, cleaner=request.user).exists():
            raise ValidationError("You have already submitted a bid for this job.")
        
        bid = serializer.save()
        
        # Return created bid with full details
        response_serializer = JobBidSerializer(bid)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class JobBidDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, and delete JobBid instances.
    """
    queryset = JobBid.objects.all().select_related('job', 'cleaner')
    serializer_class = JobBidSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        """
        Get bid with ownership validation.
        """
        obj = super().get_object()
        user = self.request.user
        
        # Check ownership or if client owns the job
        if (obj.cleaner != user and 
            obj.job.client != user and
            not (hasattr(user, 'role') and user.role == 'admin')):
            raise PermissionDenied("You can only access your own bids or bids on your jobs.")
        
        return obj


class AcceptBidView(generics.UpdateAPIView):
    """
    Accept a bid on a cleaning job (clients only).
    """
    queryset = JobBid.objects.all()
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, *args, **kwargs):
        """
        Accept a bid and assign the job to the cleaner.
        """
        bid = self.get_object()
        
        # Only job owner can accept bids
        if bid.job.client != request.user:
            raise PermissionDenied("Only the job owner can accept bids.")
        
        # Check if job is still open for bids
        if bid.job.status != 'open_for_bids':
            raise ValidationError("This job is no longer accepting bids.")
        
        with transaction.atomic():
            # Update bid status
            bid.status = 'accepted'
            bid.save()
            
            # Update job
            job = bid.job
            job.cleaner = bid.cleaner
            job.accepted_bid = bid
            job.final_price = bid.bid_amount
            job.status = 'confirmed'
            job.save()
            
            # Reject all other bids
            JobBid.objects.filter(job=job).exclude(id=bid.id).update(status='rejected')
        
        return Response({
            'message': 'Bid accepted successfully',
            'job_id': job.id,
            'cleaner': bid.cleaner.username,
            'final_price': str(bid.bid_amount)
        }, status=status.HTTP_200_OK)
