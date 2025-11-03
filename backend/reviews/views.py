from rest_framework import generics, status, permissions as drf_permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from .models import Review, ReviewRating, ReviewResponse, ReviewFlag
from .serializers import (
    ReviewSerializer,
    ReviewListSerializer,
    ReviewStatsSerializer,
    ReviewResponseSerializer,
    ReviewFlagSerializer
)
from .permissions import IsReviewer, IsReviewee, CanFlagReview, IsAdminOrReadOnly
from users.models import User
from cleaning_jobs.models import CleaningJob


class ReviewListCreateView(generics.ListCreateAPIView):
    """
    List reviews for a specific user (cleaner or client) or create a new review.
    
    GET:  List reviews for a user (filter by reviewee_id query param)
    POST: Create a new review for a completed job
    """
    permission_classes = [drf_permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        """Use lightweight serializer for list, full serializer for create"""
        if self.request.method == 'GET':
            return ReviewListSerializer
        return ReviewSerializer
    
    def get_queryset(self):
        """
        Filter reviews by reviewee (person being reviewed).
        Only show visible reviews unless user is admin or the reviewee.
        """
        queryset = Review.objects.select_related(
            'reviewer',
            'reviewee',
            'job'
        ).prefetch_related(
            'ratings',
            'response'
        )
        
        # Filter by reviewee if provided
        reviewee_id = self.request.query_params.get('reviewee_id', None)
        if reviewee_id:
            queryset = queryset.filter(reviewee_id=reviewee_id)
        
        # Filter by job if provided
        job_id = self.request.query_params.get('job_id', None)
        if job_id:
            queryset = queryset.filter(job_id=job_id)
        
        # Show only visible reviews unless user is admin or reviewee
        if not self.request.user.is_staff:
            queryset = queryset.filter(
                Q(is_visible=True) | Q(reviewee=self.request.user) | Q(reviewer=self.request.user)
            )
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Create review with current user as reviewer"""
        serializer.save()


class ReviewDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a specific review.
    
    GET:    Anyone can view (if visible)
    PUT:    Only reviewer can update
    DELETE: Only reviewer can delete
    """
    serializer_class = ReviewSerializer
    permission_classes = [drf_permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Optimize query with related data"""
        return Review.objects.select_related(
            'reviewer',
            'reviewee',
            'job'
        ).prefetch_related(
            'ratings',
            'response'
        )
    
    def get_permissions(self):
        """
        Allow anyone to view, but only reviewer can update/delete.
        """
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [drf_permissions.IsAuthenticated(), IsReviewer()]
        return [drf_permissions.IsAuthenticatedOrReadOnly()]
    
    def destroy(self, request, *args, **kwargs):
        """Soft delete by hiding the review instead of deleting"""
        review = self.get_object()
        
        # Only reviewer or admin can delete
        if review.reviewer != request.user and not request.user.is_staff:
            return Response(
                {'error': 'Only the reviewer can delete this review.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Soft delete - just hide it
        review.is_visible = False
        review.save()
        
        return Response(
            {'message': 'Review hidden successfully.'},
            status=status.HTTP_204_NO_CONTENT
        )


class ReviewResponseCreateView(generics.CreateAPIView):
    """
    Create a response to a review.
    Only the reviewee (person being reviewed) can respond.
    """
    serializer_class = ReviewResponseSerializer
    permission_classes = [drf_permissions.IsAuthenticated, IsReviewee]
    
    def get_permissions(self):
        """Check if user is the reviewee"""
        return [drf_permissions.IsAuthenticated(), IsReviewee()]
    
    def post(self, request, review_id):
        """Create response for specific review"""
        # Get the review
        review = get_object_or_404(Review, id=review_id)
        
        # Check if review already has a response
        if hasattr(review, 'response'):
            return Response(
                {'error': 'This review already has a response.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check permission (user must be reviewee)
        if review.reviewee != request.user:
            return Response(
                {'error': 'Only the reviewee can respond to this review.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create response
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(review=review)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewResponseUpdateView(generics.UpdateAPIView):
    """
    Update a response to a review.
    Only the reviewee can update their response.
    """
    serializer_class = ReviewResponseSerializer
    permission_classes = [drf_permissions.IsAuthenticated, IsReviewee]
    queryset = ReviewResponse.objects.all()


class ReviewStatsView(APIView):
    """
    Get aggregate statistics for a user's reviews.
    Shows average ratings across all categories.
    """
    permission_classes = [drf_permissions.AllowAny]
    
    def get(self, request, user_id):
        """Calculate and return review statistics for a user"""
        user = get_object_or_404(User, id=user_id)
        
        # Get all visible reviews for this user
        reviews = Review.objects.filter(
            reviewee=user,
            is_visible=True
        )
        
        # Count total reviews
        total_reviews = reviews.count()
        
        if total_reviews == 0:
            return Response({
                'user_id': user.id,
                'user_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'user_role': user.role,
                'total_reviews': 0,
                'average_overall_rating': 0.0,
                'average_quality': 0.0,
                'average_communication': 0.0,
                'average_professionalism': 0.0,
                'average_timeliness': 0.0,
            })
        
        # Calculate average overall rating
        avg_overall = reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
        
        # Calculate average sub-ratings
        ratings = ReviewRating.objects.filter(review__in=reviews)
        
        avg_quality = ratings.filter(category='quality').aggregate(Avg('rating'))['rating__avg'] or 0.0
        avg_communication = ratings.filter(category='communication').aggregate(Avg('rating'))['rating__avg'] or 0.0
        avg_professionalism = ratings.filter(category='professionalism').aggregate(Avg('rating'))['rating__avg'] or 0.0
        avg_timeliness = ratings.filter(category='timeliness').aggregate(Avg('rating'))['rating__avg'] or 0.0
        
        stats_data = {
            'user_id': user.id,
            'user_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'user_role': user.role,
            'total_reviews': total_reviews,
            'average_overall_rating': round(avg_overall, 1) if avg_overall else 0.0,
            'average_quality': round(avg_quality, 1),
            'average_communication': round(avg_communication, 1),
            'average_professionalism': round(avg_professionalism, 1),
            'average_timeliness': round(avg_timeliness, 1),
        }
        
        serializer = ReviewStatsSerializer(data=stats_data)
        serializer.is_valid()
        return Response(serializer.data)


class ReviewFlagCreateView(generics.CreateAPIView):
    """
    Flag a review as inappropriate.
    Any authenticated user can flag a review (except their own).
    """
    serializer_class = ReviewFlagSerializer
    permission_classes = [drf_permissions.IsAuthenticated, CanFlagReview]
    
    def post(self, request, review_id):
        """Create flag for specific review"""
        # Get the review
        review = get_object_or_404(Review, id=review_id)
        
        # Check if user is trying to flag their own review
        if review.reviewer == request.user:
            return Response(
                {'error': 'You cannot flag your own review.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user has already flagged this review
        existing_flag = ReviewFlag.objects.filter(
            review=review,
            flagger=request.user
        ).first()
        
        if existing_flag:
            return Response(
                {'error': 'You have already flagged this review.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create flag
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(review=review, flagger=request.user)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewFlagListView(generics.ListAPIView):
    """
    List all flagged reviews.
    Only accessible by admin/staff users.
    """
    serializer_class = ReviewFlagSerializer
    permission_classes = [drf_permissions.IsAuthenticated, drf_permissions.IsAdminUser]
    
    def get_queryset(self):
        """Get all flags, ordered by moderation status and date"""
        queryset = ReviewFlag.objects.select_related(
            'review',
            'flagger',
            'review__reviewer',
            'review__reviewee'
        ).all()
        
        # Filter by moderation status if provided
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(moderation_status=status_filter)
        
        return queryset.order_by('moderation_status', '-created_at')


class ReviewFlagModerationView(APIView):
    """
    Moderate a flagged review.
    Admin-only endpoint to update flag status and hide/show reviews.
    """
    permission_classes = [drf_permissions.IsAuthenticated, drf_permissions.IsAdminUser]
    
    def patch(self, request, flag_id):
        """Update flag moderation status"""
        from django.utils import timezone
        
        flag = get_object_or_404(ReviewFlag, id=flag_id)
        
        # Get action from request
        action = request.data.get('action')  # 'approve', 'dismiss', 'hide_review'
        admin_notes = request.data.get('admin_notes', '')
        
        if action == 'approve':
            flag.moderation_status = 'action_taken'
            flag.review.is_visible = False  # Hide the review
            flag.review.save()
            message = 'Review hidden due to flag.'
        elif action == 'dismiss':
            flag.moderation_status = 'dismissed'
            message = 'Flag dismissed.'
        elif action == 'hide_review':
            flag.moderation_status = 'action_taken'
            flag.review.is_visible = False
            flag.review.save()
            message = 'Review hidden.'
        else:
            return Response(
                {'error': 'Invalid action. Use "approve", "dismiss", or "hide_review".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update flag
        flag.admin_notes = admin_notes
        flag.reviewed_at = timezone.now()
        flag.save()
        
        return Response({
            'message': message,
            'flag': ReviewFlagSerializer(flag).data
        })


class MyReviewsView(generics.ListAPIView):
    """
    List all reviews written by the current user.
    """
    serializer_class = ReviewListSerializer
    permission_classes = [drf_permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Get reviews written by current user"""
        return Review.objects.filter(
            reviewer=self.request.user
        ).select_related(
            'reviewer',
            'reviewee',
            'job'
        ).prefetch_related(
            'ratings',
            'response'
        ).order_by('-created_at')


class JobReviewEligibilityView(APIView):
    """
    Check if current user can review a specific job.
    Returns eligibility status and reason if not eligible.
    """
    permission_classes = [drf_permissions.IsAuthenticated]
    
    def get(self, request, job_id):
        """Check if user can review this job"""
        from django.utils import timezone
        from datetime import timedelta
        
        job = get_object_or_404(CleaningJob, id=job_id)
        user = request.user
        
        # Initialize response
        response_data = {
            'can_review': False,
            'reason': None,
            'job_id': job.id,
            'job_status': job.status
        }
        
        # Check if job is completed
        if job.status != 'completed':
            response_data['reason'] = 'Job must be completed before it can be reviewed.'
            return Response(response_data)
        
        # Check if user is a participant
        if user != job.client and user != job.cleaner:
            response_data['reason'] = 'You can only review jobs you participated in.'
            return Response(response_data)
        
        # Check if job has completion date
        if not job.actual_end_time:
            response_data['reason'] = 'Job must have a completion date to be reviewed.'
            return Response(response_data)
        
        # Check if within 30-day window
        thirty_days_ago = timezone.now() - timedelta(days=30)
        if job.actual_end_time < thirty_days_ago:
            response_data['reason'] = 'Review window (30 days) has expired.'
            return Response(response_data)
        
        # Check if user has already reviewed
        existing_review = Review.objects.filter(job=job, reviewer=user).first()
        if existing_review:
            response_data['reason'] = 'You have already reviewed this job.'
            response_data['existing_review_id'] = existing_review.id
            return Response(response_data)
        
        # All checks passed
        response_data['can_review'] = True
        response_data['reason'] = 'You can review this job.'
        
        return Response(response_data)
