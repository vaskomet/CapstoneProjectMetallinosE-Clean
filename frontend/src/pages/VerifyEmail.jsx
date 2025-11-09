import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authAPI } from '../services/api';

/**
 * Email Verification Page
 * Automatically verifies email when landing with token
 */
export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [message, setMessage] = useState('');
  const [userRole, setUserRole] = useState(null); // client, cleaner, or admin
  const [isResending, setIsResending] = useState(false);
  const hasVerified = React.useRef(false); // Prevent double verification in StrictMode

  React.useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('No verification token provided');
        return;
      }

      // Prevent double verification (React StrictMode calls useEffect twice)
      if (hasVerified.current) {
        return;
      }
      hasVerified.current = true;

      try {
        const response = await authAPI.verifyEmail(token);
        setStatus('success');
        setMessage(response.message || 'Email verified successfully!');
        setUserRole(response.user_role); // Store user role for custom messaging
        
        // Redirect to profile after 3 seconds
        setTimeout(() => {
          navigate('/settings/profile');
        }, 3000);
      } catch (error) {
        const errorData = error.response?.data;
        
        // Check if token expired
        if (errorData?.expired) {
          setStatus('expired');
          setMessage(errorData.message || 'This verification link has expired.');
        } else {
          setStatus('error');
          setMessage(errorData?.error || 'Verification failed. The link may be invalid.');
        }
      }
    };

    verifyEmail();
  }, [token, navigate]);

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await authAPI.resendVerification();
      setStatus('success');
      setMessage('A new verification email has been sent! Please check your inbox.');
    } catch (error) {
      setMessage('Failed to resend email. Please try again or log in to resend from your profile.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {status === 'verifying' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying your email...</h2>
            <p className="text-gray-600">Please wait while we verify your email address</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            
            {/* Role-specific success messages */}
            {userRole === 'client' && (
              <p className="text-sm text-gray-500">You can now post cleaning jobs and hire professional cleaners.</p>
            )}
            {userRole === 'cleaner' && (
              <p className="text-sm text-gray-500">You can now browse jobs and submit bids to start earning!</p>
            )}
            {userRole === 'admin' && (
              <p className="text-sm text-gray-500">Your admin account is now verified.</p>
            )}
            {!userRole && (
              <p className="text-sm text-gray-500">You can now access all platform features.</p>
            )}
            
            <p className="text-sm text-gray-500 mt-2">Redirecting to your profile...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate('/settings/profile')}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
            >
              Go to Profile
            </button>
          </div>
        )}

        {status === 'expired' && (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h2>
            <p className="text-gray-600 mb-2">{message}</p>
            <p className="text-sm text-gray-500 mb-6">Verification links expire after 30 minutes for security.</p>
            <div className="space-y-3">
              <button
                onClick={handleResendEmail}
                disabled={isResending}
                className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResending ? 'Sending...' : 'Send New Verification Email'}
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
              >
                Back to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
