/**
 * Error Handling Utilities
 *
 * Comprehensive error handling system for the E-Cleaner platform frontend.
 * Provides user-friendly error messages, validation error extraction, toast notifications,
 * retry mechanisms, and loading state management.
 *
 * @module errorHandling
 *
 * @features
 * - HTTP status code mapping to user-friendly messages
 * - Django REST Framework validation error extraction
 * - Automatic retry mechanism for failed requests
 * - Global loading state management
 * - Toast notification integration
 * - Field name formatting for display
 * - Network error detection and handling
 *
 * @dependencies
 * - None (pure JavaScript utilities)
 *
 * @example
 * ```javascript
 * import {
 *   getErrorMessage,
 *   showErrorToast,
 *   retryRequest,
 *   globalLoadingManager
 * } from './utils/errorHandling';
 *
 * // Extract user-friendly error message
 * try {
 *   await apiCall();
 * } catch (error) {
 *   const { message, type } = getErrorMessage(error);
 *   showErrorToast(error, toastFunction);
 * }
 *
 * // Retry failed request
 * const result = await retryRequest(() => apiCall(), 3, 1000);
 *
 * // Manage loading states
 * globalLoadingManager.setLoading('api_call', true);
 * if (globalLoadingManager.isLoading('api_call')) {
 *   // Show loading indicator
 * }
 * ```
 */

/**
 * Error Type Constants
 *
 * Enumeration of error types used throughout the application for consistent error categorization.
 *
 * @enum {string}
 */
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
};

/**
 * User-Friendly Error Messages
 *
 * Predefined user-friendly error messages mapped to error types.
 * These messages are designed to be clear, actionable, and non-technical.
 *
 * @constant {Object.<string, string>}
 */
export const UserFriendlyMessages = {
  [ErrorTypes.NETWORK_ERROR]: "Network connection issue. Please check your internet connection and try again.",
  [ErrorTypes.AUTHENTICATION_ERROR]: "Your session has expired. Please log in again.",
  [ErrorTypes.VALIDATION_ERROR]: "Please check your input and try again.",
  [ErrorTypes.PERMISSION_ERROR]: "You don't have permission to perform this action.",
  [ErrorTypes.SERVER_ERROR]: "Something went wrong on our end. Please try again in a few moments.",
  [ErrorTypes.NOT_FOUND_ERROR]: "The requested resource was not found.",
  [ErrorTypes.TIMEOUT_ERROR]: "Request timed out. Please try again.",
};

/**
 * Extract User-Friendly Error Message
 *
 * Converts raw API error responses into user-friendly error objects with consistent messaging.
 * Handles various error scenarios including network issues, authentication, validation, and server errors.
 *
 * @function getErrorMessage
 * @param {Object} error - Error object from API call (typically Axios error)
 * @param {Object} [error.response] - HTTP response object
 * @param {number} error.response.status - HTTP status code
 * @param {Object} error.response.data - Response data containing error details
 * @param {string} [error.code] - Error code for network issues
 * @returns {Object} Error information object
 * @property {string} type - Error type from ErrorTypes enum
 * @property {string} message - User-friendly error message
 * @property {Array} [details] - Array of specific validation errors (for 400 responses)
 *
 * @example
 * ```javascript
 * try {
 *   await api.post('/users/', userData);
 * } catch (error) {
 *   const { type, message, details } = getErrorMessage(error);
 *   console.log(`${type}: ${message}`);
 *   if (details) {
 *     details.forEach(detail => console.log(`- ${detail}`));
 *   }
 * }
 * ```
 */
