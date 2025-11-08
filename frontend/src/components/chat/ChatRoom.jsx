/**
 * ChatRoom Component
 *
 * Real-time chat interface for job-specific OR direct message communication.
 * Provides WebSocket-powered messaging with typing indicators, read receipts, and file attachments.
 *
 * @component
 * @requires React, WebSocket connection
 * @requires useChat hook for WebSocket functionality
 * @requires UserContext for current user information
 *
 * @features
 * - **Real-time Messaging**: WebSocket-powered instant message delivery
 * - **Typing Indicators**: Shows when other users are typing
 * - **Read Receipts**: Visual confirmation when messages are read
 * - **Message Types**: Support for text, images, files, and system messages
 * - **Auto-scroll**: Automatically scrolls to latest messages
 * - **Connection Status**: Visual indicators for connection state
 * - **Keyboard Shortcuts**: Enter to send, Shift+Enter for new line
 * - **Responsive Design**: Mobile-friendly chat interface
 * - **Message History**: Persistent message display with timestamps
 *
 * @dependencies
 * - useChat hook: WebSocket connection and messaging functions
 * - UserContext: Current user information for message ownership
 * - Tailwind CSS: Responsive styling and animations
 *
 * @props
 * - jobId: string - Unique identifier for the job (converts to room ID internally)
 * - roomId: string - Direct room ID (for DMs or when room ID is already known)
 * - className: string - Additional CSS classes for styling (optional)
 * Note: Provide EITHER jobId OR roomId, not both
 *
 * @state
 * - newMessage: Current message being typed
 * - isTyping: Local typing state for indicator management
 * - messages: Array of chat messages (managed by useChat hook)
 * - isConnected: WebSocket connection status
 *
 * @websocket
 * - Connects to job-specific chat room via WebSocket
 * - Handles real-time message reception and sending
 * - Manages typing indicators and connection status
 * - Automatic reconnection on disconnection
 *
 * @messageTypes
 * - text: Standard text messages
 * - image: Image attachments with preview
 * - file: File attachments with download links
 * - system: Automated system notifications
 * - job_update: Job status change notifications
 *
 * @ui
 * - Message bubbles with sender identification
 * - Timestamp formatting (today vs other dates)
 * - Connection status indicator in header
 * - Typing indicators and read receipts
 * - Auto-expanding textarea for message input
 * - Send button with disabled state for empty messages
 *
 * @accessibility
 * - Keyboard navigation support
 * - Screen reader friendly message structure
 * - Focus management for input field
 * - ARIA labels for status indicators
 * - Color contrast for message differentiation
 *
 * @styling
 * - Distinct styling for own vs others' messages
 * - Connection status colors (green/red)
 * - Smooth animations for new messages
 * - Responsive layout for mobile devices
 * - Clean, modern chat interface design
 *
 * @example
 * ```jsx
 * import ChatRoom from './components/chat/ChatRoom';
 *
 * function JobDetailPage({ jobId }) {
 *   return (
 *     <div className="job-detail">
 *       <ChatRoom jobId={jobId} className="h-96" />
 *     </div>
 *   );
 * }
 * ```
 *
 * @notes
 * - Messages are automatically marked as read when viewed
 * - Typing indicators timeout after 2 seconds of inactivity
 * - Component handles WebSocket reconnection automatically
 * - File attachments are displayed as download links
 * - System messages have distinct styling from user messages
 */

import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useUnifiedChatRoom } from '../../hooks/useUnifiedChatRoom';
import { chatAPI } from '../../services/api';

