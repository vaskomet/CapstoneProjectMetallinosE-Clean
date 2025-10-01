import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

export default function Dashboard() {
  const { user } = useUser();

  const getRoleColor = (role) => {
    switch(role) {
      case 'client': return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg';
      case 'cleaner': return 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg';
      case 'admin': return 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg';
      default: return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg';
    }
  };

  const getWelcomeMessage = (role) => {
    switch(role) {
      case 'client': return 'Find and book professional cleaning services for your property.';
      case 'cleaner': return 'Manage your cleaning services and connect with clients.';
      case 'admin': return 'Oversee the platform and manage all users and services.';
      default: return 'Welcome to the E-Clean platform.';
    }
  };

  const getFeatures = (role) => {
    const baseFeatures = [
      {
        title: 'Profile',
        description: 'Update your account information and preferences.',
        link: '/profile',
        icon: (
          <svg className="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )
      }
    ];

    if (role === 'client') {
      return [
        {
          title: 'Properties',
          description: 'Manage your properties that need cleaning services.',
          link: '/properties',
          icon: (
            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )
        },
        {
          title: 'Cleaning Jobs',
          description: 'Book and track your cleaning appointments.',
          icon: (
            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )
        },
        ...baseFeatures
      ];
    } else if (role === 'cleaner') {
      return [
        {
          title: 'Available Jobs',
          description: 'View and accept cleaning job requests.',
          icon: (
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6m0 0a2 2 0 002 2h2m-2-2a2 2 0 00-2-2m2 2v12a2 2 0 002 2h-2a2 2 0 01-2-2V8z" />
            </svg>
          )
        },
        {
          title: 'My Jobs',
          description: 'Manage your assigned cleaning jobs.',
          icon: (
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          )
        },
        ...baseFeatures
      ];
    } else {
      return [
        {
          title: 'User Management',
          description: 'Manage all platform users and accounts.',
          icon: (
            <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          )
        },
        {
          title: 'Platform Overview',
          description: 'Monitor platform activity and analytics.',
          icon: (
            <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          )
        },
        ...baseFeatures
      ];
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-white to-blue-50 rounded-2xl shadow-lg p-8 border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
                Welcome back, {user?.first_name}! 👋
              </h1>
              <p className="text-gray-700 text-xl font-medium">
                {getWelcomeMessage(user?.role)}
              </p>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right space-y-1">
                <p className="text-sm text-gray-500 font-medium">Your Role</p>
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${getRoleColor(user?.role)}`}>
                  {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {getFeatures(user?.role).map((feature, index) => (
              <div key={index} className="group">
                {feature.link ? (
                  <Link to={feature.link} className="block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1">
                    <div className="p-8 space-y-6">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl group-hover:from-blue-200 group-hover:to-purple-200 transition-all duration-300">
                          {feature.icon}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-gray-600 leading-relaxed">
                        {feature.description}
                      </p>
                      <div className="pt-2">
                        <span className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold text-sm transition-all duration-200 group-hover:translate-x-1">
                          <span>Get started</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1">
                    <div className="p-8 space-y-6">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl group-hover:from-blue-200 group-hover:to-purple-200 transition-all duration-300">
                          {feature.icon}
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-gray-600 leading-relaxed">
                        {feature.description}
                      </p>
                      <div className="pt-2">
                        <button className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold text-sm transition-all duration-200 group-hover:translate-x-1">
                          <span>Coming Soon</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-gradient-to-r from-white to-indigo-50 rounded-2xl shadow-lg p-8 border border-indigo-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span>Quick Stats</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg text-white transform hover:scale-105 transition-transform duration-300">
              <div className="text-4xl font-bold mb-2">0</div>
              <div className="text-blue-100 font-medium">
                {user?.role === 'client' ? 'Properties' : user?.role === 'cleaner' ? 'Completed Jobs' : 'Total Users'}
              </div>
            </div>
            <div className="text-center p-8 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg text-white transform hover:scale-105 transition-transform duration-300">
              <div className="text-4xl font-bold mb-2">0</div>
              <div className="text-green-100 font-medium">
                {user?.role === 'client' ? 'Bookings' : user?.role === 'cleaner' ? 'Active Jobs' : 'Active Jobs'}
              </div>
            </div>
            <div className="text-center p-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-lg text-white transform hover:scale-105 transition-transform duration-300">
              <div className="text-4xl font-bold mb-2">$0</div>
              <div className="text-purple-100 font-medium">
                {user?.role === 'client' ? 'Total Spent' : user?.role === 'cleaner' ? 'Total Earned' : 'Platform Revenue'}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-gradient-to-r from-white to-green-50 rounded-2xl shadow-lg p-8 border border-green-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span>Recent Activity</span>
          </h2>
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">No recent activity yet</p>
              <p className="text-gray-400 text-sm mt-2">Your activity will appear here once you start using the platform</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}