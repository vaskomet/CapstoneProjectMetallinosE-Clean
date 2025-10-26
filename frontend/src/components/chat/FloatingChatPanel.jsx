/**
 * FloatingChatPanel Component
 * 
 * Messenger-style floating chat panel that slides in from the right
 * Contains chat list and active conversation
 * Can be toggled open/closed from anywhere in the app
 */

import React, { useState, useEffect } from 'react';
import { useUnifiedChat } from '../../contexts/UnifiedChatContext';
import ChatList from './ChatList';
import ChatRoom from './ChatRoom';

const FloatingChatPanel = () => {
  const { isChatOpen, closeChat, refreshRoomList } = useUnifiedChat();
  const [activeRoom, setActiveRoom] = useState(null);
  const [showList, setShowList] = useState(true);

  // Refresh chat data when panel opens
  useEffect(() => {
    if (isChatOpen) {
      refreshRoomList();
    }
  }, [isChatOpen, refreshRoomList]);

  const handleSelectRoom = (room) => {
    console.log('📱 FloatingChatPanel - Selected room:', room);
    setActiveRoom(room);
    setShowList(false);
  };

  const handleBackToList = () => {
    setShowList(true);
    setActiveRoom(null);
    // Refresh chat list when going back
    refreshRoomList();
  };

  const handleClosePanel = () => {
    setShowList(true);
    setActiveRoom(null);
    closeChat();
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
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-4 flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-3">
              {!showList && (
                <button
                  onClick={handleBackToList}
                  className="hover:bg-blue-500 rounded-full p-1 transition-colors"
                  aria-label="Back to conversations"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              
              <div className="flex items-center space-x-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h2 className="text-lg font-semibold">
                  {showList ? 'Messages' : (activeRoom?.name || `Job #${activeRoom?.job?.id}`)}
                </h2>
              </div>
            </div>
            
            <button
              onClick={handleClosePanel}
              className="hover:bg-blue-500 rounded-full p-1 transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
