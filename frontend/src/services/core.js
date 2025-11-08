/**
 * Core API Infrastructure
 *
 * Shared axios instance, interceptors, and utilities for all API modules.
 * Provides JWT token management, automatic refresh, retry logic, and error handling.
 *
 * @module core
 *
 * @features
 * - Configured axios instance with base URL and timeout
 * - JWT token authentication with automatic refresh
 * - Request/response interceptors for consistent behavior
 * - Automatic retry logic for network failures
 * - Enhanced error handling with user-friendly messages
 * - Loading state management integration
 * - Toast notification integration
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
 * import { api, apiCall } from './core';
 *
 * // Direct axios usage
 * const response = await api.get('/endpoint/');
 *
 * // With apiCall wrapper (recommended)
 * const data = await apiCall(
 *   () => api.get('/endpoint/'),
 *   { showLoading: true, successMessage: 'Success!' }
 * );
 * ```
 */

import axios from 'axios';
import { getErrorMessage, retryRequest } from '../utils/errorHandling';

/**
 * API base URL
 * @constant {string}
 */
export const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Configured axios instance
 * @type {import('axios').AxiosInstance}
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track retry attempts to prevent infinite loops
const retryAttempts = new Map();

/**
 * Request interceptor to add JWT token
 */
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

/**
 * Response interceptor with enhanced error handling
 */
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
export const apiCall = async (requestFunction, options = {}) => {
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
 * Default export for convenience
 */
export default api;
