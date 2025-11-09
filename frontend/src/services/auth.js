/**
 * Authentication API Module
 *
 * Handles user authentication, registration, profile management, and session handling.
 *
 * @module auth
 *
 * @features
 * - User login with JWT token management
 * - New user registration
 * - Profile retrieval and updates
 * - Password management
 * - Session logout and user data access
 *
 * @example
 * ```javascript
 * import { authAPI } from './services/auth';
 *
 * // Login
 * const { user, access, refresh } = await authAPI.login({ email, password });
 *
 * // Get profile
 * const profile = await authAPI.getProfile();
 *
 * // Logout
 * authAPI.logout();
 * ```
 */

import { api, apiCall } from './core';

/**
 * Authentication API
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
        
        // Check if 2FA is required (different response structure)
        if (response.data.requires_2fa) {
          return response.data;
        }
        
        // Regular login (with tokens)
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
   * Verify user email with token from verification email
   * @async
   * @function verifyEmail
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} Verification response
   */
  verifyEmail: async (token) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/verify-email/', { token });
        // Update user in localStorage if logged in
        const currentUser = localStorage.getItem('user');
        if (currentUser) {
          const user = JSON.parse(currentUser);
          user.email_verified = true;
          user.email_verified_at = new Date().toISOString();
          localStorage.setItem('user', JSON.stringify(user));
        }
        return response.data;
      },
      {
        loadingKey: 'auth_verify_email',
        showSuccess: false // Page handles success message
      }
    );
  },

  /**
   * Resend email verification
   * @async
   * @function resendVerification
   * @returns {Promise<Object>} Resend response
   */
  resendVerification: async () => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/resend-verification/');
        return response.data;
      },
      {
        loadingKey: 'auth_resend_verification',
        successMessage: 'Verification email sent! Check your inbox.',
        showSuccess: true
      }
    );
  },

  /**
   * Enable two-factor authentication
   * @async
   * @function enable2FA
   * @returns {Promise<Object>} 2FA setup data with QR code and backup codes
   */
  enable2FA: async () => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/2fa/enable/');
        return response.data;
      },
      {
        loadingKey: 'auth_enable_2fa'
      }
    );
  },

  /**
   * Verify 2FA setup with code from authenticator app
   * @async
   * @function verify2FASetup
   * @param {string} code - 6-digit verification code
   * @returns {Promise<Object>} Verification response
   */
  verify2FASetup: async (code) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/2fa/verify-setup/', { code });
        return response.data;
      },
      {
        loadingKey: 'auth_verify_2fa_setup'
      }
    );
  },

  /**
   * Disable two-factor authentication
   * @async
   * @function disable2FA
   * @param {string} password - User password for confirmation
   * @returns {Promise<Object>} Disable response
   */
  disable2FA: async (password) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/2fa/disable/', { password });
        return response.data;
      },
      {
        loadingKey: 'auth_disable_2fa',
        showSuccess: false  // Don't show toast here, let component handle it
      }
    );
  },

  /**
   * Verify 2FA code during login
   * @async
   * @function verify2FALogin
   * @param {string} email - User email
   * @param {string} code - 6-digit verification code
   * @returns {Promise<Object>} Login response with tokens
   */
  verify2FALogin: async (email, code) => {
    return apiCall(
      async () => {
        const response = await api.post('/auth/2fa/verify-login/', { email, code });
        const { access, refresh, user } = response.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        localStorage.setItem('user', JSON.stringify(user));
        return response.data;
      },
      {
        loadingKey: 'auth_verify_2fa_login'
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

export default authAPI;
