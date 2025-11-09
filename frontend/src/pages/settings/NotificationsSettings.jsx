import React from 'react';

/**
 * Notifications Settings Page (Placeholder)
 * Email and push notification preferences
 */
export default function NotificationsSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage how you receive notifications and updates
        </p>
      </div>

      {/* Coming Soon */}
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-gray-600">
          Notification preferences will be available in a future update
        </p>
      </div>
    </div>
  );
}
