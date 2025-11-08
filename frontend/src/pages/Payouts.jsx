import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import api from '../services/api';

/**
 * Payouts Page - Cleaner View
 * 
 * Shows cleaner's payout dashboard with:
 * - Stripe Connect setup (if needed)
 * - Available/pending balance
 * - Payout request functionality
 * - Payout history
 * - Job earnings breakdown with platform fees
 */
const Payouts = () => {
  const { user } = useUser();
  const [balance, setBalance] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  useEffect(() => {
    if (user?.role !== 'cleaner') {
      setError('Only cleaners can access this page');
      setLoading(false);
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch balance, earnings, and payout history in parallel
      const [balanceRes, earningsRes, payoutsRes] = await Promise.all([
        api.get('/payments/payouts/balance/'),
        api.get('/payments/payouts/earnings/'),
        api.get('/payments/payouts/requests/')
      ]);

      setBalance(balanceRes.data);
      setEarnings(earningsRes.data);
      setPayoutRequests(payoutsRes.data.results || payoutsRes.data || []);
    } catch (err) {
      console.error('Error fetching payout data:', err);
      setError(err.response?.data?.detail || 'Failed to load payout information');
    } finally {
      setLoading(false);
    }
  };

  const handleStripeOnboarding = async () => {
    try {
      const response = await api.post('/payments/stripe-connect/onboarding/');
      if (response.data.onboarding_url) {
        window.location.href = response.data.onboarding_url;
      }
    } catch (err) {
      console.error('Error starting Stripe onboarding:', err);
      alert(err.response?.data?.error || 'Failed to start Stripe setup');
    }
  };

  const handleRequestPayout = async () => {
    if (!payoutAmount || parseFloat(payoutAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (parseFloat(payoutAmount) > parseFloat(balance.available_balance)) {
      alert(`Amount exceeds available balance ($${balance.available_balance})`);
      return;
    }

    try {
      setRequestingPayout(true);
      await api.post('/payments/payouts/request/', {
        amount: parseFloat(payoutAmount)
      });
      
      alert('Payout request submitted successfully! Pending admin approval.');
      setPayoutAmount('');
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error requesting payout:', err);
      alert(err.response?.data?.error || 'Failed to request payout');
    } finally {
      setRequestingPayout(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatAmount = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Approval' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Processing' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payout dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 font-semibold text-lg mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // If Stripe not set up, show onboarding prompt
  if (!balance?.stripe_onboarding_complete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payout Setup Required</h2>
            <p className="text-gray-600 mb-6">
              Connect your bank account to receive payments from completed jobs. 
              This is powered by Stripe Connect for secure and fast transfers.
            </p>
            <button
              onClick={handleStripeOnboarding}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Complete Stripe Setup
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Setup takes about 5 minutes. You'll need your bank account details.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payouts</h1>
          <p className="mt-2 text-gray-600">Manage your earnings and payouts</p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Available Balance */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Available Balance</h3>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-bold">{formatAmount(balance.available_balance)}</p>
            <p className="text-sm opacity-75 mt-1">Ready to withdraw</p>
          </div>

          {/* Pending Balance */}
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Pending Release</h3>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-bold">{formatAmount(balance.pending_balance)}</p>
            <p className="text-sm opacity-75 mt-1">Available in 24 hours</p>
          </div>

          {/* Total Earnings */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium opacity-90">Total Earnings</h3>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-bold">{formatAmount(balance.total_earnings)}</p>
            <p className="text-sm opacity-75 mt-1">Lifetime earnings</p>
          </div>
        </div>

        {/* Request Payout Card */}
        {balance.can_request_payout && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Payout</h3>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (max: {formatAmount(balance.available_balance)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={balance.available_balance}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleRequestPayout}
                disabled={requestingPayout || !payoutAmount}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {requestingPayout ? 'Processing...' : 'Request Payout'}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Payouts are subject to admin approval and typically process within 1-2 business days.
            </p>
          </div>
        )}

        {/* Payout History */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Payout History</h3>
          </div>
          <div className="overflow-x-auto">
            {payoutRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No payout requests yet
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank Account</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Processed</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payoutRequests.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payout.requested_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatAmount(payout.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payout.bank_account_last4 ? `•••• ${payout.bank_account_last4}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payout.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payout.processed_at ? formatDate(payout.processed_at) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Job Earnings Breakdown */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Job Earnings</h3>
            <p className="text-sm text-gray-500 mt-1">Platform fee: 18%</p>
          </div>
          <div className="overflow-x-auto">
            {earnings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No earnings yet
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Job Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Platform Fee</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">You Receive</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {earnings.map((earning, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(earning.paid_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {earning.job_title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {earning.client_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatAmount(earning.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                        -{formatAmount(earning.platform_fee)}
                        <div className="text-xs text-gray-400">({earning.platform_fee_percentage.toFixed(0)}%)</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                        {formatAmount(earning.cleaner_payout)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {earning.is_available_for_payout ? (
                          <span className="text-green-600">✓ Available</span>
                        ) : (
                          <span className="text-yellow-600">⏱ Pending ({earning.hours_since_paid}h)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payouts;
