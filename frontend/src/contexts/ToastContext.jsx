/**
 * Toast notification context for global error and success messages
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ToastContext = createContext();

// Toast component for individual toast messages
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