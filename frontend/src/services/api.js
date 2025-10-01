import axios from 'axios';

// API service configuration per DEVELOPMENT_STANDARDS.md
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
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/auth/login/', credentials);
    // Follow DEVELOPMENT_STANDARDS.md pattern - handle localStorage here and return response.data
    const { access, refresh, user } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post('/auth/register/', userData);
    return response.data;
  },
  updateProfile: async (data) => {
    const response = await api.patch('/auth/profile/', data);
    return response.data;
  },
  changePassword: async (passwordData) => {
    const response = await api.post('/auth/change-password/', passwordData);
    return response.data;
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
};

// Properties API
export const propertiesAPI = {
  getAll: () => api.get('/properties/properties/'),
  getById: (id) => api.get(`/properties/properties/${id}/`),
  create: (data) => api.post('/properties/properties/', data),
  update: (id, data) => api.patch(`/properties/properties/${id}/`, data),
  delete: (id) => api.delete(`/properties/properties/${id}/`),
  getServiceTypes: () => api.get('/properties/service-types/'),
};

// Cleaning Jobs API
export const cleaningJobsAPI = {
  getAll: () => api.get('/jobs/'),
  getById: (id) => api.get(`/jobs/${id}/`),
  create: (data) => api.post('/jobs/', data),
  update: (id, data) => api.patch(`/jobs/${id}/`, data),
  delete: (id) => api.delete(`/jobs/${id}/`),
  updateStatus: (id, status) => api.patch(`/jobs/${id}/`, { status }),
  claimJob: (id) => api.patch(`/jobs/${id}/claim/`),
};

export default api;