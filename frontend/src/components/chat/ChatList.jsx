/**
 * ChatList Component
 * 
 * Displays a list of all chat conversations for the current user
 * Shows job title, last message preview, timestamp, and unread count
 * Similar to WhatsApp/Messenger conversation list
 */

import React, { useEffect } from 'react';
import { useUnifiedChat } from '../../contexts/UnifiedChatContext';

const ChatList = ({ onSelectRoom, activeRoomId }) => {
  const { rooms, isConnected, refreshRoomList } = useUnifiedChat();
  const isLoading = !isConnected;

  console.log('📱 ChatList render:', { 
    roomsCount: rooms?.length, 
    isConnected, 
    isLoading,
    rooms: rooms 
  });

  useEffect(() => {
    // Refresh room list when component mounts
    if (isConnected) {
      console.log('📱 ChatList: Refreshing room list');
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

  const getJobTitle = (room) => {
    if (room.job) {
      return room.job.property?.address || room.job.title || `Job #${room.job.id}`;
    }
    return room.name || 'Chat';
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
    <div className="overflow-y-auto h-full">
      <div className="divide-y divide-gray-200">
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          const hasUnread = room.unread_count > 0;
          
          return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                isActive ? 'bg-blue-50 border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* Job Icon/Avatar */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  hasUnread ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`text-sm font-medium truncate ${
                      hasUnread ? 'text-gray-900 font-semibold' : 'text-gray-700'
                    }`}>
                      {getJobTitle(room)}
                    </h3>
                    {room.last_message && (
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatTimestamp(room.last_message.timestamp)}
                      </span>
                    )}
                  </div>
                  
                  {/* Last Message Preview */}
                  {room.last_message ? (
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${
                        hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'
                      }`}>
                        {room.last_message.is_own_message ? 'You: ' : ''}
                        {room.last_message.content}
                      </p>
                      
                      {/* Unread Badge */}
                      {hasUnread && (
                        <span className="ml-2 flex-shrink-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No messages yet</p>
                  )}

                  {/* Participants Count */}
                  <div className="mt-1 flex items-center text-xs text-gray-400">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    {room.participant_count} {room.participant_count === 1 ? 'participant' : 'participants'}
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
