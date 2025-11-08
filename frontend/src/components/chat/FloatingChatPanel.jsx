/**
 * FloatingChatPanel Component
 * 
 * Messenger-style floating chat panel that slides in from the right
 */

import React, { useState, useEffect } from 'react';
import { useUnifiedChat } from '../../contexts/UnifiedChatContext';
import { useUser } from '../../contexts/UserContext';
import ChatList from './ChatList';
import ChatRoom from './ChatRoom';

const FloatingChatPanel = () => {
  const { isChatOpen, closeChat, refreshRoomList } = useUnifiedChat();
  const { user } = useUser();
  const [activeRoom, setActiveRoom] = useState(null);
  const [showList, setShowList] = useState(true);

  // Refresh chat data when panel opens
  useEffect(() => {
    if (isChatOpen) {
      refreshRoomList();
    }
  }, [isChatOpen, refreshRoomList]);

  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    setShowList(false);
  };

  const handleBackToList = () => {
    setShowList(true);
    setActiveRoom(null);
    refreshRoomList();
  };

  const handleClosePanel = () => {
    setShowList(true);
    setActiveRoom(null);
    closeChat();
  };

  // Get conversation title for header
  const getConversationTitle = () => {
    if (!activeRoom) return 'Chat';
    
    if (activeRoom.room_type === 'job' && activeRoom.job && activeRoom.bidder && user) {
      const jobTitle = activeRoom.job.property?.address || activeRoom.job.title || `Job #${activeRoom.job.id}`;
      
      // If current user is the client, show cleaner name
      if (user.id === activeRoom.job.client) {
        const cleanerName = activeRoom.bidder.first_name || activeRoom.bidder.username;
        return `${jobTitle} • ${cleanerName}`;
      }
      
      // If current user is the cleaner, show client name
      if (user.id === activeRoom.bidder.id) {
        const client = (activeRoom.participants || []).find(p => p.id === activeRoom.job.client);
        const clientName = client ? (client.first_name || client.username) : 'Client';
        return `${jobTitle} • ${clientName}`;
      }
    }
    
    if (activeRoom.room_type === 'direct' && user) {
      const other = (activeRoom.participants || []).find(p => p.id !== user.id);
      return other ? (other.first_name || other.username) : 'Direct Message';
    }
    
    return activeRoom.job?.property?.address || activeRoom.job?.title || activeRoom.name || 'Chat';
  };

  // Get subtitle for header
  const getConversationSubtitle = () => {
    if (!activeRoom) return '';
    
    const parts = [];
    
    if (activeRoom.room_type === 'job' && activeRoom.job) {
      if (activeRoom.job.status) {
        parts.push(activeRoom.job.status.replace(/_/g, ' '));
      }
      if (activeRoom.job.scheduled_date) {
        parts.push(new Date(activeRoom.job.scheduled_date).toLocaleDateString());
      }
    }
    
    return parts.join(' • ');
  };

  return (
    <>
      {/* Backdrop */}
      {isChatOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-40 transition-opacity"
          onClick={handleClosePanel}
        />
      )}

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isChatOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3.5 flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {/* Back Button */}
              {!showList && (
                <button
                  onClick={handleBackToList}
                  className="hover:bg-blue-500 rounded-full p-1.5 transition-colors flex-shrink-0"
                  aria-label="Back to conversations"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              
              {/* Title Section */}
              <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold truncate">
                    {showList ? 'Messages' : getConversationTitle()}
                  </h2>
                  {!showList && getConversationSubtitle() && (
                    <p className="text-xs text-blue-100 truncate capitalize">
                      {getConversationSubtitle()}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={handleClosePanel}
              className="hover:bg-blue-500 rounded-full p-1.5 transition-colors flex-shrink-0 ml-2"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden bg-gray-50">
            {showList ? (
              <ChatList 
                onSelectRoom={handleSelectRoom}
                activeRoomId={activeRoom?.id}
              />
            ) : (
              activeRoom ? (
                <div className="h-full bg-white">
                  <ChatRoom 
                    roomId={activeRoom.id}
                    jobId={activeRoom.job?.id}
                    className="h-full"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-medium">Unable to load chat</p>
                    <p className="text-sm mt-2">No room selected</p>
                    <button
                      onClick={handleBackToList}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Back to Messages
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FloatingChatPanel;
