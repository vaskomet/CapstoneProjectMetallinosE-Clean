/**
 * ChatContext
 * 
 * Global state management for the chat system
 * Manages panel open/closed state, total unread count, and active room
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { chatAPI } from '../services/api';
import { useUser } from './UserContext';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user } = useUser();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [chatRooms, setChatRooms] = useState([]);

  // Fetch chat rooms and calculate unread count
  // Wrapped in useCallback to prevent infinite loops
  const fetchChatData = useCallback(async () => {
    if (!user) return;
    
    try {
      const rooms = await chatAPI.getAllRooms();
      setChatRooms(rooms);
      
      // Calculate total unread messages
      const total = rooms.reduce((sum, room) => sum + (room.unread_count || 0), 0);
      setTotalUnreadCount(total);
      console.log('💬 ChatContext: Fetched chat data, unread count:', total);
    } catch (error) {
      console.error('Failed to fetch chat data:', error);
    }
  }, [user]); // Only recreate when user changes

  // Function to be called when a new message arrives
  const incrementUnreadCount = useCallback(() => {
    setTotalUnreadCount(prev => prev + 1);
  }, []);

  // Listen for new messages from WebSocket
  useEffect(() => {
    const handleNewMessage = (event) => {
      const { roomId, message } = event.detail;
      console.log('💬 ChatContext: New message received in room', roomId);
      
      // If the message is not from the current user, increment unread count
      if (message.sender?.id !== user?.id) {
        incrementUnreadCount();
      }
      
      // Refresh chat data to get updated unread counts
      fetchChatData();
    };

    window.addEventListener('newChatMessage', handleNewMessage);
    return () => window.removeEventListener('newChatMessage', handleNewMessage);
  }, [user, fetchChatData, incrementUnreadCount]); // Fixed: Added all dependencies

  // Fetch chat data when user logs in
  useEffect(() => {
    if (user) {
      fetchChatData();
      
      // Poll for updates every 30 seconds
      const interval = setInterval(fetchChatData, 30000);
      return () => clearInterval(interval);
    } else {
      setChatRooms([]);
      setTotalUnreadCount(0);
    }
  }, [user, fetchChatData]); // Fixed: Added fetchChatData to dependencies

  const openChat = () => setIsChatOpen(true);
  const closeChat = () => setIsChatOpen(false);
  const toggleChat = () => setIsChatOpen(!isChatOpen);

  // Function to be called when a message is read
  const decrementUnreadCount = useCallback((count = 1) => {
    setTotalUnreadCount(prev => Math.max(0, prev - count));
  }, []);

  // Refresh chat data manually
  const refreshChatData = useCallback(() => {
    fetchChatData();
  }, [fetchChatData]);

  const value = {
    isChatOpen,
    openChat,
    closeChat,
    toggleChat,
    totalUnreadCount,
    chatRooms,
    decrementUnreadCount,
    incrementUnreadCount,
    refreshChatData,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
