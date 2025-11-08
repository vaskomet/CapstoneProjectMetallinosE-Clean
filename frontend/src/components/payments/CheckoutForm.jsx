/**
 * CheckoutForm Component
 * 
 * Provides a complete checkout experience using Stripe Elements.
 * Handles payment intent creation, card collection, and payment confirmation.
 * 
 * Features:
 * - Stripe CardElement integration with custom styling
 * - Payment intent creation for cleaning jobs
 * - Real-time validation and error handling
 * - Loading states during payment processing
 * - Success/error feedback to users
 * - Automatic navigation after successful payment
 * 
 * @component
 * @example
 * ```jsx
 * <Elements stripe={stripePromise}>
 *   <CheckoutForm jobId={123} amount={150.00} onSuccess={handleSuccess} />
 * </Elements>
 * ```
 */

import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { paymentsAPI } from '../../services/api';
import { STRIPE_ELEMENT_OPTIONS } from '../../constants/stripe';

const CheckoutForm = ({ 
  jobId, 
  bidId,
  amount, 
  jobTitle = 'Cleaning Service',
  onSuccess = null,
  onCancel = null 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();

  // Component state
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentIntentClientSecret, setPaymentIntentClientSecret] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  /**
   * Create payment intent when component mounts
   * Gets the client secret needed for Stripe payment confirmation
   */
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        console.log('🔷 Creating payment intent for bid ID:', bidId, 'amount:', amount);
        const data = await paymentsAPI.createPaymentIntent(bidId, amount);
        console.log('✅ Payment intent created:', data);
        setPaymentIntentClientSecret(data.client_secret);
      } catch (error) {
        console.error('❌ Error creating payment intent:', error);
        console.error('❌ Error response:', error.response?.data);
        toast.error(error.userMessage || 'Failed to initialize payment. Please try again.');
        setPaymentError('Failed to initialize payment. Please refresh and try again.');
      }
    };

    if (bidId && amount) {
      createPaymentIntent();
    }
  }, [bidId, amount]);

  /**
   * Handle card element changes
   * Updates validation state and error messages
   */
  const handleCardChange = (event) => {
    setCardComplete(event.complete);
    setCardError(event.error ? event.error.message : null);
  };

  /**
   * Handle form submission
   * Confirms payment with Stripe and updates backend
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate Stripe is loaded
    if (!stripe || !elements) {
      toast.error('Payment system not ready. Please wait a moment and try again.');
      return;
    }

    // Validate payment intent is created
    if (!paymentIntentClientSecret) {
      toast.error('Payment not initialized. Please refresh and try again.');
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      // Get card element
      const cardElement = elements.getElement(CardElement);

      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        paymentIntentClientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      // Handle Stripe errors
      if (stripeError) {
        console.error('Stripe error:', stripeError);
        setPaymentError(stripeError.message);
        toast.error(stripeError.message);
        setIsProcessing(false);
        return;
      }

      // Confirm payment succeeded
      if (paymentIntent.status === 'succeeded') {
        // Notify backend of successful payment
        try {
          await paymentsAPI.confirmPayment(paymentIntent.id);
          
          // Show success message
          toast.success('Payment successful! Your booking is confirmed.');

          // Call onSuccess callback if provided
          if (onSuccess) {
            onSuccess(paymentIntent);
          } else {
            // Default: navigate to job details or dashboard
            navigate('/dashboard');
          }
        } catch (confirmError) {
          console.error('Error confirming payment with backend:', confirmError);
          // Payment succeeded with Stripe, but backend confirmation failed
          // User should still see success since payment went through
          toast.warning('Payment succeeded, but there was an issue updating your booking. Please contact support if needed.');
          navigate('/dashboard');
        }
      } else {
        // Handle other payment intent statuses
        console.warn('Payment intent status:', paymentIntent.status);
        setPaymentError(`Payment status: ${paymentIntent.status}`);
        toast.error('Payment was not successful. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'An unexpected error occurred.');
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle cancel button
   */
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1); // Go back to previous page
    }
  };

  // Show error state if payment intent creation failed
  if (paymentError && !paymentIntentClientSecret) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 text-lg font-medium mb-2">
          ⚠️ Payment Initialization Failed
        </div>
        <p className="text-red-700 mb-4">{paymentError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Summary */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Summary</h3>
        <div className="flex justify-between items-center">
          <span className="text-gray-700">{jobTitle}</span>
          <span className="text-2xl font-bold text-gray-900">
            ${typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Secure payment processed by Stripe
        </p>
      </div>

      {/* Card Input */}
      <div>
        <label htmlFor="card-element" className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="p-4 border border-gray-300 rounded-lg bg-white focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
          <CardElement
            id="card-element"
            options={STRIPE_ELEMENT_OPTIONS}
            onChange={handleCardChange}
          />
        </div>
        {cardError && (
          <p className="mt-2 text-sm text-red-600">
            {cardError}
          </p>
        )}
      </div>

      {/* Payment Error */}
      {paymentError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            <span className="font-medium">Error:</span> {paymentError}
          </p>
        </div>
      )}

      {/* Test Card Info (only in development) */}
      {import.meta.env.DEV && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 font-medium mb-1">
            💳 Test Mode
          </p>
          <p className="text-xs text-blue-700">
            Use card: 4242 4242 4242 4242 | Any future expiry | Any CVC
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || !cardComplete || isProcessing || !paymentIntentClientSecret}
          className="flex-1 px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isProcessing ? (
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
              Processing...
            </>
          ) : (
            `Pay $${typeof amount === 'number' ? amount.toFixed(2) : '0.00'}`
          )}
        </button>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        <span>Secured by Stripe - Your payment information is encrypted</span>
      </div>
    </form>
  );
};

export default CheckoutForm;
