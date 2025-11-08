/**
 * E-Clean API Service Layer (Backwards Compatibility Export)
 * 
 * This file re-exports all API modules for backwards compatibility with existing code.
 * All API functionality has been moved to domain-specific modules for better organization:
 * 
 * - core.js: Axios instance, interceptors, apiCall wrapper, retry logic
 * - auth.js: Authentication and profile management  
 * - properties.js: Property CRUD operations
 * - jobs.js: Job and bidding management
 * - serviceAreas.js: Service area management
 * - chat.js: Chat rooms and messaging
 * - cleaners.js: Cleaner search and geolocation
 * - payments.js: Payment processing and Stripe integration
 * 
 * Migration Guide:
 * - Old import (still works): import { authAPI } from './services/api';
 * - New import (recommended): import { authAPI } from './services/auth';
 * - Or use barrel export: import { authAPI } from './services';
 * 
 * @deprecated Import from individual modules or services/index.js instead
 * @module services/api
 */

// Re-export everything from the modular structure
export { default as api, apiCall, API_BASE_URL } from './core';
export { authAPI } from './auth';
export { propertiesAPI } from './properties';
export { cleaningJobsAPI, jobBidsAPI } from './jobs';
export { serviceAreasAPI } from './serviceAreas';
export { chatAPI } from './chat';
export { cleanerSearchAPI } from './cleaners';
export { paymentsAPI } from './payments';

// Default export for backwards compatibility
export { default } from './core';
