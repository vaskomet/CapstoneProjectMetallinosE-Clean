import React, { useState, useEffect } from 'react';
import { useNotifications } from '../../hooks/useWebSocket';

/**
 * NotificationToast Component
 *
 * A non-intrusive toast notification system that displays real-time notifications
 * as temporary overlay messages in the top-right corner of the screen.
 *
 * @component
 *
 * @features
 * - Real-time toast notifications with WebSocket integration
 * - Auto-dismiss after 5 seconds with smooth animations
 * - Priority-based color coding (urgent=red, high=orange, medium=blue, low=green)
 * - Click-to-navigate functionality for actionable notifications
 * - Manual dismiss with close button
 * - Stacked toast display for multiple notifications
 * - Smooth slide-in/slide-out animations
 * - Emoji icons for different notification types
 *
 * @dependencies
 * - React hooks: useState, useEffect
 * - useNotifications hook from WebSocket context
 * - Tailwind CSS for styling and animations
 * - Custom icons and emojis for notification types
 *
 * @example
 * ```javascript
 * // Include in main app layout for global notifications
 * function App() {
 *   return React.createElement('div', null,
 *     React.createElement(NotificationToast),
 *     // Other app content
 *   );
 * }
 * ```
 *
 * @example
 * ```javascript
 * // Integration with routing
 * React.createElement(BrowserRouter, null,
 *   React.createElement(NotificationToast),
 *   React.createElement(Routes, null)
 * );
 * ```
 */
const NotificationToast = () => {
  // Extract notifications from WebSocket hook
  const { notifications } = useNotifications();

  // State to manage active toast notifications with animation states
  const [toasts, setToasts] = useState([]);

  // Show toast for new notifications - triggered when notifications array changes
  useEffect(() => {
    // Get the most recent notification (first in array)
    const latestNotification = notifications[0];
    if (latestNotification && !latestNotification.is_read) {
      // Create unique toast ID using timestamp
      const toastId = Date.now();
      const newToast = {
        id: toastId,
        notification: latestNotification,
        isVisible: true
      };

      // Add new toast to the stack
      setToasts(prev => [...prev, newToast]);

      // Auto-remove toast after 5 seconds with animation
      setTimeout(() => {
        // Start fade-out animation
        setToasts(prev =>
          prev.map(toast =>
            toast.id === toastId
              ? { ...toast, isVisible: false }
              : toast
          )
        );

        // Remove from array after animation completes (300ms)
        setTimeout(() => {
          setToasts(prev => prev.filter(toast => toast.id !== toastId));
        }, 300);
      }, 5000);
    }
  }, [notifications]);

  /**
   * Manually removes a toast notification with animation
   * @param {number} toastId - Unique identifier of the toast to remove
   */
  const removeToast = (toastId) => {
    // Start fade-out animation
    setToasts(prev =>
      prev.map(toast =>
        toast.id === toastId
          ? { ...toast, isVisible: false }
          : toast
      )
    );

    // Remove from array after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== toastId));
    }, 300);
  };

  /**
   * Returns Tailwind CSS classes for priority-based toast styling
   * @param {string} priority - Notification priority level
   * @returns {string} CSS classes for toast background and border
   */
  const getToastStyle = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 border-red-600 text-white';
      case 'high':
        return 'bg-orange-500 border-orange-600 text-white';
      case 'medium':
        return 'bg-blue-500 border-blue-600 text-white';
      case 'low':
        return 'bg-green-500 border-green-600 text-white';
      default:
        return 'bg-gray-700 border-gray-800 text-white';
    }
  };

  /**
   * Returns appropriate emoji icon based on notification type
   * @param {string} type - Notification type identifier
   * @returns {string} Emoji icon representing the notification type
   */
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'job_created': return '🆕';
      case 'job_accepted': return '✅';
      case 'job_started': return '🏃‍♂️';
      case 'job_completed': return '🎉';
      case 'job_cancelled': return '❌';
      case 'payment_received': return '💰';
      case 'message_received': return '💬';
      case 'system_alert': return '⚠️';
      case 'reminder': return '🔔';
      default: return '📢';
    }
  };

  // Don't render anything if no toasts are active
  if (toasts.length === 0) return null;

  return (
    // Fixed positioning container for top-right corner toasts
    <div className="fixed top-20 right-4 z-40 space-y-2">
      {/* Render each active toast */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            max-w-sm w-full shadow-lg rounded-lg pointer-events-auto
            border-l-4 transition-all duration-300 ease-in-out transform
            ${toast.isVisible
              ? 'translate-x-0 opacity-100'
              : 'translate-x-full opacity-0'
            }
            ${getToastStyle(toast.notification.priority)}
          `}
        >
          <div className="p-4">
            <div className="flex items-start">
              {/* Notification type icon */}
              <div className="flex-shrink-0">
                <span className="text-xl">
                  {getNotificationIcon(toast.notification.notification_type)}
                </span>
              </div>

              {/* Toast content */}
              <div className="ml-3 w-0 flex-1">
                <p className="text-sm font-medium">
                  {toast.notification.title}
                </p>
                <p className="mt-1 text-sm opacity-90">
                  {toast.notification.message}
                </p>

                {/* Action button - only shown if notification has action_url */}
                {toast.notification.action_url && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        window.location.href = toast.notification.action_url;
                        removeToast(toast.id);
                      }}
                      className="text-sm font-medium underline opacity-90 hover:opacity-100"
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>

              {/* Close button for manual dismissal */}
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  onClick={() => removeToast(toast.id)}
                  className="inline-flex text-white hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white rounded"
                >
                  <span className="sr-only">Close</span>
                  {/* Close icon SVG */}
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;