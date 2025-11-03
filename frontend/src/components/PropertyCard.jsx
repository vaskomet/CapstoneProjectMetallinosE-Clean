import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { useUser } from '../contexts/UserContext';
import { propertiesAPI } from '../services/api';
import AddressSearch from './AddressSearch';
import 'leaflet/dist/leaflet.css';

// Fix for default icons in Leaflet with Webpack
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.divIcon({
  html: '<div style="background-color: #3B82F6; width: 25px; height: 25px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [25, 25],
  iconAnchor: [12, 12],
});
L.Marker.prototype.options.icon = DefaultIcon;

/**
 * Map Click Handler for editing mode
 */
const MapClickHandler = ({ onLocationSelect, isEditing }) => {
  useMapEvents({
    click: (e) => {
      if (isEditing) {
        const { lat, lng } = e.latlng;
        onLocationSelect(lat, lng);
      }
    },
  });
  return null;
};

/**
 * PropertyCard Component
 * 
 * Displays individual property details with:
 * - Property information (address, type, size, notes)
 * - Leaflet.js map integration showing property location
 * - Edit/delete functionality for property owners
 * 
 * Map uses GeoJSON from PropertySerializer, edit/delete require ownership per DEVELOPMENT_STANDARDS.md permissions.
 * Follows PascalCase naming per DEVELOPMENT_STANDARDS.md
 * 
 * @param {Object} property - Property object with id, owner, address, location, etc.
 * @param {Function} onPropertyUpdate - Callback function to refresh properties list
 */
