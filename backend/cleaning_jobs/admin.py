from django.contrib import admin
from .models import CleaningJob, JobBid, JobPhoto

@admin.register(CleaningJob)
class CleaningJobAdmin(admin.ModelAdmin):
    """
    CleaningJob admin interface.
    """
    list_display = ('id', 'client', 'cleaner', 'property', 'status', 'scheduled_date', 'client_budget', 'final_price')
    list_filter = ('status', 'scheduled_date', 'created_at')
    search_fields = ('client__email', 'cleaner__email', 'property__address_line1', 'property__city')
    date_hierarchy = 'scheduled_date'

@admin.register(JobBid)
class JobBidAdmin(admin.ModelAdmin):
    """
    JobBid admin interface.
    """
    list_display = ('id', 'job', 'cleaner', 'bid_amount', 'estimated_duration', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('job__id', 'cleaner__email')
    date_hierarchy = 'created_at'

@admin.register(JobPhoto)
class JobPhotoAdmin(admin.ModelAdmin):
    """
    JobPhoto admin interface.
    """
    list_display = ('job', 'photo_type', 'description', 'uploaded_at')
    list_filter = ('photo_type', 'uploaded_at')
    search_fields = ('job__id', 'description')
