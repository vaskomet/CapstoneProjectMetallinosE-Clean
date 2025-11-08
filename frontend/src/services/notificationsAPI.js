/**
 * Notifications API Service
 *
 * REST API service for notification management in the E-Cleaner platform.
 * Provides HTTP endpoints for notification CRUD operations, preferences management,
 * and admin functions. Complements the WebSocket real-time notification system.
 *
 * @module notificationsAPI
 *
 * @features
 * - Notification list with pagination and filtering
 * - Individual notification retrieval
 * - Unread notification management
 * - Mark as read functionality (single and bulk)
 * - User notification preferences CRUD
 * - Admin bulk notification sending
 * - Loading state integration
 * - Error handling with user-friendly messages
 *
 * @dependencies
 * - api: Base axios instance with JWT authentication
 * - apiCall: Centralized API wrapper with error handling
 *
 * @example
 * ```javascript
 * import { notificationsAPI } from './services/notificationsAPI';
 *
 * // Get all notifications
 * const notifications = await notificationsAPI.getAll();
 *
 * // Get unread count
 * const count = await notificationsAPI.getUnreadCount();
 *
 * // Mark as read
 * await notificationsAPI.markAsRead(notificationId);
 * ```
 */

import { api, apiCall } from './api';

/**
 * Notifications API
 *
 * REST endpoints for notification operations
 */
export const notificationsAPI = {
  /**
   * Get all notifications for the authenticated user
   * @async
   * @function getAll
   * @param {Object} [params={}] - Query parameters for filtering
   * @param {number} [params.page] - Page number for pagination
   * @param {number} [params.page_size] - Number of items per page
   * @param {string} [params.notification_type] - Filter by notification type
   * @param {boolean} [params.is_read] - Filter by read status
   * @param {string} [params.ordering] - Sort order (e.g., '-created_at')
   * @returns {Promise<Object>} Paginated notification list
   * @example
   * const unread = await notificationsAPI.getAll({ is_read: false });
   */
  getAll: async (params = {}) => {
    return apiCall(
      async () => {
        const response = await api.get('/notifications/', { params });
        return response.data;
      },
      {
        loadingKey: 'notifications_list',
        showSuccess: false
      }
    );
  },

  /**
   * Get a specific notification by ID
   * @async
   * @function getById
   * @param {number} id - Notification ID
   * @returns {Promise<Object>} Notification object
   * @example
   * const notification = await notificationsAPI.getById(123);
   */
  getById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/notifications/${id}/`);
        return response.data;
      },
      {
        loadingKey: `notification_${id}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get only unread notifications
   * @async
   * @function getUnread
   * @returns {Promise<Array>} Array of unread notification objects
   * @example
   * const unread = await notificationsAPI.getUnread();
   */
  getUnread: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/notifications/unread/');
        return response.data;
      },
      {
        loadingKey: 'unread_notifications',
        showSuccess: false
      }
    );
  },

  /**
   * Get unread notification count
   * @async
   * @function getUnreadCount
   * @returns {Promise<Object>} Object with unread_count property
   * @example
   * const { unread_count } = await notificationsAPI.getUnreadCount();
   */
  getUnreadCount: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/notifications/unread_count/');
        return response.data;
      },
      {
        loadingKey: 'unread_count',
        showSuccess: false
      }
    );
  },

  /**
   * Mark a specific notification as read
   * @async
   * @function markAsRead
   * @param {number} id - Notification ID to mark as read
   * @returns {Promise<Object>} Updated notification object
   * @example
   * await notificationsAPI.markAsRead(123);
   */
  markAsRead: async (id) => {
    return apiCall(
      async () => {
        const response = await api.post(`/notifications/${id}/mark_read/`);
        return response.data;
      },
      {
        loadingKey: `mark_read_${id}`,
        successMessage: 'Notification marked as read',
        showSuccess: false
      }
    );
  },

  /**
   * Mark all notifications as read
   * @async
   * @function markAllAsRead
   * @returns {Promise<Object>} Response with marked_count property
   * @example
   * const { marked_count } = await notificationsAPI.markAllAsRead();
   */
  markAllAsRead: async () => {
    return apiCall(
      async () => {
        const response = await api.post('/notifications/mark_all_read/');
        return response.data;
      },
      {
        loadingKey: 'mark_all_read',
        successMessage: 'All notifications marked as read',
        showSuccess: true
      }
    );
  },

  /**
   * Delete a specific notification
   * @async
   * @function delete
   * @param {number} id - Notification ID to delete
   * @returns {Promise<void>}
   * @example
   * await notificationsAPI.delete(123);
   */
  delete: async (id) => {
    return apiCall(
      async () => {
        const response = await api.delete(`/notifications/${id}/`);
        return response.data;
      },
      {
        loadingKey: `delete_notification_${id}`,
        successMessage: 'Notification deleted',
        showSuccess: true
      }
    );
  },

  /**
   * Send a new notification (admin only)
   * @async
   * @function send
   * @param {Object} data - Notification data
   * @param {number} data.recipient - Recipient user ID
   * @param {string} data.notification_type - Type of notification
   * @param {string} data.title - Notification title
   * @param {string} data.message - Notification message
   * @param {string} [data.priority='medium'] - Priority level
   * @param {string} [data.action_url] - Optional action URL
   * @param {Object} [data.metadata] - Optional metadata object
   * @returns {Promise<Object>} Created notification object
   * @example
   * await notificationsAPI.send({
   *   recipient: 123,
   *   notification_type: 'system',
   *   title: 'System Maintenance',
   *   message: 'Scheduled maintenance tonight',
   *   priority: 'high'
   * });
   */
  send: async (data) => {
    return apiCall(
      async () => {
        const response = await api.post('/notifications/send_notification/', data);
        return response.data;
      },
      {
        loadingKey: 'send_notification',
        successMessage: 'Notification sent successfully',
        showSuccess: true
      }
    );
  },

  /**
   * Send bulk notifications (admin only)
   * @async
   * @function sendBulk
   * @param {Object} data - Bulk notification data
   * @param {Array<number>} data.recipient_ids - Array of recipient user IDs
   * @param {string} data.notification_type - Type of notification
   * @param {string} data.title - Notification title
   * @param {string} data.message - Notification message
   * @param {string} [data.priority='medium'] - Priority level
   * @param {string} [data.action_url] - Optional action URL
   * @param {Object} [data.metadata] - Optional metadata object
   * @returns {Promise<Object>} Response with notifications_sent count
   * @example
   * const result = await notificationsAPI.sendBulk({
   *   recipient_ids: [123, 456, 789],
   *   notification_type: 'announcement',
   *   title: 'New Feature Available',
   *   message: 'Check out our new dashboard!',
   *   priority: 'medium'
   * });
   * console.log(`Sent to ${result.notifications_sent} users`);
   */
  sendBulk: async (data) => {
    return apiCall(
      async () => {
        const response = await api.post('/notifications/send_bulk/', data);
        return response.data;
      },
      {
        loadingKey: 'send_bulk_notifications',
        successMessage: `Notifications sent to ${data.recipient_ids.length} users`,
        showSuccess: true
      }
    );
  }
};

