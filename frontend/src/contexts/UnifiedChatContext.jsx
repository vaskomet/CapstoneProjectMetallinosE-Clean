/**
 * UnifiedChatContext
 * 
 * Modern, consolidated chat context using UnifiedChatConsumer backend.
 * Single WebSocket connection per user handles all chat operations.
 * 
 * Features:
 * - Single persistent WebSocket connection (ws://host/ws/chat/)
 * - Room subscription management (subscribe/unsubscribe)
 * - Real-time messages, typing indicators, read receipts
 * - Real-time room list (no REST polling)
 * - Automatic reconnection with exponential backoff
 * - Message queuing during disconnection
 * - Optimistic UI updates (future)
 * 
 * Architecture:
 * - Replaces: ChatContext + WebSocketContext (chat portion)
 * - No custom events (direct state updates)
 * - Single source of truth for chat state
 * - Type-based message routing
 * 
 * Message Protocol:
 * Client → Server:
 *   - subscribe_room: Join a room
 *   - unsubscribe_room: Leave a room
 *   - send_message: Send a message
 *   - typing: Send typing indicator
 *   - stop_typing: Stop typing indicator
 *   - mark_read: Mark messages as read
 *   - get_room_list: Request room list
 * 
 * Server → Client:
 *   - connection_established: Connection confirmed
 *   - subscribed: Subscription confirmed
 *   - new_message: New message received
 *   - typing: User typing indicator
 *   - message_read: Read receipt
 *   - room_list: List of rooms
 *   - room_updated: Room metadata changed
 *   - error: Error message
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useUser } from './UserContext';

const UnifiedChatContext = createContext();

/**
 * Hook to access unified chat context
 * @throws {Error} If used outside UnifiedChatProvider
 */
export const useUnifiedChat = () => {
  const context = useContext(UnifiedChatContext);
  if (!context) {
    throw new Error('useUnifiedChat must be used within a UnifiedChatProvider');
  }
  return context;
};

/**
 * UnifiedChatProvider Component
 * 
 * Manages single WebSocket connection for all chat operations
 */
