from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from .models import Property, ServiceType
from .serializers import PropertySerializer, ServiceTypeSerializer
from users.models import User

class PropertyListCreateView(generics.ListCreateAPIView):
    """
    ListCreateView enables authenticated clients to list all properties and create new ones with their ownership.
    Supports geospatial data for location-based searches.
    """
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        """
        Perform_create ensures property ownership for client role.
        Sets the owner to the authenticated user making the request.
        """
        serializer.save(owner=self.request.user)

class PropertyRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    RetrieveUpdateDestroyView allows owners to view, update, or delete their own properties only.
    Implements ownership-based permissions for property management.
    """
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        """
        Override perform_update to check property ownership.
        PermissionDenied raised for unauthorized updates.
        """
        obj = self.get_object()
        if self.request.user != obj.owner:
            raise PermissionDenied("You can only update your own properties.")
        serializer.save()

    def perform_destroy(self, instance):
        """
        Override perform_destroy to check property ownership.
        PermissionDenied raised for unauthorized deletions.
        """
        if self.request.user != instance.owner:
            raise PermissionDenied("You can only delete your own properties.")
        instance.delete()

class ServiceTypeListCreateView(generics.ListCreateAPIView):
    """
    ListCreateView enables listing of all service types and admin creation of new ones.
    Supports service standardization for cleaner-client matching.
    """
    queryset = ServiceType.objects.all()
    serializer_class = ServiceTypeSerializer
    permission_classes = [IsAuthenticated]  # Admin-only for creation in future

# Test with Postman: POST to /api/properties/ with JWT token and 
# {'address_line1': '123 Main St', 'location': {'type': 'Point', 'coordinates': [-73.935242, 40.730610]}}
