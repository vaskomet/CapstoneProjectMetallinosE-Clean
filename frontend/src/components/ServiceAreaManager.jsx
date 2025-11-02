import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { serviceAreasAPI } from '../services/api';
import { toast } from 'react-toastify';
import L from 'leaflet';

// Custom marker icon
const createCustomIcon = (color = '#3b82f6') => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: 'custom-marker'
  });
};

/**
 * Map Click Handler for selecting service area center
 */
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    },
  });
  return null;
};

/**
 * Service Area Manager Component
 * 
 * Allows cleaners to define their service areas using GPS location + radius model.
 * This matches the client search system (GPS + radius) for consistent location matching.
 * 
 * Cleaners select a center point on the map and choose a radius (1-50 km).
 * Jobs and client searches within that radius will match this service area.
 */
const ServiceAreaManager = () => {
  const [serviceAreas, setServiceAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 37.9755, lng: 23.7348 }); // Athens default
  
  const [formData, setFormData] = useState({
    area_name: '',
    area_type: 'radius',
    city: '',
    state: '',
    center_latitude: '',
    center_longitude: '',
    radius_miles: 3.1, // Default to 5 km
    max_travel_time_minutes: 30,
    is_active: true
  });

  const radiusOptions = [
    { value: 0.6, label: '1 km', km: 1 },
    { value: 1.2, label: '2 km', km: 2 },
    { value: 1.9, label: '3 km', km: 3 },
    { value: 3.1, label: '5 km', km: 5 },
    { value: 6.2, label: '10 km', km: 10 },
    { value: 9.3, label: '15 km', km: 15 },
    { value: 12.4, label: '20 km', km: 20 },
    { value: 18.6, label: '30 km', km: 30 },
    { value: 31.1, label: '50 km', km: 50 }
  ];

  useEffect(() => {
    fetchServiceAreas();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMapCenter({ lat: latitude, lng: longitude });
          setFormData(prev => ({
            ...prev,
            center_latitude: latitude.toString(),
            center_longitude: longitude.toString()
          }));
        },
        (error) => {
          // Geolocation failed, keep default Athens location
        }
      );
    }
  };

  const fetchServiceAreas = async () => {
    try {
      const response = await serviceAreasAPI.getAll();
      setServiceAreas(response.results || response || []);
    } catch (error) {
      console.error('Failed to fetch service areas:', error);
      toast.error('Failed to load service areas');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleMapClick = (lat, lng) => {
    setFormData(prev => ({
      ...prev,
      center_latitude: lat.toString(),
      center_longitude: lng.toString()
    }));
    setMapCenter({ lat, lng });
    toast.success(`Location selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation for radius-based service area
    if (!formData.center_latitude || !formData.center_longitude) {
      toast.error('Please select a location on the map');
      return;
    }
    if (!formData.area_name.trim()) {
      setFormData(prev => ({
        ...prev,
        area_name: `${radiusOptions.find(r => r.value === parseFloat(formData.radius_miles))?.label || formData.radius_miles + ' mi'} around selected location`
      }));
    }

    try {
      const dataToSend = {
        area_name: formData.area_name || `${radiusOptions.find(r => r.value === parseFloat(formData.radius_miles))?.label || formData.radius_miles + ' mi'} around selected location`,
        area_type: 'radius', // Always radius
        city: '', // Not used for radius
        state: '', // Not used for radius
        center_latitude: parseFloat(formData.center_latitude).toFixed(8),
        center_longitude: parseFloat(formData.center_longitude).toFixed(8),
        radius_miles: parseFloat(formData.radius_miles),
        max_travel_time_minutes: parseInt(formData.max_travel_time_minutes),
        is_active: formData.is_active
      };

      await serviceAreasAPI.create(dataToSend);
      toast.success('Service area created successfully!');
      setShowCreateForm(false);
      setFormData({
        area_name: '',
        area_type: 'radius',
        city: '',
        state: '',
        center_latitude: '',
        center_longitude: '',
        radius_miles: 3.1, // Default to 5 km
        max_travel_time_minutes: 30,
        is_active: true
      });
      fetchServiceAreas();
    } catch (error) {
      console.error('Failed to create service area:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
      
      // Get dataToSend from the try block
      const dataToSend = {
        ...formData,
        center_latitude: formData.center_latitude ? parseFloat(formData.center_latitude).toFixed(8) : null,
        center_longitude: formData.center_longitude ? parseFloat(formData.center_longitude).toFixed(8) : null,
        radius_miles: formData.radius_miles ? parseFloat(formData.radius_miles) : null
      };
      console.error('Data being sent:', dataToSend);
      
      let errorMessage = 'Failed to create service area';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Check for field-specific errors
        if (errorData.area_name && Array.isArray(errorData.area_name)) {
          errorMessage = `Area name: ${errorData.area_name[0]}`;
        } else if (errorData.center_latitude && Array.isArray(errorData.center_latitude)) {
          errorMessage = `Latitude error: ${errorData.center_latitude[0]}`;
        } else if (errorData.center_longitude && Array.isArray(errorData.center_longitude)) {
          errorMessage = `Longitude error: ${errorData.center_longitude[0]}`;
        } else if (errorData.radius_miles && Array.isArray(errorData.radius_miles)) {
          errorMessage = `Radius: ${errorData.radius_miles[0]}`;
        } else if (errorData.city && Array.isArray(errorData.city)) {
          errorMessage = `City: ${errorData.city[0]}`;
        } else if (errorData.non_field_errors && Array.isArray(errorData.non_field_errors)) {
          errorMessage = errorData.non_field_errors[0];
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else {
          // Show all validation errors
          const allErrors = [];
          Object.keys(errorData).forEach(field => {
            if (Array.isArray(errorData[field])) {
              allErrors.push(`${field}: ${errorData[field][0]}`);
            }
          });
          errorMessage = allErrors.length > 0 ? allErrors.join(', ') : `Validation error: ${JSON.stringify(errorData)}`;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const toggleAreaStatus = async (areaId, currentStatus) => {
    try {
      await serviceAreasAPI.update(areaId, { is_active: !currentStatus });
      toast.success(`Service area ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchServiceAreas();
    } catch (error) {
      toast.error('Failed to update service area');
    }
  };

  const deleteArea = async (areaId) => {
    if (window.confirm('Are you sure you want to delete this service area?')) {
      try {
        await serviceAreasAPI.delete(areaId);
        toast.success('Service area deleted');
        fetchServiceAreas();
      } catch (error) {
        toast.error('Failed to delete service area');
      }
    }
  };

  // Convert miles to meters for Circle component
  const milesToMeters = (miles) => miles * 1609.34;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading service areas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">My Service Areas</h3>
          <p className="text-sm text-gray-600">Define where you can provide cleaning services</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'Add Service Area'}
        </button>
      </div>

      {/* Existing Service Areas */}
      <div className="grid gap-4">
        {serviceAreas.map((area) => (
          <div
            key={area.id}
            className={`p-4 border rounded-lg ${
              area.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-900">{area.area_name}</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  {area.area_type === 'radius' && (
                    <>
                      <p>📍 Radius: {(area.radius_miles * 1.609).toFixed(1)} km ({area.radius_miles} miles)</p>
                      <p>⏱️ Max travel: {area.max_travel_time_minutes} min</p>
                    </>
                  )}
                  {area.area_type === 'city' && (
                    <p>🏙️ City: {area.city}, {area.state}</p>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleAreaStatus(area.id, area.is_active)}
                  className={`px-3 py-1 rounded text-sm ${
                    area.is_active
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {area.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => deleteArea(area.id)}
                  className="px-3 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {serviceAreas.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No service areas defined yet.</p>
            <p className="text-sm">Add a service area to start receiving relevant job assignments.</p>
          </div>
        )}
      </div>

      {/* Create Service Area Form */}
      {showCreateForm && (
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Add New Service Area</h4>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Area Type is now fixed to radius - no dropdown needed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Radius
              </label>
              <select
                name="radius_miles"
                value={formData.radius_miles}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {radiusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Define how far from your center location you're willing to travel for jobs
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Click on the map to select your center location
              </label>
              <div className="h-64 border rounded-lg overflow-hidden">
                <MapContainer
                  center={[mapCenter.lat, mapCenter.lng]}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapClickHandler onLocationSelect={handleMapClick} />
                  
                  {formData.center_latitude && formData.center_longitude && (
                    <>
                      <Marker
                        position={[parseFloat(formData.center_latitude), parseFloat(formData.center_longitude)]}
                        icon={createCustomIcon('#3b82f6')}
                      />
                      <Circle
                        center={[parseFloat(formData.center_latitude), parseFloat(formData.center_longitude)]}
                        radius={milesToMeters(formData.radius_miles)}
                        pathOptions={{
                          color: '#3b82f6',
                          fillColor: '#3b82f6',
                          fillOpacity: 0.1,
                          weight: 2
                        }}
                      />
                    </>
                  )}
                </MapContainer>
              </div>
              {formData.center_latitude && formData.center_longitude && (
                <p className="text-sm text-gray-600 mt-1">
                  Selected: {parseFloat(formData.center_latitude).toFixed(6)}, {parseFloat(formData.center_longitude).toFixed(6)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Area Name (optional)
              </label>
              <input
                type="text"
                name="area_name"
                value={formData.area_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 'Downtown Area', 'North Side'"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Travel Time (minutes)
              </label>
              <select
                name="max_travel_time_minutes"
                value={formData.max_travel_time_minutes}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
              >
                Create Service Area
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ServiceAreaManager;