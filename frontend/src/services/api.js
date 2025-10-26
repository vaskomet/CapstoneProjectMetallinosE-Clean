/**
 * E-Cleaner API Service
 *
 * Comprehensive API service layer for the E-Cleaner platform providing centralized
 * HTTP communication with the Django backend. Features automatic JWT token management,
 * request/response interceptors, retry logic, and enhanced error handling.
 *
 * @module api
 *
 * @features
 * - JWT token authentication with automatic refresh
 * - Request/response interceptors for consistent behavior
 * - Automatic retry logic for network failures
 * - Enhanced error handling with user-friendly messages
 * - Loading state management integration
 * - Toast notification integration for feedback
 * - Centralized API call wrapper with configurable options
 * - Modular API sections for different domains (auth, properties, jobs, etc.)
 *
 * @dependencies
 * - axios: HTTP client library
 * - errorHandling utils: Error message generation and retry logic
 * - localStorage: Token and user data persistence
 * - globalToast: Toast notification system
 * - globalLoadingManager: Loading state management
 *
 * @example
 * ```javascript
 * import { authAPI, cleaningJobsAPI } from './services/api';
 *
 * // Login user
 * const loginData = await authAPI.login({ email, password });
 *
 * // Get cleaning jobs with loading and error handling
 * const jobs = await cleaningJobsAPI.getAll({ status: 'active' });
 * ```
 *
 * @example
 * ```javascript
 * // Using the generic apiCall wrapper for custom requests
 * import { apiCall, api } from './services/api';
 *
 * const customRequest = await apiCall(
 *   () => api.get('/custom/endpoint/'),
 *   {
 *     showLoading: true,
 *     successMessage: 'Data loaded successfully!',
 *     loadingKey: 'custom_data'
 *   }
 * );
 * ```
 */

import axios from 'axios';
import { getErrorMessage, retryRequest, ErrorTypes } from '../utils/errorHandling';

// API service configuration per DEVELOPMENT_STANDARDS.md
// Align with API conventions from DEVELOPMENT_STANDARDS.md
const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance with enhanced configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track retry attempts to prevent infinite loops
const retryAttempts = new Map();

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    // Automatically add JWT token to all requests if available
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Token attached to request:', config.url, 'Token exists:', !!token);
    } else {
      console.warn('⚠️ No token found for request:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with enhanced error handling
api.interceptors.response.use(
  (response) => {
    // Clear retry attempts on successful response
    const requestKey = `${response.config.method}:${response.config.url}`;
    retryAttempts.delete(requestKey);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestKey = `${originalRequest.method}:${originalRequest.url}`;

    // Handle token refresh for 401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the access token
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear auth data and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');

        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Handle network errors with retry logic
    if (!error.response && !originalRequest._retryCount) {
      const currentRetries = retryAttempts.get(requestKey) || 0;

      if (currentRetries < 2) { // Max 2 retries for network errors
        retryAttempts.set(requestKey, currentRetries + 1);
        originalRequest._retryCount = currentRetries + 1;

        // Wait before retry (exponential backoff)
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, currentRetries) * 1000)
        );

        return api(originalRequest);
      }
    }

    // Clear retry attempts for this request
    retryAttempts.delete(requestKey);

    // Enhance error with user-friendly message
    const enhancedError = {
      ...error,
      userMessage: getErrorMessage(error)
    };

    return Promise.reject(enhancedError);
  }
);

/**
 * Enhanced API call wrapper with error handling and loading states
 *
 * @async
 * @function apiCall
 * @param {Function} requestFunction - Async function that returns an axios request
 * @param {Object} [options={}] - Configuration options
 * @param {boolean} [options.showLoading=true] - Whether to show loading indicator
 * @param {boolean} [options.showErrors=true] - Whether to show error toasts
 * @param {boolean} [options.showSuccess=false] - Whether to show success toasts
 * @param {string} [options.successMessage=''] - Success message to display
 * @param {string} [options.loadingKey='default'] - Unique key for loading state
 * @param {number} [options.retries=0] - Number of retry attempts
 * @returns {Promise} Response data from the API call
 *
 * @example
 * ```javascript
 * const data = await apiCall(
 *   () => api.get('/endpoint/'),
 *   {
 *     showLoading: true,
 *     successMessage: 'Data loaded!',
 *     loadingKey: 'fetch_data'
 *   }
 * );
 * ```
 */
