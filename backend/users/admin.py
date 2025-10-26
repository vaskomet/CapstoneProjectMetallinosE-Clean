from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, ServiceArea

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """
    Custom User admin with fields specific to our User model.
    """
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff', 'date_joined')
    search_fields = ('email', 'first_name', 'last_name', 'phone_number')
    ordering = ('email',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone_number', 'profile_picture')}),
        ('Role & Status', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'role', 'first_name', 'last_name'),
        }),
    )

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
