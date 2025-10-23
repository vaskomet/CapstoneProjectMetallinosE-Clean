/**
 * Global Setup Utilities
 *
 * Initializes global instances and utilities for the E-Cleaner platform frontend.
 * Sets up global loading manager and toast notification system for application-wide access.
 *
 * @module globalSetup
 *
 * @features
 * - Global loading state management initialization
 * - Global toast notification system setup
 * - Window object extensions for cross-component access
 * - Centralized global state coordination
 *
 * @dependencies
 * - LoadingManager: From './errorHandling'
 * - Window object: Browser global object for attaching global utilities
 *
 * @example
 * ```javascript
 * import './utils/globalSetup'; // Initialize globals on app startup
 *
 * // Access global utilities anywhere in the app
 * window.globalLoadingManager.setLoading('api_call', true);
 * window.globalToast?.success('Operation completed!');
 * ```
 */

// Global setup for error handling and loading management
import { LoadingManager } from './errorHandling';

// Initialize global instances
window.globalLoadingManager = new LoadingManager();

// Global toast will be set by ToastProvider when it mounts
window.globalToast = null;

/**
 * Global Loading Manager Export
 *
 * Direct export of the global loading manager instance for explicit imports.
 * Provides the same instance as window.globalLoadingManager for module-based access.
 *
 * @constant {LoadingManager}
 *
 * @example
 * ```javascript
 * import { globalLoadingManager } from './utils/globalSetup';
 *
 * globalLoadingManager.setLoading('user_action', true);
 * ```
 */
export const globalLoadingManager = window.globalLoadingManager;