const ChatRoom = ({ jobId, roomId: propRoomId, bidderId, className = "" }) => {
  const { user } = useUser();
  
  // State to hold the actual room ID (fetched by job ID if needed)
  const [roomId, setRoomId] = useState(propRoomId || null);
  const [roomLoading, setRoomLoading] = useState(!!jobId && !propRoomId); // Only load if jobId provided
  const [roomError, setRoomError] = useState(null);
  
  // Fetch room ID from job ID (if jobId provided and no direct roomId)
  useEffect(() => {
    if (propRoomId) {
      // Direct room ID provided, use it immediately
      console.log(`✅ Using provided room ID: ${propRoomId}`);
      setRoomId(propRoomId);
      setRoomLoading(false);
      return;
    }

    if (!jobId) {
      setRoomError('Either jobId or roomId must be provided');
      setRoomLoading(false);
      return;
    }
    
    const fetchRoom = async () => {
      try {
        setRoomLoading(true);
        setRoomError(null);
        console.log(`🔍 Fetching room for job ${jobId}, bidder ${bidderId || 'auto'}`);
        
        // Start job chat with bidder parameter
        const room = await chatAPI.startJobChat(jobId, bidderId);
        
        if (room && room.id) {
          console.log(`✅ Found/created room ${room.id} for job ${jobId}, bidder ${bidderId || user.id}`);
          setRoomId(room.id);
        } else {
          const error = `No chat room found for job ${jobId}`;
          console.error(`❌ ${error}`);
          setRoomError(error);
        }
      } catch (error) {
        console.error(`❌ Error fetching room for job ${jobId}:`, error);
        
        // Check if error is due to missing bid
        if (error.response?.status === 403 || error.message?.includes('bid')) {
          setRoomError('You must place a bid on this job before accessing chat.');
        } else {
          setRoomError(error.message || 'Failed to load chat room');
        }
      } finally {
        setRoomLoading(false);
      }
    };
    
    fetchRoom();
  }, [jobId, propRoomId, bidderId, user?.id]);
  
  // Use unified chat room hook with simplified pub/sub pattern
  const {
    messages,
    sendMessage,
    isConnected,
    startTyping: sendTypingIndicator,
    stopTyping,
    typingUsers,
  } = useUnifiedChatRoom(roomId, {
    autoSubscribe: true,
    autoMarkRead: true
  });

  // Local state for message input
  const [newMessage, setNewMessage] = useState('');

  // Refs for DOM manipulation
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  /**
   * Focus input field when component mounts
   * Improves user experience by immediately allowing typing
   */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Handles message sending with validation
   * Prevents sending empty messages or when disconnected
   * @param {Event} e - Form submission event
   */
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    sendMessage(newMessage.trim());
    setNewMessage('');
    stopTyping();
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  /**
   * Handles input changes with typing indicator management
   * Sends typing indicators and manages timeout for stopping
   * @param {Event} e - Input change event
   */
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    // Send typing indicator if starting to type
    if (e.target.value) {
      sendTypingIndicator();
    }

    // Clear existing timeout and set new one
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Auto-stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  /**
   * Handles keyboard shortcuts for message sending
   * Enter sends message, Shift+Enter creates new line
   * @param {Event} e - Key press event
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  /**
   * Formats message timestamps for display
   * Shows time for today's messages, date+time for older messages
   * @param {string} timestamp - ISO timestamp string
   * @returns {string} Formatted time string
   */
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
             ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  /**
   * Returns appropriate icon for different message types
   * @param {string} messageType - Type of message
   * @returns {string|null} Emoji icon or null
   */
  const getMessageTypeIcon = (messageType) => {
    switch (messageType) {
      case 'image': return '🖼️';
      case 'file': return '📎';
      case 'system': return '🤖';
      case 'job_update': return '📋';
      default: return null;
    }
  };

  // Show loading state while fetching room
  if (roomLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-white border border-gray-200 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat room...</p>
        </div>
      </div>
    );
  }

  // Show error state if room not found
  if (roomError || !roomId) {
    return (
      <div className={`flex items-center justify-center h-full bg-white border border-gray-200 rounded-lg ${className}`}>
        <div className="text-center text-red-600">
          <svg className="w-12 h-12 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p className="font-semibold">{roomError || 'Chat room not found'}</p>
          <p className="text-sm text-gray-600 mt-2">This job may not have a chat room yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Chat Header - Title and connection status */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900">
            Job Chat #{jobId}
          </h3>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`} title={isConnected ? 'Connected' : 'Disconnected'} />
        </div>

        {!isConnected && (
          <span className="text-sm text-red-600 font-medium">
            Reconnecting...
          </span>
        )}
      </div>

      {/* Messages Container - Scrollable message history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          /* Empty State - No messages placeholder */
          <div className="text-center text-gray-500 py-8">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
            </svg>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          /* Messages List - Render all chat messages */
          messages.map((message) => {
            const isOwnMessage = message.sender?.id === user?.id;

            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  isOwnMessage
                    ? 'bg-blue-600 text-white'
                    : message.message_type === 'system'
                    ? 'bg-gray-100 text-gray-700 border border-gray-200'
                    : 'bg-gray-200 text-gray-900'
                }`}>
                  {/* Sender Information - For received messages */}
                  {!isOwnMessage && message.sender && (
                    <div className="text-xs font-semibold mb-1 opacity-75">
                      {message.sender.first_name || message.sender.username}
                      {message.sender.role && (
                        <span className="ml-1 text-xs opacity-60">
                          ({message.sender.role})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Content and Attachments */}
                  <div className="flex items-start space-x-2">
                    {getMessageTypeIcon(message.message_type) && (
                      <span className="text-sm">
                        {getMessageTypeIcon(message.message_type)}
                      </span>
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>

                      {/* File Attachment Link */}
                      {message.attachment && (
                        <div className="mt-2">
                          <a
                            href={message.attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline opacity-75 hover:opacity-100"
                          >
                            📎 Attachment
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message Metadata - Timestamp and read status */}
                  <div className={`text-xs mt-1 ${
                    isOwnMessage ? 'text-blue-200' : 'text-gray-500'
                  }`}>
                    {formatMessageTime(message.timestamp)}
                    {message.is_read && isOwnMessage && (
                      <span className="ml-1">✓</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Typing Indicator - Shows when other users are typing */}
      {typingUsers && typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-500 italic">
          {typingUsers.length === 1 ? (
            <span>{typingUsers[0].username} is typing...</span>
          ) : typingUsers.length === 2 ? (
            <span>{typingUsers[0].username} and {typingUsers[1].username} are typing...</span>
          ) : (
            <span>Several people are typing...</span>
          )}
        </div>
      )}

      {/* Message Input Area - Send new messages */}
      <div className="border-t border-gray-200 p-4">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={
                isConnected
                  ? "Type your message..."
                  : "Connecting..."
              }
              disabled={!isConnected}
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ minHeight: '40px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>

        {/* Connection Status Indicator */}
        {!isConnected && (
          <div className="mt-2 text-sm text-red-600 flex items-center">
            <svg className="w-4 h-4 mr-1 animate-spin" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6z"/>
            </svg>
            Reconnecting to chat...
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;