import React, { useState, useRef } from 'react';
import { authAPI } from '../services/api';

/**
 * Email Verification Banner Component
 * Shows warning banner for unverified users (excludes OAuth users)
 */
export default function EmailVerificationBanner({ user, onVerificationSent }) {
  const [isResending, setIsResending] = useState(false);
  const isResendingRef = useRef(false); // Prevent double-send during state update

  // Don't show banner if:
  // - User is verified
  // - User is OAuth user (auto-verified)
  // - User is null/undefined
  if (!user || user.email_verified || user.is_oauth_user) {
    return null;
  }

  const handleResendVerification = async () => {
    // Prevent double-send (React StrictMode or rapid clicks)
    if (isResendingRef.current) {
      console.log('Resend already in progress, ignoring duplicate call');
      return;
    }
    
    isResendingRef.current = true;
    setIsResending(true);
    
    try {
      await authAPI.resendVerification();
      if (onVerificationSent) {
        onVerificationSent('Verification email sent! Check your inbox.');
      }
    } catch (error) {
      console.error('Failed to resend verification:', error);
      
      // Check for rate limit error
      if (error.response?.status === 429) {
        if (onVerificationSent) {
          onVerificationSent('Too many requests. Please wait an hour before requesting another verification email.', 'error');
        }
      } else {
        if (onVerificationSent) {
          onVerificationSent('Failed to send verification email. Please try again.', 'error');
        }
      }
    } finally {
      setIsResending(false);
      // Reset ref after a short delay to allow UI update
      setTimeout(() => {
        isResendingRef.current = false;
      }, 1000);
    }
  };

  const roleSpecificMessage = user.role === 'client' 
    ? 'You cannot post jobs until you verify your email address.'
    : 'You cannot bid on jobs until you verify your email address.';

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Email Verification Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>{roleSpecificMessage}</p>
            <p className="mt-1">Please check your inbox for a verification email from E-Clean.</p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isResending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isResending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Resend Verification Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
