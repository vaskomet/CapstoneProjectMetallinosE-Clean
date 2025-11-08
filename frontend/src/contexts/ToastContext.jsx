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
    const baseStyles = "p-4 rounded-xl shadow-2xl transform transition-all duration-300 ease-in-out backdrop-blur-sm";
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-gradient-to-r from-green-500 to-green-600 text-white border border-green-400`;
      case 'error':
        return `${baseStyles} bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-400`;
      case 'warning':
        return `${baseStyles} bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border border-yellow-400`;
      case 'info':
      default:
        return `${baseStyles} bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400`;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // Split message by newlines for multi-line support
  const messageLines = toast.message.split('\n').filter(line => line.trim());

  return (
    <div className={getToastStyles(toast.type)}>
      <div className="flex items-start space-x-3 min-w-[320px] max-w-md">
        <div className="flex-shrink-0 mt-0.5 animate-pulse">
          {getIcon(toast.type)}
        </div>
        <div className="flex-1 min-w-0">
          {messageLines.map((line, index) => (
            <p 
              key={index}
              className={`text-sm leading-relaxed break-words ${
                index === 0 ? 'font-bold text-base' : 'font-normal mt-1 opacity-95'
              }`}
            >
              {line}
            </p>
          ))}
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 ml-2 hover:bg-white/20 rounded-lg p-1 transition-all duration-200"
          aria-label="Close notification"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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
    <div className="fixed top-20 right-6 z-[9999] space-y-3 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="animate-slide-in-right pointer-events-auto"
          style={{
            animationDelay: `${index * 100}ms`,
            animationFillMode: 'both'
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