"""
CleaningJob and JobBid API views for Django REST Framework.
Supports CRUD operations with role-based permissions, bidding system, and job lifecycle management.
"""

from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.decorators import action, api_view, permission_classes
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
        
        Query Parameters:
        - status: Filter by job status (e.g., 'completed', 'in_progress', 'open_for_bids')
        """
        user = self.request.user
        
        # Admin users can see all jobs for management purposes
        if hasattr(user, 'role') and user.role == 'admin':
            queryset = CleaningJob.objects.all().select_related(
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
                
                queryset = CleaningJob.objects.filter(
                    Q(cleaner=user) |  # Their assigned jobs
                    (Q(status='open_for_bids') & location_filter)  # Available jobs in their areas
                ).select_related(
                    'client', 'cleaner', 'property', 'accepted_bid'
                ).prefetch_related('bids__cleaner')
            else:
                # If cleaner has no service areas, show only their assigned jobs
                queryset = CleaningJob.objects.filter(
                    cleaner=user
                ).select_related(
                    'client', 'cleaner', 'property', 'accepted_bid'
                ).prefetch_related('bids__cleaner')
        
        # Clients can only see their own jobs
        else:
            queryset = CleaningJob.objects.filter(
                client=user
            ).select_related(
                'client', 'cleaner', 'property', 'accepted_bid'
            ).prefetch_related('bids__cleaner')
        
        # Apply status filter if provided in query parameters
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # ========== SEARCH FUNCTIONALITY (PostgreSQL Full-Text Search) ==========
        # Advanced search with stemming, relevance ranking, and multi-language support
        search_query = self.request.query_params.get('search')
        if search_query:
            from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
            from django.db.models import Q, F
            
            # Check if search query is a postal code
            # Greek format: "XXX XX" (6 chars with space) or "XXXXX" (5 digits)
            # Remove spaces and check if it's 5 digits
            postal_normalized = search_query.strip().replace(' ', '')
            is_postal_code = postal_normalized.isdigit() and len(postal_normalized) == 5
            
            if is_postal_code:
                # Postal code search - exact match (handles both formats)
                # Match against normalized postal codes (without spaces)
                queryset = queryset.filter(
                    Q(property__postal_code=search_query.strip()) |  # Exact with space
                    Q(property__postal_code=postal_normalized) |      # Without space
                    Q(property__postal_code__icontains=postal_normalized)  # Partial match for autocomplete
                )
            else:
                # Text search - use Full-Text Search with bilingual support
                from django.contrib.postgres.search import SearchHeadline
                
                # Create search vectors for different fields with weights
                # A = highest weight (job description), B = high (address fields), C = medium (notes)
                search_vector = (
                    SearchVector('services_description', weight='A', config='greek') +
                    SearchVector('services_description', weight='A', config='english') +
                    SearchVector('property__address_line1', weight='B', config='greek') +
                    SearchVector('property__address_line1', weight='B', config='english') +
                    SearchVector('property__city', weight='B', config='greek') +
                    SearchVector('property__city', weight='B', config='english') +
                    SearchVector('notes', weight='C', config='greek') +
                    SearchVector('notes', weight='C', config='english')
                )
                
                # Create search query (supports both Greek and English)
                search_query_greek = SearchQuery(search_query, config='greek')
                search_query_english = SearchQuery(search_query, config='english')
                
                # Combine searches with OR (find in either language)
                combined_query = search_query_greek | search_query_english
                
                # Calculate relevance rank
                rank = SearchRank(search_vector, combined_query)
                
                # Add search result highlighting using ts_headline
                # This wraps matched terms in <b></b> tags for frontend highlighting
                queryset = queryset.annotate(
                    search=search_vector,
                    rank=rank,
                    highlighted_description=SearchHeadline(
                        'services_description',
                        combined_query,
                        config='english',
                        start_sel='<mark>',
                        stop_sel='</mark>',
                        max_words=50,
                        min_words=15,
                    ),
                    highlighted_address=SearchHeadline(
                        'property__address_line1',
                        combined_query,
                        config='english',
                        start_sel='<mark>',
                        stop_sel='</mark>',
                        max_words=20,
                        min_words=5,
                    ),
                    highlighted_city=SearchHeadline(
                        'property__city',
                        combined_query,
                        config='english',
                        start_sel='<mark>',
                        stop_sel='</mark>',
                    ),
                    highlighted_notes=SearchHeadline(
                        'notes',
                        combined_query,
                        config='english',
                        start_sel='<mark>',
                        stop_sel='</mark>',
                        max_words=30,
                        min_words=10,
                    ),
                ).filter(search=combined_query).order_by('-rank')
        
        # ========== PRICE RANGE FILTERING ==========
        # Filter by minimum and/or maximum client budget
        price_min = self.request.query_params.get('price_min')
        price_max = self.request.query_params.get('price_max')
        if price_min:
            try:
                queryset = queryset.filter(client_budget__gte=float(price_min))
            except (ValueError, TypeError):
                pass  # Invalid price_min, ignore filter
        if price_max:
            try:
                queryset = queryset.filter(client_budget__lte=float(price_max))
            except (ValueError, TypeError):
                pass  # Invalid price_max, ignore filter
        
        # ========== DATE RANGE FILTERING ==========
        # Filter by scheduled date range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(scheduled_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(scheduled_date__lte=date_to)
        
        return queryset
    
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
        
        Requires email verification for non-OAuth users.
        """
        # Ensure only clients can create jobs
        if hasattr(request.user, 'role') and request.user.role not in ['client', 'admin']:
            raise PermissionDenied("Only clients can create cleaning jobs.")
        
        # Check email verification (mandatory for job posting)
        if not request.user.can_post_jobs():
            return Response(
                {
                    'error': 'Email verification required',
                    'message': 'You must verify your email address before posting jobs. Check your inbox for the verification email.',
                    'email_verified': request.user.email_verified
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
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
        Requires email verification for non-OAuth users.
        """
        if not (hasattr(request.user, 'role') and request.user.role == 'cleaner'):
            raise PermissionDenied("Only cleaners can submit bids.")
        
        # Check email verification (mandatory for bidding)
        if not request.user.can_bid_on_jobs():
            return Response(
                {
                    'error': 'Email verification required',
                    'message': 'You must verify your email address before bidding on jobs. Check your inbox for the verification email.',
                    'email_verified': request.user.email_verified
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
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
            job.status = 'bid_accepted'  # Changed from 'confirmed' to 'bid_accepted'
            job.save()
            
            # Reject all other bids
            JobBid.objects.filter(job=job).exclude(id=bid.id).update(status='rejected')
        
        return Response({
            'message': 'Bid accepted successfully',
            'job_id': job.id,
            'cleaner': bid.cleaner.username,
            'final_price': str(bid.bid_amount)
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def job_statistics(request):
    """
    Get job statistics based on user role.
    
    Returns:
        - total: Total number of jobs visible to user
        - open_for_bids: Jobs currently accepting bids
        - pending: Jobs with accepted bid or confirmed (awaiting start)
        - in_progress: Jobs currently being worked on
        - completed: Finished jobs
    """
    user = request.user
    
    # Role-based job filtering
    if hasattr(user, 'role') and user.role == 'admin':
        jobs = CleaningJob.objects.all()
    elif hasattr(user, 'role') and user.role == 'client':
        jobs = CleaningJob.objects.filter(client=user)
    elif hasattr(user, 'role') and user.role == 'cleaner':
        from django.db.models import Q
        jobs = CleaningJob.objects.filter(
            Q(status='open_for_bids') | Q(cleaner=user)
        )
    else:
        # Fallback for users without role
        jobs = CleaningJob.objects.none()
    
    # Calculate statistics
    stats = {
        'total': jobs.count(),
        'open_for_bids': jobs.filter(status='open_for_bids').count(),
        'pending': jobs.filter(status__in=['bid_accepted', 'confirmed']).count(),
        'in_progress': jobs.filter(status='in_progress').count(),
        'completed': jobs.filter(status='completed').count(),
        'cancelled': jobs.filter(status='cancelled').count(),
    }
    
    return Response(stats)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_autocomplete(request):
    """
    Autocomplete suggestions for job search.
    
    Returns unique suggestions from:
    - Service descriptions
    - Cities
    - Postal codes
    - Address terms
    
    Query params:
        q: Search query (minimum 2 characters)
        limit: Max suggestions per category (default: 5)
    """
    query = request.GET.get('q', '').strip()
    limit = int(request.GET.get('limit', 5))
    
    if len(query) < 2:
        return Response({
            'descriptions': [],
            'cities': [],
            'postal_codes': [],
            'addresses': []
        })
    
    user = request.user
    
    # Role-based job filtering (same as main list view)
    if hasattr(user, 'role') and user.role == 'admin':
        jobs = CleaningJob.objects.all()
    elif hasattr(user, 'role') and user.role == 'client':
        jobs = CleaningJob.objects.filter(client=user)
    elif hasattr(user, 'role') and user.role == 'cleaner':
        # Cleaners see open_for_bids jobs and their own jobs
        from django.db.models import Q
        jobs = CleaningJob.objects.filter(
            Q(status='open_for_bids') | Q(cleaner=user)
        )
    else:
        jobs = CleaningJob.objects.none()
    
    # Check if query looks like a postal code (digits only)
    postal_normalized = query.replace(' ', '')
    is_postal_query = postal_normalized.isdigit()
    
    suggestions = {
        'descriptions': [],
        'cities': [],
        'postal_codes': [],
        'addresses': []
    }
    
    if is_postal_query:
        # For postal code queries, prioritize postal code suggestions
        postal_codes = jobs.filter(
            property__postal_code__icontains=postal_normalized
        ).values_list('property__postal_code', flat=True).distinct()[:limit]
        suggestions['postal_codes'] = list(postal_codes)
    else:
        # Text search - get suggestions from multiple fields
        from django.db.models import Q
        
        # Service descriptions (common search terms)
        descriptions = jobs.filter(
            services_description__icontains=query
        ).values_list('services_description', flat=True).distinct()[:limit]
        suggestions['descriptions'] = list(descriptions)
        
        # Cities
        cities = jobs.filter(
            property__city__icontains=query
        ).values_list('property__city', flat=True).distinct()[:limit]
        suggestions['cities'] = list(set(cities))  # Remove duplicates
        
        # Addresses
        addresses = jobs.filter(
            property__address_line1__icontains=query
        ).values_list('property__address_line1', flat=True).distinct()[:limit]
        suggestions['addresses'] = list(addresses)
    
    return Response(suggestions)
