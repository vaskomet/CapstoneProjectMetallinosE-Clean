import axios from 'axios';

// API service configuration per DEVELOPMENT_STANDARDS.md
// Test with console.log(response.data) to verify token and user data
// Align with API conventions from DEVELOPMENT_STANDARDS.md
const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          return api(original);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login/', credentials),
  register: (userData) => api.post('/auth/register/', userData),
  refreshToken: (refreshToken) => api.post('/token/refresh/', { refresh: refreshToken }),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (data) => api.patch('/auth/profile/', data),
  changePassword: (passwordData) => api.post('/auth/change-password/', passwordData),
};

// Properties API
export const propertiesAPI = {
  getAll: () => api.get('/properties/'),
  getById: (id) => api.get(`/properties/${id}/`),
  create: (data) => api.post('/properties/', data),
  update: (id, data) => api.patch(`/properties/${id}/`, data),
  delete: (id) => api.delete(`/properties/${id}/`),
  getServiceTypes: () => api.get('/properties/service-types/'),
};

// Cleaning Jobs API
export const cleaningJobsAPI = {
  getAll: () => api.get('/cleaning-jobs/'),
  getById: (id) => api.get(`/cleaning-jobs/${id}/`),
  create: (data) => api.post('/cleaning-jobs/', data),
  update: (id, data) => api.patch(`/cleaning-jobs/${id}/`, data),
  delete: (id) => api.delete(`/cleaning-jobs/${id}/`),
  updateStatus: (id, status) => api.patch(`/cleaning-jobs/${id}/`, { status }),
};

export default api;