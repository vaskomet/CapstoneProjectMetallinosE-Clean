import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useUnifiedChat } from '../contexts/UnifiedChatContext';
import NotificationBell from './notifications/NotificationBell';
import { toast } from 'react-toastify';

// Navigation component with links per DEVELOPMENT_STANDARDS.md
// Role-based links per DEVELOPMENT_STANDARDS.md, uses kebab-case for URLs; integrates with useUser hook as in auth.
// Uses kebab-case for URL paths and Tailwind styling
// Mobile-first responsive design with hamburger menu
export default function Navigation() {
  const { user, isAuthenticated, logout } = useUser();
  const { toggleChat, totalUnreadCount } = useUnifiedChat();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-xl border-b border-gray-100 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 md:h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 md:space-x-3 group" onClick={closeMobileMenu}>
              <div className="h-8 w-8 md:h-10 md:w-10 bg-gradient-to-br from-blue-600 via-purple-600 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                <svg className="h-4 w-4 md:h-6 md:w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:via-purple-700 group-hover:to-green-700 transition-all duration-300">
                E-Clean
              </span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4">
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
                <Link to="/dashboard" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all">
                  Dashboard
                </Link>
                
                {user?.role === 'client' && (
                  <>
                    <Link to="/properties" className="text-gray-700 hover:text-emerald-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>Properties</span>
                    </Link>
                    <Link to="/find-cleaners" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Find Cleaners</span>
                    </Link>
                  </>
                )}
                
                <Link to="/jobs" className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{user?.role === 'client' ? 'My Jobs' : 'Find Jobs'}</span>
                </Link>
                
                <Link to="/completed-jobs" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>History</span>
                </Link>
                
                <Link to="/payments" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>{user?.role === 'cleaner' ? 'Earnings' : 'Payments'}</span>
                </Link>
                
                {user?.role === 'cleaner' && (
                  <Link to="/payouts" className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Payouts</span>
                  </Link>
                )}
                
                <NotificationBell />
                
                <button onClick={toggleChat} className="relative p-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" aria-label="Open chat">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </span>
                  )}
                </button>
                
                <Link to="/profile" className="text-gray-700 hover:text-purple-600 px-3 py-2 rounded-lg text-sm font-semibold transition-all">
                  Profile
                </Link>
                
                <button onClick={handleLogout} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg">
                  Sign Out
                </button>
              </>
            )}
          </div>
          
          {/* Mobile menu button & icons */}
          <div className="flex lg:hidden items-center space-x-2">
            {isAuthenticated && (
              <>
                <NotificationBell />
                <button onClick={toggleChat} className="relative p-2 text-gray-700 hover:text-blue-600 rounded-lg" aria-label="Open chat">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold text-white bg-red-600 rounded-full">
                      {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                    </span>
                  )}
                </button>
              </>
            )}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors" aria-label="Toggle menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          <div className="px-4 pt-2 pb-3 space-y-1">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all" onClick={closeMobileMenu}>
                  Sign In
                </Link>
                <Link to="/register" className="block px-3 py-2 rounded-lg text-base font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all" onClick={closeMobileMenu}>
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 mb-3">
                  <p className="text-sm font-semibold text-gray-900">{user?.first_name || user?.email}</p>
                  <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
                </div>
                
                <Link to="/dashboard" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all" onClick={closeMobileMenu}>
                  Dashboard
                </Link>
                
                {user?.role === 'client' && (
                  <>
                    <Link to="/properties" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 transition-all" onClick={closeMobileMenu}>
                      🏠 Properties
                    </Link>
                    <Link to="/find-cleaners" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-all" onClick={closeMobileMenu}>
                      🔍 Find Cleaners
                    </Link>
                  </>
                )}
                
                <Link to="/jobs" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all" onClick={closeMobileMenu}>
                  📋 {user?.role === 'client' ? 'My Jobs' : 'Find Jobs'}
                </Link>
                
                <Link to="/completed-jobs" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-green-50 hover:text-green-600 transition-all" onClick={closeMobileMenu}>
                  ✅ History
                </Link>
                
                <Link to="/payments" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all" onClick={closeMobileMenu}>
                  💳 {user?.role === 'cleaner' ? 'Earnings' : 'Payments'}
                </Link>
                
                {user?.role === 'cleaner' && (
                  <Link to="/payouts" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-green-50 hover:text-green-600 transition-all" onClick={closeMobileMenu}>
                    💰 Payouts
                  </Link>
                )}
                
                {user?.role === 'admin' && (
                  <Link to="/admin/financials" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all" onClick={closeMobileMenu}>
                    📊 Financials
                  </Link>
                )}
                
                <Link to="/profile" className="block px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-600 transition-all" onClick={closeMobileMenu}>
                  👤 Profile
                </Link>
                
                <button onClick={handleLogout} className="w-full mt-2 px-3 py-2 rounded-lg text-base font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all">
                  🚪 Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}