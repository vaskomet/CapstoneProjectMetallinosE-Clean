/**
 * Error handling utilities for the E-Clean platform
 * Provides user-friendly error messages and feedback
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
 * Extract user-friendly error message from API error response
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
 * Extract validation errors from Django REST Framework error response
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
 * Format field names for user display
 */
const formatFieldName = (fieldName) => {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Show error toast notification
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
 * Show success toast notification
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
 * Retry mechanism for failed requests
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
 * Loading state manager for async operations
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

export const globalLoadingManager = new LoadingManager();