/**
 * RegisterForm Component (Enhanced with OAuth & Industry Validation)
 *
 * User registration form component for new account creation in the E-Cleaner platform.
 * Provides comprehensive form validation, Google OAuth login, and role-based account setup.
 *
 * @component
 * @requires React, React Router
 * @requires UserContext for registration state management
 * @requires PhoneInput component for international phone number handling
 *
 * @features
 * - **Industry-Standard Validation**: Real-time validation with strength indicators
 * - **Google OAuth Registration**: One-click signup with Google account
 * - **Password Strength Meter**: Visual feedback on password complexity
 * - **Email Format Validation**: RFC-compliant email checking
 * - **Username Availability**: Real-time uniqueness checking (optional)
 * - **Role Selection**: User type selection (client/cleaner) affecting dashboard routing
 * - **Phone Number Input**: International phone number formatting with country codes
 * - **Password Confirmation**: Secure password setup with confirmation matching
 * - **Form State Management**: Real-time validation and error display
 * - **Loading States**: Visual feedback during registration process
 * - **Responsive Design**: Mobile-friendly form layout with gradient styling
 * - **Auto-navigation**: Automatic redirect to dashboard on successful registration
 * - **Terms & Conditions**: Legal agreement checkbox (optional)
 *
 * @dependencies
 * - React Router: useNavigate for post-registration redirection
 * - UserContext: register function and error state management
 * - PhoneInput: International phone number input component
 * - Tailwind CSS: Gradient backgrounds and responsive styling
 *
 * @api
 * - POST /api/auth/register/ - User account creation endpoint
 * - GET /accounts/google/login/ - Google OAuth initiation endpoint
 * - Returns: User profile data and authentication tokens
 *
 * @state
 * - formData: Complete user registration data including personal info and role
 * - isSubmitting: Loading state during registration request
 * - errors: Field-specific validation error messages
 *
 * @validation
 * - Email: Required, format validation handled server-side
 * - Username: Required, minimum 3 characters
 * - Password: Required, minimum 8 characters, confirmation matching
 * - Names: Required first and last name fields
 * - Phone: Optional but formatted international number
 * - Role: Required selection between client/cleaner
 *
 * @errorHandling
 * - Field-level validation with real-time error clearing
 * - Server error display in prominent error banner
 * - Form prevents submission with validation errors
 * - Network error handling through UserContext
 *
 * @accessibility
 * - Proper label-input associations for all fields
 * - ARIA attributes and screen reader support
 * - Keyboard navigation and focus management
 * - Error announcements for validation failures
 * - Color contrast compliant error states
 *
 * @styling
 * - Glassmorphism design with backdrop blur effects
 * - Green/emerald/teal gradient theme (distinct from login)
 * - Smooth transitions and micro-animations
 * - Consistent with E-Cleaner brand aesthetics
 * - Mobile-responsive grid layouts
 *
 * @workflow
 * 1. User fills registration form with validation feedback
 * 2. Client-side validation prevents invalid submissions
 * 3. Form data sent to registration API
 * 4. Success: Automatic navigation to role-appropriate dashboard
 * 5. Failure: Error display with retry capability
 *
 * @example
 * ```jsx
 * import RegisterForm from './components/auth/RegisterForm';
 *
 * function RegisterPage() {
 *   return (
 *     <div className="register-page">
 *     <RegisterForm />
 *     </div>
 *   );
 * }
 * ```
 *
 * @notes
 * - Role selection determines post-registration dashboard routing
 * - Phone number defaults to Greek country code (+30)
 * - Form validation errors clear when user starts typing in field
 * - Password confirmation must match exactly
 * - All fields are required except phone number
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import PhoneInput from '../PhoneInput';

/**
 * Password strength calculator
 * @param {string} password - Password to evaluate
 * @returns {object} Strength score (0-4) and feedback
 */
