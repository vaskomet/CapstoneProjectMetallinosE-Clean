/**
 * Properties API Module
 * 
 * Handles property management operations including CRUD and service types.
 * 
 * @module services/properties
 */

import { apiCall } from './core';
import api from './core';

/**
 * Properties API
 * 
 * @namespace propertiesAPI
 */
export const propertiesAPI = {
  /**
   * Get all properties
   * @async
   * @function getAll
   * @returns {Promise<Array>} Array of property objects
   */
  getAll: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/properties/properties/');
        return response.data;
      },
      {
        loadingKey: 'properties_list',
        showSuccess: false
      }
    );
  },

  /**
   * Get property by ID
   * @async
   * @function getById
   * @param {number} id - Property ID
   * @returns {Promise<Object>} Property object
   */
  getById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/properties/properties/${id}/`);
        return response.data;
      },
      {
        loadingKey: `property_${id}`,
        showSuccess: false
      }
    );
  },

  /**
   * Create a new property
   * @async
   * @function create
   * @param {Object} data - Property creation data
   * @returns {Promise<Object>} Created property object
   */
  create: async (data) => {
    return apiCall(
      async () => {
        const response = await api.post('/properties/properties/', data);
        return response.data;
      },
      {
        loadingKey: 'property_create',
        successMessage: 'Property created successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Update existing property
   * @async
   * @function update
   * @param {number} id - Property ID
   * @param {Object} data - Property update data
   * @returns {Promise<Object>} Updated property object
   */
  update: async (id, data) => {
    return apiCall(
      async () => {
        const response = await api.patch(`/properties/properties/${id}/`, data);
        return response.data;
      },
      {
        loadingKey: `property_update_${id}`,
        successMessage: 'Property updated successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Delete property
   * @async
   * @function delete
   * @param {number} id - Property ID
   * @returns {Promise<Object>} Deletion response
   */
  delete: async (id) => {
    return apiCall(
      async () => {
        const response = await api.delete(`/properties/properties/${id}/`);
        return response.data;
      },
      {
        loadingKey: `property_delete_${id}`,
        successMessage: 'Property deleted successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Get available service types
   * @async
   * @function getServiceTypes
   * @returns {Promise<Array>} Array of service type objects
   */
  getServiceTypes: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/properties/service-types/');
        return response.data;
      },
      {
        loadingKey: 'service_types',
        showSuccess: false
      }
    );
  },
};
