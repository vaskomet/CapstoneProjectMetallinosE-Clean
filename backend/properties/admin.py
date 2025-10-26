from django.contrib import admin
from .models import Property, ServiceType

@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    """
    Property admin interface.
    """
    list_display = ('address_line1', 'city', 'state', 'owner', 'property_type', 'size_sqft')
    list_filter = ('property_type', 'state', 'city')
    search_fields = ('address_line1', 'city', 'state', 'postal_code', 'owner__email')

@admin.register(ServiceType)
class ServiceTypeAdmin(admin.ModelAdmin):
    """
    ServiceType admin interface.
    """
    list_display = ('name', 'base_price', 'description')
    search_fields = ('name', 'description')
    ordering = ('name',)
