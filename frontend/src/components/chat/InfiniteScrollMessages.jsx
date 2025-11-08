/**
 * InfiniteScrollMessages Component
 * 
 * A scroll container component that detects when the user scrolls to the top
 * and triggers loading of older messages. Implements infinite scroll pattern
 * used by modern chat applications (Slack, Discord, WhatsApp).
 * 
 * @component
 * @module components/chat/InfiniteScrollMessages
 * 
 * @features
 * - Detects scroll-to-top for loading older messages
 * - Maintains scroll position when prepending messages
 * - Auto-scrolls to bottom for new messages
 * - Shows loading indicator at top when fetching
 * - Smooth scrolling behavior
 * - Performance optimized with throttling
 * 
 * @props
 * - children: React nodes to render (message list)
 * - onLoadMore: Function to call when scrolling to top
 * - hasMore: Boolean indicating if more messages exist
 * - isLoading: Boolean for initial loading state
 * - isLoadingMore: Boolean for pagination loading state
 * - className: Additional CSS classes
 * - autoScrollToBottom: Whether to auto-scroll on mount and new messages
 * 
 * @example
 * ```jsx
 * <InfiniteScrollMessages
 *   onLoadMore={loadMore}
 *   hasMore={hasMore}
 *   isLoadingMore={isLoadingMore}
 *   autoScrollToBottom={true}
 * >
 *   {messages.map(msg => <Message key={msg.id} {...msg} />)}
 * </InfiniteScrollMessages>
 * ```
 */

import { useRef, useEffect, useCallback, useState } from 'react';

const SCROLL_THRESHOLD = 50; // Pixels from top to trigger load
const THROTTLE_MS = 200; // Throttle scroll events

export const InfiniteScrollMessages = ({
  children,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  isLoadingMore = false,
  className = '',
  autoScrollToBottom = true,
}) => {
  const containerRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const isLoadingRef = useRef(false);
  const lastScrollTimeRef = useRef(0);
  const [shouldMaintainPosition, setShouldMaintainPosition] = useState(false);

  /**
   * Scroll to bottom of container
   * Used for initial load and new messages
   */
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  /**
   * Check if user is at the bottom of the scroll container
   */
  const isAtBottom = useCallback(() => {
    if (!containerRef.current) return false;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    return distanceFromBottom < 100; // Within 100px of bottom
  }, []);

  /**
   * Handle scroll events with throttling
   * Triggers loadMore when scrolling near the top
   */
  const handleScroll = useCallback(() => {
    if (!containerRef.current || !hasMore || isLoadingRef.current) return;

    const now = Date.now();
    if (now - lastScrollTimeRef.current < THROTTLE_MS) return;
    lastScrollTimeRef.current = now;

    const { scrollTop } = containerRef.current;

    // If user scrolls to top, load more messages
    if (scrollTop < SCROLL_THRESHOLD) {
      console.log('🔄 Scroll threshold reached, loading more messages...');
      isLoadingRef.current = true;
      setShouldMaintainPosition(true);
      
      // Store current scroll height before loading
      previousScrollHeightRef.current = containerRef.current.scrollHeight;
      
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  /**
   * Maintain scroll position after prepending messages
   * Critical for good UX - prevents jump when loading older messages
   */
  useEffect(() => {
    if (shouldMaintainPosition && !isLoadingMore && containerRef.current) {
      const newScrollHeight = containerRef.current.scrollHeight;
      const heightDifference = newScrollHeight - previousScrollHeightRef.current;
      
      if (heightDifference > 0) {
        // Adjust scroll position to maintain view
        containerRef.current.scrollTop += heightDifference;
        console.log(`📍 Maintained scroll position (adjusted by ${heightDifference}px)`);
      }
      
      setShouldMaintainPosition(false);
      isLoadingRef.current = false;
    }
  }, [isLoadingMore, shouldMaintainPosition]);

  /**
   * Auto-scroll to bottom on initial load
   */
  useEffect(() => {
    if (autoScrollToBottom && !isLoading && children) {
      // Small delay to ensure DOM is rendered
      const timer = setTimeout(() => scrollToBottom('auto'), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, autoScrollToBottom, scrollToBottom]);

  /**
   * Auto-scroll to bottom when new messages arrive (if already at bottom)
   */
  useEffect(() => {
    if (!isLoading && !isLoadingMore && autoScrollToBottom) {
      // Only auto-scroll if user is already at the bottom
      if (isAtBottom()) {
        scrollToBottom('smooth');
      }
    }
  }, [children, isLoading, isLoadingMore, autoScrollToBottom, isAtBottom, scrollToBottom]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-y-auto scroll-smooth ${className}`}
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Loading indicator at top */}
      {isLoadingMore && hasMore && (
        <div className="flex justify-center py-4">
          <div className="flex items-center space-x-2 text-gray-500">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">Loading older messages...</span>
          </div>
        </div>
      )}

      {/* "No more messages" indicator */}
      {!hasMore && !isLoading && children && (
        <div className="flex justify-center py-3">
          <span className="text-xs text-gray-400">• Beginning of conversation •</span>
        </div>
      )}

      {/* Initial loading state */}
      {isLoading && (
        <div className="flex justify-center items-center h-full">
          <div className="flex flex-col items-center space-y-3">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-gray-500">Loading messages...</span>
          </div>
        </div>
      )}

      {/* Message list */}
      {!isLoading && children}
    </div>
  );
};

export default InfiniteScrollMessages;
