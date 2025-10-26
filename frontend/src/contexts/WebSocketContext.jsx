/**
 * WebSocket Context
 *
 * React context for managing real-time WebSocket connections in the E-Cleaner platform.
 * Handles notification delivery, chat messaging, and connection management with automatic reconnection.
 *
 * @module WebSocketContext
 *
 * @features
 * - Real-time notification delivery with toast integration
 * - Job-specific chat messaging with room-based connections
 * - Automatic reconnection with exponential backoff
 * - JWT token-based authentication for WebSocket connections
 * - Connection status monitoring and error handling
 * - Notification read/unread state management
 * - Environment-aware WebSocket URL construction
 *
 * @dependencies
 * - React: Core React hooks (useState, useEffect, useRef, useContext)
 * - useUser: User context for authentication state and tokens
 * - WebSocket API: Browser WebSocket implementation
 * - Toast system: Global toast notification system
 *
 * @example
 * ```jsx
 * import { WebSocketProvider, useWebSocket } from './contexts/WebSocketContext';
 *
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <WebSocketProvider>
 *       <YourAppComponents />
 *     </WebSocketProvider>
 *   );
 * }
 *
 * // Use the hook in components
 * function NotificationComponent() {
 *   const {
 *     notifications,
 *     unreadCount,
 *     connectionStatus,
 *     markNotificationAsRead
 *   } = useWebSocket();
 *
 *   return (
 *     <div>
 *       <p>Status: {connectionStatus}</p>
 *       <p>Unread: {unreadCount}</p>
 *       {notifications.map(notification => (
 *         <div key={notification.id}>
 *           {notification.title}
 *           <button onClick={() => markNotificationAsRead(notification.id)}>
 *             Mark Read
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useUser } from './UserContext';

const WebSocketContext = createContext();

/**
 * useWebSocket Hook
 *
 * Custom React hook for accessing WebSocket functionality and real-time data.
 * Must be used within a WebSocketProvider component.
 *
 * @returns {Object} WebSocket context interface
 * @property {string} connectionStatus - Current WebSocket connection status
 * @property {Array} notifications - Array of notification objects
 * @property {number} unreadCount - Number of unread notifications
 * @property {Function} markNotificationAsRead - Mark specific notification as read
 * @property {Function} markAllNotificationsAsRead - Mark all notifications as read
 * @property {Function} getUnreadCount - Request updated unread count
 * @property {Object} chatMessages - Object mapping room IDs to message arrays
 * @property {Function} connectChatWebSocket - Connect to chat room WebSocket
 * @property {Function} sendChatMessage - Send message to chat room
 * @property {Function} sendNotificationAction - Send custom notification action
 * @throws {Error} If used outside of WebSocketProvider
 *
 * @example
 * ```javascript
 * const {
 *   notifications,
 *   unreadCount,
 *   connectionStatus,
 *   markNotificationAsRead
 * } = useWebSocket();
 *
 * // Mark notification as read
 * markNotificationAsRead(notificationId);
 *
 * // Connect to chat room
 * const chatWs = connectChatWebSocket(roomId);
 * ```
 */
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

/**
 * WebSocket Provider Component
 *
 * React context provider that manages WebSocket connections for real-time features.
 * Handles notification WebSocket, chat connections, and automatic reconnection logic.
 *
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} Provider component wrapping children
 *
 * @example
 * ```jsx
 * <WebSocketProvider>
 *   <App />
 * </WebSocketProvider>
 * ```
 */
