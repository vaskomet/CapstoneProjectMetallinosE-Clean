/**
 * Cleaner Search API Module
 * 
 * Location-based cleaner search functionality with geolocation support.
 * 
 * @module services/cleaners
 */

import { apiCall } from './core';
import api from './core';

/**
 * User/Cleaner Search API
 * Location-based cleaner search functionality
 * 
 * @namespace cleanerSearchAPI
 */
export const cleanerSearchAPI = {
  /**
   * Search for cleaners by location (lat/lng, city, or postal code)
   * @async
   * @function searchByLocation
   * @param {Object} params - Search parameters
   * @param {number} [params.latitude] - Latitude
   * @param {number} [params.longitude] - Longitude
   * @param {number} [params.max_radius=50] - Maximum search radius in miles
   * @param {string} [params.city] - City name
   * @param {string} [params.state] - State/province
   * @param {string} [params.postal_code] - Postal/ZIP code
   * @returns {Promise<Object>} Object with count and cleaners array
   */
  searchByLocation: async (params) => {
    return apiCall(
      async () => {
        const response = await api.get('/auth/search-cleaners/', { params });
        return response.data;
      },
      {
        loadingKey: 'search_cleaners',
        showSuccess: false
      }
    );
  },

  /**
   * Get current user's geolocation
   * @async
   * @function getCurrentLocation
   * @returns {Promise<Object>} Object with latitude and longitude
   */
  getCurrentLocation: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          // Enhanced error messages
          let errorMessage = 'Unable to get your location';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions in your browser.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Try the test location button.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Try the test location button or check your device location settings.';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: false,  // Use faster, less accurate location (WiFi/IP-based)
          timeout: 30000,  // Increased to 30 seconds
          maximumAge: 300000  // Accept cached location up to 5 minutes old
        }
      );
    });
  },
};
