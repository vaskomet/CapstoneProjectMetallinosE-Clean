/**
 * ConnectionStateIndicator Component
 * 
 * Visual indicator showing WebSocket connection status
 * Appears when connection is lost or reconnecting
 */

import React from 'react';
import { useUnifiedChat } from '../../contexts/UnifiedChatContext';

const ConnectionStateIndicator = () => {
  const { connectionStatus, isConnected } = useUnifiedChat();
  
  // Don't show anything when connected
  if (isConnected) {
    return null;
  }
  
  // Determine message and styling based on status
  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connecting':
        return {
          bg: 'bg-yellow-500',
          icon: '🔄',
          message: 'Connecting to chat...',
          animate: true
        };
      case 'disconnected':
        return {
          bg: 'bg-orange-500',
          icon: '⚠️',
          message: 'Chat disconnected. Reconnecting...',
          animate: true
        };
      case 'error':
        return {
          bg: 'bg-red-500',
          icon: '❌',
          message: 'Connection failed. Messages will be sent when reconnected.',
          animate: false
        };
      default:
        return {
          bg: 'bg-gray-500',
          icon: '⏸️',
          message: 'Chat offline',
          animate: false
        };
    }
  };
  
  const config = getStatusConfig();
  
  return (
    <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 z-50 ${config.bg} text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 transition-all duration-300`}>
      <span className={config.animate ? 'animate-spin' : ''}>{config.icon}</span>
      <span className="text-sm font-medium">{config.message}</span>
    </div>
  );
};

export default ConnectionStateIndicator;
