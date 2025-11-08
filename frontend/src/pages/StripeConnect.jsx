/**
 * StripeConnect Page
 * 
 * Dedicated page for Stripe Connect onboarding and account management.
 * Accessible to cleaners for setting up payout accounts.
 * 
 * @page
 */

import React from 'react';
import { StripeConnectOnboarding } from '../components/payments';

const StripeConnect = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <StripeConnectOnboarding />
      </div>
    </div>
  );
};

export default StripeConnect;
