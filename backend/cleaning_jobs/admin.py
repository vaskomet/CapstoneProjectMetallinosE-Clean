from django.contrib import admin
from .models import CleaningJob

@admin.register(CleaningJob)
class CleaningJobAdmin(admin.ModelAdmin):
    """
    CleaningJob admin interface for managing booking lifecycle.
    Displays job status, client, cleaner, property, and scheduling information.
    """
    list_display = ('id', 'client', 'cleaner', 'property', 'status', 'scheduled_date', 'total_cost', 'created_at')
    list_filter = ('status', 'scheduled_date', 'created_at')
    search_fields = ('client__email', 'cleaner__email', 'property__address_line1', 'property__city')
    list_select_related = ('client', 'cleaner', 'property')
    date_hierarchy = 'scheduled_date'
    
    fieldsets = (
        ('Job Assignment', {'fields': ('client', 'cleaner', 'property')}),
        ('Status & Timing', {'fields': ('status', 'scheduled_date', 'start_time', 'end_time')}),
        ('Service Details', {'fields': ('services_requested', 'checklist', 'notes')}),
        ('Pricing', {'fields': ('total_cost', 'discount_applied')}),
        ('Eco Impact', {'fields': ('eco_impact_metrics',)}),
    )
    
    # Enable filtering by services requested
    filter_horizontal = ('services_requested',)
    
    # Read-only fields for certain data
    readonly_fields = ('created_at', 'updated_at')
    
    # Custom actions for bulk status updates
    actions = ['mark_as_confirmed', 'mark_as_completed']
    
    def mark_as_confirmed(self, request, queryset):
        """Bulk action to mark selected jobs as confirmed."""
        updated = queryset.filter(status='pending').update(status='confirmed')
        self.message_user(request, f'{updated} jobs marked as confirmed.')
    mark_as_confirmed.short_description = "Mark selected jobs as confirmed"
    
    def mark_as_completed(self, request, queryset):
        """Bulk action to mark selected jobs as completed."""
        updated = queryset.filter(status='in_progress').update(status='completed')
        self.message_user(request, f'{updated} jobs marked as completed.')
    mark_as_completed.short_description = "Mark selected jobs as completed"
    
    # Customize the queryset to optimize database queries
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'client', 'cleaner', 'property'
        ).prefetch_related('services_requested')
