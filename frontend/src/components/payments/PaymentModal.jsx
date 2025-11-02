/**
 * PaymentModal Component
 * 
 * Modal wrapper for the checkout form that provides Stripe Elements context.
 * Can be triggered from any part of the application to initiate payment.
 * 
 * Features:
 * - Stripe Elements provider setup
 * - Modal overlay with backdrop
 * - Responsive design
 * - Loading state while Stripe initializes
 * 
 * @component
 * @example
 * ```jsx
 * <PaymentModal 
 *   isOpen={showPayment}
 *   onClose={() => setShowPayment(false)}
 *   jobId={123}
 *   amount={150.00}
 *   jobTitle="Deep Cleaning Service"
 * />
 * ```
 */

import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm';
import { STRIPE_PUBLISHABLE_KEY, STRIPE_ELEMENT_APPEARANCE } from '../../constants/stripe';

// Initialize Stripe outside component to avoid recreating on each render
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const PaymentModal = ({
  isOpen,
  onClose,
  jobId,
  bidId,
  amount,
  jobTitle = 'Cleaning Service',
  onSuccess = null,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Handle modal animation
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Delay hiding to allow fade-out animation
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black transition-opacity duration-300 ${
        isOpen ? 'bg-opacity-50' : 'bg-opacity-0'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Complete Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <Elements 
            stripe={stripePromise}
            options={{
              appearance: STRIPE_ELEMENT_APPEARANCE,
            }}
          >
            <CheckoutForm
              jobId={jobId}
              bidId={bidId}
              amount={amount}
              jobTitle={jobTitle}
              onSuccess={(paymentIntent) => {
                if (onSuccess) {
                  onSuccess(paymentIntent);
                }
                onClose();
              }}
              onCancel={onClose}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
