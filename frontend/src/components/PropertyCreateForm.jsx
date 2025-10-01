import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { propertiesAPI } from '../services/api';
import { toast } from 'react-toastify';

/**
 * PropertyCreateForm Component
 * 
 * Form validates location coordinates, uses PropertySerializer fields per DEVELOPMENT_STANDARDS.md, client-only per role check.
 * API calls use Authorization header with Bearer token as in auth integrations.
 * 
 * Features:
 * - Property creation form with validation
 * - Location coordinates validation (-90 to 90 for lat, -180 to 180 for lng)
 * - Client-only access restriction
 * - Toast notifications for feedback
 * - Automatic navigation to properties dashboard on success
 * 
 * Test with token from login, verify client role restriction, test property creation with GeoJSON.
 */
const PropertyCreateForm = ({ onPropertyCreated, onCancel }) => {
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    property_type: 'house',
    size_sqft: '',
    notes: '',
    latitude: '',
    longitude: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Redirect if not authenticated or not client
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'client') {
      toast.error('Only clients can create properties');
      navigate('/dashboard');
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form data
  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.address_line1.trim()) {
      newErrors.address_line1 = 'Address line 1 is required';
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }
    if (!formData.postal_code.trim()) {
      newErrors.postal_code = 'Postal code is required';
    }

    // Validate coordinates if provided
    if (formData.latitude || formData.longitude) {
      const lat = parseFloat(formData.latitude);
      const lng = parseFloat(formData.longitude);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.latitude = 'Latitude must be between -90 and 90';
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.longitude = 'Longitude must be between -180 and 180';
      }
    }

    // Validate size if provided
    if (formData.size_sqft && (isNaN(formData.size_sqft) || parseInt(formData.size_sqft) <= 0)) {
      newErrors.size_sqft = 'Size must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare data for API
      const propertyData = {
        address_line1: formData.address_line1.trim(),
        address_line2: formData.address_line2.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postal_code: formData.postal_code.trim(),
        property_type: formData.property_type,
        size_sqft: formData.size_sqft ? parseInt(formData.size_sqft) : null,
        notes: formData.notes.trim(),
      };

      // Add location if coordinates are provided
      if (formData.latitude && formData.longitude) {
        propertyData.location = {
          type: 'Point',
          coordinates: [parseFloat(formData.longitude), parseFloat(formData.latitude)]
        };
      }

      await propertiesAPI.create(propertyData);
      toast.success('Property created successfully!');
      
      // Reset form
      setFormData({
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        property_type: 'house',
        size_sqft: '',
        notes: '',
        latitude: '',
        longitude: ''
      });

      // Call callback or navigate
      if (onPropertyCreated) {
        onPropertyCreated();
      } else {
        navigate('/properties');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          'Failed to create property';
      toast.error('Error: ' + errorMessage);
      console.error('Create property error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/properties');
    }
  };

  if (!isAuthenticated || user?.role !== 'client') {
    return null; // Will redirect
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Add New Property</h2>
        <p className="text-gray-600">Create a new property for cleaning services</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Address Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Address Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 1 *
            </label>
            <input
              type="text"
              name="address_line1"
              value={formData.address_line1}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.address_line1 ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="123 Main Street"
              required
            />
            {errors.address_line1 && (
              <p className="mt-1 text-sm text-red-600">{errors.address_line1}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <input
              type="text"
              name="address_line2"
              value={formData.address_line2}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Apartment, suite, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.city ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-600">{errors.city}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State *
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.state ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {errors.state && (
                <p className="mt-1 text-sm text-red-600">{errors.state}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Postal Code *
            </label>
            <input
              type="text"
              name="postal_code"
              value={formData.postal_code}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.postal_code ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {errors.postal_code && (
              <p className="mt-1 text-sm text-red-600">{errors.postal_code}</p>
            )}
          </div>
        </div>

        {/* Property Details Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Property Details</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Type
              </label>
              <select
                name="property_type"
                value={formData.property_type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="house">House</option>
                <option value="apartment">Apartment</option>
                <option value="condo">Condo</option>
                <option value="office">Office</option>
                <option value="commercial">Commercial</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size (sq ft)
              </label>
              <input
                type="number"
                name="size_sqft"
                value={formData.size_sqft}
                onChange={handleInputChange}
                min="1"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.size_sqft ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="1500"
              />
              {errors.size_sqft && (
                <p className="mt-1 text-sm text-red-600">{errors.size_sqft}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional information about the property..."
            />
          </div>
        </div>

        {/* Location Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Location Coordinates (Optional)</h3>
          <p className="text-sm text-gray-600">
            Add precise coordinates for map display. Leave empty to use address geocoding.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleInputChange}
                step="any"
                min="-90"
                max="90"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.latitude ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="37.7749"
              />
              {errors.latitude && (
                <p className="mt-1 text-sm text-red-600">{errors.latitude}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleInputChange}
                step="any"
                min="-180"
                max="180"
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.longitude ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="-122.4194"
              />
              {errors.longitude && (
                <p className="mt-1 text-sm text-red-600">{errors.longitude}</p>
              )}
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-4 pt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-2 px-4 rounded-md transition-colors font-medium"
          >
            {isSubmitting ? 'Creating...' : 'Create Property'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 px-4 rounded-md transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default PropertyCreateForm;