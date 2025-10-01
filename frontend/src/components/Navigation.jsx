import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

// Navigation component with links per DEVELOPMENT_STANDARDS.md
// Uses kebab-case for URL paths and Tailwind styling
export default function Navigation() {
  const { user, isAuthenticated, logout } = useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
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
                <Link 
                  to="/properties" 
                  className="text-gray-700 hover:text-green-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-green-50"
                >
                  Properties
                </Link>
                <Link 
                  to="/profile" 
                  className="text-gray-700 hover:text-purple-600 px-4 py-2 rounded-xl text-base font-semibold transition-all duration-200 hover:bg-purple-50"
                >
                  Profile
                </Link>
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