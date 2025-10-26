import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useUnifiedChat } from '../contexts/UnifiedChatContext';
import NotificationBell from './notifications/NotificationBell';
import { toast } from 'react-toastify';

// Navigation component with links per DEVELOPMENT_STANDARDS.md
// Role-based links per DEVELOPMENT_STANDARDS.md, uses kebab-case for URLs; integrates with useUser hook as in auth.
// Uses kebab-case for URL paths and Tailwind styling
export default function Navigation() {
  const { user, isAuthenticated, logout } = useUser();
  const { toggleChat, totalUnreadCount } = useUnifiedChat();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-xl border-b border-gray-100 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 via-purple-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:via-purple-700 group-hover:to-green-700 transition-all duration-300">
                E-Clean
              </span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-6">
            {!isAuthenticated ? (
              <>
                <Link 
                  to="/login" 
                  className="text-gray-700 hover:text-blue-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-blue-50"
                >
                  Sign In
                </Link>
                <Link 
                  to="/register" 
                  className="bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 hover:from-blue-700 hover:via-purple-700 hover:to-green-700 text-white px-6 py-3 rounded-xl text-base font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link 
                  to="/dashboard" 
                  className="text-gray-700 hover:text-blue-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-blue-50"
                >
                  Dashboard
                </Link>
                {(user?.role === 'client' || user?.role === 'cleaner') && (
                  <Link 
                    to="/jobs" 
                    className="text-gray-700 hover:text-purple-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-purple-50 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{user?.role === 'client' ? 'My Jobs' : 'Find Jobs'}</span>
                  </Link>
                )}
                {(user?.role === 'client' || user?.role === 'cleaner') && (
                  <Link 
                    to="/completed-jobs" 
                    className="text-gray-700 hover:text-green-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-green-50 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>History</span>
                  </Link>
                )}
                {user?.role === 'client' && (
                  <Link 
                    to="/properties" 
                    className="text-gray-700 hover:text-emerald-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-emerald-50 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>Properties</span>
                  </Link>
                )}
                <Link 
                  to="/profile" 
                  className="text-gray-700 hover:text-purple-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-purple-50"
                >
                  Profile
                </Link>
                
                {/* Real-time notifications */}
                <div className="flex items-center">
                  <NotificationBell />
                </div>

                {/* Chat Button with Unread Badge */}
                <div className="flex items-center">
                  <button
                    onClick={toggleChat}
                    className="relative p-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
                    aria-label="Open chat"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {totalUnreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full animate-pulse">
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </span>
                    )}
                  </button>
                </div>
                
                <div className="flex items-center space-x-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-4 border border-gray-200">
                  <div className="text-right space-y-1">
                    <p className="text-base font-semibold text-gray-900">
                      {user?.first_name || user?.email}
                    </p>
                    <p className="text-sm text-gray-600 capitalize font-medium">
                      {user?.role}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}