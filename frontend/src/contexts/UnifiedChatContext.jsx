/**
 * UnifiedChatContext - Simplified Version
 * 
 * Clean pub/sub chat implementation with minimal complexity.
 * 
 * Key Principles:
 * - Single WebSocket connection per user
 * - Pure pub/sub pattern (no optimistic UI)
 * - Messages from WebSocket are source of truth
 * - Minimal state management
 * - Clean logging with debug mode
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useUser } from './UserContext';
import { chatAPI } from '../services/api';
import chatLog from '../utils/chatLogger';

const UnifiedChatContext = createContext();

export const useUnifiedChat = () => {
  const context = useContext(UnifiedChatContext);
  if (!context) {
    throw new Error('useUnifiedChat must be used within a UnifiedChatProvider');
  }
  return context;
};

export const UnifiedChatProvider = ({ children }) => {
  const { user } = useUser();
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Chat state
  const [rooms, setRooms] = useState([]);
  const [subscribedRooms, setSubscribedRooms] = useState(new Set());
  const [messages, setMessages] = useState({}); // { roomId: [messages] }
  const [typingUsers, setTypingUsers] = useState({}); // { roomId: [{userId, username}] }
  const [unreadCounts, setUnreadCounts] = useState({});
  
  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  /**
   * Get WebSocket URL
   */
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:8000';
    return `${protocol}//${host}/ws/chat/`;
  }, []);
  
  /**
   * Send message via WebSocket
   */
  const sendMessage = useCallback((type, data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
      chatLog.debug(`Sent: ${type}`, data);
    } else {
      chatLog.warn('WebSocket not connected, message not sent', { type, data });
    }
  }, []);
  
  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      chatLog.debug(`Received: ${data.type}`, data);
      
      switch (data.type) {
        case 'connection_established':
          chatLog.connect(`Connected as ${data.username}`);
          setConnectionStatus('connected');
          setIsConnected(true);
          reconnectAttempts.current = 0;
          sendMessage('get_room_list', {});
          break;
          
        case 'room_list':
          chatLog.debug(`Received ${data.rooms.length} rooms`);
          setRooms(data.rooms);
          
          // Update unread counts
          const counts = {};
          data.rooms.forEach(room => {
            counts[room.id] = room.unread_count || 0;
          });
          setUnreadCounts(counts);
          break;
          
        case 'subscribed':
          chatLog.success(`Subscribed to room ${data.room_id}`);
          setSubscribedRooms(prev => new Set([...prev, data.room_id]));
          break;
          
        case 'unsubscribed':
          chatLog.debug(`Unsubscribed from room ${data.room_id}`);
          setSubscribedRooms(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.room_id);
            return newSet;
          });
          break;
          
        case 'new_message':
          const { room_id, message } = data;
          chatLog.message(`New message in room ${room_id}`, message);
          
          // Add message to state (with deduplication)
          setMessages(prev => {
            const existingMessages = prev[room_id] || [];
            // Check if this message already exists by ID
            if (existingMessages.some(m => m.id === message.id)) {
              chatLog.debug(`Duplicate message ${message.id} ignored`);
              return prev; // Skip duplicate
            }
            return {
              ...prev,
              [room_id]: [...existingMessages, message]
            };
          });
          
          // Update room list
          setRooms(prev => prev.map(room => {
            if (room.id === room_id) {
              return {
                ...room,
                last_message_content: message.content,
                last_message_time: message.timestamp,
                updated_at: message.timestamp
              };
            }
            return room;
          }));
          
          // Update unread count if not from current user
          if (message.sender.id !== user?.id) {
            setUnreadCounts(prev => {
              const newCount = (prev[room_id] || 0) + 1;
              const newCounts = {
                ...prev,
                [room_id]: newCount
              };
              console.log(`📊 Unread count updated for room ${room_id}: ${newCount}`, newCounts);
              chatLog.debug(`Unread count for room ${room_id}: ${prev[room_id] || 0} → ${newCount}`);
              return newCounts;
            });
          }
          break;
          
        case 'typing':
          const { room_id: typingRoomId, user_id: typingUserId, username, is_typing } = data;
          
          if (is_typing) {
            setTypingUsers(prev => ({
              ...prev,
              [typingRoomId]: [
                ...(prev[typingRoomId] || []).filter(u => u.userId !== typingUserId),
                { userId: typingUserId, username }
              ]
            }));
          } else {
            setTypingUsers(prev => ({
              ...prev,
              [typingRoomId]: (prev[typingRoomId] || []).filter(u => u.userId !== typingUserId)
            }));
          }
          break;
          
        case 'message_read':
          chatLog.debug('Messages marked as read', data);
          // Update unread count
          setUnreadCounts(prev => ({
            ...prev,
            [data.room_id]: Math.max(0, (prev[data.room_id] || 0) - data.message_ids.length)
          }));
          break;
          
        case 'error':
          chatLog.error('Server error', data.message);
          break;
          
        default:
          chatLog.debug('Unknown message type', data);
      }
    } catch (error) {
      chatLog.error('Error handling message', error);
    }
  }, [user, sendMessage]);
  
  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!user) {
      chatLog.warn('No user, skipping WebSocket connection');
      return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      chatLog.debug('Already connected');
      return;
    }
    
    const token = localStorage.getItem('access_token');
    if (!token) {
      chatLog.error('No auth token available');
      setConnectionStatus('error');
      return;
    }
    
    chatLog.connect('Connecting to chat WebSocket...');
    setConnectionStatus('connecting');
    
    const url = getWebSocketUrl();
    const wsUrlWithToken = `${url}?token=${token}`;
    const ws = new WebSocket(wsUrlWithToken);
    
    ws.onopen = () => {
      chatLog.connect('WebSocket connected');
      setConnectionStatus('connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };
    
    ws.onmessage = handleMessage;
    
    ws.onerror = (error) => {
      chatLog.error('WebSocket error', error);
      setConnectionStatus('error');
    };
    
    ws.onclose = (event) => {
      chatLog.connect(`WebSocket closed (code: ${event.code})`);
      setConnectionStatus('disconnected');
      setIsConnected(false);
      setSubscribedRooms(new Set());
      
      // Attempt reconnection
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        chatLog.connect(`Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectAttempts.current += 1;
        setTimeout(() => connect(), delay);
      }
    };
    
    wsRef.current = ws;
  }, [user, getWebSocketUrl, handleMessage]);
  
  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
  }, []);
  
  /**
   * Subscribe to a room
   */
  const subscribeToRoom = useCallback((roomId) => {
    if (!roomId) return;
    chatLog.debug(`Subscribing to room ${roomId}`);
    sendMessage('subscribe_room', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Unsubscribe from a room
   */
  const unsubscribeFromRoom = useCallback((roomId) => {
    if (!roomId) return;
    chatLog.debug(`Unsubscribing from room ${roomId}`);
    sendMessage('unsubscribe_room', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Send a chat message (simplified - no optimistic UI)
   */
  const sendChatMessage = useCallback((roomId, content) => {
    if (!content || !content.trim()) {
      chatLog.warn('Cannot send empty message');
      return;
    }
    
    chatLog.message(`Sending message to room ${roomId}`);
    sendMessage('send_message', {
      room_id: roomId,
      content: content.trim()
    });
  }, [sendMessage]);
  
  /**
   * Send typing indicator
   */
  const sendTyping = useCallback((roomId) => {
    sendMessage('typing', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Send stop typing indicator
   */
  const sendStopTyping = useCallback((roomId) => {
    sendMessage('stop_typing', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Mark messages as read
   */
  const markMessagesAsRead = useCallback((roomId, messageIds = []) => {
    sendMessage('mark_read', {
      room_id: roomId,
      message_ids: messageIds
    });
  }, [sendMessage]);
  
  /**
   * Refresh room list
   */
  const refreshRoomList = useCallback(() => {
    sendMessage('get_room_list', {});
  }, [sendMessage]);
  
  /**
   * Load message history for a room from REST API
   */
  const loadRoomHistory = useCallback(async (roomId, limit = 50) => {
    try {
      chatLog.debug(`Loading ${limit} messages for room ${roomId} from API`);
      
      // Import chatAPI dynamically to avoid circular dependency
      const { chatAPI } = await import('../services/api');
      const response = await chatAPI.getMessages(roomId, { limit });
      
      if (response && response.messages) {
        chatLog.success(`Loaded ${response.messages.length} messages for room ${roomId}`);
        
        // Add messages to state (these become the initial messages)
        setMessages(prev => ({
          ...prev,
          [roomId]: response.messages
        }));
      }
    } catch (error) {
      chatLog.error(`Failed to load history for room ${roomId}`, error);
      throw error;
    }
  }, []);
  
  /**
   * Get messages for a specific room
   */
  const getRoomMessages = useCallback((roomId) => {
    return messages[roomId] || [];
  }, [messages]);
  
  /**
   * Get typing users for a specific room
   */
  const getRoomTypingUsers = useCallback((roomId) => {
    return typingUsers[roomId] || [];
  }, [typingUsers]);
  
  /**
   * Create or get existing direct message room with a user
   */
  const createDirectMessage = useCallback(async (userId) => {
    try {
      chatLog.debug('Creating DM with user', { userId });
      const response = await chatAPI.startDirectMessage(userId);
      
      if (response.room) {
        chatLog.info(`DM ${response.created ? 'created' : 'retrieved'} with user ${userId}`, response.room);
        
        // Refresh room list to include the new DM
        refreshRoomList();
        
        return response.room;
      }
      
      return null;
    } catch (error) {
      chatLog.error('Failed to create DM', error);
      throw error;
    }
  }, [refreshRoomList]);
  
  /**
   * Calculate total unread count across all rooms
   */
  const totalUnreadCount = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  
  /**
   * Log total unread count changes for debugging
   */
  useEffect(() => {
    console.log(`🔔 Total unread count changed: ${totalUnreadCount}`, unreadCounts);
  }, [totalUnreadCount, unreadCounts]);
  
  /**
   * UI state management
   */
  const openChat = useCallback(() => setIsChatOpen(true), []);
  const closeChat = useCallback(() => setIsChatOpen(false), []);
  const toggleChat = useCallback(() => setIsChatOpen(prev => !prev), []);
  
  /**
   * Auto-connect when user is available
   * Only connect if user is authenticated (prevents connection attempts for non-logged-in users)
   */
  useEffect(() => {
    if (user && user.id) {
      chatLog.debug('User authenticated, connecting to chat WebSocket');
      connect();
    } else {
      chatLog.debug('No authenticated user, skipping chat connection');
    }
    
    return () => {
      if (user && user.id) {
        disconnect();
      }
    };
  }, [user, connect, disconnect]);
  
  const value = {
    // Connection state
    connectionStatus,
    isConnected,
    connect,
    disconnect,
    
    // Room management
    rooms,
    subscribedRooms: Array.from(subscribedRooms),
    subscribeToRoom,
    unsubscribeFromRoom,
    refreshRoomList,
    createDirectMessage,
    
    // Messaging
    messages,
    sendChatMessage,
    getRoomMessages,
    loadRoomHistory,
    
    // Typing indicators
    typingUsers,
    sendTyping,
    sendStopTyping,
    getRoomTypingUsers,
    
    // Read receipts
    markMessagesAsRead,
    unreadCounts,
    totalUnreadCount,
    
    // UI state
    isChatOpen,
    openChat,
    closeChat,
    toggleChat
  };
  
  return (
    <UnifiedChatContext.Provider value={value}>
      {children}
    </UnifiedChatContext.Provider>
  );
};

export default UnifiedChatContext;
