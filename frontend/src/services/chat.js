/**
 * Chat API Module
 * 
 * Handles chat room and messaging operations for job-based and direct messaging.
 * 
 * @module services/chat
 */

import { apiCall } from './core';
import api from './core';

/**
 * Chat API
 * Handles chat room and messaging operations
 * 
 * @namespace chatAPI
 */
export const chatAPI = {
  /**
   * Get all chat rooms for current user
   * @async
   * @function getAllRooms
   * @returns {Promise<Array>} Array of chat room objects with metadata
   */
  getAllRooms: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/chat/rooms/');
        return response.data;
      },
      {
        loadingKey: 'chat_rooms_list',
        showSuccess: false
      }
    );
  },

  /**
   * Get chat room by ID
   * @async
   * @function getRoomById
   * @param {number} id - Chat room ID
   * @returns {Promise<Object>} Chat room object
   */
  getRoomById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/chat/rooms/${id}/`);
        return response.data;
      },
      {
        loadingKey: `chat_room_${id}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get messages for a chat room with cursor-based pagination
   * @async
   * @function getMessages
   * @param {number} roomId - Chat room ID
   * @param {Object} options - Pagination options
   * @param {number} [options.before] - Message ID to fetch messages before (scroll up)
   * @param {number} [options.after] - Message ID to fetch messages after (scroll down)
   * @param {number} [options.limit=50] - Number of messages to fetch (max 100)
   * @returns {Promise<Object>} Object containing messages array and pagination metadata
   * @returns {Array} return.messages - Array of message objects
   * @returns {boolean} return.has_more - Whether more messages exist
   * @returns {number} return.count - Total number of messages returned
   * @returns {number} return.oldest_id - ID of oldest message in response
   * @returns {number} return.newest_id - ID of newest message in response
   * 
   * @example
   * // Initial load (most recent 50 messages)
   * const { messages, has_more, oldest_id } = await chatAPI.getMessages(roomId);
   * 
   * // Load older messages (scroll up / pagination)
   * const olderMessages = await chatAPI.getMessages(roomId, { before: oldest_id, limit: 50 });
   * 
   * // Load newer messages (scroll down / catch-up)
   * const newerMessages = await chatAPI.getMessages(roomId, { after: newest_id, limit: 50 });
   */
  getMessages: async (roomId, options = {}) => {
    return apiCall(
      async () => {
        const params = new URLSearchParams();
        
        if (options.before) params.append('before', options.before);
        if (options.after) params.append('after', options.after);
        if (options.limit) params.append('limit', Math.min(options.limit, 100));
        
        const queryString = params.toString();
        const url = `/chat/rooms/${roomId}/messages/${queryString ? '?' + queryString : ''}`;
        
        const response = await api.get(url);
        return response.data;
      },
      {
        loadingKey: `chat_messages_${roomId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Send message to chat room
   * @async
   * @function sendMessage
   * @param {number} roomId - Chat room ID
   * @param {Object} data - Message data
   * @returns {Promise<Object>} Created message object
   */
  sendMessage: async (roomId, data) => {
    return apiCall(
      async () => {
        const response = await api.post(`/chat/rooms/${roomId}/send_message/`, data);
        return response.data;
      },
      {
        loadingKey: `send_message_${roomId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Mark message as read
   * @async
   * @function markAsRead
   * @param {number} messageId - Message ID
   * @returns {Promise<Object>} Response
   */
  markAsRead: async (messageId) => {
    return apiCall(
      async () => {
        const response = await api.post(`/chat/messages/${messageId}/mark_read/`);
        return response.data;
      },
      {
        loadingKey: `mark_read_${messageId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get chat room for a specific job
   * @deprecated Use startJobChat instead for bid-gated access
   * @async
   * @function getJobChatRoom
   * @param {number} jobId - Job ID
   * @returns {Promise<Object>} Chat room object
   */
  getJobChatRoom: async (jobId) => {
    return apiCall(
      async () => {
        const response = await api.get(`/chat/rooms/?job=${jobId}`);
        // Returns first room for this job
        return response.data[0] || null;
      },
      {
        loadingKey: `job_chat_${jobId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Start or get existing job chat with a specific bidder
   * @async
   * @function startJobChat
   * @param {number} jobId - Job ID
   * @param {number} bidderId - Bidder/cleaner user ID (optional for cleaners, required for clients)
   * @returns {Promise<Object>} Object with room and created flag
   */
  startJobChat: async (jobId, bidderId = null) => {
    return apiCall(
      async () => {
        const payload = { job_id: jobId };
        if (bidderId) {
          payload.bidder_id = bidderId;
        }
        const response = await api.post('/chat/rooms/start_job_chat/', payload);
        return response.data.room;
      },
      {
        loadingKey: `start_job_chat_${jobId}_${bidderId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get all job-related chats for the current user
   * @async
   * @function getJobChats
   * @param {number} [jobId] - Optional job ID to filter by
   * @returns {Promise<Array>} Array of job chat room objects
   */
  getJobChats: async (jobId = null) => {
    return apiCall(
      async () => {
        const url = jobId 
          ? `/chat/rooms/job_chats/?job_id=${jobId}`
          : '/chat/rooms/job_chats/';
        const response = await api.get(url);
        return response.data;
      },
      {
        loadingKey: jobId ? `job_chats_${jobId}` : 'job_chats',
        showSuccess: false
      }
    );
  },

  /**
   * Start or get existing direct message conversation with a user
   * @async
   * @function startDirectMessage
   * @param {number} userId - ID of user to message
   * @returns {Promise<Object>} Object with room and created flag
   */
  startDirectMessage: async (userId) => {
    return apiCall(
      async () => {
        const response = await api.post('/chat/rooms/start_dm/', { user_id: userId });
        return response.data;
      },
      {
        loadingKey: `start_dm_${userId}`,
        showSuccess: false
      }
    );
  },

  /**
   * Get all direct message conversations for current user
   * @async
   * @function getDirectMessages
   * @returns {Promise<Array>} Array of DM room objects
   */
  getDirectMessages: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/chat/rooms/direct_messages/');
        return response.data;
      },
      {
        loadingKey: 'direct_messages',
        showSuccess: false
      }
    );
  },
};
