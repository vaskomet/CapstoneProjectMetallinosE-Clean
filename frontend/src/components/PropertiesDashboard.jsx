import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { propertiesAPI } from '../services/api';
import PropertyCard from './PropertyCard';
import PropertyCreateForm from './PropertyCreateForm';

/**
 * PropertiesDashboard Component
 * 
 * Fetches client properties, uses Leaflet.js for maps, follows PascalCase per DEVELOPMENT_STANDARDS.md.
 * Create form integrated for client property addition, follows PascalCase per DEVELOPMENT_STANDARDS.md; uses toast for feedback as in other integrations.
 * 
 * Features:
 * - Displays all properties in a responsive grid layout
 * - Fetches properties from backend API with authentication
 * - Shows PropertyCard components with map integration
 * - Handles loading and error states
 * - Provides navigation to property creation for authenticated users
 * - Integrated PropertyCreateForm modal for seamless property addition
 * 
 * Test with token from login, check map rendering, verify edit/delete ownership, test property creation with GeoJSON and refresh dashboard
 */
const PropertiesDashboard = () => {
  const { user, isAuthenticated } = useUser();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  // Fetch properties from API
  const fetchProperties = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await propertiesAPI.getAll();
      setProperties(response.results || response || []);
    } catch (err) {
      setError('Failed to fetch properties. Please try again later.');
      console.error('Fetch properties error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load properties on component mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchProperties();
    }
  }, [isAuthenticated]);

  // Handle property updates (refresh list)
  const handlePropertyUpdate = () => {
    fetchProperties();
  };

  // Handle create new property navigation
  const handleCreateProperty = () => {
    setShowCreateModal(true);
  };

  // Handle property creation success
  const handlePropertyCreated = () => {
    setShowCreateModal(false);
    fetchProperties(); // Refresh the properties list
  };

  // Handle create modal cancel
  const handleCreateCancel = () => {
    setShowCreateModal(false);
  };

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-white to-emerald-50 shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <svg className="w-8 h-8 text-emerald-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                My Properties
              </h1>
              <p className="text-gray-600 text-lg">
                Manage your properties to book cleaning services efficiently
              </p>
              
              {/* Property Stats */}
              <div className="flex items-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}
                  </span>
                </div>
                {properties.length === 0 && (
                  <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm">
                    🏠 Add your first property to get started
                  </div>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              {!user?.role && (
                <button
                  onClick={() => navigate('/register')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Complete Registration
                </button>
              )}
              
              <button
                onClick={handleCreateProperty}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Property
              </button>
              
              <button
                onClick={fetchProperties}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading properties...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Properties Grid */}
        {!loading && !error && (
          <>
            {properties.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Properties Found
                </h3>
                <p className="text-gray-600 mb-6">
                  You haven't added any properties yet. Start by adding your first property.
                </p>
                <button
                  onClick={handleCreateProperty}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Add Your First Property
                </button>
              </div>
            ) : (
              <>
                {/* Properties Count */}
                <div className="mb-6">
                  <p className="text-gray-600">
                    Showing {properties.length} {properties.length === 1 ? 'property' : 'properties'}
                  </p>
                </div>

                {/* Properties Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {properties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      onPropertyUpdate={handlePropertyUpdate}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Help Section */}
        {!loading && (
          <div className="mt-12 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Need Help?
            </h3>
            <p className="text-blue-700 mb-4">
              Manage your properties easily with our dashboard. You can add new properties, 
              edit existing ones, and view them on interactive maps.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-blue-900">Add Properties</h4>
                <p className="text-blue-700">Click "Add Property" to register new properties for cleaning services.</p>
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Edit Details</h4>
                <p className="text-blue-700">Click "Edit Property" on any property card to update information.</p>
              </div>
              <div>
                <h4 className="font-medium text-blue-900">View Location</h4>
                <p className="text-blue-700">Each property shows an interactive map with precise location.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Property Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <PropertyCreateForm
              onPropertyCreated={handlePropertyCreated}
              onCancel={handleCreateCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesDashboard;