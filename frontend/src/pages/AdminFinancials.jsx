import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import api from '../services/api';

/**
 * Admin Financials Page
 * 
 * Complete financial dashboard for admins showing:
 * - Platform revenue metrics
 * - Pending payout request approvals
 * - Payment and payout history
 */
const AdminFinancials = () => {
  const { user } = useUser();
  const [summary, setSummary] = useState(null);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Only admins can access this page');
      setLoading(false);
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch summary and pending payouts in parallel
      const [summaryRes, payoutsRes] = await Promise.all([
        api.get('/payments/admin/financials/summary/'),
        api.get('/payments/payouts/requests/?status=pending')
      ]);

      setSummary(summaryRes.data);
      setPendingPayouts(payoutsRes.data.results || payoutsRes.data || []);
    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError(err.response?.data?.detail || 'Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayout = async (payoutId) => {
    if (!confirm('Are you sure you want to approve this payout request?')) {
      return;
    }

    try {
      await api.post(`/payments/payouts/requests/${payoutId}/approve/`);
      alert('Payout request approved successfully!');
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error approving payout:', err);
      alert(err.response?.data?.error || 'Failed to approve payout');
    }
  };

  const handleRejectPayout = async (payoutId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await api.post(`/payments/payouts/requests/${payoutId}/reject/`, { reason });
      alert('Payout request rejected');
      fetchData(); // Refresh data
    } catch (err) {
      console.error('Error rejecting payout:', err);
      alert(err.response?.data?.error || 'Failed to reject payout');
    }
  };

  const formatAmount = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading financial dashboard...</p>
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Financial Dashboard</h1>
          <p className="mt-2 text-gray-600">Platform revenue and payout management</p>
        </div>

        {/* Summary Cards - Platform Revenue */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Platform Revenue (18% Fee)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <h3 className="text-sm font-medium opacity-90 mb-2">This Month</h3>
              <p className="text-3xl font-bold">{formatAmount(summary.platform_revenue_this_month)}</p>
              <p className="text-sm opacity-75 mt-1">Platform earnings</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <h3 className="text-sm font-medium opacity-90 mb-2">This Year</h3>
              <p className="text-3xl font-bold">{formatAmount(summary.platform_revenue_this_year)}</p>
              <p className="text-sm opacity-75 mt-1">Year-to-date</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <h3 className="text-sm font-medium opacity-90 mb-2">All Time</h3>
              <p className="text-3xl font-bold">{formatAmount(summary.platform_revenue_total)}</p>
              <p className="text-sm opacity-75 mt-1">Total revenue</p>
            </div>
          </div>
        </div>

        {/* Payment Metrics */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Payments</p>
                  <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.total_payments)}</p>
                </div>
                <div className="bg-blue-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{summary.payment_count} transactions</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.payments_this_month)}</p>
                </div>
                <div className="bg-green-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Payment volume</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Payouts</p>
                  <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.total_payouts)}</p>
                </div>
                <div className="bg-yellow-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{summary.payout_count} payouts</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Refunds</p>
                  <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.total_refunds)}</p>
                </div>
                <div className="bg-red-100 rounded-full p-3">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{summary.refund_count} refunds</p>
            </div>
          </div>
        </div>

        {/* Pending Payout Requests */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Pending Payout Requests</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {summary.pending_payout_requests} request{summary.pending_payout_requests !== 1 ? 's' : ''} • 
                  Total: {formatAmount(summary.pending_payout_amount)}
                </p>
              </div>
              {summary.pending_payout_requests > 0 && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-3 py-1 rounded-full">
                  {summary.pending_payout_requests} Pending
                </span>
              )}
            </div>
            
            {pendingPayouts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 mb-2">
                  <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No pending requests</h3>
                <p className="text-gray-500">All payout requests have been processed</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cleaner</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank Account</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingPayouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{payout.cleaner_name}</div>
                            <div className="text-sm text-gray-500">{payout.cleaner_email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatAmount(payout.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payout.bank_account_last4 ? `•••• ${payout.bank_account_last4}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(payout.requested_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleApprovePayout(payout.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectPayout(payout.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors font-medium"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Payment Breakdown */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Gross Payments</span>
                <span className="text-sm font-medium text-gray-900">{formatAmount(summary.total_payments)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Platform Fee (18%)</span>
                <span className="text-sm font-medium text-green-600">{formatAmount(summary.platform_revenue_total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Cleaner Payouts</span>
                <span className="text-sm font-medium text-gray-900">{formatAmount(summary.total_payouts)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm text-gray-600">Refunded to Clients</span>
                <span className="text-sm font-medium text-red-600">-{formatAmount(summary.total_refunds)}</span>
              </div>
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Actions</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900">Payout Requests</span>
                </div>
                <span className="text-lg font-bold text-yellow-600">{summary.pending_payout_requests}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900">Refund Requests</span>
                </div>
                <span className="text-lg font-bold text-red-600">{summary.pending_refund_requests}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancials;
