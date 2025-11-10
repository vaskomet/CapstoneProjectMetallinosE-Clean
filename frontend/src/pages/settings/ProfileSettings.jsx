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
  const [initialData, setInitialData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (user) {
      const userData = {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: user.phone_number || '',
        country_code: user.country_code || '+30',
      };
      setFormData(userData);
      setInitialData(userData);
    }
  }, [user]);

  // Track unsaved changes
  useEffect(() => {
    if (initialData) {
      const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialData);
      setHasUnsavedChanges(hasChanges);
    }
  }, [formData, initialData]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const validateField = (name, value) => {
    const newErrors = { ...errors };
    
    switch (name) {
      case 'first_name':
        if (value && value.trim().length > 0) {
          if (value.trim().length < 2) {
            newErrors.first_name = 'First name must be at least 2 characters long.';
          } else if (value.length > 150) {
            newErrors.first_name = 'First name cannot exceed 150 characters.';
          } else if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(value)) {
            newErrors.first_name = 'First name can only contain letters, spaces, hyphens, and apostrophes.';
          } else {
            delete newErrors.first_name;
          }
        } else {
          delete newErrors.first_name;
        }
        break;
        
      case 'last_name':
        if (value && value.trim().length > 0) {
          if (value.trim().length < 2) {
            newErrors.last_name = 'Last name must be at least 2 characters long.';
          } else if (value.length > 150) {
            newErrors.last_name = 'Last name cannot exceed 150 characters.';
          } else if (!/^[a-zA-ZÀ-ÿ\s\-']+$/.test(value)) {
            newErrors.last_name = 'Last name can only contain letters, spaces, hyphens, and apostrophes.';
          } else {
            delete newErrors.last_name;
          }
        } else {
          delete newErrors.last_name;
        }
        break;
        
      case 'phone_number':
        if (value) {
          const cleaned = value.replace(/[\s\-]/g, '');
          if (!/^\d+$/.test(cleaned)) {
            newErrors.phone_number = 'Phone number can only contain digits.';
          } else {
            // Backend will validate country-specific rules with phonenumbers library
            delete newErrors.phone_number;
          }
        } else {
          delete newErrors.phone_number;
        }
        break;
        
      default:
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear message on change
    setMessage('');
    // Validate on blur will happen, but clear error on type if fixing
    if (errors[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    validateField(name, value);
  };

  const handleCountryCodeChange = (countryCode) => {
    setFormData({ ...formData, country_code: countryCode });
    setMessage('');
    // Revalidate phone number with new country code
    if (formData.phone_number) {
      validateField('phone_number', formData.phone_number);
    }
  };

  const handlePhoneNumberChange = (phoneNumber) => {
    setFormData({ ...formData, phone_number: phoneNumber });
    setMessage('');
    if (errors.phone_number) {
      validateField('phone_number', phoneNumber);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setErrors({});
    setMessage('');

    // Validate all fields
    const firstNameValid = validateField('first_name', formData.first_name);
    const lastNameValid = validateField('last_name', formData.last_name);
    const phoneValid = validateField('phone_number', formData.phone_number);

    if (!firstNameValid || !lastNameValid || !phoneValid) {
      setIsUpdating(false);
      return;
    }

    const result = await updateProfile(formData);

    if (result.success) {
      setMessage('Profile updated successfully!');
      setInitialData(formData); // Update initial data to reflect saved state
      setHasUnsavedChanges(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } else {
      // Parse backend errors
      if (result.error && typeof result.error === 'object') {
        // Backend returned field-specific errors
        setErrors(result.error);
      } else {
        // Generic error
        setErrors({ general: result.error || 'Failed to update profile' });
      }
    }

    setIsUpdating(false);
  };

  const handleVerificationMessage = (msg, type = 'success') => {
    if (type === 'error') {
      setErrors({ general: msg });
    } else {
      setMessage(msg);
    }
  };

  const handleReset = () => {
    if (initialData) {
      setFormData(initialData);
      setErrors({});
      setMessage('');
      setHasUnsavedChanges(false);
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
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-700 font-medium">{message}</p>
          </div>
        </div>
      )}

      {errors.general && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 font-medium">{errors.general}</p>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-yellow-700 text-sm font-medium">You have unsaved changes</p>
          </div>
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
                onBlur={handleBlur}
                className={`w-full px-4 py-3 border ${
                  errors.first_name ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                } rounded-lg focus:outline-none focus:ring-2 transition-all`}
                placeholder="John"
              />
              {errors.first_name && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.first_name}
                </p>
              )}
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
                onBlur={handleBlur}
                className={`w-full px-4 py-3 border ${
                  errors.last_name ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                } rounded-lg focus:outline-none focus:ring-2 transition-all`}
                placeholder="Doe"
              />
              {errors.last_name && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.last_name}
                </p>
              )}
            </div>
          </div>

          <div>
            <PhoneInput
              countryCode={formData.country_code}
              phoneNumber={formData.phone_number}
              onCountryChange={handleCountryCodeChange}
              onPhoneChange={handlePhoneNumberChange}
              error={errors.phone_number}
            />
            {formData.phone_number && (
              <p className="mt-1 text-xs text-gray-500">
                Phone number length: {formData.phone_number.replace(/[\s\-]/g, '').length} digits
              </p>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 flex justify-end gap-3">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleReset}
              disabled={isUpdating}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Reset Changes
            </button>
          )}
          <button
            type="submit"
            disabled={isUpdating || Object.keys(errors).length > 0 || !hasUnsavedChanges}
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
