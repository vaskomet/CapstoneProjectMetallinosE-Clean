/**
 * StripeConnectOnboarding Component
 * 
 * Handles Stripe Connect onboarding for cleaners to receive payouts.
 * Displays account status and provides onboarding link generation.
 * 
 * Features:
 * - Display current Connect account status
 * - Generate onboarding link for new accounts
 * - Handle return from Stripe onboarding
 * - Show account capabilities (charges, payouts)
 * - Display earnings and payout information
 * 
 * @component
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { paymentsAPI } from '../../services/api';
import { CONNECT_ACCOUNT_STATUS_CONFIG } from '../../constants/stripe';

const StripeConnectOnboarding = () => {
  const [accountStatus, setAccountStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);

  // Load account status on mount
  useEffect(() => {
    loadAccountStatus();
    
    // Check if returning from Stripe onboarding
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('stripe_onboarding') === 'complete') {
      toast.success('Onboarding complete! Please wait while we verify your account.');
      // Remove query params from URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload account status after a short delay
      setTimeout(loadAccountStatus, 2000);
    }
  }, []);

  /**
   * Load Stripe Connect account status
   */
  const loadAccountStatus = async () => {
    try {
      setLoading(true);
      const data = await paymentsAPI.getConnectAccountStatus();
      setAccountStatus(data);
    } catch (error) {
      console.error('Error loading account status:', error);
      // If no account exists yet, this is expected
      if (error.response?.status !== 404) {
        toast.error('Failed to load account status');
      }
      setAccountStatus(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start Stripe Connect onboarding process
   */
  const handleStartOnboarding = async () => {
    try {
      setOnboarding(true);
      const returnUrl = `${window.location.origin}${window.location.pathname}?stripe_onboarding=complete`;
      const refreshUrl = window.location.href;

      const data = await paymentsAPI.startConnectOnboarding({
        return_url: returnUrl,
        refresh_url: refreshUrl,
      });

      // Redirect to Stripe onboarding
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No onboarding URL received');
      }
    } catch (error) {
      console.error('Error starting onboarding:', error);
      toast.error('Failed to start onboarding. Please try again.');
      setOnboarding(false);
    }
  };

  /**
   * Get status badge configuration
   */
  const getStatusBadge = (status) => {
    const config = CONNECT_ACCOUNT_STATUS_CONFIG[status] || CONNECT_ACCOUNT_STATUS_CONFIG.pending;
    return (
      <span
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor}`}
      >
        <span className="text-lg">{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // No account - show onboarding CTA
  if (!accountStatus) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-6xl mb-4">💰</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Set Up Payouts with Stripe
          </h2>
          <p className="text-gray-600 mb-6">
            To receive payments for your cleaning services, you need to connect your bank account
            through Stripe. This secure process takes just a few minutes.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">What you'll need:</h3>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Bank account information for receiving payouts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Government-issued ID (driver's license or passport)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Social Security Number or Tax ID</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">✓</span>
                <span>Business details (if applicable)</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleStartOnboarding}
            disabled={onboarding}
            className="px-8 py-4 bg-emerald-600 text-white text-lg font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center mx-auto"
          >
            {onboarding ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Redirecting to Stripe...
              </>
            ) : (
              <>Start Stripe Onboarding</>
            )}
          </button>

          <p className="text-sm text-gray-500 mt-4">
            Powered by{' '}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Stripe Connect
            </a>
            {' '}• Secure and trusted by millions
          </p>
        </div>
      </div>
    );
  }

  // Account exists - show status
  const statusConfig = CONNECT_ACCOUNT_STATUS_CONFIG[accountStatus.status] || CONNECT_ACCOUNT_STATUS_CONFIG.pending;

  return (
    <div className="space-y-6">
      {/* Account Status Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Stripe Connect Account</h2>
            <p className="text-gray-600">{statusConfig.description}</p>
          </div>
          {getStatusBadge(accountStatus.status)}
        </div>

        {/* Account Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Capabilities */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Account Capabilities</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Charges Enabled:</span>
                <span
                  className={`text-sm font-medium ${
                    accountStatus.charges_enabled ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {accountStatus.charges_enabled ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Payouts Enabled:</span>
                <span
                  className={`text-sm font-medium ${
                    accountStatus.payouts_enabled ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {accountStatus.payouts_enabled ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Ready for Payouts:</span>
                <span
                  className={`text-sm font-medium ${
                    accountStatus.can_receive_payouts ? 'text-green-600' : 'text-yellow-600'
                  }`}
                >
                  {accountStatus.can_receive_payouts ? '✓ Yes' : '⏳ Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Earnings Summary</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-600">Total Earnings:</span>
                <div className="text-2xl font-bold text-gray-900">
                  ${parseFloat(accountStatus.total_earnings || 0).toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-sm text-gray-600">Total Payouts:</span>
                <div className="text-xl font-semibold text-emerald-600">
                  ${parseFloat(accountStatus.total_payouts || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Account Info */}
        {accountStatus.bank_account_last4 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-900">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <span className="font-medium">
                {accountStatus.bank_account_bank_name || 'Bank'} ••••{' '}
                {accountStatus.bank_account_last4}
              </span>
            </div>
          </div>
        )}

        {/* Onboarding Actions */}
        {accountStatus.status === 'pending' && !accountStatus.details_submitted && (
          <div className="mt-6">
            <button
              onClick={handleStartOnboarding}
              disabled={onboarding}
              className="w-full px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {onboarding ? 'Redirecting to Stripe...' : 'Complete Onboarding'}
            </button>
          </div>
        )}

        {accountStatus.status === 'restricted' && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              Your account has restrictions. Please contact{' '}
              <a
                href="mailto:support@e-cleaner.com"
                className="font-medium underline"
              >
                support@e-cleaner.com
              </a>{' '}
              for assistance.
            </p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Need Help?</h3>
        <div className="space-y-2 text-blue-800 text-sm">
          <p>
            • Payouts are typically processed within 2-3 business days after a job is completed.
          </p>
          <p>
            • A 15% platform fee is automatically deducted from each payment before your payout.
          </p>
          <p>
            • For questions about your account, contact{' '}
            <a href="mailto:support@e-cleaner.com" className="font-medium underline">
              support@e-cleaner.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default StripeConnectOnboarding;