export const getErrorMessage = (error) => {
  // Network/connection errors
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return {
        type: ErrorTypes.TIMEOUT_ERROR,
        message: UserFriendlyMessages[ErrorTypes.TIMEOUT_ERROR]
      };
    }
    return {
      type: ErrorTypes.NETWORK_ERROR,
      message: UserFriendlyMessages[ErrorTypes.NETWORK_ERROR]
    };
  }

  const { status, data } = error.response;
  
  switch (status) {
    case 400:
      // Extract specific validation errors
      if (data && typeof data === 'object') {
        const validationErrors = extractValidationErrors(data);
        return {
          type: ErrorTypes.VALIDATION_ERROR,
          message: validationErrors.length > 0 
            ? validationErrors.join(', ') 
            : UserFriendlyMessages[ErrorTypes.VALIDATION_ERROR],
          details: validationErrors
        };
      }
      return {
        type: ErrorTypes.VALIDATION_ERROR,
        message: data?.message || data?.detail || UserFriendlyMessages[ErrorTypes.VALIDATION_ERROR]
      };

    case 401:
      return {
        type: ErrorTypes.AUTHENTICATION_ERROR,
        message: UserFriendlyMessages[ErrorTypes.AUTHENTICATION_ERROR]
      };

    case 403:
      return {
        type: ErrorTypes.PERMISSION_ERROR,
        message: data?.detail || UserFriendlyMessages[ErrorTypes.PERMISSION_ERROR]
      };

    case 404:
      return {
        type: ErrorTypes.NOT_FOUND_ERROR,
        message: data?.detail || UserFriendlyMessages[ErrorTypes.NOT_FOUND_ERROR]
      };

    case 409:
      return {
        type: ErrorTypes.VALIDATION_ERROR,
        message: data?.detail || "This action conflicts with existing data."
      };

    case 429:
      return {
        type: ErrorTypes.VALIDATION_ERROR,
        message: "Too many requests. Please wait a moment and try again."
      };

    case 500:
    case 502:
    case 503:
    case 504:
      return {
        type: ErrorTypes.SERVER_ERROR,
        message: UserFriendlyMessages[ErrorTypes.SERVER_ERROR]
      };

    default:
      return {
        type: ErrorTypes.SERVER_ERROR,
        message: data?.detail || data?.message || "An unexpected error occurred."
      };
  }
};

/**
 * Extract Validation Errors from Django REST Framework
 *
 * Parses Django REST Framework validation error responses and extracts field-specific errors.
 * Handles both field errors and non-field errors, formatting them for user display.
 *
 * @function extractValidationErrors
 * @private
 * @param {Object|Array|string} data - Validation error data from API response
 * @returns {Array<string>} Array of formatted validation error messages
 *
 * @example
 * ```javascript
 * // Input: { email: ["Enter a valid email address."], password: ["This field is required."] }
 * // Output: ["Email: Enter a valid email address.", "Password: This field is required."]
 * const errors = extractValidationErrors(validationData);
 * ```
 */
const extractValidationErrors = (data) => {
  const errors = [];
  
  if (typeof data === 'string') {
    return [data];
  }
  
  if (Array.isArray(data)) {
    return data.map(String);
  }
  
  // Handle DRF field errors
  Object.keys(data).forEach(field => {
    const fieldErrors = data[field];
    if (Array.isArray(fieldErrors)) {
      fieldErrors.forEach(error => {
        if (field === 'non_field_errors') {
          errors.push(error);
        } else {
          errors.push(`${formatFieldName(field)}: ${error}`);
        }
      });
    } else if (typeof fieldErrors === 'string') {
      if (field === 'non_field_errors') {
        errors.push(fieldErrors);
      } else {
        errors.push(`${formatFieldName(field)}: ${fieldErrors}`);
      }
    }
  });
  
  return errors;
};

/**
 * Format Field Names for User Display
 *
 * Converts API field names (snake_case) into user-friendly display names (Title Case).
 * Handles underscores and camelCase conversion for better readability.
 *
 * @function formatFieldName
 * @private
 * @param {string} fieldName - Raw field name from API
 * @returns {string} Formatted field name for display
 *
 * @example
 * ```javascript
 * formatFieldName('first_name');     // "First Name"
 * formatFieldName('phoneNumber');     // "Phone Number"
 * formatFieldName('user_profile');    // "User Profile"
 * ```
 */
