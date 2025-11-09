import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';

/**
 * Settings Layout Component
 * 
 * Modern settings page with sidebar navigation following webapp standards.
 * Used by: GitHub, LinkedIn, Google Account Settings, Stripe Dashboard
 * 
 * Features:
 * - Persistent sidebar navigation
 * - Active state indicators
 * - Role-based menu items
 * - Nested routing with <Outlet />
 * - Responsive design (mobile: bottom tabs, desktop: sidebar)
 */
export default function SettingsLayout() {
  const { user } = useUser();
  const location = useLocation();

  const navigationItems = [
    {
      id: 'profile',
      name: 'Profile',
      path: '/settings/profile',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      description: 'Manage your personal information',
    },
    {
      id: 'security',
      name: 'Security',
      path: '/settings/security',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      description: 'Password and authentication',
    },
    {
      id: 'notifications',
      name: 'Notifications',
      path: '/settings/notifications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      description: 'Email and push notification preferences',
    },
    {
      id: 'service-areas',
      name: 'Service Areas',
      path: '/settings/service-areas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: 'Manage your working locations',
      roleRequired: 'cleaner',
    },
    {
      id: 'connected-accounts',
      name: 'Connected Accounts',
      path: '/settings/connected-accounts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      description: 'Manage OAuth providers and integrations',
    },
    {
      id: 'account',
      name: 'Account',
      path: '/settings/account',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: 'Delete account and manage data',
    },
  ];

  // Filter navigation items based on user role
  const visibleItems = navigationItems.filter(
    (item) => !item.roleRequired || item.roleRequired === user?.role
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Desktop Layout: Sidebar + Content */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Sidebar Navigation - Hidden on mobile */}
          <aside className="hidden lg:block lg:col-span-3">
            <nav className="space-y-1 sticky top-8">
              {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={({ isActive }) =>
                      `group flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-white shadow-lg shadow-blue-500/10 text-blue-600 border border-blue-100'
                          : 'text-gray-700 hover:bg-white/60 hover:shadow-md'
                      }`
                    }
                  >
                    <div
                      className={`flex-shrink-0 ${
                        isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </NavLink>
                );
              })}
            </nav>
          </aside>

          {/* Mobile Navigation - Horizontal tabs */}
          <div className="lg:hidden mb-6 overflow-x-auto">
            <nav className="flex space-x-2 pb-2">
              {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'bg-white shadow-md text-blue-600 border border-blue-100'
                          : 'text-gray-600 hover:bg-white/60'
                      }`
                    }
                  >
                    {item.icon}
                    <span className="text-sm font-medium">{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <main className="lg:col-span-9">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 p-6 sm:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
