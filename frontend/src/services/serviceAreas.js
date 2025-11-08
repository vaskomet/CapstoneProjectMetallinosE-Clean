/**
 * Service Areas API Module
 * 
 * Handles service area management for geographic coverage definition.
 * 
 * @module services/serviceAreas
 */

import { apiCall } from './core';
import api from './core';

/**
 * Service Areas API module
 *
 * Handles service area management for geographic coverage definition.
 *
 * @namespace serviceAreasAPI
 */
export const serviceAreasAPI = {
  /**
   * Get all service areas
   * @async
   * @function getAll
   * @returns {Promise<Array>} Array of service area objects
   */
  getAll: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/auth/service-areas/');
        return response.data;
      },
      {
        loadingKey: 'service_areas_list',
        showSuccess: false
      }
    );
  },

  /**
   * Get service area by ID
   * @async
   * @function getById
   * @param {number} id - Service area ID
   * @returns {Promise<Object>} Service area object
   */
  getById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/auth/service-areas/${id}/`);
        return response.data;
      },
      {
        loadingKey: `service_area_${id}`,
        showSuccess: false
      }
    );
  },

  /**
   * Create a new service area
   * @async
   * @function create
   * @param {Object} data - Service area creation data
   * @returns {Promise<Object>} Created service area object
   */
  create: async (data) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/service-areas/', data);
        return response.data;
      },
      {
        loadingKey: 'service_area_create',
        successMessage: 'Service area created successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Update existing service area
   * @async
   * @function update
   * @param {number} id - Service area ID
   * @param {Object} data - Service area update data
   * @returns {Promise<Object>} Updated service area object
   */
  update: async (id, data) => {
    return apiCall(
      async () => {
        const response = await api.patch(`/auth/service-areas/${id}/`, data);
        return response.data;
      },
      {
        loadingKey: `service_area_update_${id}`,
        successMessage: 'Service area updated successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Delete service area
   * @async
   * @function delete
   * @param {number} id - Service area ID
   * @returns {Promise<Object>} Deletion response
   */
  delete: async (id) => {
    return apiCall(
      async () => {
        const response = await api.delete(`/auth/service-areas/${id}/`);
        return response.data;
      },
      {
        loadingKey: `service_area_delete_${id}`,
        successMessage: 'Service area deleted successfully!',
        showSuccess: true
      }
    );
  },
};
