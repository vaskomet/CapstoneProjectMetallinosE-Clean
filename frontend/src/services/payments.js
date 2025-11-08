/**
 * Payments API Module
 * 
 * Payment processing, Stripe Connect onboarding, transaction history, and refund management.
 * 
 * @module services/payments
 */

import { apiCall } from './core';
import api from './core';

/**
 * Payment API endpoints
 * 
 * Provides methods for payment processing, Stripe Connect onboarding,
 * transaction history, and refund management.
 * 
 * @namespace paymentsAPI
 */
export const paymentsAPI = {
  /**
   * Create a payment intent for a cleaning job bid
   * @async
   * @function createPaymentIntent
   * @param {number} bidId - ID of the bid to pay for
   * @param {number} amount - Payment amount
   * @returns {Promise<Object>} Payment intent with client_secret
   */
  createPaymentIntent: async (bidId, amount) => {
    return apiCall(
      async () => {
        const response = await api.post('/payments/create-intent/', { 
          bid_id: bidId,
          amount: amount
        });
        return response.data;
      },
      {
        loadingKey: 'create_payment_intent',
        showSuccess: false,
        showErrors: true,
      }
    );
  },

  /**
   * Confirm a payment after Stripe processing
   * @async
   * @function confirmPayment
   * @param {string} paymentIntentId - Stripe PaymentIntent ID
   * @returns {Promise<Object>} Updated payment details
   */
  confirmPayment: async (paymentIntentId) => {
    return apiCall(
      async () => {
        const response = await api.post('/payments/confirm/', { 
          payment_intent_id: paymentIntentId 
        });
        return response.data;
      },
      {
        loadingKey: 'confirm_payment',
        showSuccess: true,
        successMessage: 'Payment confirmed successfully!',
        showErrors: true,
      }
    );
  },

  /**
   * Get list of payments for current user
   * @async
   * @function getPayments
   * @param {Object} [params] - Filter parameters
   * @param {string} [params.status] - Filter by payment status
   * @returns {Promise<Array>} List of payments
   */
  getPayments: async (params = {}) => {
    return apiCall(
      async () => {
        const response = await api.get('/payments/', { params });
        return response.data;
      },
      {
        loadingKey: 'fetch_payments',
        showSuccess: false,
        showErrors: true,
      }
    );
  },

  /**
   * Get payment details by ID
   * @async
   * @function getPaymentDetails
   * @param {number} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  getPaymentDetails: async (paymentId) => {
    return apiCall(
      async () => {
        const response = await api.get(`/payments/${paymentId}/`);
        return response.data;
      },
      {
        loadingKey: 'fetch_payment_details',
        showSuccess: false,
        showErrors: true,
      }
    );
  },

  /**
   * Start Stripe Connect onboarding for cleaners
   * @async
   * @function startConnectOnboarding
   * @param {Object} [urls] - Redirect URLs
   * @param {string} [urls.return_url] - URL to return after onboarding
   * @param {string} [urls.refresh_url] - URL to refresh if onboarding expires
   * @returns {Promise<Object>} Onboarding URL
   */
  startConnectOnboarding: async (urls = {}) => {
    return apiCall(
      async () => {
        const response = await api.post('/payments/stripe-connect/onboarding/', urls);
        return response.data;
      },
      {
        loadingKey: 'stripe_connect_onboarding',
        showSuccess: false,
        showErrors: true,
      }
    );
  },

  /**
   * Get Stripe Connect account status
   * @async
   * @function getConnectAccountStatus
   * @returns {Promise<Object>} Connect account details
   */
  getConnectAccountStatus: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/payments/stripe-connect/account/');
        return response.data;
      },
      {
        loadingKey: 'stripe_connect_status',
        showSuccess: false,
        showErrors: true,
      }
    );
  },

  /**
   * Get transaction history
   * @async
   * @function getTransactions
   * @param {Object} [params] - Filter parameters
   * @returns {Promise<Array>} List of transactions
   */
  getTransactions: async (params = {}) => {
    return apiCall(
      async () => {
        const response = await api.get('/payments/transactions/', { params });
        return response.data;
      },
      {
        loadingKey: 'fetch_transactions',
        showSuccess: false,
        showErrors: true,
      }
    );
  },

  /**
   * Create a refund request
   * @async
   * @function createRefund
   * @param {Object} refundData - Refund details
   * @param {number} refundData.payment - Payment ID
   * @param {number} refundData.amount - Refund amount
   * @param {string} refundData.reason - Refund reason
   * @returns {Promise<Object>} Created refund
   */
  createRefund: async (refundData) => {
    return apiCall(
      async () => {
        const response = await api.post('/payments/refunds/create/', refundData);
        return response.data;
      },
      {
        loadingKey: 'create_refund',
        showSuccess: true,
        successMessage: 'Refund request created successfully!',
        showErrors: true,
      }
    );
  },

  /**
   * Get list of refunds
   * @async
   * @function getRefunds
   * @param {Object} [params] - Filter parameters
   * @returns {Promise<Array>} List of refunds
   */
  getRefunds: async (params = {}) => {
    return apiCall(
      async () => {
        const response = await api.get('/payments/refunds/', { params });
        return response.data;
      },
      {
        loadingKey: 'fetch_refunds',
        showSuccess: false,
        showErrors: true,
      }
    );
  },
};
