/**
 * Recommendations API
 * 
 * Provides endpoints for algorithmic cleaner recommendations.
 * 
 * Features:
 * - Cleaner recommendations for locations based on ratings, experience, and completion rate
 * 
 * @module services/recommendations
 */

import { api, apiCall } from './core';

/**
 * Recommendations API endpoints
 */
export const recommendationsAPI = {
  /**
   * Get cleaner recommendations for a location
   * 
   * @param {Object} params - Search parameters
   * @param {number} params.latitude - Job location latitude (required)
   * @param {number} params.longitude - Job location longitude (required)
   * @param {number} [params.max_radius=15] - Search radius in km
   * @param {string} [params.property_type='apartment'] - Property type
   * @param {number} [params.property_size] - Property size in sq meters
   * @param {number} [params.top_k=10] - Number of recommendations
   * @param {number} [params.job_id] - Existing job ID for context
   * 
   * @returns {Promise<Object>} Recommendation results
   * @example
   * const result = await recommendationsAPI.getCleanersForLocation({
   *   latitude: 37.9755,
   *   longitude: 23.7348,
   *   max_radius: 15,
   *   property_type: 'apartment',
   *   top_k: 5
   * });
   * // Returns:
   * // {
   * //   count: 5,
   * //   recommendations: [
   * //     {
   * //       cleaner: {...},
   * //       score: 0.87,
   * //       distance_km: 2.3,
   * //       stats: {...}
   * //     }
   * //   ],
   * //   ml_enabled: false,
   * //   fallback_mode: true
   * // }
   */
  getCleanersForLocation: async (params) => {
    return apiCall(
      async () => {
        const response = await api.get('/recommendations/cleaners-for-location/', { params });
        return response.data;
      },
      {
        loadingKey: 'recommendations_cleaners',
        showSuccess: false,
        showErrors: true,
        retries: 2
      }
    );
  },
};

export default recommendationsAPI;
