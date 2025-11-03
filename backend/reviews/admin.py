from django.contrib import admin
from .models import Review, ReviewRating, ReviewResponse, ReviewFlag


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    """
    Admin interface for Review model with comprehensive viewing and filtering.
    """
    list_display = [
        'id',
        'reviewer',
        'reviewee',
        'job',
        'overall_rating',
        'is_visible',
        'created_at'
    ]
    
    list_filter = [
        'is_visible',
        'overall_rating',
        'created_at',
    ]
    
    search_fields = [
        'reviewer__username',
        'reviewer__email',
        'reviewee__username',
        'reviewee__email',
        'comment',
    ]
    
    readonly_fields = [
        'id',
        'job',
        'reviewer',
        'reviewee',
        'created_at',
        'updated_at',
    ]
    
    fieldsets = (
        ('Review Information', {
            'fields': ('id', 'job', 'reviewer', 'reviewee')
        }),
        ('Rating & Content', {
            'fields': ('overall_rating', 'comment')
        }),
        ('Moderation', {
            'fields': ('is_visible',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    date_hierarchy = 'created_at'
    
    def has_delete_permission(self, request, obj=None):
        """Allow admins to delete reviews if needed for moderation"""
        return request.user.is_superuser
    
    def has_add_permission(self, request):
        """Prevent manual creation via admin - reviews should come from API"""
        return False


@admin.register(ReviewRating)
class ReviewRatingAdmin(admin.ModelAdmin):
    """
    Admin interface for ReviewRating model (sub-ratings).
    """
    list_display = [
        'id',
        'review',
        'category',
        'rating',
    ]
    
    list_filter = [
        'category',
        'rating',
    ]
    
    search_fields = [
        'review__reviewer__username',
        'review__reviewee__username',
    ]
    
    readonly_fields = [
        'id',
        'review',
        'category',
        'rating',
    ]
    
    def has_add_permission(self, request):
        """Prevent manual creation - ratings created with reviews via API"""
        return False
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion - delete the parent review instead"""
        return False


@admin.register(ReviewResponse)
class ReviewResponseAdmin(admin.ModelAdmin):
    """
    Admin interface for ReviewResponse model.
    """
    list_display = [
        'id',
        'review',
        'get_respondent',
        'created_at',
    ]
    
    search_fields = [
        'review__reviewee__username',
        'response_text',
    ]
    
    readonly_fields = [
        'id',
        'review',
        'created_at',
        'updated_at',
    ]
    
    fieldsets = (
        ('Response Information', {
            'fields': ('id', 'review')
        }),
        ('Response Content', {
            'fields': ('response_text',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_respondent(self, obj):
        """Show who responded (the reviewee)"""
        return obj.review.reviewee.username
    get_respondent.short_description = 'Respondent'
    
    def has_add_permission(self, request):
        """Prevent manual creation - responses created via API"""
        return False


@admin.register(ReviewFlag)
class ReviewFlagAdmin(admin.ModelAdmin):
    """
    Admin interface for ReviewFlag model with moderation tools.
    """
    list_display = [
        'id',
        'review',
        'flagger',
        'reason',
        'moderation_status',
        'created_at',
    ]
    
    list_filter = [
        'moderation_status',
        'reason',
        'created_at',
    ]
    
    search_fields = [
        'flagger__username',
        'review__reviewer__username',
        'review__reviewee__username',
        'details',
        'admin_notes',
    ]
    
    readonly_fields = [
        'id',
        'review',
        'flagger',
        'reason',
        'details',
        'created_at',
    ]
    
    fieldsets = (
        ('Flag Information', {
            'fields': ('id', 'review', 'flagger', 'reason', 'details', 'created_at')
        }),
        ('Moderation', {
            'fields': ('moderation_status', 'reviewed_at', 'admin_notes')
        }),
    )
    
    actions = ['mark_as_reviewed', 'mark_as_action_taken', 'mark_as_dismissed']
    
    date_hierarchy = 'created_at'
    
    def mark_as_reviewed(self, request, queryset):
        """Bulk action to mark flags as reviewed"""
        from django.utils import timezone
        queryset.update(moderation_status='reviewed', reviewed_at=timezone.now())
        self.message_user(request, f"{queryset.count()} flag(s) marked as reviewed.")
    mark_as_reviewed.short_description = "Mark selected flags as reviewed"
    
    def mark_as_action_taken(self, request, queryset):
        """Bulk action to mark flags as action taken"""
        from django.utils import timezone
        queryset.update(moderation_status='action_taken', reviewed_at=timezone.now())
        self.message_user(request, f"{queryset.count()} flag(s) marked as action taken.")
    mark_as_action_taken.short_description = "Mark selected flags as action taken"
    
    def mark_as_dismissed(self, request, queryset):
        """Bulk action to dismiss flags"""
        from django.utils import timezone
        queryset.update(moderation_status='dismissed', reviewed_at=timezone.now())
        self.message_user(request, f"{queryset.count()} flag(s) dismissed.")
    mark_as_dismissed.short_description = "Dismiss selected flags"
    
    def has_add_permission(self, request):
        """Prevent manual creation - flags created via API"""
        return False