const apiCall = async (requestFunction, options = {}) => {
  const {
    showLoading = true,
    showErrors = true,
    showSuccess = false,
    successMessage = '',
    loadingKey = 'default',
    retries = 0
  } = options;

  try {
    // Set loading state if loading manager is available
    if (showLoading && window.globalLoadingManager) {
      window.globalLoadingManager.setLoading(loadingKey, true);
    }

    let result;
    // Use retry logic if retries are specified
    if (retries > 0) {
      result = await retryRequest(requestFunction, retries);
    } else {
      result = await requestFunction();
    }

    // Show success message if configured
    if (showSuccess && successMessage && window.globalToast) {
      window.globalToast.success(successMessage);
    }

    return result;
  } catch (error) {
    // Show error message if configured
    if (showErrors && window.globalToast) {
      const { message } = error.userMessage || getErrorMessage(error);
      window.globalToast.error(message);
    }
    throw error;
  } finally {
    // Clear loading state
    if (showLoading && window.globalLoadingManager) {
      window.globalLoadingManager.setLoading(loadingKey, false);
    }
  }
};

/**
 * Authentication API module
 *
 * Handles user authentication, registration, profile management, and session handling.
 *
 * @namespace authAPI
 */
export const authAPI = {
  /**
   * Authenticate user with email and password
   * @async
   * @function login
   * @param {Object} credentials - User login credentials
   * @param {string} credentials.email - User email address
   * @param {string} credentials.password - User password
   * @returns {Promise<Object>} Login response with tokens and user data
   */
  login: async (credentials) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/login/', credentials);
        const { access, refresh, user } = response.data;
        console.log('🔐 Login response tokens:', { 
          hasAccess: !!access, 
          hasRefresh: !!refresh, 
          user: user.email 
        });
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('user', JSON.stringify(user));
        return response.data;
      },
      {
        loadingKey: 'auth_login',
        successMessage: `Welcome back!`,
        showSuccess: true
      }
    );
  },

  /**
   * Register a new user account
   * @async
   * @function register
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email address
   * @param {string} userData.password - User password
   * @param {string} userData.first_name - User first name
   * @param {string} userData.last_name - User last name
   * @param {string} userData.user_type - User type (client/cleaner)
   * @returns {Promise<Object>} Registration response
   */
  register: async (userData) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/register/', userData);
        return response.data;
      },
      {
        loadingKey: 'auth_register',
        successMessage: 'Account created successfully! Please log in.',
        showSuccess: true
      }
    );
  },

  /**
   * Get current user profile information
   * @async
   * @function getProfile
   * @returns {Promise<Object>} Current user profile data
   */
  getProfile: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/auth/profile/');
        return response.data;
      },
      {
        loadingKey: 'auth_get_profile',
        showSuccess: false
      }
    );
  },

  /**
   * Update current user profile information
   * @async
   * @function updateProfile
   * @param {Object} data - Profile update data
   * @returns {Promise<Object>} Updated user profile data
   */
  updateProfile: async (data) => {
    return apiCall(
      async () => {
        const response = await api.patch('/auth/profile/', data);
        return response.data;
      },
      {
        loadingKey: 'auth_profile',
        successMessage: 'Profile updated successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Change user password
   * @async
   * @function changePassword
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.old_password - Current password
   * @param {string} passwordData.new_password - New password
   * @returns {Promise<Object>} Password change response
   */
  changePassword: async (passwordData) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/change-password/', passwordData);
        return response.data;
      },
      {
        loadingKey: 'auth_password',
        successMessage: 'Password changed successfully!',
        showSuccess: true
      }
    );
  },

  /**
   * Logout current user by clearing stored authentication data
   * @function logout
   */
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    if (window.globalToast) {
      window.globalToast.info('You have been logged out');
    }
  },

  /**
   * Get current user data from localStorage
   * @function getCurrentUser
   * @returns {Object|null} Current user data or null if not logged in
   */
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

/**
 * Properties API module
 *
 * Handles property management including CRUD operations and service types.
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

/**
 * Cleaning Jobs API module
 *
 * Handles cleaning job management including CRUD operations and status updates.
 *
 * @namespace cleaningJobsAPI
 */
