import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useWebSocket';

/**
 * NotificationBell Component
 *
 * A comprehensive notification management component that provides a bell icon with dropdown
 * functionality for displaying and interacting with user notifications in real-time.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string} [props.className=""] - Additional CSS classes for styling customization
 *
 * @features
 * - Real-time notification display with WebSocket integration
 * - Dropdown menu with notification list and actions
 * - Unread count badge on bell icon
 * - Connection status indicator
 * - Priority-based notification styling
 * - Time-ago formatting for notification timestamps
 * - Click-to-navigate functionality for actionable notifications
 * - Mark as read functionality (individual and bulk)
 * - Responsive design with hover states
 * - Auto-close dropdown on outside clicks
 *
 * @dependencies
 * - React hooks: useState, useRef, useEffect
 * - useNotifications hook from WebSocket context
 * - Tailwind CSS for styling
 * - Custom icons and emojis for notification types
 *
 * @example
 * ```jsx
 * // Basic usage
 * <NotificationBell />
 *
 * // With custom styling
 * <NotificationBell className="ml-4" />
 * ```
 *
 * @example
 * // Integration with layout
 * <header className="flex items-center justify-between">
 *   <h1>My App</h1>
 *   <NotificationBell />
 * </header>
 * ```
 */
const NotificationBell = ({ className = "" }) => {
  // Extract notification data and actions from WebSocket hook
  const { unreadCount, notifications, markAsRead, markAllAsRead, isConnected } = useNotifications();
  const navigate = useNavigate();

  // State for controlling dropdown visibility
  const [isOpen, setIsOpen] = useState(false);

  // Ref for dropdown container to handle outside clicks
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside - prevents UI clutter
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Handles notification click events
   * Marks notification as read and navigates to action URL if available
   * @param {Object} notification - The notification object clicked
   */
  const handleNotificationClick = (notification) => {
    // Mark as read only if not already read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Close dropdown
    setIsOpen(false);

    // Navigate to action URL if available (e.g., job details, chat)
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  /**
   * Formats timestamp into human-readable "time ago" format
   * @param {string} timestamp - ISO timestamp string
   * @returns {string} Formatted time ago string
   */
  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  };

  /**
   * Returns Tailwind CSS classes for priority-based styling
   * @param {string} priority - Notification priority level
   * @returns {string} CSS classes for styling
   */
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 border-red-200 bg-red-50';
      case 'high': return 'text-orange-600 border-orange-200 bg-orange-50';
      case 'medium': return 'text-blue-600 border-blue-200 bg-blue-50';
      case 'low': return 'text-green-600 border-green-200 bg-green-50';
      default: return 'text-gray-600 border-gray-200 bg-gray-50';
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

  return (
    // Main container with relative positioning for dropdown
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Icon Button with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-full transition-colors duration-200 ${
          isConnected
            ? 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            : 'text-gray-400'
        }`}
        title={isConnected ? 'Notifications' : 'Notifications (Disconnected)'}
      >
        {/* Bell Icon SVG */}
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Count Badge - shows number of unread notifications */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Connection Status Indicator - shows when WebSocket is disconnected */}
        {!isConnected && (
          <span className="absolute -bottom-1 -right-1 bg-gray-400 rounded-full h-3 w-3 border-2 border-white"></span>
        )}
      </button>

      {/* Dropdown Menu - conditionally rendered when open */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* Header Section */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {/* Mark all as read button - only shown when there are unread notifications */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>
            {/* Connection status warning */}
            {!isConnected && (
              <p className="text-sm text-gray-500 mt-1">
                ⚠️ Disconnected - notifications may be delayed
              </p>
            )}
          </div>

          {/* Notifications List Container */}
          <div className="max-h-64 overflow-y-auto">
            {/* Empty state when no notifications */}
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <p>No notifications yet</p>
              </div>
            ) : (
              // Render up to 10 most recent notifications
              notifications.slice(0, 10).map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors duration-200 hover:bg-gray-50 ${
                    !notification.is_read ? 'bg-blue-25 border-l-4 border-l-blue-500' : ''
                  } ${getPriorityColor(notification.priority)}`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Notification type icon */}
                    <span className="text-xl flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.notification_type)}
                    </span>

                    {/* Notification content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-medium truncate ${
                          !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h4>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      {/* Priority badge - only shown for non-medium priority */}
                      {notification.priority !== 'medium' && (
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-2 ${
                          notification.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          notification.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          notification.priority === 'low' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {notification.priority.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Unread indicator dot */}
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with link to full notifications page */}
          {notifications.length > 10 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to full notifications page
                  window.location.href = '/notifications';
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all notifications ({notifications.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;