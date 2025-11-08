/**
 * useUnifiedChatRoom Hook - Simplified Version
 * 
 * Clean hook for managing a single chat room with pub/sub pattern.
 * 
 * Features:
 * - Auto-subscribe to room on mount
 * - Auto-unsubscribe on unmount
 * - Load initial message history from API
 * - Get messages from context (WebSocket is source of truth)
 * - Send messages to room
 * - Typing indicators
 * - Read receipts
 * 
 * NO complex merging, NO optimistic UI
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useUnifiedChat } from '../contexts/UnifiedChatContext';
import chatLog from '../utils/chatLogger';

export const useUnifiedChatRoom = (roomId, options = {}) => {
  const {
    autoSubscribe = true,
    autoMarkRead = true
  } = options;
  
  const {
    isConnected,
    subscribeToRoom,
    unsubscribeFromRoom,
    sendChatMessage,
    getRoomMessages,
    sendTyping,
    sendStopTyping,
    getRoomTypingUsers,
    markMessagesAsRead,
    loadRoomHistory
  } = useUnifiedChat();
  
  const typingTimeoutRef = useRef(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const hasLoadedHistoryRef = useRef(false);
  
  /**
   * Load initial message history when room opens
   */
  useEffect(() => {
    if (!roomId || !isConnected || hasLoadedHistoryRef.current) {
      return;
    }
    
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      chatLog.debug(`Loading message history for room ${roomId}`);
      
      try {
        await loadRoomHistory(roomId);
        hasLoadedHistoryRef.current = true;
        chatLog.success(`Loaded message history for room ${roomId}`);
      } catch (error) {
        chatLog.error(`Failed to load history for room ${roomId}`, error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    loadHistory();
  }, [roomId, isConnected, loadRoomHistory]);
  
  /**
   * Subscribe to room on mount, unsubscribe on unmount
   */
  useEffect(() => {
    if (!roomId || !autoSubscribe || !isConnected) {
      return;
    }
    
    chatLog.debug(`Auto-subscribing to room ${roomId}`);
    subscribeToRoom(roomId);
    
    return () => {
      chatLog.debug(`Auto-unsubscribing from room ${roomId}`);
      unsubscribeFromRoom(roomId);
      hasLoadedHistoryRef.current = false; // Reset for next mount
    };
  }, [roomId, autoSubscribe, isConnected]); // Only these deps, functions are stable
  
  /**
   * Get messages for this room (directly from context)
   */
  const messages = getRoomMessages(roomId);
  
  /**
   * Get typing users for this room
   */
  const typingUsers = getRoomTypingUsers(roomId);
  
  /**
   * Send a message
   */
  const sendMessage = useCallback((content) => {
    if (!content || !content.trim()) {
      chatLog.warn('Cannot send empty message');
      return;
    }
    
    sendChatMessage(roomId, content.trim());
  }, [roomId, sendChatMessage]);
  
  /**
   * Send typing indicator with auto-timeout
   */
  const startTyping = useCallback(() => {
    sendTyping(roomId);
    
    // Auto-stop after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping(roomId);
    }, 3000);
  }, [roomId, sendTyping, sendStopTyping]);
  
  /**
   * Stop typing indicator
   */
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendStopTyping(roomId);
  }, [roomId, sendStopTyping]);
  
  /**
   * Mark messages as read
   */
  const markAsRead = useCallback((messageIds = []) => {
    markMessagesAsRead(roomId, messageIds);
  }, [roomId, markMessagesAsRead]);
  
  /**
   * Auto-mark messages as read when they appear
   */
  useEffect(() => {
    if (!autoMarkRead || messages.length === 0) {
      return;
    }
    
    // Mark all unread messages as read after 1 second
    const timeout = setTimeout(() => {
      const unreadIds = messages
        .filter(msg => !msg.is_read)
        .map(msg => msg.id);
      
      if (unreadIds.length > 0) {
        chatLog.debug(`Auto-marking ${unreadIds.length} messages as read`);
        markAsRead(unreadIds);
      }
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [messages, autoMarkRead, markAsRead]);
  
  return {
    messages,
    sendMessage,
    startTyping,
    stopTyping,
    typingUsers,
    markAsRead,
    isConnected
  };
};

export default useUnifiedChatRoom;