const PropertyCard = ({ property, onPropertyUpdate }) => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    address_line1: property.address_line1 || '',
    address_line2: property.address_line2 || '',
    city: property.city || '',
    state: property.state || '',
    postal_code: property.postal_code || '',
    property_type: property.property_type || '',
    size_sqft: property.size_sqft || '',
    notes: property.notes || '',
    latitude: property.latitude || '',
    longitude: property.longitude || ''
  });
  const [editMapLocation, setEditMapLocation] = useState({
    lat: parseFloat(property.latitude) || 37.9755,
    lng: parseFloat(property.longitude) || 23.7348
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  // Check if current user owns this property
  const isOwner = user && property.owner && user.email === property.owner.email;

  // Initialize edit mode with current property data
  const handleEditStart = () => {
    setEditData({
      address_line1: property.address_line1 || '',
      address_line2: property.address_line2 || '',
      city: property.city || '',
      state: property.state || '',
      postal_code: property.postal_code || '',
      property_type: property.property_type || '',
      size_sqft: property.size_sqft || '',
      notes: property.notes || '',
      latitude: property.latitude || '',
      longitude: property.longitude || ''
    });
    
    setEditMapLocation({
      lat: parseFloat(property.latitude) || 37.9755,
      lng: parseFloat(property.longitude) || 23.7348
    });
    
    setIsEditing(true);
  };

  // Handle property deletion
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this property?')) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await propertiesAPI.delete(property.id);
      onPropertyUpdate(); // Refresh the properties list
    } catch (err) {
      setError('Failed to delete property. Please try again.');
      console.error('Delete property error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle property update
  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Create update payload without latitude/longitude from editData
      const { latitude: _, longitude: __, ...addressData } = editData;
      const updatePayload = { ...addressData };
      
      // Add location coordinates as numbers with limited precision if they exist
      if (editMapLocation.lat && editMapLocation.lng) {
        // Limit to 8 decimal places for precision (max 11 digits total for lat, 12 for lng)
        // Format: XX.XXXXXXXX (lat) or XXX.XXXXXXXX (lng)
        updatePayload.latitude = parseFloat(parseFloat(editMapLocation.lat).toFixed(8));
        updatePayload.longitude = parseFloat(parseFloat(editMapLocation.lng).toFixed(8));
      }
      
      console.log('📤 Sending update payload:', updatePayload);
      
      await propertiesAPI.update(property.id, updatePayload);
      setIsEditing(false);
      onPropertyUpdate(); // Refresh the properties list
    } catch (err) {
      console.error('Update property error:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to update property. Please try again.');
    }
  };

  // Handle map location selection during editing
  const handleLocationSelect = (lat, lng) => {
    setEditMapLocation({ lat, lng });
    setEditData(prev => ({
      ...prev,
      latitude: lat.toFixed(8),
      longitude: lng.toFixed(8)
    }));
  };

  // Handle address selection from search during editing
  const handleAddressSelect = (addressData) => {
    // Update form with selected address
    setEditData(prev => ({
      ...prev,
      address_line1: addressData.address.address_line1,
      city: addressData.address.city,
      state: addressData.address.state,
      postal_code: addressData.address.postal_code,
      latitude: addressData.coordinates.lat.toString(),
      longitude: addressData.coordinates.lng.toString()
    }));

    // Update map location
    setEditMapLocation({
      lat: addressData.coordinates.lat,
      lng: addressData.coordinates.lng
    });
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Format address for display
  const formatAddress = () => {
    const parts = [
      property.address_line1,
      property.address_line2,
      property.city,
      property.state,
      property.postal_code
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Get map center coordinates
  const getMapCenter = () => {
    if (property.latitude && property.longitude) {
      return [parseFloat(property.latitude), parseFloat(property.longitude)]; // [lat, lng]
    }
    // Fallback: check for old GeoJSON format (for backward compatibility)
    if (property.location && property.location.coordinates) {
      return [property.location.coordinates[1], property.location.coordinates[0]]; // [lat, lng]
    }
    return [37.9755, 23.7348]; // Default to Athens, Greece
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200">
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Property Details */}
      <div className="mb-4">
        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-3">
            {/* Address Search with Geocoding */}
            <AddressSearch onAddressSelect={handleAddressSelect} />
            
            <div className="text-sm text-gray-600 text-center py-2">
              ─────── OR fill manually ───────
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 1
              </label>
              <input
                type="text"
                name="address_line1"
                value={editData.address_line1}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2
              </label>
              <input
                type="text"
                name="address_line2"
                value={editData.address_line2}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={editData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={editData.state}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  name="postal_code"
                  value={editData.postal_code}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Type
                </label>
                <select
                  name="property_type"
                  value={editData.property_type}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Type</option>
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="condo">Condo</option>
                  <option value="office">Office</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size (sq ft)
              </label>
              <input
                type="number"
                name="size_sqft"
                value={editData.size_sqft}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={editData.notes}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes about the property..."
              />
            </div>

            {/* Location Editing Map */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Property Location
              </label>
              <p className="text-sm text-gray-600 mb-2">
                Click on the map to update the property location
              </p>
              <div className="h-64 rounded-lg overflow-hidden border border-gray-300 mb-2 relative z-0">
                <MapContainer
                  center={[editMapLocation.lat, editMapLocation.lng]}
                  zoom={13}
                  style={{ height: '100%', width: '100%', zIndex: 0 }}
                  scrollWheelZoom={false}
                  key={`edit-${property.id}`}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[editMapLocation.lat, editMapLocation.lng]}>
                    <Popup>
                      <div className="text-center">
                        <p className="font-medium">Property Location</p>
                        <p className="text-xs text-gray-600">
                          {typeof editMapLocation.lat === 'number' ? editMapLocation.lat.toFixed(6) : editMapLocation.lat}, {typeof editMapLocation.lng === 'number' ? editMapLocation.lng.toFixed(6) : editMapLocation.lng}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                  <MapClickHandler onLocationSelect={handleLocationSelect} isEditing={true} />
                </MapContainer>
              </div>
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                📍 Current: {typeof editMapLocation.lat === 'number' ? editMapLocation.lat.toFixed(6) : editMapLocation.lat}, {typeof editMapLocation.lng === 'number' ? editMapLocation.lng.toFixed(6) : editMapLocation.lng}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {formatAddress()}
            </h3>
            
            <div className="space-y-2 text-gray-600">
              <p>
                <span className="font-medium">Type:</span> {property.property_type || 'Not specified'}
              </p>
              
              {property.size_sqft && (
                <p>
                  <span className="font-medium">Size:</span> {property.size_sqft.toLocaleString()} sq ft
                </p>
              )}
              
              {property.notes && (
                <p>
                  <span className="font-medium">Notes:</span> {property.notes}
                </p>
              )}
              
              {property.owner && (
                <p>
                  <span className="font-medium">Owner:</span> {property.owner.email}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Map Integration - Only show when NOT editing */}
      {!isEditing && (
        <div className="mb-4 h-48 rounded-lg overflow-hidden border border-gray-200 relative z-0">
          <MapContainer
            center={getMapCenter()}
            zoom={13}
            style={{ height: '100%', width: '100%', zIndex: 0 }}
            scrollWheelZoom={false}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={getMapCenter()}>
              <Popup>
                <div className="text-center">
                  <p className="font-medium">{property.property_type || 'Property'}</p>
                  <p className="text-sm text-gray-600">{formatAddress()}</p>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      )}

      {/* Action Buttons - Only show for property owners */}
      {isOwner && !isEditing && (
        <div className="flex gap-2">
          <button
            onClick={handleEditStart}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors flex-1"
          >
            Edit Property
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-md transition-colors flex-1"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PropertyCard;