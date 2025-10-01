from django.contrib import admin
from .models import Property, ServiceType

@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    """
    Property admin interface for managing client properties.
    Displays owner, address, property type, and location information.
    """
    list_display = ('address_line1', 'city', 'state', 'owner', 'property_type', 'size_sqft', 'created_at')
    list_filter = ('property_type', 'state', 'city', 'created_at')
    search_fields = ('address_line1', 'city', 'state', 'postal_code', 'owner__email')
    list_select_related = ('owner',)
    
    fieldsets = (
        ('Owner Information', {'fields': ('owner',)}),
        ('Address Details', {'fields': ('address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country')}),
        ('Location Coordinates', {'fields': ('latitude', 'longitude')}),
        ('Property Details', {'fields': ('property_type', 'size_sqft')}),
        ('Preferences & Notes', {'fields': ('preferences', 'notes')}),
    )
    
    # Allow filtering by owner role
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('owner')

@admin.register(ServiceType)
class ServiceTypeAdmin(admin.ModelAdmin):
    """
    ServiceType admin interface for managing available cleaning services.
    Displays service name, description, and pricing information.
    """
    list_display = ('name', 'base_price', 'description', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'description')
    ordering = ('name',)
    
    fieldsets = (
        ('Service Information', {'fields': ('name', 'description')}),
        ('Pricing', {'fields': ('base_price',)}),
    )