const formatFieldName = (fieldName) => {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Show Error Toast Notification
 *
 * Displays an error toast notification using the provided toast function.
 * Automatically extracts user-friendly error messages from API errors.
 *
 * @function showErrorToast
 * @param {Object} error - Error object from API call
 * @param {Function} [toastFunction] - Toast notification function (optional)
 * @param {Object} [toastFunction.options] - Toast options object
 * @param {string} toastFunction.options.title - Toast title
 * @param {string} toastFunction.options.description - Toast description
 * @param {string} toastFunction.options.status - Toast status ('error', 'success', etc.)
 * @param {number} toastFunction.options.duration - Toast duration in milliseconds
 * @param {boolean} toastFunction.options.isClosable - Whether toast can be closed
 *
 * @example
 * ```javascript
 * try {
 *   await apiCall();
 * } catch (error) {
 *   showErrorToast(error, (options) => {
 *     // Your toast implementation
 *     showToast(options);
 *   });
 * }
 * ```
 */
export const showErrorToast = (error, toastFunction) => {
  const { message, details } = getErrorMessage(error);
  
  if (toastFunction) {
    toastFunction({
      title: "Error",
      description: message,
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  } else {
    console.error('Error:', message, details);
  }
};

/**
 * Show Success Toast Notification
 *
 * Displays a success toast notification with the provided message.
 *
 * @function showSuccessToast
 * @param {string} message - Success message to display
 * @param {Function} [toastFunction] - Toast notification function (optional)
 * @param {Object} [toastFunction.options] - Toast options object
 * @param {string} toastFunction.options.title - Toast title
 * @param {string} toastFunction.options.description - Toast description
 * @param {string} toastFunction.options.status - Toast status ('success')
 * @param {number} toastFunction.options.duration - Toast duration in milliseconds
 * @param {boolean} toastFunction.options.isClosable - Whether toast can be closed
 *
 * @example
 * ```javascript
 * showSuccessToast('Profile updated successfully!', (options) => {
 *   showToast(options);
 * });
 * ```
 */
export const showSuccessToast = (message, toastFunction) => {
  if (toastFunction) {
    toastFunction({
      title: "Success",
      description: message,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  } else {
    console.log('Success:', message);
  }
};

/**
 * Retry Mechanism for Failed Requests
 *
 * Automatically retries failed API requests with exponential backoff.
 * Does not retry client errors (4xx) except for specific cases like timeouts.
 *
 * @function retryRequest
 * @param {Function} requestFunction - Async function that makes the API request
 * @param {number} [maxRetries=3] - Maximum number of retry attempts
 * @param {number} [delay=1000] - Base delay in milliseconds between retries
 * @returns {Promise} Result of the successful request
 * @throws {Error} Last error encountered if all retries fail
 *
 * @example
 * ```javascript
 * const result = await retryRequest(
 *   () => api.get('/unstable-endpoint'),
 *   3,    // max retries
 *   1000  // base delay
 * );
 * ```
 */
export const retryRequest = async (requestFunction, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFunction();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx) except for network issues
      if (error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 408) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
};

/**
 * Loading State Manager Class
 *
 * Manages loading states for multiple async operations with listener pattern.
 * Allows components to subscribe to loading state changes and react accordingly.
 *
 * @class LoadingManager
 *
 * @example
 * ```javascript
 * const loadingManager = new LoadingManager();
 *
 * // Set loading state
 * loadingManager.setLoading('api_call', true);
 *
 * // Check loading state
 * if (loadingManager.isLoading('api_call')) {
 *   // Show loading indicator
 * }
 *
 * // Subscribe to changes
 * const unsubscribe = loadingManager.addListener((states) => {
 *   console.log('Loading states changed:', states);
 * });
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
    this.listeners = new Set();
  }
  
  setLoading(key, isLoading) {
    this.loadingStates.set(key, isLoading);
    this.notifyListeners();
  }
  
  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }
  
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.loadingStates));
  }
}

/**
 * Global Loading Manager Instance
 *
 * Singleton instance of LoadingManager for application-wide loading state management.
 * Use this instance to manage loading states across the entire application.
 *
 * @constant {LoadingManager}
 *
 * @example
 * ```javascript
 * import { globalLoadingManager } from './utils/errorHandling';
 *
 * // Set global loading state
 * globalLoadingManager.setLoading('user_profile', true);
 *
 * // Check in components
 * const isLoading = globalLoadingManager.isLoading('user_profile');
 * ```
 */
export const globalLoadingManager = new LoadingManager();