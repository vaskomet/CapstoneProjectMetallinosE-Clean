/**
 * API Services Barrel Export
 * 
 * Central export point for all API modules. This file provides backwards
 * compatibility by re-exporting all API modules.
 * 
 * @module services
 */

// Core infrastructure
export { default as api, apiCall, API_BASE_URL } from './core';

// Domain APIs
export { authAPI } from './auth';
export { propertiesAPI } from './properties';
export { cleaningJobsAPI, jobBidsAPI } from './jobs';
export { serviceAreasAPI } from './serviceAreas';
export { chatAPI } from './chat';
export { cleanerSearchAPI } from './cleaners';
export { paymentsAPI } from './payments';
