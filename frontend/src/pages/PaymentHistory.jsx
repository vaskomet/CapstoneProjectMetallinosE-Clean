/**
 * PaymentHistory Page
 * 
 * Displays a comprehensive list of all payments for the current user.
 * Clients see payments they've made, cleaners see payments they've received.
 * 
 * Features:
 * - Filterable payment list by status
 * - Payment status badges with color coding
 * - Expandable payment details
 * - Transaction history
 * - Refund request functionality
 * - Responsive design
 * 
 * @page
 */

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { paymentsAPI } from '../../services/api.js';
import { PAYMENT_STATUS_CONFIG } from '../../constants/stripe.js';

const PaymentHistory = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  // Load payments on mount
  useEffect(() => {
    loadPayments();
  }, [statusFilter]);

  /**
   * Load payments from API
   */
  const loadPayments = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const data = await paymentsAPI.getPayments(params);
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
      toast.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get status badge configuration
   */
  const getStatusBadge = (status) => {
    const config = PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pending;
    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor}`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  /**
   * Toggle payment details view
   */
  const togglePaymentDetails = (paymentId) => {
    setSelectedPayment(selectedPayment === paymentId ? null : paymentId);
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment History</h1>
        <p className="text-gray-600">View and manage your payment transactions</p>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Payments
        </button>
        {Object.entries(PAYMENT_STATUS_CONFIG).map(([status, config]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === status
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {config.icon} {config.label}
          </button>
        ))}
      </div>

      {/* Payment List */}
      {payments.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">💳</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Payments Found</h3>
          <p className="text-gray-600">
            {statusFilter === 'all'
              ? "You haven't made or received any payments yet."
              : `No payments with status: ${PAYMENT_STATUS_CONFIG[statusFilter]?.label}`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              {/* Payment Card Header */}
              <div
                className="p-6 cursor-pointer"
                onClick={() => togglePaymentDetails(payment.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {payment.job_title || `Job #${payment.job}`}
                      </h3>
                      {getStatusBadge(payment.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Client:</span> {payment.client_name}
                      </div>
                      <div>
                        <span className="font-medium">Cleaner:</span> {payment.cleaner_name}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span> {formatDate(payment.created_at)}
                      </div>
                      {payment.payment_method_details && (
                        <div>
                          <span className="font-medium">Payment:</span>{' '}
                          {payment.payment_method_details.brand?.toUpperCase()} ••••{' '}
                          {payment.payment_method_details.last4}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-6">
                    <div className="text-2xl font-bold text-gray-900">
                      ${parseFloat(payment.amount).toFixed(2)}
                    </div>
                    {payment.platform_fee && (
                      <div className="text-xs text-gray-500">
                        Platform Fee: ${parseFloat(payment.platform_fee).toFixed(2)}
                      </div>
                    )}
                    {payment.cleaner_payout && (
                      <div className="text-xs text-emerald-600 font-medium">
                        Payout: ${parseFloat(payment.cleaner_payout).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expand Indicator */}
                <div className="mt-4 text-center text-sm text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    {selectedPayment === payment.id ? '▲ Hide Details' : '▼ Show Details'}
                  </span>
                </div>
              </div>

              {/* Payment Details (Expandable) */}
              {selectedPayment === payment.id && (
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Payment Details
                        </h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Payment ID:</dt>
                            <dd className="font-mono text-gray-900">#{payment.id}</dd>
                          </div>
                          {payment.stripe_payment_intent_id && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Stripe ID:</dt>
                              <dd className="font-mono text-xs text-gray-900">
                                {payment.stripe_payment_intent_id.substring(0, 20)}...
                              </dd>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Created:</dt>
                            <dd className="text-gray-900">{formatDate(payment.created_at)}</dd>
                          </div>
                          {payment.paid_at && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Paid:</dt>
                              <dd className="text-gray-900">{formatDate(payment.paid_at)}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {payment.refunded_amount > 0 && (
                        <div className="bg-purple-50 border border-purple-200 rounded p-3">
                          <h5 className="text-sm font-semibold text-purple-800 mb-1">
                            Refund Information
                          </h5>
                          <p className="text-sm text-purple-700">
                            Refunded Amount: ${parseFloat(payment.refunded_amount).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">
                          Amount Breakdown
                        </h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-600">Subtotal:</dt>
                            <dd className="text-gray-900">
                              ${parseFloat(payment.amount).toFixed(2)}
                            </dd>
                          </div>
                          {payment.platform_fee && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600">Platform Fee:</dt>
                              <dd className="text-red-600">
                                -${parseFloat(payment.platform_fee).toFixed(2)}
                              </dd>
                            </div>
                          )}
                          {payment.cleaner_payout && (
                            <div className="flex justify-between pt-2 border-t border-gray-200">
                              <dt className="font-semibold text-gray-700">Cleaner Payout:</dt>
                              <dd className="font-semibold text-emerald-600">
                                ${parseFloat(payment.cleaner_payout).toFixed(2)}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* Actions */}
                      {payment.status === 'succeeded' && payment.can_be_refunded && (
                        <button
                          onClick={() => {
                            // TODO: Implement refund modal
                            toast.info('Refund functionality coming soon');
                          }}
                          className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Request Refund
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PaymentHistory;