export const WebSocketProvider = ({ children }) => {
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [chatMessages, setChatMessages] = useState({});
  
  const notificationWs = useRef(null);
  const chatWs = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = 5;
  const reconnectAttempts = useRef(0);

  const getWebSocketUrl = (endpoint) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:8000';
    return `${protocol}//${host}/ws/${endpoint}`;
  };

  const connectNotificationWebSocket = () => {
    if (!user) {
      console.log('⚠️ No user object available for WebSocket connection');
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.log('⚠️ No token available for WebSocket connection');
      return;
    }

    console.log('👤 User object:', user);
    console.log('🆔 User ID:', user.id);

    if (!user.id) {
      console.error('❌ User object missing ID! Please logout and login again.');
      console.log('📋 User object keys:', Object.keys(user));
      return;
    }

    try {
      const wsUrl = getWebSocketUrl(`notifications/${user.id}/`);
      console.log('🔌 WebSocket connecting to:', wsUrl);
      // Add token as query parameter for authentication
      const wsUrlWithToken = `${wsUrl}?token=${token}`;
      notificationWs.current = new WebSocket(wsUrlWithToken);

      notificationWs.current.onopen = () => {
        console.log('📡 Notification WebSocket connected');
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      notificationWs.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleNotificationMessage(data);
      };

      notificationWs.current.onclose = (event) => {
        console.log('📡 Notification WebSocket disconnected', event.code);
        setConnectionStatus('disconnected');
        
        // Auto-reconnect logic
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectNotificationWebSocket();
          }, timeout);
        }
      };

      notificationWs.current.onerror = (error) => {
        console.error('📡 Notification WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('📡 Failed to connect notification WebSocket:', error);
      setConnectionStatus('error');
    }
  };

  const connectChatWebSocket = useCallback((roomId) => {
    if (!user) return null;

    const token = localStorage.getItem('access_token');
    if (!token) {
      console.log('⚠️ No token available for chat WebSocket');
      return null;
    }

    try {
      const wsUrl = getWebSocketUrl(`job_chat/${roomId}/`);
      // Add token as query parameter for authentication
      const wsUrlWithToken = `${wsUrl}?token=${token}`;
      console.log(`💬 Creating chat WebSocket for room ${roomId}`);
      const ws = new WebSocket(wsUrlWithToken);

      ws.onopen = () => {
        console.log(`💬 Chat WebSocket connected to room ${roomId}`);
      };

      ws.onmessage = (event) => {
        console.log(`💬 Chat message received in room ${roomId}:`, event.data);
        const data = JSON.parse(event.data);
        handleChatMessage(roomId, data);
      };

      ws.onclose = () => {
        console.log(`💬 Chat WebSocket disconnected from room ${roomId}`);
      };

      ws.onerror = (error) => {
        console.error(`💬 Chat WebSocket error for room ${roomId}:`, error);
      };

      return ws;
    } catch (error) {
      console.error('💬 Failed to connect chat WebSocket:', error);
      return null;
    }
  }, [user]); // Only recreate when user changes

  const handleNotificationMessage = (data) => {
    switch (data.type) {
      case 'new_notification':
        setNotifications(prev => [data.notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Show toast notification
        if (window.showToast) {
          window.showToast(data.notification.title, {
            type: getNotificationToastType(data.notification.priority),
            duration: 5000
          });
        }
        break;

      case 'notification_read':
        setNotifications(prev => 
          prev.map(n => 
            n.id === data.notification_id 
              ? { ...n, is_read: true }
              : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        break;

      case 'unread_count':
        setUnreadCount(data.count);
        break;

      case 'recent_notifications':
        setNotifications(data.notifications);
        break;

      case 'all_notifications_read':
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        break;

      default:
        console.log('📡 Unknown notification message type:', data.type);
    }
  };

  const handleChatMessage = (roomId, data) => {
    switch (data.type) {
      case 'chat_message':
        setChatMessages(prev => ({
          ...prev,
          [roomId]: [...(prev[roomId] || []), data.message]
        }));
        
        // Trigger custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('newChatMessage', { 
          detail: { roomId, message: data.message } 
        }));
        break;

      case 'user_typing':
        // Handle typing indicators
        break;

      case 'user_stopped_typing':
        // Handle stop typing indicators
        break;

      default:
        console.log('💬 Unknown chat message type:', data.type);
    }
  };

  const getNotificationToastType = (priority) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'success';
      default: return 'info';
    }
  };

  const sendNotificationAction = (action, data = {}) => {
    if (notificationWs.current?.readyState === WebSocket.OPEN) {
      notificationWs.current.send(JSON.stringify({
        action,
        ...data
      }));
    }
  };

  const sendChatMessage = (roomId, message) => {
    if (chatWs.current?.readyState === WebSocket.OPEN) {
      chatWs.current.send(JSON.stringify({
        action: 'send_message',
        message
      }));
    }
  };

  const markNotificationAsRead = (notificationId) => {
    sendNotificationAction('mark_read', { notification_id: notificationId });
  };

  const markAllNotificationsAsRead = () => {
    sendNotificationAction('mark_all_read');
  };

  const getUnreadCount = () => {
    sendNotificationAction('get_unread_count');
  };

  // Fetch initial notifications from REST API
  const fetchNotifications = async () => {
    const token = localStorage.getItem('access_token');
    console.log('🔍 fetchNotifications called - user:', !!user, 'token:', !!token);
    if (!user || !token) {
      console.log('⚠️ Skipping fetch - missing user or token');
      return;
    }

    try {
      console.log('🌐 Fetching notifications from API...');
      const response = await fetch('http://localhost:8000/api/notifications/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📥 Fetched existing notifications:', data.length, data);
        setNotifications(data);
        
        // Calculate unread count from fetched notifications
        const unreadCount = data.filter(n => !n.is_read).length;
        setUnreadCount(unreadCount);
        console.log('📊 Unread count:', unreadCount);
      } else {
        console.error('❌ Failed to fetch notifications:', response.status, await response.text());
      }
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
    }
  };

  // Connect to notification WebSocket when user logs in
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    console.log('🔄 WebSocket useEffect triggered - user:', !!user, 'token:', !!token);
    if (user && token) {
      console.log('✅ User and token present, initializing...');
      // First, fetch existing notifications from REST API
      fetchNotifications();
      
      // Then, connect to WebSocket for real-time updates
      connectNotificationWebSocket();
    } else {
      console.log('❌ Missing user or token, skipping initialization');
    }

    return () => {
      if (notificationWs.current) {
        notificationWs.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (notificationWs.current) {
        notificationWs.current.close();
      }
      if (chatWs.current) {
        chatWs.current.close();
      }
    };
  }, []);

  const value = {
    // Connection status
    connectionStatus,
    
    // Notifications
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadCount,
    
    // Chat
    chatMessages,
    connectChatWebSocket,
    sendChatMessage,
    
    // WebSocket management
    sendNotificationAction
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};