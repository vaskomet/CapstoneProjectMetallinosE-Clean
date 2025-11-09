import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';

/**
 * Account Settings Page
 * Account deletion and data management
 */
export default function AccountSettings() {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleDeleteAccount = async () => {
    // TODO: Implement account deletion API
    console.log('Delete account requested');
    // await userAPI.deleteAccount();
    // logout();
    // navigate('/');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account settings and data
        </p>
      </div>

      {/* Account Information */}
      <div className="border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Account Information</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Email</p>
            <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Role</p>
            <p className="mt-1 text-sm text-gray-900 capitalize">{user?.role}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Account Type</p>
            <p className="mt-1 text-sm text-gray-900">
              {user?.is_oauth_user ? `OAuth (${user.oauth_provider})` : 'Email & Password'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Member Since</p>
            <p className="mt-1 text-sm text-gray-900">
              {user?.date_joined ? new Date(user.date_joined).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Data Export (Coming Soon) */}
      <div className="border border-gray-200 rounded-lg p-6 opacity-60">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Export Your Data</h3>
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                Coming Soon
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Download a copy of your account data and activity
            </p>
          </div>
          <button
            disabled
            className="px-4 py-2 bg-gray-100 text-gray-400 font-medium rounded-lg cursor-not-allowed"
          >
            Export Data
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-2 border-red-200 rounded-lg p-6 space-y-4 bg-red-50/50">
        <div>
          <h3 className="text-lg font-semibold text-red-900 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Danger Zone
          </h3>
          <p className="mt-1 text-sm text-red-700">
            Irreversible actions that affect your account
          </p>
        </div>

        {!showDeleteConfirm ? (
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900">Delete Account</p>
              <p className="text-sm text-gray-600 mt-1">
                Permanently delete your account and all associated data
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all"
            >
              Delete Account
            </button>
          </div>
        ) : (
          <div className="space-y-4 bg-white border border-red-300 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Are you absolutely sure?</h4>
                <p className="mt-1 text-sm text-gray-600">
                  This action <strong>cannot be undone</strong>. This will permanently delete your account,
                  all your jobs, messages, and remove all your data from our servers.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="delete-confirm" className="block text-sm font-medium text-gray-700 mb-2">
                Type <code className="px-2 py-0.5 bg-gray-100 rounded text-sm font-mono">DELETE</code> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Type DELETE to confirm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Delete My Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
