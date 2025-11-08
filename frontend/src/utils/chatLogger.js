/**
 * Chat Logger Utility
 * 
 * Centralized logging for chat functionality with debug mode control.
 * Set DEBUG to true to see verbose logs during development.
 */

const DEBUG = true; // Set to true for verbose debugging

/**
 * Chat logging utility with emoji prefixes and debug control
 */
export const chatLog = {
  /**
   * Connection events (always shown)
   */
  connect: (message, data) => {
    console.log('🔌 Chat:', message, data !== undefined ? data : '');
  },

  /**
   * Error events (always shown)
   */
  error: (message, error) => {
    console.error('❌ Chat Error:', message, error || '');
  },

  /**
   * Message events (only in debug mode)
   */
  message: (message, data) => {
    if (DEBUG) {
      console.log('💬', message, data !== undefined ? data : '');
    }
  },

  /**
   * Debug events (only in debug mode)
   */
  debug: (message, data) => {
    if (DEBUG) {
      console.log('🔍 Debug:', message, data !== undefined ? data : '');
    }
  },

  /**
   * Success events (only in debug mode)
   */
  success: (message, data) => {
    if (DEBUG) {
      console.log('✅', message, data !== undefined ? data : '');
    }
  },

  /**
   * Info events (only in debug mode)
   */
  info: (message, data) => {
    if (DEBUG) {
      console.log('ℹ️', message, data !== undefined ? data : '');
    }
  },

  /**
   * Warning events (only in debug mode)
   */
  warn: (message, data) => {
    if (DEBUG) {
      console.warn('⚠️ Chat Warning:', message, data !== undefined ? data : '');
    }
  }
};

/**
 * Enable or disable debug mode at runtime
 */
export const setChatDebug = (enabled) => {
  if (typeof window !== 'undefined') {
    window.__CHAT_DEBUG_ENABLED__ = enabled;
  }
};

/**
 * Check if debug mode is enabled
 */
export const isChatDebugEnabled = () => {
  if (typeof window !== 'undefined' && window.__CHAT_DEBUG_ENABLED__ !== undefined) {
    return window.__CHAT_DEBUG_ENABLED__;
  }
  return DEBUG;
};

// Allow runtime debug control via window object
if (typeof window !== 'undefined') {
  window.enableChatDebug = () => setChatDebug(true);
  window.disableChatDebug = () => setChatDebug(false);
  
  console.log('💡 Chat debug controls available:');
  console.log('  - window.enableChatDebug()  → Enable verbose logs');
  console.log('  - window.disableChatDebug() → Disable verbose logs');
}

export default chatLog;
