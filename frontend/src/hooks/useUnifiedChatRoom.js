/**
 * useUnifiedChatRoom Hook
 * 
 * Custom hook that combines UnifiedChatContext with pagination
 * for a complete chat room experience.
 * 
 * Features:
 * - Automatic room subscription/unsubscription
 * - Paginated message loading (REST API)
 * - Real-time message updates (WebSocket)
 * - Typing indicators
 * - Read receipts
 * - Message sending
 * 
 * Usage:
 * ```jsx
 * const {
 *   messages,
 *   hasMore,
 *   isLoading,
 *   loadMore,
 *   sendMessage,
 *   sendTyping,
 *   typingUsers,
 *   markAsRead
 * } = useUnifiedChatRoom(roomId);
 * ```
 */

import { useEffect, useCallback, useRef } from 'react';
import { useUnifiedChat } from '../contexts/UnifiedChatContext';
import { usePaginatedMessages } from './usePaginatedMessages';

export const useUnifiedChatRoom = (roomId, options = {}) => {
  const {
    autoSubscribe = true,
    autoMarkRead = true,
    pageSize = 50
  } = options;
  
  const {
    isConnected,
    subscribeToRoom,
    unsubscribeFromRoom,
    sendChatMessage,
    sendTyping: sendTypingIndicator,
    sendStopTyping: sendStopTypingIndicator,
    markMessagesAsRead,
    getRoomMessages: getWebSocketMessages,
    getRoomTypingUsers,
    getRoomUnreadCount,
  } = useUnifiedChat();
  
  // Get WebSocket messages for this room (will update when context messages change)
  const wsMessages = getWebSocketMessages(roomId);
  
  // Paginated messages from REST API
  const {
    messages: paginatedMessages,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    addNewMessage,
    resetMessages,
  } = usePaginatedMessages(roomId, { pageSize, autoLoad: true });
  
  // Track if we've subscribed
  const isSubscribedRef = useRef(false);
  const hasReceivedWebSocketMessages = useRef(false);
  
  /**
   * Subscribe to room on mount if enabled
   */
  useEffect(() => {
    if (roomId && autoSubscribe && isConnected && !isSubscribedRef.current) {
      console.log(`🔔 Auto-subscribing to room ${roomId}`);
      subscribeToRoom(roomId);
      isSubscribedRef.current = true;
    }
    
    return () => {
      if (roomId && isSubscribedRef.current) {
        console.log(`🔕 Unsubscribing from room ${roomId}`);
        unsubscribeFromRoom(roomId);
        isSubscribedRef.current = false;
      }
    };
  }, [roomId, autoSubscribe, isConnected, subscribeToRoom, unsubscribeFromRoom]);
  
  /**
   * Listen for new WebSocket messages and add to paginated list
   */
  useEffect(() => {
    console.log(`🔍 WebSocket merge effect running:`, {
      roomId,
      wsMessagesCount: wsMessages?.length || 0,
      paginatedCount: paginatedMessages.length,
      isLoading
    });
    
    if (!roomId) {
      console.log(`  ⏭️ Skipping: no roomId`);
      return;
    }
    
    // wsMessages comes from context and updates when context messages change
    // Only process messages received after initial load
    if (wsMessages && wsMessages.length > 0 && !isLoading) {
      // Get messages that aren't in paginated list yet
      const lastPaginatedId = paginatedMessages.length > 0 
        ? paginatedMessages[paginatedMessages.length - 1]?.id 
        : 0;
      
      console.log(`  📊 Last paginated ID: ${lastPaginatedId}`);
      
      // Filter for new messages (including optimistic ones with temp IDs)
      const paginatedIds = new Set(paginatedMessages.map(m => m.id));
      const newMessages = wsMessages.filter(msg => {
        // Include if:
        // 1. Optimistic message (temp ID starting with "temp_")
        // 2. New confirmed message not in paginated list
        const isTempId = typeof msg.id === 'string' && msg.id.startsWith('temp_');
        const isNewConfirmed = typeof msg.id === 'number' && msg.id > lastPaginatedId;
        const notInPaginated = !paginatedIds.has(msg.id);
        
        return (isTempId || isNewConfirmed) && notInPaginated;
      });
      
      console.log(`  🔍 Found ${newMessages.length} new messages to add`);
      
      if (newMessages.length > 0) {
        console.log(`📨 Adding ${newMessages.length} WebSocket messages to room ${roomId}`, newMessages.map(m => ({ id: m.id, content: m.content?.substring(0, 20) })));
        newMessages.forEach(msg => addNewMessage(msg));
        hasReceivedWebSocketMessages.current = true;
      }
    } else {
      console.log(`  ⏭️ Skipping merge:`, {
        hasWsMessages: !!(wsMessages && wsMessages.length > 0),
        isLoadingState: isLoading
      });
    }
  }, [roomId, wsMessages, paginatedMessages, isLoading, addNewMessage]);
  
  /**
   * Auto-mark messages as read when user views them
   */
  useEffect(() => {
    if (roomId && autoMarkRead && paginatedMessages.length > 0) {
      // Get IDs of unread messages
      const unreadMessageIds = paginatedMessages
        .filter(msg => !msg.is_read)
        .map(msg => msg.id);
      
      if (unreadMessageIds.length > 0) {
        console.log(`✓ Auto-marking ${unreadMessageIds.length} messages as read in room ${roomId}`);
        // Small delay to ensure user has seen the messages
        const timeout = setTimeout(() => {
          markMessagesAsRead(roomId, unreadMessageIds);
        }, 1000);
        
        return () => clearTimeout(timeout);
      }
    }
  }, [roomId, autoMarkRead, paginatedMessages, markMessagesAsRead]);
  
  /**
   * Send a message
   */
  const sendMessage = useCallback((content, replyTo = null) => {
    if (!content || !content.trim()) {
      console.warn('⚠️ Cannot send empty message');
      return;
    }
    
    sendChatMessage(roomId, content.trim(), replyTo);
  }, [roomId, sendChatMessage]);
  
  /**
   * Send typing indicator with auto-stop after 2 seconds
   */
  const typingTimeoutRef = useRef(null);
  
  const sendTyping = useCallback(() => {
    sendTypingIndicator(roomId);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Auto-stop after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTypingIndicator(roomId);
    }, 2000);
  }, [roomId, sendTypingIndicator, sendStopTypingIndicator]);
  
  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendStopTypingIndicator(roomId);
  }, [roomId, sendStopTypingIndicator]);
  
  /**
   * Mark messages as read
   */
  const markAsRead = useCallback((messageIds = []) => {
    markMessagesAsRead(roomId, messageIds);
  }, [roomId, markMessagesAsRead]);
  
  // Get current typing users
  const typingUsers = getRoomTypingUsers(roomId);
  
  // Get unread count
  const unreadCount = getRoomUnreadCount(roomId);
  
  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    // Messages (from pagination + WebSocket)
    messages: paginatedMessages,
    hasMore,
    isLoading,
    isLoadingMore,
    loadMore,
    
    // Messaging
    sendMessage,
    isConnected,
    
    // Typing
    sendTyping,
    stopTyping,
    typingUsers,
    
    // Read receipts
    markAsRead,
    unreadCount,
    
    // Room state
    roomId,
  };
};

export default useUnifiedChatRoom;
