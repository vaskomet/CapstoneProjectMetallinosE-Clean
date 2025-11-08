# Infinite Loop Fix - ChatContext API Spam

## Problem

When opening the navbar chat, `ChatContext` was making **hundreds of API requests** to `/chat/rooms/` per second, causing:
- Performance degradation
- Network spam
- Browser console flooding with logs
- Potential backend overload

## Root Cause

The `ChatContext` had missing `useCallback` wrappers and incomplete dependency arrays in `useEffect` hooks, causing:

1. **`fetchChatData` recreated on every render** - Not wrapped in `useCallback`, so it was a new function reference on every render
2. **Missing dependencies in `useEffect`** - Line 61: dependency array `[user]` was incomplete, missing `fetchChatData` and `incrementUnreadCount`
3. **Chain reaction** - Each render triggered the effect, which called `fetchChatData`, which caused a state update, which triggered a re-render, repeating infinitely

## Symptoms

Console logs showed:
```
api.js:80 🔑 Token attached to request: /chat/rooms/ Token exists: true
ChatContext.jsx:39 💬 ChatContext: Fetched chat data, unread count: 0
api.js:80 🔑 Token attached to request: /chat/rooms/ Token exists: true
ChatContext.jsx:39 💬 ChatContext: Fetched chat data, unread count: 0
api.js:80 🔑 Token attached to request: /chat/rooms/ Token exists: true
ChatContext.jsx:39 💬 ChatContext: Fetched chat data, unread count: 0
... (repeating hundreds of times)
```

## Solution

### 1. Wrapped `fetchChatData` in `useCallback`

**Before:**
```javascript
const fetchChatData = async () => {
  if (!user) return;
  // ... implementation
};
```

**After:**
```javascript
const fetchChatData = useCallback(async () => {
  if (!user) return;
  // ... implementation
}, [user]); // Only recreate when user changes
```

### 2. Wrapped `incrementUnreadCount` in `useCallback`

**Before:**
```javascript
const incrementUnreadCount = () => {
  setTotalUnreadCount(prev => prev + 1);
};
```

**After:**
```javascript
const incrementUnreadCount = useCallback(() => {
  setTotalUnreadCount(prev => prev + 1);
}, []); // No dependencies, stable function
```

### 3. Fixed `useEffect` Dependency Arrays

**Before:**
```javascript
useEffect(() => {
  const handleNewMessage = (event) => {
    // ... uses fetchChatData and incrementUnreadCount
  };
  window.addEventListener('newChatMessage', handleNewMessage);
  return () => window.removeEventListener('newChatMessage', handleNewMessage);
}, [user]); // ❌ Missing fetchChatData and incrementUnreadCount
```

**After:**
```javascript
useEffect(() => {
  const handleNewMessage = (event) => {
    // ... uses fetchChatData and incrementUnreadCount
  };
  window.addEventListener('newChatMessage', handleNewMessage);
  return () => window.removeEventListener('newChatMessage', handleNewMessage);
}, [user, fetchChatData, incrementUnreadCount]); // ✅ All dependencies included
```

### 4. Fixed Polling `useEffect` Dependencies

**Before:**
```javascript
useEffect(() => {
  if (user) {
    fetchChatData();
    const interval = setInterval(fetchChatData, 30000);
    return () => clearInterval(interval);
  }
}, [user]); // ❌ Missing fetchChatData
```

**After:**
```javascript
useEffect(() => {
  if (user) {
    fetchChatData();
    const interval = setInterval(fetchChatData, 30000);
    return () => clearInterval(interval);
  }
}, [user, fetchChatData]); // ✅ fetchChatData included
```

### 5. Wrapped Helper Functions in `useCallback`

```javascript
const decrementUnreadCount = useCallback((count = 1) => {
  setTotalUnreadCount(prev => Math.max(0, prev - count));
}, []);

const refreshChatData = useCallback(() => {
  fetchChatData();
}, [fetchChatData]);
```

## Files Changed

- **`frontend/src/contexts/ChatContext.jsx`**
  - Added `useCallback` import
  - Wrapped `fetchChatData` in `useCallback([user])`
  - Wrapped `incrementUnreadCount` in `useCallback([])`
  - Fixed dependency arrays in two `useEffect` hooks
  - Wrapped `decrementUnreadCount` in `useCallback([])`
  - Wrapped `refreshChatData` in `useCallback([fetchChatData])`

## Expected Behavior

After the fix:
- `fetchChatData` is called **once** when user logs in
- `fetchChatData` is called **every 30 seconds** for polling
- `fetchChatData` is called **when a new message arrives** via WebSocket event
- **No infinite loops or redundant API calls**

Console should show:
```
💬 ChatContext: Fetched chat data, unread count: 0  (on login)
💬 ChatContext: Fetched chat data, unread count: 0  (every 30 seconds)
💬 ChatContext: New message received in room 5     (when message arrives)
💬 ChatContext: Fetched chat data, unread count: 1  (after new message)
```

## Testing

1. Open browser with DevTools
2. Login as any user
3. Open navbar chat panel
4. **Verify**: Only ONE API request to `/chat/rooms/` on panel open
5. Wait 30 seconds
6. **Verify**: ONE additional API request (polling)
7. Receive a message from another user
8. **Verify**: ONE API request triggered by new message event

## React Best Practices Applied

✅ **Stable function references** - Used `useCallback` for functions used in dependencies  
✅ **Complete dependency arrays** - All dependencies included in `useEffect`  
✅ **Proper memoization** - Functions only recreate when necessary  
✅ **No infinite loops** - Effect dependencies don't cause re-triggers  

## Status

🎉 **FIXED** - Infinite loop resolved, API requests now controlled and predictable.

## Related Issues

This fix resolves the same category of bug we fixed previously in `WebSocketContext.jsx` where `connectChatWebSocket` needed `useCallback`. The pattern is consistent: any function used in `useEffect` dependencies or passed as props should be wrapped in `useCallback` to prevent unnecessary re-renders and infinite loops.
