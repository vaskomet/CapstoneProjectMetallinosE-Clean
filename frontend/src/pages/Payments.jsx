import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/**
 * Payments Page - Payment History
 * 
 * Shows user's payment history:
 * - Clients: payments they made (with cleaner info)
 * - Cleaners: payments they received (with client info)
 * - Admins: all payments
 */
const Payments = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, succeeded, refunded

  useEffect(() => {
    fetchPayments();
  }, [user, filter]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/payments/history/', { params });
      
      setPayments(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
      setError(err.response?.data?.detail || 'Failed to load payment history');
    } finally {
      setLoading(false);
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
      succeeded: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: 'Paid'
      },
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        label: 'Pending'
      },
      processing: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: 'Processing'
      },
      failed: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: 'Failed'
      },
      refunded: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        label: 'Refunded'
      }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleRequestRefund = async (paymentId) => {
    // TODO: Implement refund request flow
    alert(`Refund request for payment #${paymentId} - Coming soon!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment history...</p>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment History</h1>
          <p className="mt-2 text-gray-600">
            {user?.role === 'client' 
              ? 'View all payments you made for cleaning services'
              : user?.role === 'cleaner'
              ? 'View all payments you received for completed jobs'
              : 'View all platform payments'
            }
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Filter by status:</label>
            <div className="flex space-x-2">
              {['all', 'succeeded', 'refunded'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Payments List */}
        {payments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No payments found</h3>
            <p className="text-gray-500">
              {filter !== 'all' 
                ? `No ${filter} payments to display`
                : user?.role === 'client'
                ? 'Your payment history will appear here after you book a cleaning service'
                : user?.role === 'cleaner'
                ? 'Your received payments will appear here after you complete jobs'
                : 'No payment history available'
              }
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Job Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {user?.role === 'client' ? 'Cleaner' : 'Client'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr 
                      key={payment.id} 
                      onClick={() => navigate(`/jobs?job=${payment.job_id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      title="Click to view job details"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.paid_at || payment.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{payment.job_title}</div>
                          {payment.job_address && (
                            <div className="text-gray-500">{payment.job_address}</div>
                          )}
                          {(payment.job_bedrooms || payment.job_bathrooms) && (
                            <div className="text-gray-400 text-xs">
                              {payment.job_bedrooms && `${payment.job_bedrooms} BR`}
                              {payment.job_bedrooms && payment.job_bathrooms && ' • '}
                              {payment.job_bathrooms && `${payment.job_bathrooms} BA`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user?.role === 'client' 
                          ? (payment.cleaner_name || 'N/A')
                          : (payment.client_name || 'N/A')
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatAmount(payment.amount)}
                        </div>
                        {payment.refunded_amount > 0 && (
                          <div className="text-xs text-gray-500">
                            Refunded: {formatAmount(payment.refunded_amount)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.payment_method_brand && payment.payment_method_last4 ? (
                          <div>
                            <div>{payment.payment_method_brand}</div>
                            <div className="text-xs">•••• {payment.payment_method_last4}</div>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => navigate(`/jobs?job=${payment.job_id}`)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                            title="View job details"
                          >
                            Job Details
                          </button>
                          <button
                            onClick={() => window.open(`/api/payments/${payment.id}/receipt`, '_blank')}
                            className="text-gray-600 hover:text-gray-900 font-medium"
                            title="View receipt"
                          >
                            Receipt
                          </button>
                          {payment.can_request_refund && (
                            <button
                              onClick={() => handleRequestRefund(payment.id)}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {payments.length > 0 && (
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Showing {payments.length} payment{payments.length !== 1 ? 's' : ''}
              </span>
              <span className="text-sm font-medium text-gray-900">
                Total: {formatAmount(payments.reduce((sum, p) => sum + parseFloat(p.amount), 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Payments;
