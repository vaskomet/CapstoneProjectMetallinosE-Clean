/**
 * Toast Notification Context
 *
 * React context for managing global toast notifications throughout the E-Cleaner platform.
 * Provides a centralized system for displaying success, error, warning, and info messages
 * with automatic dismissal and smooth animations.
 *
 * @module ToastContext
 *
 * @features
 * - Multiple toast types (success, error, warning, info)
 * - Automatic dismissal with configurable duration
 * - Smooth slide-in animations with staggered timing
 * - Global access via window.globalToast for API services
 * - TypeScript-like prop validation with JSDoc
 * - Accessible close buttons and ARIA labels
 *
 * @dependencies
 * - React: Core React hooks (useState, useEffect, useContext)
 * - Tailwind CSS: Utility classes for styling and animations
 * - Heroicons: SVG icons for different toast types
 *
 * @example
 * ```jsx
 * import { ToastProvider, useToast } from './contexts/ToastContext';
 *
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <ToastProvider>
 *       <YourAppComponents />
 *     </ToastProvider>
 *   );
 * }
 *
 * // Use the hook in components
 * function MyComponent() {
 *   const toast = useToast();
 *
 *   const handleSuccess = () => {
 *     toast.success('Operation completed successfully!');
 *   };
 *
 *   const handleError = () => {
 *     toast.error('Something went wrong!', 10000); // 10 second duration
 *   };
 *
 *   return <button onClick={handleSuccess}>Complete Action</button>;
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ToastContext = createContext();

/**
 * Individual Toast Component
 *
 * Renders a single toast notification with appropriate styling, icon, and close button.
 * Supports different types (success, error, warning, info) with distinct visual styling.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.toast - Toast notification object
 * @param {number} props.toast.id - Unique identifier for the toast
 * @param {string} props.toast.message - Message text to display
 * @param {string} props.toast.type - Toast type ('success' | 'error' | 'warning' | 'info')
 * @param {number} props.toast.duration - Auto-dismiss duration in milliseconds
 * @param {Function} props.onRemove - Callback function to remove the toast
 * @returns {JSX.Element} Rendered toast notification
 *
 * @example
 * ```jsx
 * <Toast
 *   toast={{ id: 1, message: 'Success!', type: 'success', duration: 5000 }}
 *   onRemove={(id) => console.log('Remove toast', id)}
 * />
 * ```
 */
const Toast = ({ toast, onRemove }) => {
  const getToastStyles = (type) => {
    const baseStyles = "p-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out border-l-4";
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-500 text-white border-green-700`;
      case 'error':
        return `${baseStyles} bg-red-500 text-white border-red-700`;
      case 'warning':
        return `${baseStyles} bg-yellow-500 text-white border-yellow-700`;
      case 'info':
      default:
        return `${baseStyles} bg-blue-500 text-white border-blue-700`;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className={getToastStyles(toast.type)}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon(toast.type)}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium leading-relaxed">
            {toast.message}
          </p>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 ml-3 hover:opacity-75 transition-opacity"
          aria-label="Close notification"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Toast container component
/**
 * Toast Container Component
 *
 * Container component that renders all active toast notifications in a fixed position.
 * Manages the layout and animation timing for multiple toasts with staggered slide-in effects.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.toasts - Array of active toast objects
 * @param {Function} props.onRemove - Callback to remove a specific toast by ID
 * @returns {JSX.Element|null} Toast container or null if no toasts
 *
 * @example
 * ```jsx
 * <ToastContainer
 *   toasts={[
 *     { id: 1, message: 'Success!', type: 'success' },
 *     { id: 2, message: 'Error occurred', type: 'error' }
 *   ]}
 *   onRemove={(id) => removeToast(id)}
 * />
 * ```
 */
const ToastContainer = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="animate-slide-in-right"
          style={{
            animationDelay: `${index * 100}ms`
          }}
        >
          <Toast toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

// Provider component
/**
 * Toast Provider Component
 *
 * React context provider that manages the global toast notification state.
 * Provides toast methods to child components and renders the toast container.
 * Also sets up a global window reference for API service access.
 *
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} Provider component with toast container
 *
 * @example
 * ```jsx
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 * ```
 */
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  const addToast = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  };
  
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  const toastMethods = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
  };

  // Set global reference for API service access
  useEffect(() => {
    window.globalToast = toastMethods;
    return () => {
      window.globalToast = null;
    };
  }, [toastMethods]);
  
  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

// Hook for using toast context
/**
 * useToast Hook
 *
 * Custom React hook for accessing toast notification methods.
 * Must be used within a ToastProvider component.
 *
 * @returns {Object} Toast methods interface
 * @property {Function} success - Show success toast message
 * @property {Function} error - Show error toast message
 * @property {Function} warning - Show warning toast message
 * @property {Function} info - Show info toast message
 * @throws {Error} If used outside of ToastProvider
 *
 * @example
 * ```javascript
 * const toast = useToast();
 *
 * // Show different types of toasts
 * toast.success('Operation completed!');
 * toast.error('Something went wrong!');
 * toast.warning('Please check your input');
 * toast.info('New feature available');
 *
 * // Custom duration (0 = no auto-dismiss)
 * toast.success('Important message', 0);
 * ```
 */
const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Export everything properly for Fast Refresh
export { ToastProvider, useToast };
export default ToastProvider;