from django.urls import path
from .views import (
    ReviewListCreateView,
    ReviewDetailView,
    ReviewResponseCreateView,
    ReviewResponseUpdateView,
    ReviewStatsView,
    ReviewFlagCreateView,
    ReviewFlagListView,
    ReviewFlagModerationView,
    MyReviewsView,
    JobReviewEligibilityView,
)

urlpatterns = [
    # Review CRUD
    path('', ReviewListCreateView.as_view(), name='review-list-create'),
    path('<int:pk>/', ReviewDetailView.as_view(), name='review-detail'),
    
    # User's own reviews
    path('my-reviews/', MyReviewsView.as_view(), name='my-reviews'),
    
    # Review responses
    path('<int:review_id>/response/', ReviewResponseCreateView.as_view(), name='review-response-create'),
    path('responses/<int:pk>/', ReviewResponseUpdateView.as_view(), name='review-response-update'),
    
    # Review statistics
    path('stats/<int:user_id>/', ReviewStatsView.as_view(), name='review-stats'),
    
    # Review flags (moderation)
    path('<int:review_id>/flag/', ReviewFlagCreateView.as_view(), name='review-flag-create'),
    path('flags/', ReviewFlagListView.as_view(), name='review-flag-list'),
    path('flags/<int:flag_id>/moderate/', ReviewFlagModerationView.as_view(), name='review-flag-moderate'),
    
    # Job review eligibility check
    path('can-review/<int:job_id>/', JobReviewEligibilityView.as_view(), name='job-review-eligibility'),
]
