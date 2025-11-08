/**
 * Stripe Configuration Constants
 * 
 * Centralizes Stripe-related configuration for the frontend.
 * Uses Vite environment variables for configuration.
 * 
 * @module constants/stripe
 */

// Stripe Publishable Key (safe to expose in frontend)
// Default to test key for development
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 
  'pk_test_51SEPusQ1SldwUSm9xBiqeuuEQflwqRTRCQBKoy7DCx33HWb7LkOD5c5I9ZAWsgj4uzuitPow9CNyoDmgPiSaa0bS00xFrugm8q';

// Stripe appearance theme for Elements
export const STRIPE_ELEMENT_APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#10b981', // Emerald-500 (matches app theme)
    colorBackground: '#ffffff',
    colorText: '#1f2937', // Gray-800
    colorDanger: '#ef4444', // Red-500
    fontFamily: 'system-ui, sans-serif',
    spacingUnit: '4px',
    borderRadius: '6px',
  },
  rules: {
    '.Input': {
      border: '1px solid #d1d5db', // Gray-300
      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    },
    '.Input:focus': {
      border: '1px solid #10b981', // Emerald-500
      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.1)',
      outline: 'none',
    },
    '.Label': {
      fontWeight: '500',
      marginBottom: '8px',
    },
    '.Error': {
      fontSize: '14px',
      marginTop: '8px',
    },
  },
};

// Stripe Element options
export const STRIPE_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      '::placeholder': {
        color: '#9ca3af', // Gray-400
      },
    },
    invalid: {
      color: '#ef4444', // Red-500
      iconColor: '#ef4444',
    },
  },
};

// Payment status display configuration
export const PAYMENT_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    icon: '⏳',
  },
  processing: {
    label: 'Processing',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    icon: '🔄',
  },
  succeeded: {
    label: 'Succeeded',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    icon: '✅',
  },
  failed: {
    label: 'Failed',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: '❌',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🚫',
  },
  refunded: {
    label: 'Refunded',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    icon: '↩️',
  },
  partially_refunded: {
    label: 'Partially Refunded',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    icon: '↩️',
  },
};

// Stripe Connect account status configuration
export const CONNECT_ACCOUNT_STATUS_CONFIG = {
  pending: {
    label: 'Pending Onboarding',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    icon: '⏳',
    description: 'Complete your Stripe onboarding to receive payouts.',
  },
  active: {
    label: 'Active',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    icon: '✅',
    description: 'Your account is active and ready to receive payouts.',
  },
  restricted: {
    label: 'Restricted',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-800',
    icon: '⚠️',
    description: 'Your account has restrictions. Please check with Stripe support.',
  },
  disabled: {
    label: 'Disabled',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🚫',
    description: 'Your account is disabled. Contact support for assistance.',
  },
};

// Test card numbers for development
export const STRIPE_TEST_CARDS = {
  success: '4242 4242 4242 4242',
  decline: '4000 0000 0000 0002',
  insufficient_funds: '4000 0000 0000 9995',
  lost_card: '4000 0000 0000 9987',
  requires_authentication: '4000 0025 0000 3155',
};