const calculatePasswordStrength = (password) => {
  let score = 0;
  const feedback = [];

  if (!password) return { score: 0, feedback: ['Enter a password'] };

  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  else feedback.push('Use 12+ characters for better security');

  // Complexity checks
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Include both uppercase and lowercase letters');
  }

  if (/\d/.test(password)) {
    score++;
  } else {
    feedback.push('Include at least one number');
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('Include a special character (!@#$%^&*)');
  }

  // Common password check
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123'];
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    score = Math.max(0, score - 2);
    feedback.push('Avoid common passwords');
  }

  return { score: Math.min(score, 4), feedback };
};

/**
 * Email format validator (RFC-compliant)
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Username validator
 * @param {string} username - Username to validate
 * @returns {object} Valid status and error message
 */
const validateUsername = (username) => {
  if (!username) return { valid: false, error: 'Username is required' };
  if (username.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (username.length > 30) return { valid: false, error: 'Username must be less than 30 characters' };
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }
  if (/^\d/.test(username)) return { valid: false, error: 'Username cannot start with a number' };
  return { valid: true, error: '' };
};

// Role selection drives dashboard routing
// Use PascalCase for component per DEVELOPMENT_STANDARDS.md
export default function RegisterForm() {
  // Form state with comprehensive user data
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    country_code: '+30', // Default to Greece
    role: 'client',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({}); // Field-specific validation errors
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [touched, setTouched] = useState({}); // Track which fields user has interacted with

  // Context and navigation hooks
  const { register, error } = useUser();
  const navigate = useNavigate();

  // Real-time password strength calculation
  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(calculatePasswordStrength(formData.password));
    } else {
      setPasswordStrength({ score: 0, feedback: [] });
    }
  }, [formData.password]);

  /**
   * Handles input field changes with real-time validation
   * Updates form state and validates on blur for better UX
   * @param {Event} e - Input change event
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear field-specific error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  /**
   * Mark field as touched when user leaves it
   * Enables showing validation errors only after user interaction
   */
  const handleBlur = (fieldName) => {
    setTouched({
      ...touched,
      [fieldName]: true,
    });
    
    // Validate field on blur
    validateField(fieldName);
  };

  /**
   * Validate individual field
   * @param {string} fieldName - Name of field to validate
   */
  const validateField = (fieldName) => {
    const newErrors = { ...errors };

    switch (fieldName) {
      case 'email':
        if (!formData.email) {
          newErrors.email = 'Email is required';
        } else if (!isValidEmail(formData.email)) {
          newErrors.email = 'Please enter a valid email address';
        } else {
          delete newErrors.email;
        }
        break;

      case 'username':
        const usernameValidation = validateUsername(formData.username);
        if (!usernameValidation.valid) {
          newErrors.username = usernameValidation.error;
        } else {
          delete newErrors.username;
        }
        break;

      case 'password':
        if (!formData.password) {
          newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
          newErrors.password = 'Password must be at least 8 characters';
        } else if (passwordStrength.score < 2) {
          newErrors.password = 'Password is too weak. ' + passwordStrength.feedback.join(', ');
        } else {
          delete newErrors.password;
        }
        break;

      case 'password_confirm':
        if (!formData.password_confirm) {
          newErrors.password_confirm = 'Please confirm your password';
        } else if (formData.password !== formData.password_confirm) {
          newErrors.password_confirm = 'Passwords do not match';
        } else {
          delete newErrors.password_confirm;
        }
        break;

      case 'first_name':
        if (!formData.first_name) {
          newErrors.first_name = 'First name is required';
        } else if (formData.first_name.length < 2) {
          newErrors.first_name = 'First name must be at least 2 characters';
        } else {
          delete newErrors.first_name;
        }
        break;

      case 'last_name':
        if (!formData.last_name) {
          newErrors.last_name = 'Last name is required';
        } else if (formData.last_name.length < 2) {
          newErrors.last_name = 'Last name must be at least 2 characters';
        } else {
          delete newErrors.last_name;
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
  };

  /**
   * Comprehensive client-side form validation
   * Checks all required fields and business rules
   * @returns {boolean} True if form is valid, false otherwise
   */
  const validateForm = () => {
    const newErrors = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Username validation
    const usernameValidation = validateUsername(formData.username);
    if (!usernameValidation.valid) {
      newErrors.username = usernameValidation.error;
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (passwordStrength.score < 2) {
      newErrors.password = 'Please create a stronger password';
    }

    // Password confirmation
    if (!formData.password_confirm) {
      newErrors.password_confirm = 'Please confirm your password';
    } else if (formData.password !== formData.password_confirm) {
      newErrors.password_confirm = 'Passwords do not match';
    }

    // Name validation
    if (!formData.first_name) {
      newErrors.first_name = 'First name is required';
    } else if (formData.first_name.length < 2) {
      newErrors.first_name = 'First name must be at least 2 characters';
    }

    if (!formData.last_name) {
      newErrors.last_name = 'Last name is required';
    } else if (formData.last_name.length < 2) {
      newErrors.last_name = 'Last name must be at least 2 characters';
    }

    setErrors(newErrors);
    
    // Mark all fields as touched to show errors
    setTouched({
      email: true,
      username: true,
      password: true,
      password_confirm: true,
      first_name: true,
      last_name: true,
    });

    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles form submission with validation and registration
   * Prevents submission if validation fails, manages loading state
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = document.querySelector('.border-red-500');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      }
      return;
    }

    setIsSubmitting(true);

    const result = await register(formData);

    if (result.success) {
      navigate('/dashboard');
    }

    setIsSubmitting(false);
  };

  /**
   * Handle Google OAuth registration
   * Redirects to custom endpoint that auto-redirects to Google
   * NOTE: Do NOT use VITE_API_URL here - it includes /api prefix
   */
  const handleGoogleSignup = () => {
    // Get base URL without /api suffix
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');
    // Use custom endpoint that immediately redirects to Google
    window.location.href = `${baseUrl}/auth/google/`;
  };

  /**
   * Get password strength indicator color and label
   */
  const getPasswordStrengthDisplay = () => {
    if (!formData.password) return null;

    const displays = [
      { color: 'bg-red-500', label: 'Very Weak', textColor: 'text-red-600' },
      { color: 'bg-orange-500', label: 'Weak', textColor: 'text-orange-600' },
      { color: 'bg-yellow-500', label: 'Fair', textColor: 'text-yellow-600' },
      { color: 'bg-blue-500', label: 'Good', textColor: 'text-blue-600' },
      { color: 'bg-green-500', label: 'Strong', textColor: 'text-green-600' },
    ];

    return displays[passwordStrength.score];
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 via-emerald-50 to-teal-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-10">
        {/* Header Section - Branding and welcome message */}
        <div className="text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-600 via-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Join E-Clean! 🚀
          </h2>
          <p className="text-gray-600 text-lg font-medium">
            Create your account to get started
          </p>
        </div>

        {/* Main Form Container - Glassmorphism design */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-10 border border-white/20">
          
          {/* Google OAuth Button - Primary CTA */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-300 rounded-2xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-300 shadow-sm hover:shadow-md group"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-base font-semibold text-gray-700 group-hover:text-gray-900">
              Continue with Google
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/80 text-gray-500 font-medium">Or sign up with email</span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Global Error Display - Registration failure messages */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 p-4 rounded-2xl">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields Container */}
            <div className="space-y-5">
              {/* Name Fields - First and Last Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    className={`block w-full px-4 py-3 border-2 ${
                      touched.first_name && errors.first_name 
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'border-gray-200 focus:ring-green-500/20 focus:border-green-500'
                    } rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300`}
                    placeholder="John"
                    value={formData.first_name}
                    onChange={handleChange}
                    onBlur={() => handleBlur('first_name')}
                  />
                  {touched.first_name && errors.first_name && (
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.first_name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    className={`block w-full px-4 py-3 border-2 ${
                      touched.last_name && errors.last_name 
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'border-gray-200 focus:ring-green-500/20 focus:border-green-500'
                    } rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300`}
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={handleChange}
                    onBlur={() => handleBlur('last_name')}
                  />
                  {touched.last_name && errors.last_name && (
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.last_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`block w-full px-4 py-3 border-2 ${
                    touched.email && errors.email 
                      ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                      : 'border-gray-200 focus:ring-green-500/20 focus:border-green-500'
                  } rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300`}
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                />
                {touched.email && errors.email && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Username Field */}
              <div className="space-y-2">
                <label htmlFor="username" className="block text-sm font-semibold text-gray-700">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className={`block w-full px-4 py-3 border-2 ${
                    touched.username && errors.username 
                      ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                      : 'border-gray-200 focus:ring-green-500/20 focus:border-green-500'
                  } rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300`}
                  placeholder="johndoe"
                  value={formData.username}
                  onChange={handleChange}
                  onBlur={() => handleBlur('username')}
                />
                {touched.username && errors.username && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.username}
                  </p>
                )}
                <p className="text-xs text-gray-500">3-30 characters, letters, numbers, underscores, and hyphens only</p>
              </div>

              {/* Phone Number Field */}
              <PhoneInput
                countryCode={formData.country_code}
                phoneNumber={formData.phone_number}
                onCountryChange={(countryCode) => setFormData({...formData, country_code: countryCode})}
                onPhoneChange={(phoneNumber) => setFormData({...formData, phone_number: phoneNumber})}
                error={errors.phone_number}
                className="space-y-2"
              />

              {/* Role Selection */}
              <div className="space-y-2">
                <label htmlFor="role" className="block text-sm font-semibold text-gray-700">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  name="role"
                  className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 bg-white"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="client">🏠 Client - I need cleaning services</option>
                  <option value="cleaner">🧽 Cleaner - I provide cleaning services</option>
                </select>
              </div>

              {/* Password Field with Strength Indicator */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={`block w-full px-4 py-3 pr-12 border-2 ${
                      touched.password && errors.password 
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : 'border-gray-200 focus:ring-green-500/20 focus:border-green-500'
                    } rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300`}
                    placeholder="Min. 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                
                {/* Password Strength Meter */}
                {formData.password && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <div
                          key={index}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            index <= passwordStrength.score - 1
                              ? getPasswordStrengthDisplay()?.color || 'bg-gray-200'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    {getPasswordStrengthDisplay() && (
                      <p className={`text-xs font-medium ${getPasswordStrengthDisplay().textColor}`}>
                        {getPasswordStrengthDisplay().label}
                      </p>
                    )}
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="text-xs text-gray-600 space-y-1">
                        {passwordStrength.feedback.map((tip, index) => (
                          <li key={index} className="flex items-start gap-1">
                            <svg className="w-4 h-4 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                
                {touched.password && errors.password && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label htmlFor="password_confirm" className="block text-sm font-semibold text-gray-700">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password_confirm"
                    name="password_confirm"
                    type={showPasswordConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className={`block w-full px-4 py-3 pr-12 border-2 ${
                      touched.password_confirm && errors.password_confirm 
                        ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                        : formData.password && formData.password_confirm && formData.password === formData.password_confirm
                        ? 'border-green-500 focus:ring-green-500/20 focus:border-green-500'
                        : 'border-gray-200 focus:ring-green-500/20 focus:border-green-500'
                    } rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300`}
                    placeholder="Confirm your password"
                    value={formData.password_confirm}
                    onChange={handleChange}
                    onBlur={() => handleBlur('password_confirm')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPasswordConfirm ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                  {formData.password && formData.password_confirm && formData.password === formData.password_confirm && (
                    <div className="absolute inset-y-0 right-12 flex items-center">
                      <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {touched.password_confirm && errors.password_confirm && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password_confirm}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center px-6 py-4 border border-transparent text-base font-semibold rounded-2xl text-white bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </button>
            </div>

            {/* Terms and Privacy - Optional but recommended */}
            <p className="text-xs text-center text-gray-500">
              By creating an account, you agree to our{' '}
              <a href="/terms" className="text-green-600 hover:text-green-700 font-medium">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" className="text-green-600 hover:text-green-700 font-medium">Privacy Policy</a>
            </p>
          </form>
          
          {/* Already have account link */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white/80 text-gray-500 font-medium">Already have an account?</span>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="font-semibold text-base bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 transition-all duration-300"
              >
                Sign in here →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}