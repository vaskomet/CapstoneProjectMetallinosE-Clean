import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { authAPI } from '../services/api';
import PhoneInput from './PhoneInput';
import ServiceAreaManager from './ServiceAreaManager';

// Profile component following PascalCase naming per DEVELOPMENT_STANDARDS.md
// Uses modern UI with gradients and proper spacing
export default function Profile() {
  const { user, updateProfile } = useUser();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    country_code: '+30', // Default to Greece
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: user.phone_number || '',
        country_code: user.country_code || '+30',
      });
    }
  }, [user]);

  const handleProfileChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCountryCodeChange = (countryCode) => {
    setFormData({
      ...formData,
      country_code: countryCode,
    });
  };

  const handlePhoneNumberChange = (phoneNumber) => {
    setFormData({
      ...formData,
      phone_number: phoneNumber,
    });
  };

  const validatePhoneNumber = () => {
    const fullPhoneNumber = formData.country_code + formData.phone_number;
    if (fullPhoneNumber.length > 14) {
      return 'Phone number with country code cannot exceed 14 characters';
    }
    return null;
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');
    setMessage('');

    // Validate phone number length
    const phoneError = validatePhoneNumber();
    if (phoneError) {
      setError(phoneError);
      setIsUpdating(false);
      return;
    }

    const result = await updateProfile(formData);
    
    if (result.success) {
      setMessage('Profile updated successfully!');
    } else {
      setError(result.error || 'Failed to update profile');
    }
    
    setIsUpdating(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setError('');
    setMessage('');

    try {
      await authAPI.changePassword(passwordData);
      setMessage('Password changed successfully!');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setShowPasswordForm(false);
    } catch (err) {
      setError(err.response?.data?.current_password?.[0] || 
               err.response?.data?.new_password?.[0] || 
               err.response?.data?.non_field_errors?.[0] || 
               'Failed to change password');
    }
    
    setIsChangingPassword(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Profile Settings
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            Manage your account information and security
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-400 p-6 rounded-2xl">
            <p className="text-green-700 font-medium">{message}</p>
          </div>
        )}

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 p-6 rounded-2xl">
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Information */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="flex items-center space-x-3 mb-8">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Username</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">Username cannot be changed</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Role</label>
                <input
                  type="text"
                  value={user?.role || ''}
                  disabled
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl bg-gray-50 text-gray-500 cursor-not-allowed capitalize"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700">
                    First Name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    value={formData.first_name}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700">
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    value={formData.last_name}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <PhoneInput
                countryCode={formData.country_code}
                phoneNumber={formData.phone_number}
                onCountryChange={handleCountryCodeChange}
                onPhoneChange={handlePhoneNumberChange}
                className="space-y-2"
              />
              <div className="mt-1">
                <p className="text-xs text-gray-500">
                  Total length: {(formData.country_code + formData.phone_number).length}/14 characters
                </p>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full flex justify-center items-center px-6 py-4 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                {isUpdating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Update Profile'
                )}
              </button>
            </form>
          </div>

          {/* Password Change */}
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="flex items-center space-x-3 mb-8">
              <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Password & Security</h2>
            </div>

            {!showPasswordForm ? (
              <div className="text-center space-y-6">
                <p className="text-gray-600">
                  Keep your account secure by using a strong password
                </p>
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full flex justify-center items-center px-6 py-4 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  Change Password
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="current_password" className="block text-sm font-semibold text-gray-700">
                    Current Password
                  </label>
                  <input
                    id="current_password"
                    name="current_password"
                    type="password"
                    required
                    value={passwordData.current_password}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                    placeholder="Enter current password"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="new_password" className="block text-sm font-semibold text-gray-700">
                    New Password
                  </label>
                  <input
                    id="new_password"
                    name="new_password"
                    type="password"
                    required
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm_password" className="block text-sm font-semibold text-gray-700">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    required
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                    placeholder="Confirm new password"
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordData({
                        current_password: '',
                        new_password: '',
                        confirm_password: '',
                      });
                      setError('');
                    }}
                    className="flex-1 px-6 py-4 border-2 border-gray-300 text-lg font-semibold rounded-2xl text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-gray-300 transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex-1 flex justify-center items-center px-6 py-4 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    {isChangingPassword ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Changing...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Service Areas - Only for Cleaners */}
        {user?.role === 'cleaner' && (
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
            <div className="flex items-center space-x-3 mb-8">
              <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Service Areas</h2>
            </div>
            <ServiceAreaManager />
          </div>
        )}
      </div>
    </div>
  );
}