/**
 * Notification Preferences API
 *
 * REST endpoints for managing user notification preferences
 */
export const notificationPreferencesAPI = {
  /**
   * Get user notification preferences
   * @async
   * @function get
   * @returns {Promise<Object>} User notification preferences object
   * @example
   * const preferences = await notificationPreferencesAPI.get();
   */
  get: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/preferences/');
        return response.data;
      },
      {
        loadingKey: 'notification_preferences',
        showSuccess: false
      }
    );
  },

  /**
   * Update notification preferences
   * @async
   * @function update
   * @param {Object} data - Preference updates
   * @param {boolean} [data.email_job_updates] - Email for job updates
   * @param {boolean} [data.email_messages] - Email for messages
   * @param {boolean} [data.email_marketing] - Email for marketing
   * @param {boolean} [data.push_job_updates] - Push for job updates
   * @param {boolean} [data.push_messages] - Push for messages
   * @param {boolean} [data.push_reminders] - Push for reminders
   * @param {boolean} [data.inapp_all] - In-app notifications
   * @param {boolean} [data.quiet_hours_enabled] - Enable quiet hours
   * @param {string} [data.quiet_hours_start] - Quiet hours start time (HH:MM)
   * @param {string} [data.quiet_hours_end] - Quiet hours end time (HH:MM)
   * @returns {Promise<Object>} Updated preferences object
   * @example
   * await notificationPreferencesAPI.update({
   *   email_job_updates: true,
   *   push_messages: false,
   *   quiet_hours_enabled: true,
   *   quiet_hours_start: '22:00',
   *   quiet_hours_end: '08:00'
   * });
   */
  update: async (data) => {
    return apiCall(
      async () => {
        const response = await api.post('/preferences/', data);
        return response.data;
      },
      {
        loadingKey: 'update_preferences',
        successMessage: 'Notification preferences updated',
        showSuccess: true
      }
    );
  },

  /**
   * Reset preferences to defaults
   * @async
   * @function reset
   * @returns {Promise<Object>} Reset preferences object
   * @example
   * await notificationPreferencesAPI.reset();
   */
  reset: async () => {
    return apiCall(
      async () => {
        const response = await api.post('/preferences/', {
          email_job_updates: true,
          email_messages: true,
          email_marketing: false,
          push_job_updates: true,
          push_messages: true,
          push_reminders: true,
          inapp_all: true,
          quiet_hours_enabled: false
        });
        return response.data;
      },
      {
        loadingKey: 'reset_preferences',
        successMessage: 'Preferences reset to defaults',
        showSuccess: true
      }
    );
  }
};

/**
 * Helper function to filter notifications by type
 * @function filterByType
 * @param {Array} notifications - Array of notification objects
 * @param {string} type - Notification type to filter by
 * @returns {Array} Filtered notifications
 * @example
 * const jobNotifications = filterByType(allNotifications, 'job_created');
 */
export const filterByType = (notifications, type) => {
  return notifications.filter(n => n.notification_type === type);
};

/**
 * Helper function to filter notifications by priority
 * @function filterByPriority
 * @param {Array} notifications - Array of notification objects
 * @param {string} priority - Priority level ('low', 'medium', 'high', 'urgent')
 * @returns {Array} Filtered notifications
 * @example
 * const urgentNotifications = filterByPriority(allNotifications, 'urgent');
 */
export const filterByPriority = (notifications, priority) => {
  return notifications.filter(n => n.priority === priority);
};

/**
 * Helper function to get notifications from last N days
 * @function getRecentNotifications
 * @param {Array} notifications - Array of notification objects
 * @param {number} days - Number of days to look back
 * @returns {Array} Recent notifications
 * @example
 * const lastWeek = getRecentNotifications(allNotifications, 7);
 */
export const getRecentNotifications = (notifications, days) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return notifications.filter(n => {
    const notifDate = new Date(n.created_at);
    return notifDate >= cutoffDate;
  });
};

export default {
  notifications: notificationsAPI,
  preferences: notificationPreferencesAPI,
  helpers: {
    filterByType,
    filterByPriority,
    getRecentNotifications
  }
};
