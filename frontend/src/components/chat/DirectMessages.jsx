import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { chatAPI } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import ChatRoom from './ChatRoom';

/**
 * DirectMessages Component
 * 
 * Displays list of DM conversations
 * Reuses ChatRoom component for actual message display
 * Users can start new conversations via the "Find Cleaners" page
 */
const DirectMessages = () => {
  const { user } = useUser();
  const [conversations, setConversations] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load existing DM conversations
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const rooms = await chatAPI.getDirectMessages();
      setConversations(rooms);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get other participant's info from DM room
  const getOtherParticipant = (room) => {
    if (!room.participants || !user) return null;
    return room.participants.find(p => p.id !== user.id);
  };

  // If room selected, show ChatRoom component
  if (selectedRoom) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSelectedRoom(null)}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
          <div>
            {getOtherParticipant(selectedRoom) && (
              <h3 className="font-semibold">
                {getOtherParticipant(selectedRoom).first_name} {getOtherParticipant(selectedRoom).last_name}
              </h3>
            )}
          </div>
        </div>
        
        {/* Reuse existing ChatRoom component with room ID */}
        <div className="flex-1 overflow-hidden">
          <ChatRoom roomId={selectedRoom.id} />
        </div>
      </div>
    );
  }

  // Show conversation list
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Direct Messages</h2>
          {user?.role === 'client' && (
            <Link
              to="/find-cleaners"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
              <span>Find Cleaners</span>
            </Link>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading conversations...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 px-4">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium mb-2">No conversations yet</p>
            {user?.role === 'client' ? (
              <Link
                to="/find-cleaners"
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Find cleaners to start chatting
              </Link>
            ) : (
              <p className="text-sm">Your conversations will appear here</p>
            )}
          </div>
        ) : (
          conversations.map((room) => {
            const otherUser = getOtherParticipant(room);
            if (!otherUser) return null;

            return (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className="w-full text-left px-4 py-4 hover:bg-white border-b transition"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {otherUser.first_name?.[0] || otherUser.username?.[0] || '?'}
                  </div>

                  {/* Message Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <h3 className="font-semibold truncate">
                        {otherUser.first_name} {otherUser.last_name}
                      </h3>
                      {room.last_message_time && (
                        <span className="text-xs text-gray-500 ml-2">
                          {new Date(room.last_message_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    
                    {room.last_message_content && (
                      <p className="text-sm text-gray-600 truncate">
                        {room.last_message_sender?.id === user?.id ? 'You: ' : ''}
                        {room.last_message_content}
                      </p>
                    )}
                  </div>

                  {/* Unread Badge */}
                  {room.unread_count > 0 && (
                    <div className="flex-shrink-0 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {room.unread_count}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DirectMessages;
