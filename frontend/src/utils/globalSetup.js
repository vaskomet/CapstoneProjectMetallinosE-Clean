// Global setup for error handling and loading management
import { LoadingManager } from './errorHandling';

// Initialize global instances
window.globalLoadingManager = new LoadingManager();

// Global toast will be set by ToastProvider when it mounts
window.globalToast = null;

// Export for direct access if needed
export const globalLoadingManager = window.globalLoadingManager;