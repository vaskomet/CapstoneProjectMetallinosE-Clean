"""
Recommendation System Admin Configuration
"""

from django.contrib import admin
from .models import (
    CleanerScore,
    JobRecommendation,
    CleanerRecommendation,
    BidSuggestion,
    RecommendationFeedback
)


@admin.register(CleanerScore)
class CleanerScoreAdmin(admin.ModelAdmin):
    list_display = [
        'cleaner', 'overall_score', 'quality_score', 'completion_rate',
        'bid_win_rate', 'total_jobs', 'is_active', 'last_calculated'
    ]
    list_filter = ['is_active', 'primary_property_type']
    search_fields = ['cleaner__username', 'cleaner__email']
    readonly_fields = ['last_calculated']
    
    fieldsets = (
        ('Cleaner', {
            'fields': ('cleaner', 'overall_score')
        }),
        ('Quality Metrics', {
            'fields': ('quality_score', 'communication_score', 'professionalism_score', 'timeliness_score')
        }),
        ('Reliability Metrics', {
            'fields': ('completion_rate', 'on_time_rate', 'cancellation_rate', 'photo_documentation_rate')
        }),
        ('Bidding Metrics', {
            'fields': ('bid_win_rate', 'avg_bid_amount', 'avg_response_time_minutes')
        }),
        ('Experience', {
            'fields': ('total_jobs', 'total_earnings', 'review_count', 'avg_rating')
        }),
        ('Specialization', {
            'fields': ('primary_property_type', 'eco_friendly_jobs_percentage')
        }),
        ('Activity', {
            'fields': ('jobs_last_30_days', 'jobs_last_90_days', 'is_active')
        }),
        ('Metadata', {
            'fields': ('last_calculated', 'calculation_version')
        }),
    )


@admin.register(JobRecommendation)
class JobRecommendationAdmin(admin.ModelAdmin):
    list_display = [
        'job', 'cleaner', 'recommendation_score', 'recommendation_rank',
        'was_viewed', 'was_bid_placed', 'was_bid_accepted', 'created_at'
    ]
    list_filter = ['was_viewed', 'was_bid_placed', 'was_bid_accepted', 'created_at']
    search_fields = ['job__id', 'cleaner__username']
    readonly_fields = ['created_at']


@admin.register(CleanerRecommendation)
class CleanerRecommendationAdmin(admin.ModelAdmin):
    list_display = [
        'job', 'cleaner', 'client', 'recommendation_score',
        'recommendation_rank', 'was_viewed', 'was_hired', 'created_at'
    ]
    list_filter = ['was_viewed', 'was_contacted', 'was_hired', 'created_at']
    search_fields = ['job__id', 'cleaner__username', 'client__username']


@admin.register(BidSuggestion)
class BidSuggestionAdmin(admin.ModelAdmin):
    list_display = [
        'job', 'cleaner', 'suggested_optimal', 'actual_bid_amount',
        'was_bid_placed', 'was_suggestion_used', 'did_win', 'created_at'
    ]
    list_filter = ['was_bid_placed', 'was_suggestion_used', 'did_win']
    search_fields = ['job__id', 'cleaner__username']
    
    fieldsets = (
        ('Job & Cleaner', {
            'fields': ('job', 'cleaner')
        }),
        ('Suggestions', {
            'fields': ('suggested_min', 'suggested_optimal', 'suggested_max')
        }),
        ('Calculation Inputs', {
            'fields': (
                'client_budget', 'market_avg_bid', 'cleaner_avg_bid',
                'cleaner_win_rate_at_suggested'
            )
        }),
        ('Competition', {
            'fields': ('current_bid_count', 'current_lowest_bid')
        }),
        ('Outcome', {
            'fields': ('actual_bid_amount', 'was_bid_placed', 'was_suggestion_used', 'did_win')
        }),
    )


@admin.register(RecommendationFeedback)
class RecommendationFeedbackAdmin(admin.ModelAdmin):
    list_display = ['user', 'feedback_type', 'created_at']
    list_filter = ['feedback_type', 'created_at']
    search_fields = ['user__username', 'comment']

