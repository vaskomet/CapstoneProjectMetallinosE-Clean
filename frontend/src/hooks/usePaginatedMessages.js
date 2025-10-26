/**
 * usePaginatedMessages Hook
 * 
 * Custom React hook for managing paginated chat messages with infinite scroll support.
 * Implements cursor-based pagination following industry best practices from Slack, Discord, and WhatsApp.
 * 
 * @module hooks/usePaginatedMessages
 * 
 * @features
 * - Cursor-based pagination for efficient message loading
 * - Infinite scroll support (load older messages on scroll up)
 * - Automatic deduplication of messages
 * - Loading states for initial load and pagination
 * - Optimized for large conversations (thousands of messages)
 * - Smart message ordering (newest first initially, chronological display)
 * - Error handling and retry logic
 * 
 * @param {number|string} roomId - The chat room ID
 * @returns {Object} Pagination interface
 * 
 * @example
 * ```javascript
 * const {
 *   messages,
 *   hasMore,
 *   isLoading,
 *   isLoadingMore,
 *   loadMore,
 *   addNewMessage,
 *   resetMessages
 * } = usePaginatedMessages(roomId);
 * 
 * // In component
 * useEffect(() => {
 *   if (scrollTop === 0 && hasMore && !isLoadingMore) {
 *     loadMore();
 *   }
 * }, [scrollTop, hasMore, isLoadingMore]);
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { chatAPI } from '../services/api';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * Custom hook for managing paginated chat messages
 * 
 * @param {number|string} roomId - Chat room identifier
 * @param {Object} options - Configuration options
 * @param {number} [options.pageSize=50] - Number of messages per page
 * @param {boolean} [options.autoLoad=true] - Whether to auto-load initial messages
 * @returns {Object} Pagination state and methods
 */
