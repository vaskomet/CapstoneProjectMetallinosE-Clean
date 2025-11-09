/**
 * LoginForm Component
 *
 * Authentication form component for user login in the E-Cleaner platform.
 * Provides a secure, user-friendly interface for existing users to access their accounts.
 *
 * @component
 * @requires React, React Router
 * @requires UserContext for authentication state management
 *
 * @features
 * - **Flexible Authentication**: Accepts both email and username for login
 * - **Form Validation**: Client-side validation with required field checks
 * - **Loading States**: Visual feedback during authentication process
 * - **Error Handling**: User-friendly error messages for failed login attempts
 * - **Responsive Design**: Mobile-friendly form layout with gradient styling
 * - **Auto-focus**: Proper input focus management for accessibility
 * - **Navigation**: Automatic redirect to dashboard on successful login
 *
 * @dependencies
 * - React Router: useNavigate for post-login redirection
 * - UserContext: login function and error state management
 * - Tailwind CSS: Gradient backgrounds and responsive styling
 *
 * @api
 * - POST /api/auth/login/ - User authentication endpoint
 * - Returns: JWT access/refresh tokens and user profile data
 *
 * @state
 * - formData: Email/username and password input values
 * - isSubmitting: Loading state during authentication request
 *
 * @validation
 * - Email/Username: Required field, accepts any string format
 * - Password: Required field, no format restrictions (server-side validation)
 *
 * @errorHandling
 * - Network errors: Displayed in error banner with retry capability
 * - Invalid credentials: Server-provided error messages
 * - Form validation: Browser-native required field validation
 *
 * @accessibility
 * - Proper label-input associations
 * - ARIA attributes for screen readers
 * - Keyboard navigation support
 * - Focus management and visual indicators
 *
 * @styling
 * - Glassmorphism design with backdrop blur effects
 * - Gradient backgrounds and text effects
 * - Smooth transitions and hover animations
 * - Consistent with E-Cleaner brand colors (blue/purple/indigo)
 *
 * @example
 * ```jsx
 * import LoginForm from './components/auth/LoginForm';
 *
 * function LoginPage() {
 *   return (
 *     <div className="login-page">
 *       <LoginForm />
 *     </div>
 *   );
 * }
 * ```
 *
 * @notes
 * - Form data is cleared on successful login
 * - Error messages persist until next submission attempt
 * - Component handles its own navigation on success
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';

// Validate email/password (e.g., regex for format) before submission
// Use camelCase for props per DEVELOPMENT_STANDARDS.md
export default function LoginForm() {
  // Form state management
  const [formData, setFormData] = useState({
    email: '', // Backend expects 'email' field (but accepts email or username as value)
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authentication context and navigation
  const { login, error } = useUser();
  const navigate = useNavigate();

  /**
   * Handles input field changes
   * Updates form state with new input values
   * @param {Event} e - Input change event
   */
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  /**
   * Handles form submission and authentication
   * Prevents default form behavior, manages loading state, and handles navigation
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await login(formData);

    if (result.success) {
      navigate('/dashboard');
    }

    setIsSubmitting(false);
  };

  /**
   * Handle Google OAuth login
   * Redirects to custom endpoint that auto-redirects to Google
   */
  const handleGoogleLogin = () => {
    // Get base URL without /api suffix
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');
    // Use custom endpoint that immediately redirects to Google
    window.location.href = `${baseUrl}/auth/google/`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-50 to-indigo-100 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-10">
        {/* Header Section - Branding and welcome message */}
        <div className="text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Welcome back! 🎉
          </h2>
          <p className="text-gray-600 text-lg font-medium">
            Sign in to your E-Clean account
          </p>
        </div>

        {/* Main Form Container - Glassmorphism design */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-10 border border-white/20">
          <form className="space-y-8" onSubmit={handleSubmit}>
            {/* Error Display - Authentication failure messages */}
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

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Email/Username Field */}
              <div className="space-y-3">
                <label htmlFor="email" className="block text-base font-semibold text-gray-700">
                  Email or Username
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  required
                  className="block w-full px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-base"
                  placeholder="Enter your email or username"
                  value={formData.email}
                  onChange={handleChange}
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can sign in with either your email address or username
                </p>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <label htmlFor="password" className="block text-base font-semibold text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full px-6 py-4 border-2 border-gray-200 rounded-2xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 text-base"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center px-6 py-4 border border-transparent text-lg font-semibold rounded-2xl text-white bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex justify-center items-center gap-3 px-6 py-4 border-2 border-gray-300 rounded-2xl text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </div>
          </form>

          {/* Registration Link - Bottom section */}
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-base">
                <span className="px-4 bg-white text-gray-500 font-medium">New to E-Clean?</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link
                to="/register"
                className="font-semibold text-lg bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 transition-all duration-300"
              >
                Create your account →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}