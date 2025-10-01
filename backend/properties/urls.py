from django.urls import path
from . import views

urlpatterns = [
    # Property endpoints for authenticated clients
    # property-list allows authenticated clients to list/create their properties
    path('properties/', views.PropertyListCreateView.as_view(), name='property-list'),
    
    # property-detail enables retrieval, update, and deletion of specific property instances
    # pk parameter enables retrieval/update/deletion of specific instances
    path('properties/<int:pk>/', views.PropertyRetrieveUpdateDestroyView.as_view(), name='property-detail'),
    
    # Service type endpoints for standardized cleaning services
    # service-type-list allows listing of available service types and admin creation
    path('service-types/', views.ServiceTypeListCreateView.as_view(), name='service-type-list'),
    
    # Note: ServiceType detail view not yet implemented - reserved for future admin operations
    # service-type-detail will require admin access for updates in future implementations
    # path('service-types/<int:pk>/', views.ServiceTypeDetailView.as_view(), name='service-type-detail'),
]

# Test with Postman: POST /api/properties/properties/ with 
# {'address_line1': '123 Main St', 'location': {'type': 'Point', 'coordinates': [-73.935242, 40.730610]}} and JWT token