export const usePaginatedMessages = (roomId, options = {}) => {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    autoLoad = true
  } = options;

  // State management
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [oldestMessageId, setOldestMessageId] = useState(null);
  const [newestMessageId, setNewestMessageId] = useState(null);

  // Refs to track state across async operations
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const roomIdRef = useRef(roomId);

  /**
   * Deduplicate messages by ID
   * Ensures no duplicate messages in the array
   */
  const deduplicateMessages = useCallback((messageArray) => {
    const seen = new Set();
    return messageArray.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
  }, []);

  /**
   * Load initial messages for the room
   * Fetches the most recent messages (default 50)
   */
  const loadInitialMessages = useCallback(async () => {
    console.log(`🔄 loadInitialMessages called:`, { roomId, loading: loadingRef.current });
    
    if (!roomId || loadingRef.current) {
      console.log(`  ⏭️ Skipping: roomId=${roomId}, loading=${loadingRef.current}`);
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    console.log(`  📡 Fetching messages for room ${roomId}...`);

    try {
      const response = await chatAPI.getMessages(roomId, {
        limit: Math.min(pageSize, MAX_PAGE_SIZE)
      });

      console.log(`  ✅ Got response:`, response);

      // Only check if the room ID changed (not mounted status due to Strict Mode)
      if (roomIdRef.current !== roomId) {
        console.log(`  ⏭️ Room changed during fetch (was ${roomId}, now ${roomIdRef.current})`);
        return;
      }

      // Backend already returns messages in chronological order (oldest first)
      // after reversing them internally - see backend/chat/views.py line 68
      const messageList = response.messages || [];

      setMessages(messageList);
      setHasMore(response.has_more || false);
      setOldestMessageId(response.oldest_id || null);
      setNewestMessageId(response.newest_id || null);

      console.log(`📥 Loaded ${messageList.length} initial messages for room ${roomId}`);
      console.log(`   Has more: ${response.has_more}, Oldest ID: ${response.oldest_id}, Newest ID: ${response.newest_id}`);
    } catch (err) {
      console.error('❌ Failed to load initial messages:', err);
      setError(err);
    } finally {
      console.log(`  ✓ Setting isLoading=false for room ${roomId}`);
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [roomId, pageSize]);  /**
   * Load more messages (pagination - scroll up)
   * Fetches older messages before the current oldest message
   */
  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loadingRef.current || !oldestMessageId) {
      console.log('⏭️ Skipping loadMore:', {
        roomId: !!roomId,
        hasMore,
        loading: loadingRef.current,
        oldestMessageId
      });
      return;
    }

    loadingRef.current = true;
    setIsLoadingMore(true);
    setError(null);

    try {
      const response = await chatAPI.getMessages(roomId, {
        before: oldestMessageId,
        limit: Math.min(pageSize, MAX_PAGE_SIZE)
      });

      if (!mountedRef.current || roomIdRef.current !== roomId) return;

      // Backend already returns messages in chronological order (oldest first)
      const olderMessages = response.messages || [];

      setMessages(prevMessages => {
        const combined = [...olderMessages, ...prevMessages];
        return deduplicateMessages(combined);
      });

      setHasMore(response.has_more || false);
      setOldestMessageId(response.oldest_id || oldestMessageId);
      // Keep newestMessageId unchanged - we're loading older messages

      console.log(`📥 Loaded ${olderMessages.length} more messages for room ${roomId}`);
      console.log(`   Has more: ${response.has_more}, New oldest ID: ${response.oldest_id}`);
    } catch (err) {
      if (mountedRef.current) {
        console.error('Failed to load more messages:', err);
        setError(err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
        loadingRef.current = false;
      }
    }
  }, [roomId, hasMore, oldestMessageId, pageSize, deduplicateMessages]);

  /**
   * Add a new message to the list (from WebSocket)
   * Appends to the end and updates newest message ID
   */
  const addNewMessage = useCallback((newMessage) => {
    if (!newMessage || !newMessage.id) return;

    setMessages(prevMessages => {
      // Check if message already exists
      if (prevMessages.some(msg => msg.id === newMessage.id)) {
        return prevMessages;
      }
      
      // Append new message to the end
      const updated = [...prevMessages, newMessage];
      console.log(`📨 Added new message ${newMessage.id} to room ${roomId}`);
      return updated;
    });

    // Update newest message ID
    setNewestMessageId(newMessage.id);
  }, [roomId]);

  /**
   * Update an existing message (for optimistic updates or edits)
   */
  const updateMessage = useCallback((messageId, updates) => {
    setMessages(prevMessages => 
      prevMessages.map(msg => 
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    );
  }, []);

  /**
   * Reset messages (when switching rooms or refreshing)
   */
  const resetMessages = useCallback(() => {
    setMessages([]);
    setHasMore(false);
    setOldestMessageId(null);
    setNewestMessageId(null);
    setError(null);
    setIsLoading(false);
    setIsLoadingMore(false);
    loadingRef.current = false;
  }, []);

  /**
   * Refresh messages (reload from server)
   */
  const refresh = useCallback(async () => {
    resetMessages();
    await loadInitialMessages();
  }, [resetMessages, loadInitialMessages]);

  // Effect: Load initial messages when room changes
  useEffect(() => {
    console.log(`📍 usePaginatedMessages effect running:`, { roomId, autoLoad, loading: loadingRef.current });
    
    // Always mark as mounted when this effect runs
    mountedRef.current = true;
    roomIdRef.current = roomId;

    if (roomId && autoLoad) {
      console.log(`  → Resetting and loading messages for room ${roomId}`);
      resetMessages();
      loadInitialMessages();
    } else {
      console.log(`  ⏭️ Skipping load:`, { hasRoomId: !!roomId, autoLoad });
    }

    // Don't mark as unmounted in cleanup - only on actual unmount
    // This prevents issues with React Strict Mode double-mounting
  }, [roomId, autoLoad, resetMessages, loadInitialMessages]); // Added missing dependencies

  // Effect: Handle actual mount/unmount
  useEffect(() => {
    console.log(`🏁 Component mounted`);
    mountedRef.current = true;
    return () => {
      console.log(`🏁 Component unmounting`);
      mountedRef.current = false;
    };
  }, []);

  return {
    // Message data
    messages,
    hasMore,
    oldestMessageId,
    newestMessageId,
    
    // Loading states
    isLoading,
    isLoadingMore,
    error,
    
    // Actions
    loadMore,
    addNewMessage,
    updateMessage,
    resetMessages,
    refresh,
    
    // Computed properties
    messageCount: messages.length,
    isEmpty: messages.length === 0 && !isLoading,
  };
};

export default usePaginatedMessages;
