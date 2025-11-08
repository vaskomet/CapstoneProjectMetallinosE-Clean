/**
 * ChatList Component
 * 
 * Displays a list of all chat conversations for the current user
 * Shows job title, last message preview, timestamp, and unread count
 */

import React, { useEffect } from 'react';
import { useUnifiedChat } from '../../contexts/UnifiedChatContext';
import { useUser } from '../../contexts/UserContext';

const ChatList = ({ onSelectRoom, activeRoomId }) => {
  const { rooms, isConnected, refreshRoomList } = useUnifiedChat();
  const { user } = useUser();
  const isLoading = !isConnected;

  useEffect(() => {
    // Refresh room list when component mounts
    if (isConnected) {
      refreshRoomList();
    }
  }, [isConnected, refreshRoomList]);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };


  // Returns a descriptive conversation name
  const getConversationLabel = (room) => {
    // For job chats: show job address + other party's name
    if (room.room_type === 'job' && room.job && room.bidder && user) {
      const jobTitle = room.job.property?.address || room.job.title || `Job #${room.job.id}`;
      
      // If current user is the client, show cleaner name
      if (user.id === room.job.client) {
        const cleanerName = room.bidder.first_name || room.bidder.username;
        return `${jobTitle} • ${cleanerName}`;
      }
      
      // If current user is the cleaner, show "with Client"
      if (user.id === room.bidder.id) {
        const client = (room.participants || []).find(p => p.id === room.job.client);
        const clientName = client ? (client.first_name || client.username) : 'Client';
        return `${jobTitle} • ${clientName}`;
      }
    }
    
    // For direct messages: show other person's name
    if (room.room_type === 'direct' && user) {
      const other = (room.participants || []).find(p => p.id !== user.id);
      return other ? (other.first_name || other.username) : 'Direct Message';
    }
    
    // Fallback
    return room.job?.property?.address || room.job?.title || room.name || 'Chat';
  };

  // Returns a subtitle for the conversation
  const getConversationSubtitle = (room) => {
    if (room.room_type === 'job' && room.job) {
      const parts = [];
      
      // Status
      if (room.job.status) {
        parts.push(room.job.status.replace(/_/g, ' '));
      }
      
      // Date
      if (room.job.scheduled_date) {
        parts.push(new Date(room.job.scheduled_date).toLocaleDateString());
      }
      
      // Budget
      if (room.job.client_budget) {
        parts.push(`$${parseFloat(room.job.client_budget).toFixed(0)}`);
      }
      
      return parts.join(' • ');
    }
    
    if (room.room_type === 'direct') {
      return 'Direct Message';
    }
    
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <div className="text-gray-400 mb-2">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium text-gray-600">No conversations yet</p>
          <p className="text-sm text-gray-500 mt-1">Start chatting about your jobs!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full bg-white">
      <div className="divide-y divide-gray-100">
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          const hasUnread = room.unread_count > 0;
          
          return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                isActive ? 'bg-blue-50 border-l-4 border-blue-600 pl-3' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* Avatar with Status */}
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    hasUnread ? 'bg-blue-600' : 'bg-gray-400'
                  }`}>
                    {room.room_type === 'job' ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>
                  {/* Job Status Indicator */}
                  {room.room_type === 'job' && room.job?.status && (
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      room.job.status === 'completed' ? 'bg-green-500' :
                      room.job.status === 'in_progress' ? 'bg-yellow-500' :
                      room.job.status === 'confirmed' ? 'bg-blue-500' :
                      'bg-purple-500'
                    }`}></div>
                  )}
                </div>

                {/* Chat Content */}
                <div className="flex-1 min-w-0">
                  {/* Header: Title and Timestamp */}
                  <div className="flex items-baseline justify-between mb-0.5">
                    <h3 className={`text-sm truncate pr-2 ${
                      hasUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                    }`}>
                      {getConversationLabel(room)}
                    </h3>
                    {room.last_message && (
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatTimestamp(room.last_message.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  {/* Subtitle */}
                  {getConversationSubtitle(room) && (
                    <p className="text-xs text-gray-500 truncate mb-1">
                      {getConversationSubtitle(room)}
                    </p>
                  )}
                  
                  {/* Last Message */}
                  <div className="flex items-center justify-between">
                    {room.last_message ? (
                      <p className={`text-sm truncate flex-1 ${
                        hasUnread ? 'text-gray-900 font-medium' : 'text-gray-600'
                      }`}>
                        {room.last_message.is_own_message && (
                          <span className="text-gray-500">You: </span>
                        )}
                        {room.last_message.content}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No messages yet</p>
                    )}
                    
                    {/* Unread Badge */}
                    {hasUnread && (
                      <span className="ml-2 flex-shrink-0 min-w-[20px] h-5 inline-flex items-center justify-center px-1.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                        {room.unread_count > 99 ? '99+' : room.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatList;
