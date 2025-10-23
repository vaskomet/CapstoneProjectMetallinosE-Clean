/**
 * User Authentication Context
 *
 * React context for managing user authentication state and operations throughout the E-Cleaner platform.
 * Provides centralized user management with JWT token handling, profile management, and role-based access control.
 *
 * @module UserContext
 *
 * @features
 * - JWT token-based authentication with automatic refresh
 * - User profile management and updates
 * - Role-based access control (customer, cleaner, admin)
 * - Persistent authentication state across browser sessions
 * - Comprehensive error handling with user-friendly messages
 * - Password change functionality
 * - Automatic token validation on app initialization
 *
 * @dependencies
 * - React: Core React hooks (useReducer, useEffect, useContext)
 * - authAPI: Authentication service from '../services/api'
 * - localStorage: Browser storage for token persistence
 *
 * @example
 * ```jsx
 * import { UserProvider, useUser } from './contexts/UserContext';
 *
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <UserProvider>
 *       <YourAppComponents />
 *     </UserProvider>
 *   );
 * }
 *
 * // Use the hook in components
 * function ProfileComponent() {
 *   const { user, isAuthenticated, login, logout } = useUser();
 *
 *   if (!isAuthenticated) {
 *     return <LoginForm onLogin={login} />;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>Welcome, {user.first_name}!</h1>
 *       <p>Role: {user.role}</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const UserContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

/**
 * User State Reducer
 *
 * Reducer function for managing user authentication state using React's useReducer hook.
 * Handles all user-related state transitions including login, logout, loading states, and errors.
 *
 * @function userReducer
 * @param {Object} state - Current state object
 * @param {Object} action - Action object with type and payload
 * @param {string} action.type - Action type ('SET_LOADING' | 'SET_USER' | 'SET_ERROR' | 'LOGOUT')
 * @param {*} action.payload - Action payload data
 * @returns {Object} New state object
 *
 * @example
 * ```javascript
 * // State transitions:
 * // SET_LOADING: { isLoading: true }
 * // SET_USER: { user: userData, isAuthenticated: true, isLoading: false, error: null }
 * // SET_ERROR: { error: 'Error message', isLoading: false }
 * // LOGOUT: { user: null, isAuthenticated: false, isLoading: false, error: null }
 * ```
 */
function userReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    default:
      return state;
  }
}

/**
 * User Provider Component
 *
 * React context provider that manages user authentication state and provides authentication methods.
 * Handles automatic token validation on app initialization, login/logout operations, and profile management.
 *
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} Provider component wrapping children
 *
 * @example
 * ```jsx
 * <UserProvider>
 *   <App />
 * </UserProvider>
 * ```
 */
export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState);

  // Check if user is authenticated on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔍 Auth initialization:', { token: !!token, storedUser: !!storedUser });
      
      if (token) {
        try {
          // Try to get fresh user data from API
          const userData = await authAPI.getProfile();
          console.log('✅ Profile fetched successfully:', userData);
          dispatch({ type: 'SET_USER', payload: userData });
        } catch (error) {
          console.log('❌ Profile fetch failed:', error.message);
          
          // If API fails but we have stored user data, use it
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              console.log('🔄 Using stored user data:', userData);
              dispatch({ type: 'SET_USER', payload: userData });
              return;
            } catch (parseError) {
              console.log('❌ Stored user data parse failed:', parseError);
            }
          }
          
          // Token is invalid and no valid stored data, remove everything
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          dispatch({ type: 'SET_USER', payload: null });
        }
      } else {
        console.log('ℹ️ No token found, user logged out');
        dispatch({ type: 'SET_USER', payload: null });
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Debug logging (can be removed later)
      console.log('Login attempt with credentials:', credentials);
      
      const response = await authAPI.login(credentials);
      // authAPI.login already handles localStorage, just get user data
      const { user } = response;

      console.log('Login successful:', { user: user.email, role: user.role });
      
      dispatch({ type: 'SET_USER', payload: user });
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error response:', error.response?.data);
      
      // Enhanced error handling for specific cases
      let errorMessage = 'Login failed';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.email?.[0]) {
        errorMessage = error.response.data.email[0];
      } else if (error.response?.data?.password?.[0]) {
        errorMessage = error.response.data.password[0];
      }
      
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authAPI.register(userData);
      // authAPI.register already returns response.data, so access directly
      const { access, refresh, user } = response;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      dispatch({ type: 'SET_USER', payload: user });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    dispatch({ type: 'LOGOUT' });
  };

  const updateProfile = async (data) => {
    try {
      const response = await authAPI.updateProfile(data);
      // API service now returns response.data directly
      dispatch({ type: 'SET_USER', payload: response });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Profile update failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const changePassword = async (passwordData) => {
    try {
      await authAPI.changePassword(passwordData);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Password change failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * useUser Hook
 *
 * Custom React hook for accessing user authentication state and methods.
 * Must be used within a UserProvider component.
 *
 * @returns {Object} User context interface
 * @property {Object|null} user - Current user object or null if not authenticated
 * @property {boolean} isAuthenticated - Whether user is currently authenticated
 * @property {boolean} isLoading - Whether authentication state is being determined
 * @property {string|null} error - Current error message or null
 * @property {Function} login - Login function accepting credentials
 * @property {Function} register - Registration function accepting user data
 * @property {Function} logout - Logout function
 * @property {Function} updateProfile - Profile update function
 * @property {Function} changePassword - Password change function
 * @throws {Error} If used outside of UserProvider
 *
 * @example
 * ```javascript
 * const {
 *   user,
 *   isAuthenticated,
 *   isLoading,
 *   login,
 *   logout
 * } = useUser();
 *
 * // Login user
 * const result = await login({ email: 'user@example.com', password: 'password' });
 * if (result.success) {
 *   console.log('Login successful!');
 * }
 *
 * // Check authentication status
 * if (isAuthenticated) {
 *   console.log('Welcome,', user.first_name);
 * }
 * ```
 */
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}