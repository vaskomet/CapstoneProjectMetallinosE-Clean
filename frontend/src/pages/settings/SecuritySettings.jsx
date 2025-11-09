import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { authAPI } from '../../services/api';

/**
 * Security Settings Page
 * Password changes and authentication management
 */
export default function SecuritySettings() {
  const { user } = useUser();
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [isChanging, setIsChanging] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsChanging(true);
    setError('');
    setMessage('');

    // Validate passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      setIsChanging(false);
      return;
    }

    try {
      await authAPI.changePassword(passwordData);
      setMessage('Password changed successfully!');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setShowForm(false);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.current_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.non_field_errors?.[0] ||
        'Failed to change password'
      );
    }

    setIsChanging(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Security</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your password and authentication settings
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
          <p className="text-green-700 font-medium">{message}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Password Section */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Password</h3>
            <p className="mt-1 text-sm text-gray-600">
              {user?.is_oauth_user
                ? `Managed by ${user.oauth_provider}`
                : 'Change your password to keep your account secure'}
            </p>
          </div>
          {!user?.is_oauth_user && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            >
              Change Password
            </button>
          )}
        </div>

        {user?.is_oauth_user ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900">OAuth Authentication</p>
              <p className="mt-1 text-sm text-blue-700">
                You sign in with <span className="font-semibold capitalize">{user.oauth_provider}</span>.
                Password changes are managed through your {user.oauth_provider} account settings.
              </p>
            </div>
          </div>
        ) : showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="current_password" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                required
                value={passwordData.current_password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your current password"
              />
            </div>

            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                id="new_password"
                name="new_password"
                type="password"
                required
                value={passwordData.new_password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter a strong new password"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use at least 8 characters with a mix of letters, numbers, and symbols
              </p>
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                value={passwordData.confirm_password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Confirm your new password"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setPasswordData({
                    current_password: '',
                    new_password: '',
                    confirm_password: '',
                  });
                  setError('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isChanging}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isChanging ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </span>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">
              Your password is secure. Click "Change Password" to update it.
            </p>
          </div>
        )}
      </div>

      {/* Future: Two-Factor Authentication */}
      <div className="border border-gray-200 rounded-lg p-6 opacity-60">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                Coming Soon
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Add an extra layer of security to your account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
