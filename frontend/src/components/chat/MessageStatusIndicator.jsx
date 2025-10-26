import React from 'react';

/**
 * MessageStatusIndicator Component
 * 
 * Shows visual status for optimistic messages:
 * - Pending: Clock icon (sending...)
 * - Sent: Checkmark (delivered)
 * - Failed: X icon (retry available)
 */
const MessageStatusIndicator = ({ status, onRetry }) => {
  if (!status || status === 'sent') {
    // Don't show indicator for confirmed messages
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ),
          tooltip: 'Sending...',
          color: 'text-gray-400'
        };
      case 'failed':
        return {
          icon: (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          tooltip: 'Failed to send. Click to retry.',
          color: 'text-red-500 cursor-pointer hover:text-red-700'
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div 
      className={`inline-flex items-center ${config.color}`}
      title={config.tooltip}
      onClick={status === 'failed' && onRetry ? onRetry : undefined}
    >
      {config.icon}
    </div>
  );
};

export default MessageStatusIndicator;
