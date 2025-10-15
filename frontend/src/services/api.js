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
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

// Enhanced API call wrapper with error handling and loading states
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
    if (showLoading && window.globalLoadingManager) {
      window.globalLoadingManager.setLoading(loadingKey, true);
    }

    let result;
    if (retries > 0) {
      result = await retryRequest(requestFunction, retries);
    } else {
      result = await requestFunction();
    }

    if (showSuccess && successMessage && window.globalToast) {
      window.globalToast.success(successMessage);
    }

    return result;
  } catch (error) {
    if (showErrors && window.globalToast) {
      const { message } = error.userMessage || getErrorMessage(error);
      window.globalToast.error(message);
    }
    throw error;
  } finally {
    if (showLoading && window.globalLoadingManager) {
      window.globalLoadingManager.setLoading(loadingKey, false);
    }
  }
};

// Authentication API with enhanced error handling
export const authAPI = {
  login: async (credentials) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/login/', credentials);
        const { access, refresh, user } = response.data;
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
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    
    if (window.globalToast) {
      window.globalToast.info('You have been logged out');
    }
  },
  
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

// Properties API with enhanced error handling
export const propertiesAPI = {
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

// Cleaning Jobs API with enhanced error handling
export const cleaningJobsAPI = {
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

// Job Bids API with enhanced error handling
export const jobBidsAPI = {
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

// Service Areas API with enhanced error handling
export const serviceAreasAPI = {
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

export { apiCall };
export default api;