export const UnifiedChatProvider = ({ children }) => {
  const { user } = useUser();
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const messageQueue = useRef([]);
  
  // Chat state
  const [rooms, setRooms] = useState([]); // All user's rooms
  const [subscribedRooms, setSubscribedRooms] = useState(new Set()); // Currently subscribed room IDs
  const [messages, setMessages] = useState({}); // { roomId: [messages] }
  const [typingUsers, setTypingUsers] = useState({}); // { roomId: [{ userId, username }] }
  const [unreadCounts, setUnreadCounts] = useState({}); // { roomId: count }
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  
  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(null);
  
  // Typing timeout refs
  const typingTimeouts = useRef({});
  
  /**
   * Get WebSocket URL based on environment
   */
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NODE_ENV === 'production' 
      ? window.location.host 
      : 'localhost:8000';
    return `${protocol}//${host}/ws/chat/`;
  }, []);
  
  /**
   * Send message through WebSocket
   */
  const sendMessage = useCallback((type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, ...data });
      wsRef.current.send(message);
      console.log(`📤 Sent: ${type}`, data);
    } else {
      console.warn('⚠️ WebSocket not connected, queuing message:', type);
      messageQueue.current.push({ type, data });
    }
  }, []);
  
  /**
   * Process queued messages after reconnection
   */
  const processMessageQueue = useCallback(() => {
    if (messageQueue.current.length > 0) {
      console.log(`📨 Processing ${messageQueue.current.length} queued messages`);
      messageQueue.current.forEach(({ type, data }) => {
        sendMessage(type, data);
      });
      messageQueue.current = [];
    }
  }, [sendMessage]);
  
  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      const messageType = data.type;
      
      console.log(`📥 Received: ${messageType}`, data);
      
      switch (messageType) {
        case 'connection_established':
          console.log(`✅ Connected as ${data.username} (ID: ${data.user_id})`);
          setConnectionStatus('connected');
          setIsConnected(true);
          reconnectAttempts.current = 0;
          
          // Process queued messages
          processMessageQueue();
          
          // Request room list
          sendMessage('get_room_list', {});
          break;
          
        case 'room_list':
          console.log(`📋 Received ${data.rooms.length} rooms`);
          setRooms(data.rooms);
          
          // Calculate total unread count
          const total = data.rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
          setTotalUnreadCount(total);
          
          // Update unread counts map
          const counts = {};
          data.rooms.forEach(room => {
            counts[room.id] = room.unread_count || 0;
          });
          setUnreadCounts(counts);
          break;
          
        case 'subscribed':
          console.log(`✅ Subscribed to room ${data.room_id}`);
          setSubscribedRooms(prev => new Set([...prev, data.room_id]));
          break;
          
        case 'unsubscribed':
          console.log(`👋 Unsubscribed from room ${data.room_id}`);
          setSubscribedRooms(prev => {
            const newSet = new Set(prev);
            newSet.delete(data.room_id);
            return newSet;
          });
          break;
          
        case 'new_message':
          const { room_id, message } = data;
          console.log(`💬 New message in room ${room_id}`, message);
          
          // Check if this is a confirmation of an optimistic message
          const tempId = message._tempId || data._tempId;
          if (tempId) {
            console.log(`  ✓ Confirming optimistic message (${tempId} → ${message.id})`);
            
            // Replace optimistic message with confirmed message
            setMessages(prev => ({
              ...prev,
              [room_id]: (prev[room_id] || []).map(msg => 
                msg._tempId === tempId || msg.id === tempId
                  ? { ...message, _status: 'sent', _method: 'websocket' }
                  : msg
              )
            }));
          } else {
            // Add new message (from another user or another session)
            setMessages(prev => ({
              ...prev,
              [room_id]: [...(prev[room_id] || []), message]
            }));
          }
          
          // Update room's last message in rooms list
          setRooms(prev => prev.map(room => {
            if (room.id === room_id) {
              return {
                ...room,
                last_message_content: message.content,
                last_message_time: message.timestamp,
                last_message_sender: message.sender,
                updated_at: message.timestamp
              };
            }
            return room;
          }));
          
          // Increment unread count if not from current user
          if (message.sender.id !== user?.id) {
            setUnreadCounts(prev => ({
              ...prev,
              [room_id]: (prev[room_id] || 0) + 1
            }));
            setTotalUnreadCount(prev => prev + 1);
          }
          break;
          
        case 'typing':
          const { room_id: typingRoomId, user_id: typingUserId, username, is_typing } = data;
          
          if (is_typing) {
            // Add user to typing list
            setTypingUsers(prev => ({
              ...prev,
              [typingRoomId]: [
                ...(prev[typingRoomId] || []).filter(u => u.userId !== typingUserId),
                { userId: typingUserId, username }
              ]
            }));
            
            // Clear previous timeout
            if (typingTimeouts.current[`${typingRoomId}_${typingUserId}`]) {
              clearTimeout(typingTimeouts.current[`${typingRoomId}_${typingUserId}`]);
            }
            
            // Auto-remove after 3 seconds
            typingTimeouts.current[`${typingRoomId}_${typingUserId}`] = setTimeout(() => {
              setTypingUsers(prev => ({
                ...prev,
                [typingRoomId]: (prev[typingRoomId] || []).filter(u => u.userId !== typingUserId)
              }));
            }, 3000);
          } else {
            // Remove user from typing list
            setTypingUsers(prev => ({
              ...prev,
              [typingRoomId]: (prev[typingRoomId] || []).filter(u => u.userId !== typingUserId)
            }));
          }
          break;
          
        case 'message_read':
          const { room_id: readRoomId, user_id: readUserId, message_ids } = data;
          console.log(`✓ Messages read in room ${readRoomId} by user ${readUserId}`);
          
          // Update read status in messages (if we implement this feature)
          // For now, just log it
          break;
          
        case 'messages_marked_read':
          const { room_id: markedRoomId, count: markedCount } = data;
          console.log(`✓ Marked ${markedCount} messages as read in room ${markedRoomId}`);
          
          // Reset unread count for this room
          setUnreadCounts(prev => {
            const oldCount = prev[markedRoomId] || 0;
            setTotalUnreadCount(total => Math.max(0, total - oldCount));
            return {
              ...prev,
              [markedRoomId]: 0
            };
          });
          break;
          
        case 'room_updated':
          console.log(`🔄 Room ${data.room_id} updated`, data.updates);
          
          // Update room in list
          setRooms(prev => prev.map(room => {
            if (room.id === data.room_id) {
              return { ...room, ...data.updates };
            }
            return room;
          }));
          break;
          
        case 'error':
          console.error(`❌ WebSocket error:`, data.message);
          // You could show a toast notification here
          break;
          
        case 'pong':
          // Heartbeat response
          console.log('💓 Pong received');
          break;
          
        default:
          console.warn('⚠️ Unknown message type:', messageType, data);
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error, event.data);
    }
  }, [user, sendMessage, processMessageQueue]);
  
  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!user) {
      console.log('👤 No user, skipping WebSocket connection');
      return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('✅ Already connected');
      return;
    }
    
    // Get auth token for WebSocket connection
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('⚠️ No auth token available - WebSocket connection will fail');
      setConnectionStatus('error');
      return;
    }
    
    console.log('🔌 Connecting to unified chat WebSocket...');
    setConnectionStatus('connecting');
    
    const url = getWebSocketUrl();
    // Add token as query parameter for authentication
    const wsUrlWithToken = `${url}?token=${token}`;
    const ws = new WebSocket(wsUrlWithToken);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setConnectionStatus('connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };
    
    ws.onmessage = handleMessage;
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setConnectionStatus('error');
    };
    
    ws.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      setConnectionStatus('disconnected');
      setIsConnected(false);
      setSubscribedRooms(new Set());
      
      // Attempt reconnection if not a normal closure
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
        
        reconnectAttempts.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
        setConnectionStatus('error');
      }
    };
    
    wsRef.current = ws;
  }, [user, getWebSocketUrl, handleMessage]);
  
  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log('🔌 Disconnecting WebSocket...');
      wsRef.current.close(1000, 'User initiated disconnect');
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setConnectionStatus('disconnected');
    setIsConnected(false);
    setSubscribedRooms(new Set());
  }, []);
  
  /**
   * Subscribe to a room
   */
  const subscribeToRoom = useCallback((roomId) => {
    console.log(`🔔 Subscribing to room ${roomId}`);
    sendMessage('subscribe_room', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Unsubscribe from a room
   */
  const unsubscribeFromRoom = useCallback((roomId) => {
    console.log(`🔕 Unsubscribing from room ${roomId}`);
    sendMessage('unsubscribe_room', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Send a chat message (WebSocket-first with REST fallback + Optimistic UI)
   */
  const sendChatMessage = useCallback(async (roomId, content, replyTo = null) => {
    console.log(`📤 Sending message to room ${roomId}`);
    
    // Generate temporary ID for optimistic message
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create optimistic message (shows immediately in UI)
    const optimisticMessage = {
      id: tempId,
      room: roomId,
      content,
      timestamp: new Date().toISOString(),
      sender: {
        id: user?.id,
        username: user?.username || 'You',
        email: user?.email,
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        role: user?.role
      },
      is_read: true,
      is_own_message: true,
      reply_to: replyTo,
      // Optimistic UI metadata
      _status: 'pending', // pending, sent, failed
      _tempId: tempId,
      _method: null // Will be set to 'websocket' or 'rest'
    };
    
    // Add optimistic message to UI immediately
    setMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), optimisticMessage]
    }));
    
    console.log(`  ✓ Optimistic message added (${tempId})`);
    
    const messageData = {
      room_id: roomId,
      content,
      ...(replyTo && { reply_to: replyTo })
    };
    
    // Try WebSocket first if connected
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('  ↳ Using WebSocket');
      
      // Update optimistic message metadata
      setMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(msg => 
          msg.id === tempId ? { ...msg, _method: 'websocket' } : msg
        )
      }));
      
      sendMessage('send_message', { ...messageData, _tempId: tempId });
      return { method: 'websocket', tempId, optimisticMessage };
    } 
    
    // Fallback to REST API
    console.log('  ↳ Falling back to REST API');
    try {
      const { chatAPI } = await import('../services/api');
      const confirmedMessage = await chatAPI.sendMessage(roomId, {
        content,
        ...(replyTo && { reply_to_id: replyTo })
      });
      
      // Replace optimistic message with confirmed message
      setMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(msg => 
          msg.id === tempId 
            ? { ...confirmedMessage, _status: 'sent', _method: 'rest' }
            : msg
        )
      }));
      
      console.log(`  ✓ Message confirmed via REST API (${tempId} → ${confirmedMessage.id})`);
      return { method: 'rest', tempId, message: confirmedMessage };
    } catch (error) {
      console.error(`  ❌ Failed to send message via REST (${tempId}):`, error);
      
      // Mark optimistic message as failed
      setMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(msg => 
          msg.id === tempId ? { ...msg, _status: 'failed', _error: error.message } : msg
        )
      }));
      
      throw error;
    }
  }, [isConnected, sendMessage, user]);
  
  /**
   * Send typing indicator
   */
  const sendTyping = useCallback((roomId) => {
    sendMessage('typing', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Stop typing indicator
   */
  const sendStopTyping = useCallback((roomId) => {
    sendMessage('stop_typing', { room_id: roomId });
  }, [sendMessage]);
  
  /**
   * Mark messages as read
   */
  const markMessagesAsRead = useCallback((roomId, messageIds = []) => {
    console.log(`✓ Marking messages as read in room ${roomId}`);
    sendMessage('mark_read', {
      room_id: roomId,
      message_ids: messageIds
    });
  }, [sendMessage]);
  
  /**
   * Refresh room list (WebSocket-first with REST fallback)
   */
  const refreshRoomList = useCallback(async () => {
    console.log('🔄 Refreshing room list');
    
    // Try WebSocket first if connected
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('  ↳ Using WebSocket');
      sendMessage('get_room_list', {});
      return { method: 'websocket' };
    }
    
    // Fallback to REST API
    console.log('  ↳ Falling back to REST API');
    try {
      const { chatAPI } = await import('../services/api');
      const roomsData = await chatAPI.getAllRooms();
      
      // Update rooms state
      setRooms(roomsData);
      
      // Calculate unread counts
      const counts = {};
      let total = 0;
      roomsData.forEach(room => {
        counts[room.id] = room.unread_count || 0;
        total += room.unread_count || 0;
      });
      setUnreadCounts(counts);
      setTotalUnreadCount(total);
      
      console.log('  ✓ Room list loaded via REST API');
      return { method: 'rest', rooms: roomsData };
    } catch (error) {
      console.error('  ❌ Failed to load room list via REST:', error);
      throw error;
    }
  }, [isConnected, sendMessage]);
  
  /**
   * Retry sending a failed message
   */
  const retryMessage = useCallback(async (roomId, messageId) => {
    console.log(`🔄 Retrying message ${messageId} in room ${roomId}`);
    
    // Find the failed message
    const failedMessage = messages[roomId]?.find(msg => msg.id === messageId || msg._tempId === messageId);
    
    if (!failedMessage) {
      console.error(`  ❌ Message ${messageId} not found in room ${roomId}`);
      return;
    }
    
    // Remove the failed message from UI
    setMessages(prev => ({
      ...prev,
      [roomId]: (prev[roomId] || []).filter(msg => msg.id !== messageId && msg._tempId !== messageId)
    }));
    
    // Resend the message
    try {
      await sendChatMessage(roomId, failedMessage.content, failedMessage.reply_to);
      console.log(`  ✓ Message retried successfully`);
    } catch (error) {
      console.error(`  ❌ Retry failed:`, error);
      // Message will be added back as optimistic message (which may fail again)
    }
  }, [messages, sendChatMessage]);
  
  /**
   * Send heartbeat ping
   */
  const sendPing = useCallback(() => {
    sendMessage('ping', {});
  }, [sendMessage]);
  
  // UI helper functions
  const openChat = useCallback(() => setIsChatOpen(true), []);
  const closeChat = useCallback(() => setIsChatOpen(false), []);
  const toggleChat = useCallback(() => setIsChatOpen(prev => !prev), []);
  
  const setActiveRoom = useCallback((roomId) => {
    setActiveRoomId(roomId);
    if (roomId && !subscribedRooms.has(roomId)) {
      subscribeToRoom(roomId);
    }
  }, [subscribedRooms, subscribeToRoom]);
  
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
   * Get unread count for a specific room
   */
  const getRoomUnreadCount = useCallback((roomId) => {
    return unreadCounts[roomId] || 0;
  }, [unreadCounts]);
  
  // Connect when user is available
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }
    
    return () => {
      disconnect();
    };
  }, [user]); // Intentionally minimal dependencies
  
  // Heartbeat every 30 seconds
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        sendPing();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected, sendPing]);
  
  // Cleanup typing timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(typingTimeouts.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);
  
  const value = {
    // Connection state
    connectionStatus,
    isConnected,
    connect,
    disconnect,
    
    // Room management
    rooms,
    subscribedRooms,
    subscribeToRoom,
    unsubscribeFromRoom,
    refreshRoomList,
    
    // Messaging
    messages,
    sendChatMessage,
    getRoomMessages,
    retryMessage,  // NEW: Retry failed messages
    
    // Typing indicators
    typingUsers,
    sendTyping,
    sendStopTyping,
    getRoomTypingUsers,
    
    // Read receipts
    markMessagesAsRead,
    unreadCounts,
    totalUnreadCount,
    getRoomUnreadCount,
    
    // UI state
    isChatOpen,
    openChat,
    closeChat,
    toggleChat,
    activeRoomId,
    setActiveRoom,
  };
  
  return (
    <UnifiedChatContext.Provider value={value}>
      {children}
    </UnifiedChatContext.Provider>
  );
};

export default UnifiedChatContext;
