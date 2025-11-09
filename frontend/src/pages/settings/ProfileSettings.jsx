import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import PhoneInput from '../../components/PhoneInput';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';

/**
 * Profile Settings Page
 * Manages personal information (name, phone, email display)
 */
export default function ProfileSettings() {
  const { user, updateProfile } = useUser();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    country_code: '+30',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCountryCodeChange = (countryCode) => {
    setFormData({ ...formData, country_code: countryCode });
  };

  const handlePhoneNumberChange = (phoneNumber) => {
    setFormData({ ...formData, phone_number: phoneNumber });
  };

  const validatePhoneNumber = () => {
    const fullPhoneNumber = formData.country_code + formData.phone_number;
    if (fullPhoneNumber.length > 14) {
      return 'Phone number with country code cannot exceed 14 characters';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');
    setMessage('');

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

  const handleVerificationMessage = (msg, type = 'success') => {
    if (type === 'error') {
      setError(msg);
    } else {
      setMessage(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Profile Information</h2>
        <p className="mt-1 text-sm text-gray-600">
          Update your personal information and contact details
        </p>
      </div>

      {/* Email Verification Banner */}
      <EmailVerificationBanner 
        user={user} 
        onVerificationSent={handleVerificationMessage}
      />

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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Read-only fields */}
        <div className="space-y-4 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Account Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Email cannot be changed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                Username cannot be changed
              </p>
            </div>
          </div>

          {user?.is_oauth_user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  OAuth Account
                </p>
                <p className="mt-1 text-sm text-blue-700">
                  Your account is connected via <span className="font-semibold capitalize">{user.oauth_provider}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Editable fields */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Personal Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="John"
              />
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <PhoneInput
              countryCode={formData.country_code}
              phoneNumber={formData.phone_number}
              onCountryChange={handleCountryCodeChange}
              onPhoneChange={handlePhoneNumberChange}
            />
            <p className="mt-1 text-xs text-gray-500">
              Total length: {(formData.country_code + formData.phone_number).length}/14 characters
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isUpdating}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isUpdating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