export const cleaningJobsAPI = {
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

/**
 * Chat API
 * Handles chat room and messaging operations
 */
export const chatAPI = {
  /**
   * Get all chat rooms for current user
   * @async
   * @function getAllRooms
   * @returns {Promise<Array>} Array of chat room objects with metadata
   */
  getAllRooms: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/chat/rooms/');
        return response.data;
      },
      {
        loadingKey: 'chat_rooms_list',
        showSuccess: false
      }
    );
  },

  /**
   * Get chat room by ID
   * @async
   * @function getRoomById
   * @param {number} id - Chat room ID
   * @returns {Promise<Object>} Chat room object
   */
  getRoomById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/chat/rooms/${id}/`);
        return response.data;
      },
      {
        loadingKey: `chat_room_${id}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get messages for a chat room with cursor-based pagination
   * @async
   * @function getMessages
   * @param {number} roomId - Chat room ID
   * @param {Object} options - Pagination options
   * @param {number} [options.before] - Message ID to fetch messages before (scroll up)
   * @param {number} [options.after] - Message ID to fetch messages after (scroll down)
   * @param {number} [options.limit=50] - Number of messages to fetch (max 100)
   * @returns {Promise<Object>} Object containing messages array and pagination metadata
   * @returns {Array} return.messages - Array of message objects
   * @returns {boolean} return.has_more - Whether more messages exist
   * @returns {number} return.count - Total number of messages returned
   * @returns {number} return.oldest_id - ID of oldest message in response
   * @returns {number} return.newest_id - ID of newest message in response
   * 
   * @example
   * // Initial load (most recent 50 messages)
   * const { messages, has_more, oldest_id } = await chatAPI.getMessages(roomId);
   * 
   * // Load older messages (scroll up / pagination)
   * const olderMessages = await chatAPI.getMessages(roomId, { before: oldest_id, limit: 50 });
   * 
   * // Load newer messages (scroll down / catch-up)
   * const newerMessages = await chatAPI.getMessages(roomId, { after: newest_id, limit: 50 });
   */
  getMessages: async (roomId, options = {}) => {
    return apiCall(
      async () => {
        const params = new URLSearchParams();
        
        if (options.before) params.append('before', options.before);
        if (options.after) params.append('after', options.after);
        if (options.limit) params.append('limit', Math.min(options.limit, 100));
        
        const queryString = params.toString();
        const url = `/chat/rooms/${roomId}/messages/${queryString ? '?' + queryString : ''}`;
        
        const response = await api.get(url);
        return response.data;
      },
      {
        loadingKey: `chat_messages_${roomId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Send message to chat room
   * @async
   * @function sendMessage
   * @param {number} roomId - Chat room ID
   * @param {Object} data - Message data
   * @returns {Promise<Object>} Created message object
   */
  sendMessage: async (roomId, data) => {
    return apiCall(
      async () => {
        const response = await api.post(`/chat/rooms/${roomId}/send_message/`, data);
        return response.data;
      },
      {
        loadingKey: `send_message_${roomId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Mark message as read
   * @async
   * @function markAsRead
   * @param {number} messageId - Message ID
   * @returns {Promise<Object>} Response
   */
  markAsRead: async (messageId) => {
    return apiCall(
      async () => {
        const response = await api.post(`/chat/messages/${messageId}/mark_read/`);
        return response.data;
      },
      {
        loadingKey: `mark_read_${messageId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get chat room for a specific job
   * @async
   * @function getJobChatRoom
   * @param {number} jobId - Job ID
   * @returns {Promise<Object>} Chat room object
   */
  getJobChatRoom: async (jobId) => {
    return apiCall(
      async () => {
        const response = await api.get(`/chat/rooms/?job=${jobId}`);
        // Returns first room for this job
        return response.data[0] || null;
      },
      {
        loadingKey: `job_chat_${jobId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Start or get existing direct message conversation with a user
   * @async
   * @function startDirectMessage
   * @param {number} userId - ID of user to message
   * @returns {Promise<Object>} Object with room and created flag
   */
  startDirectMessage: async (userId) => {
    return apiCall(
      async () => {
        const response = await api.post('/chat/rooms/start_dm/', { user_id: userId });
        return response.data;
      },
      {
        loadingKey: `start_dm_${userId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get all direct message conversations for current user
   * @async
   * @function getDirectMessages
   * @returns {Promise<Array>} Array of DM room objects
   */
  getDirectMessages: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/chat/rooms/direct_messages/');
        return response.data;
      },
      {
        loadingKey: 'direct_messages',
        showSuccess: false
      }
    );
  },
};

/**
 * User/Cleaner Search API
 * Location-based cleaner search functionality
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
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    });
  },
};

export { apiCall };
export default api;