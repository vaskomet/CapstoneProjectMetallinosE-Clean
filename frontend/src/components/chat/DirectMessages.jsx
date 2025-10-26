import React, { useState, useEffect } from 'react';
import { chatAPI, cleanerSearchAPI } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import ChatRoom from './ChatRoom';

/**
 * DirectMessages Component
 * 
 * Displays list of DM conversations and allows starting new DMs
 * Reuses ChatRoom component for actual message display
 */
const DirectMessages = () => {
  const { user } = useUser();
  const [conversations, setConversations] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

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

  // Search for users to message
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      // Use cleaner search API - adapt as needed for your user search
      const response = await cleanerSearchAPI.searchByLocation({
        city: query  // Simplified - you may want a dedicated user search endpoint
      });
      
      // Filter out current user
      const users = response.cleaners?.filter(u => u.id !== user?.id) || [];
      setSearchResults(users);
    } catch (error) {
      console.error('User search failed:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Start DM with selected user
  const startDM = async (otherUser) => {
    try {
      const result = await chatAPI.startDirectMessage(otherUser.id);
      
      // Add to conversations if newly created
      if (result.created) {
        setConversations([result.room, ...conversations]);
      }
      
      // Open the room
      setSelectedRoom(result.room);
      setShowUserSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to start DM:', error);
    }
  };

  // Get other participant's info from DM room
  const getOtherParticipant = (room) => {
    if (!room.participants || !user) return null;
    return room.participants.find(p => p.id !== user.id);
  };

  // Handle debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
          <button
            onClick={() => setShowUserSearch(!showUserSearch)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + New Message
          </button>
        </div>
      </div>

      {/* User Search Modal/Panel */}
      {showUserSearch && (
        <div className="bg-white border-b p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Start New Conversation</h3>
            <button
              onClick={() => {
                setShowUserSearch(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <input
            type="text"
            placeholder="Search users by name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />

          {searching && (
            <div className="mt-2 text-center text-gray-500">Searching...</div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-2 max-h-64 overflow-y-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => startDM(user)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b last:border-b-0 transition"
                >
                  <div className="font-medium">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {user.email}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!searching && searchQuery && searchResults.length === 0 && (
            <div className="mt-2 text-center text-gray-500">
              No users found
            </div>
          )}
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading conversations...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="mb-2">No conversations yet</p>
            <p className="text-sm">Click "New Message" to start chatting</p>
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
