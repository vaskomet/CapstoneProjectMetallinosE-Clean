import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

/**
 * useNotifications Hook
 *
 * Custom React hook for managing real-time notifications in the E-Cleaner platform.
 * Provides access to notification data, read status management, and filtering utilities.
 *
 * @returns {Object} Notification management interface
 * @property {Array} notifications - Array of all notification objects
 * @property {number} unreadCount - Number of unread notifications
 * @property {Array} unreadNotifications - Array of unread notification objects
 * @property {Function} markAsRead - Function to mark a notification as read
 * @property {Function} markAllAsRead - Function to mark all notifications as read
 * @property {Function} getNotificationsByType - Function to filter notifications by type
 * @property {boolean} isConnected - WebSocket connection status
 *
 * @example
 * ```javascript
 * const {
 *   notifications,
 *   unreadCount,
 *   markAsRead,
 *   isConnected
 * } = useNotifications();
 *
 * // Mark notification as read
 * markAsRead(notificationId);
 *
 * // Get only job-related notifications
 * const jobNotifications = getNotificationsByType('job_created');
 * ```
 */
export const useNotifications = () => {
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    connectionStatus
  } = useWebSocket();

  /**
   * Mark a specific notification as read
   * @param {number} notificationId - ID of the notification to mark as read
   */
  const markAsRead = (notificationId) => {
    markNotificationAsRead(notificationId);
  };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = () => {
    markAllNotificationsAsRead();
  };

  /**
   * Get all unread notifications
   * @returns {Array} Array of unread notification objects
   */
  const getUnreadNotifications = () => {
    return notifications.filter(n => !n.is_read);
  };

  /**
   * Filter notifications by notification type
   * @param {string} type - Notification type to filter by
   * @returns {Array} Array of notifications matching the specified type
   */
  const getNotificationsByType = (type) => {
    return notifications.filter(n => n.notification_type === type);
  };

  return {
    notifications,
    unreadCount,
    unreadNotifications: getUnreadNotifications(),
    markAsRead,
    markAllAsRead,
    getNotificationsByType,
    isConnected: connectionStatus === 'connected'
  };
};

/**
 * useChat Hook
 *
 * Custom React hook for managing real-time chat functionality in specific chat rooms.
 * Handles WebSocket connections, message sending, and typing indicators.
 *
 * @param {string|number} roomId - Unique identifier for the chat room
 * @returns {Object} Chat management interface
 * @property {Array} messages - Array of chat messages for the room
 * @property {boolean} isConnected - Chat WebSocket connection status
 * @property {Array} typingUsers - Array of users currently typing
 * @property {Function} sendMessage - Function to send a chat message
 * @property {Function} sendTypingIndicator - Function to send typing indicator
 * @property {Function} stopTyping - Function to stop typing indicator
 * @property {string} connectionStatus - Current connection status
 *
 * @example
 * ```javascript
 * const {
 *   messages,
 *   isConnected,
 *   sendMessage,
 *   sendTypingIndicator
 * } = useChat(roomId);
 *
 * // Send a text message
 * sendMessage('Hello, world!');
 *
 * // Send typing indicator
 * sendTypingIndicator();
 * ```
 */
export const useChat = (roomId) => {
  const {
    chatMessages,
    connectChatWebSocket,
    sendChatMessage,
    connectionStatus
  } = useWebSocket();

  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Connect to chat room when roomId changes
  useEffect(() => {
    if (!roomId) return;

    const ws = connectChatWebSocket(roomId);
    if (ws) {
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        setIsConnected(false);
      }
    };
  }, [roomId, connectChatWebSocket]);

  /**
   * Send a chat message to the room
   * @param {string} content - Message content to send
   * @param {string} [messageType='text'] - Type of message (text, image, etc.)
   */
  const sendMessage = (content, messageType = 'text') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'send_message',
        content,
        message_type: messageType
      }));
    }
  };

  /**
   * Send typing indicator to other users in the room
   */
  const sendTypingIndicator = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && !isTyping) {
      wsRef.current.send(JSON.stringify({
        action: 'typing_start'
      }));
      setIsTyping(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          action: 'typing_stop'
        }));
        setIsTyping(false);
      }
    }, 3000);
  };

  /**
   * Stop typing indicator
   */
  const stopTyping = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isTyping) {
      wsRef.current.send(JSON.stringify({
        action: 'typing_stop'
      }));
      setIsTyping(false);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    messages: chatMessages[roomId] || [],
    isConnected,
    typingUsers,
    sendMessage,
    sendTypingIndicator,
    stopTyping,
    connectionStatus
  };
};

/**
 * useWebSocketStatus Hook
 *
 * Custom React hook for monitoring WebSocket connection status with detailed state information.
 *
 * @returns {Object} Connection status interface
 * @property {string} connectionStatus - Raw connection status string
 * @property {boolean} isConnected - Whether WebSocket is connected
 * @property {boolean} isConnecting - Whether WebSocket is connecting
 * @property {boolean} isDisconnected - Whether WebSocket is disconnected
 * @property {boolean} hasError - Whether there was a connection error
 *
 * @example
 * ```javascript
 * const { isConnected, isConnecting, hasError } = useWebSocketStatus();
 *
 * if (hasError) {
 *   console.log('WebSocket connection error');
 * }
 * ```
 */
export const useWebSocketStatus = () => {
  const { connectionStatus } = useWebSocket();

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';
  const isDisconnected = connectionStatus === 'disconnected';
  const hasError = connectionStatus === 'error';

  return {
    connectionStatus,
    isConnected,
    isConnecting,
    isDisconnected,
    hasError
  };
};

/**
 * useJobUpdates Hook
 *
 * Custom React hook for tracking real-time job updates and status changes.
 * Filters notifications specific to a particular job and provides status utilities.
 *
 * @param {number} jobId - ID of the job to track
 * @returns {Object} Job updates interface
 * @property {Array} jobNotifications - All notifications related to the job
 * @property {Array} statusNotifications - Status change notifications only
 * @property {Object|null} latestStatus - Most recent status notification
 *
 * @example
 * ```javascript
 * const { statusNotifications, latestStatus } = useJobUpdates(jobId);
 *
 * // Check if job was recently completed
 * if (latestStatus?.notification_type === 'job_completed') {
 *   console.log('Job completed!');
 * }
 * ```
 */
export const useJobUpdates = (jobId) => {
  const { notifications, getNotificationsByType } = useNotifications();
  const [jobNotifications, setJobNotifications] = useState([]);

  useEffect(() => {
    // Filter notifications for this specific job
    const jobRelatedNotifications = notifications.filter(notification =>
      notification.metadata?.job_id === jobId ||
      notification.content_object_data?.id === jobId
    );

    setJobNotifications(jobRelatedNotifications);
  }, [notifications, jobId]);

  /**
   * Get notifications related to job status changes
   * @returns {Array} Array of status change notifications
   */
  const getJobStatusNotifications = () => {
    return jobNotifications.filter(n =>
      ['job_accepted', 'job_started', 'job_completed', 'job_cancelled'].includes(n.notification_type)
    );
  };

  /**
   * Get the most recent job status notification
   * @returns {Object|null} Latest status notification or null
   */
  const getLatestJobStatus = () => {
    const statusNotifications = getJobStatusNotifications();
    return statusNotifications.length > 0 ? statusNotifications[0] : null;
  };

  return {
    jobNotifications,
    statusNotifications: getJobStatusNotifications(),
    latestStatus: getLatestJobStatus()
  };
};