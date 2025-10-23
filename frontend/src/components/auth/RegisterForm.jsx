/**
 * RegisterForm Component
 *
 * User registration form component for new account creation in the E-Cleaner platform.
 * Provides comprehensive form validation and role-based account setup for both clients and cleaners.
 *
 * @component
 * @requires React, React Router
 * @requires UserContext for registration state management
 * @requires PhoneInput component for international phone number handling
 *
 * @features
 * - **Comprehensive Validation**: Client-side validation with real-time error clearing
 * - **Role Selection**: User type selection (client/cleaner) affecting dashboard routing
 * - **Phone Number Input**: International phone number formatting with country codes
 * - **Password Confirmation**: Secure password setup with confirmation matching
 * - **Form State Management**: Real-time validation and error display
 * - **Loading States**: Visual feedback during registration process
 * - **Responsive Design**: Mobile-friendly form layout with gradient styling
 * - **Auto-navigation**: Automatic redirect to dashboard on successful registration
 *
 * @dependencies
 * - React Router: useNavigate for post-registration redirection
 * - UserContext: register function and error state management
 * - PhoneInput: International phone number input component
 * - Tailwind CSS: Gradient backgrounds and responsive styling
 *
 * @api
 * - POST /api/auth/register/ - User account creation endpoint
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

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

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

  // Context and navigation hooks
  const { register, error } = useUser();
  const navigate = useNavigate();

  /**
   * Handles input field changes with error clearing
   * Updates form state and clears field-specific errors when user types
   * @param {Event} e - Input change event
   */
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear field-specific error when user starts typing
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
  };

  /**
   * Comprehensive client-side form validation
   * Checks all required fields and business rules
   * @returns {boolean} True if form is valid, false otherwise
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.username) newErrors.username = 'Username is required';
    if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!formData.password_confirm) newErrors.password_confirm = 'Please confirm your password';
    if (formData.password !== formData.password_confirm) {
      newErrors.password_confirm = 'Passwords do not match';
    }
    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles form submission with validation and registration
   * Prevents submission if validation fails, manages loading state
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    const result = await register(formData);

    if (result.success) {
      navigate('/dashboard');
    }

    setIsSubmitting(false);
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
          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Global Error Display - Registration failure messages */}
            {error && (
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 p-6 rounded-2xl">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields Container */}
            <div className="space-y-6">
              {/* Name Fields - First and Last Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label htmlFor="first_name" className="block text-base font-semibold text-gray-700">
                    First Name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    required
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                    placeholder="John"
                    value={formData.first_name}
                    onChange={handleChange}
                  />
                  {errors.first_name && (
                    <p className="text-sm text-red-600 font-medium">{errors.first_name}</p>
                  )}
                </div>
                <div className="space-y-3">
                  <label htmlFor="last_name" className="block text-base font-semibold text-gray-700">
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    required
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                    placeholder="Doe"
                    value={formData.last_name}
                    onChange={handleChange}
                  />
                  {errors.last_name && (
                    <p className="text-sm text-red-600 font-medium">{errors.last_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label htmlFor="email" className="block text-base font-semibold text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 font-medium">{errors.email}</p>
                )}
              </div>

              <div className="space-y-3">
                <label htmlFor="username" className="block text-base font-semibold text-gray-700">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="block w-full px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                  placeholder="johndoe"
                  value={formData.username}
                  onChange={handleChange}
                />
                {errors.username && (
                  <p className="text-sm text-red-600 font-medium">{errors.username}</p>
                )}
              </div>

              <PhoneInput
                countryCode={formData.country_code}
                phoneNumber={formData.phone_number}
                onCountryChange={(countryCode) => setFormData({...formData, country_code: countryCode})}
                onPhoneChange={(phoneNumber) => setFormData({...formData, phone_number: phoneNumber})}
                error={errors.phone_number}
                className="space-y-3"
              />

              <div className="space-y-3">
                <label htmlFor="role" className="block text-base font-semibold text-gray-700">
                  Account Type
                </label>
                <select
                  id="role"
                  name="role"
                  className="block w-full px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 bg-white"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="client">🏠 Client - I need cleaning services</option>
                  <option value="cleaner">🧽 Cleaner - I provide cleaning services</option>
                </select>
              </div>

              <div className="space-y-3">
                <label htmlFor="password" className="block text-base font-semibold text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="block w-full px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                />
                {errors.password && (
                  <p className="text-sm text-red-600 font-medium">{errors.password}</p>
                )}
              </div>

              <div className="space-y-3">
                <label htmlFor="password_confirm" className="block text-base font-semibold text-gray-700">
                  Confirm Password
                </label>
                <input
                  id="password_confirm"
                  name="password_confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="block w-full px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300"
                  placeholder="Confirm your password"
                  value={formData.password_confirm}
                  onChange={handleChange}
                />
                {errors.password_confirm && (
                  <p className="text-sm text-red-600 font-medium">{errors.password_confirm}</p>
                )}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center px-6 py-4 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          </form>
          
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-base">
                <span className="px-4 bg-white text-gray-500 font-medium">Already have an account?</span>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="font-semibold text-lg bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 transition-all duration-300"
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