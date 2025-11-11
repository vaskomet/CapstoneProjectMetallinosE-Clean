/**
 * Jobs and Bids API Module
 * 
 * Handles cleaning job management and bidding functionality.
 * 
 * @module services/jobs
 */

import { apiCall } from './core';
import api from './core';

/**
 * Cleaning Jobs API module
 *
 * Handles cleaning job management including CRUD operations and status updates.
 *
 * @namespace cleaningJobsAPI
 */
export const cleaningJobsAPI = {
  /**
   * Get dashboard statistics for client
   * @async
   * @function getClientStats
   * @returns {Promise<Object>} Client dashboard stats
   */
  getClientStats: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/jobs/dashboard/client-stats/');
        return response.data;
      },
      {
        loadingKey: 'client_stats',
        showSuccess: false
      }
    );
  },

  /**
   * Get dashboard statistics for cleaner
   * @async
   * @function getCleanerStats
   * @returns {Promise<Object>} Cleaner dashboard stats
   */
  getCleanerStats: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/jobs/dashboard/cleaner-stats/');
        return response.data;
      },
      {
        loadingKey: 'cleaner_stats',
        showSuccess: false
      }
    );
  },

  /**
   * Get all cleaning jobs with optional filtering
   * @async
   * @function getAll
   * @param {Object} [params={}] - Query parameters for filtering
   * @returns {Promise<Array>} Array of job objects
   */
  getAll: async (params = {}) => {
    return apiCall(
      async () => {
        const response = await api.get('/jobs/', { params });
        return response.data;
      },
      {
        loadingKey: 'jobs_list',
        showSuccess: false
      }
    );
  },

  /**
   * Get job by ID
   * @async
   * @function getById
   * @param {number} id - Job ID
   * @returns {Promise<Object>} Job object
   */
  getById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/jobs/${id}/`);
        return response.data;
      },
      {
        loadingKey: `job_${id}`,
        showSuccess: false
      }
    );
  },

  /**
   * Create a new cleaning job
   * @async
   * @function create
   * @param {Object} data - Job creation data
   * @returns {Promise<Object>} Created job object
   */
  create: async (data) => {
    return apiCall(
      async () => {
        const response = await api.post('/jobs/', data);
        return response.data;
      },
      {
        loadingKey: 'job_create',
        successMessage: 'Job created successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Update existing job
   * @async
   * @function update
   * @param {number} id - Job ID
   * @param {Object} data - Job update data
   * @returns {Promise<Object>} Updated job object
   */
  update: async (id, data) => {
    return apiCall(
      async () => {
        const response = await api.patch(`/jobs/${id}/`, data);
        return response.data;
      },
      {
        loadingKey: `job_update_${id}`,
        successMessage: 'Job updated successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Delete job
   * @async
   * @function delete
   * @param {number} id - Job ID
   * @returns {Promise<Object>} Deletion response
   */
  delete: async (id) => {
    return apiCall(
      async () => {
        const response = await api.delete(`/jobs/${id}/`);
        return response.data;
      },
      {
        loadingKey: `job_delete_${id}`,
        successMessage: 'Job deleted successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Update job status
   * @async
   * @function updateStatus
   * @param {number} id - Job ID
   * @param {string} status - New job status
   * @returns {Promise<Object>} Status update response
   */
  updateStatus: async (id, status) => {
    return apiCall(
      async () => {
        const response = await api.patch(`/jobs/${id}/status/`, { status });
        return response.data;
      },
      {
        loadingKey: `job_status_${id}`,
        successMessage: `Job status updated to ${status}!`,
        showSuccess: true
      }
    );
  },

  /**
   * Get search autocomplete suggestions
   * @async
   * @function autocomplete
   * @param {string} query - Search query (minimum 2 characters)
   * @param {number} [limit=5] - Maximum suggestions per category
   * @returns {Promise<Object>} Autocomplete suggestions by category
   */
  autocomplete: async (query, limit = 5) => {
    return apiCall(
      async () => {
        const response = await api.get('/jobs/autocomplete/', {
          params: { q: query, limit }
        });
        return response.data;
      },
      {
        loadingKey: 'autocomplete',
        showSuccess: false,
        showError: false, // Don't show error toast for autocomplete
      }
    );
  },
};

/**
 * Job Bids API module
 *
 * Handles job bidding functionality including bid creation, acceptance, and withdrawal.
 *
 * @namespace jobBidsAPI
 */
export const jobBidsAPI = {
  /**
   * Get all job bids
   * @async
   * @function getAll
   * @returns {Promise<Array>} Array of bid objects
   */
  getAll: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/jobs/bids/');
        return response.data;
      },
      {
        loadingKey: 'bids_list',
        showSuccess: false
      }
    );
  },

  /**
   * Get bid by ID
   * @async
   * @function getById
   * @param {number} id - Bid ID
   * @returns {Promise<Object>} Bid object
   */
  getById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/jobs/bids/${id}/`);
        return response.data;
      },
      {
        loadingKey: `bid_${id}`,
        showSuccess: false
      }
    );
  },

  /**
   * Create a new bid for a job
   * @async
   * @function create
   * @param {Object} data - Bid creation data
   * @returns {Promise<Object>} Created bid object
   */
  create: async (data) => {
    return apiCall(
      async () => {
        const response = await api.post('/jobs/bids/', data);
        return response.data;
      },
      {
        loadingKey: 'bid_create',
        successMessage: 'Bid submitted successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Accept a bid (client action)
   * @async
   * @function acceptBid
   * @param {number} id - Bid ID to accept
   * @returns {Promise<Object>} Bid acceptance response
   */
  acceptBid: async (id) => {
    return apiCall(
      async () => {
        const response = await api.patch(`/jobs/bids/${id}/accept/`);
        return response.data;
      },
      {
        loadingKey: `bid_accept_${id}`,
        successMessage: 'Bid accepted successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Withdraw a bid (cleaner action)
   * @async
   * @function withdrawBid
   * @param {number} id - Bid ID to withdraw
   * @returns {Promise<Object>} Bid withdrawal response
   */
  withdrawBid: async (id) => {
    return apiCall(
      async () => {
        const response = await api.delete(`/jobs/bids/${id}/`);
        return response.data;
      },
      {
        loadingKey: `bid_withdraw_${id}`,
        successMessage: 'Bid withdrawn successfully!',
        showSuccess: true
      }
    );
  },
};
