from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, ServiceArea

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """
    Custom User admin with fields specific to our User model.
    """
    list_display = ('email', 'first_name', 'last_name', 'role', 'email_verified', 'is_verified_cleaner', 'oauth_provider', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff', 'email_verified', 'is_verified_cleaner', 'oauth_provider', 'date_joined')
    search_fields = ('email', 'first_name', 'last_name', 'phone_number')
    ordering = ('email',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone_number', 'profile_picture')}),
        ('Role & Status', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
        ('Email Verification', {'fields': ('email_verified', 'email_verified_at', 'verification_token', 'verification_token_expires')}),
        ('Cleaner Verification', {
            'fields': ('is_verified_cleaner', 'verified_at', 'verified_by', 'verification_notes'),
            'description': 'Admin verification for cleaners (ID and resume checked)'
        }),
        ('OAuth Info', {'fields': ('oauth_provider',)}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
    )
    
    readonly_fields = ('email_verified_at', 'verified_at', 'verification_token_expires', 'date_joined', 'last_login')
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'first_name', 'last_name'),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """Auto-set verified_by when admin marks cleaner as verified."""
        if change and 'is_verified_cleaner' in form.changed_data:
            if obj.is_verified_cleaner and not obj.verified_by:
                obj.verified_by = request.user
                from django.utils import timezone
                obj.verified_at = timezone.now()
        super().save_model(request, obj, form, change)

@admin.register(ServiceArea)
class ServiceAreaAdmin(admin.ModelAdmin):
    """
    ServiceArea admin interface.
    """
    list_display = ('cleaner', 'area_name', 'area_type', 'city', 'state', 'is_active')
    list_filter = ('area_type', 'state', 'is_active')
    search_fields = ('cleaner__email', 'area_name', 'city')
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "cleaner":
            kwargs["queryset"] = User.objects.filter(role='cleaner')
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
