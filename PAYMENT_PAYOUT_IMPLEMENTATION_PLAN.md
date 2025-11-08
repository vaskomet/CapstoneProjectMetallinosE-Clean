# Payment & Payout System Implementation Plan

**Date:** November 2, 2025  
**Branch:** phase-1-payment-integration  
**Status:** 🚧 In Progress

---

## Overview

Implementing client payment history and cleaner payout management system with Stripe Connect integration.

**Platform Fee:** 18% (industry standard for cleaning marketplaces)

---

## Current Database Status

### ✅ Already Implemented

**1. Payment Model** (`payments/models.py`)
- Tracks all payment transactions
- Includes: amount, platform_fee, cleaner_payout
- Stripe integration: payment_intent_id, charge_id
- Status tracking: pending → processing → succeeded → refunded
- Payment method details (last4, brand)
- Refund tracking

**2. StripeAccount Model**
- Stripe Connect account for each cleaner
- Status: pending → active → restricted → disabled
- Onboarding tracking: details_submitted, onboarding_link
- Bank account info (last 4 digits)
- Total earnings and payouts tracking
- Capabilities: charges_enabled, payouts_enabled

**3. Transaction Model**
- Detailed audit trail
- Types: charge, payout, refund, platform_fee, adjustment
- From/to user tracking
- Stripe transfer/payout IDs
- Metadata for additional info

**4. Refund Model**
- Refund request tracking
- Reason codes and details
- Admin approval workflow
- Stripe refund ID tracking

---

## What Needs to be Built

### 1. New Model: PayoutRequest

```python
class PayoutRequest(models.Model):
    """
    Manual payout requests from cleaners.
    Cleaners can request payouts of their available balance.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
        ('failed', 'Failed'),
    ]
    
    id = models.AutoField(primary_key=True)
    cleaner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payout_requests')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Stripe details
    stripe_transfer_id = models.CharField(max_length=255, blank=True)
    stripe_payout_id = models.CharField(max_length=255, blank=True)
    
    # Admin approval
    approved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_payouts')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    
    # Timestamps
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-requested_at']
```

### 2. Backend API Endpoints

#### Client Endpoints
- `GET /api/payments/history/` - List all payments for logged-in client
  - Filter by: status, date_range
  - Include: job details, cleaner info, amount, status, receipt URL
  - Pagination: 20 per page

#### Cleaner Endpoints
- `GET /api/payouts/balance/` - Get available balance, pending balance, total earnings
  - Available: money ready to withdraw (jobs completed >24hrs ago)
  - Pending: jobs completed <24hrs ago
  - Total lifetime earnings
  
- `GET /api/payouts/history/` - List all payouts received
  - Filter by: status, date_range
  - Include: amount, date, destination bank, Stripe transfer ID
  
- `POST /api/payouts/request/` - Request a manual payout
  - Body: `{ amount: 250.00 }`
  - Validation: amount <= available_balance
  - Creates PayoutRequest with status='pending'
  
- `GET /api/payouts/earnings/` - List individual job earnings
  - Shows: job details, amount earned, platform fee (18%), net amount, status
  
- `GET /api/payouts/stripe-account/` - Get Stripe Connect account status
- `POST /api/payouts/stripe-onboarding/` - Generate Stripe onboarding link
- `GET /api/payouts/stripe-dashboard/` - Get Stripe dashboard login link

#### Admin Endpoints
- `GET /api/admin/financials/` - Financial overview dashboard
  - Total payments processed
  - Platform revenue (total fees collected)
  - Pending payout requests
  - Total payouts made
  
- `GET /api/admin/payout-requests/` - List all payout requests
  - Filter by: status, cleaner, date_range
  
- `POST /api/admin/payout-requests/<id>/approve/` - Approve payout
- `POST /api/admin/payout-requests/<id>/reject/` - Reject payout
  - Body: `{ reason: "Insufficient balance" }`

### 3. Frontend Pages

#### Payments.jsx (Client View)
```
┌─────────────────────────────────────────────┐
│ Payment History                             │
├─────────────────────────────────────────────┤
│ Filters: [All] [Completed] [Refunded]     │
│          [This Month ▼]                     │
├─────────────────────────────────────────────┤
│ Date       | Job              | Cleaner  |  │
│            |                  |          |  │
│ Nov 1,2025 | Apartment Clean  | Maria K. |  │
│            | 3BR, 2BA         |          |  │
│            | $150.00 - Paid   |[Receipt] │  │
├─────────────────────────────────────────────┤
│ Oct 28     | House Deep Clean | Nikos D. |  │
│            | 4BR, 3BA         |          |  │
│            | $225.00 - Paid   |[Receipt] │  │
├─────────────────────────────────────────────┤
│                         [Load More]         │
└─────────────────────────────────────────────┘
```

#### Payouts.jsx (Cleaner View)

**If Stripe NOT setup:**
```
┌─────────────────────────────────────────────┐
│ 🔴 Payout Setup Required                    │
│                                             │
│ Connect your bank account to receive        │
│ payments from completed jobs.               │
│                                             │
│ [Complete Stripe Setup]                     │
└─────────────────────────────────────────────┘
```

**If Stripe IS setup:**
```
┌─────────────────────────────────────────────┐
│ Balance Overview                            │
├─────────────────────────────────────────────┤
│ Available Balance:    $450.00               │
│ Pending Release:      $125.00               │
│ Total Earnings:       $2,850.00             │
│                                             │
│ [Request Payout]                            │
├─────────────────────────────────────────────┤
│ Payout History                              │
├─────────────────────────────────────────────┤
│ Nov 1, 2025  | $300.00 | •••• 1234 | Paid  │
│ Oct 15, 2025 | $450.00 | •••• 1234 | Paid  │
├─────────────────────────────────────────────┤
│ Job Earnings                                │
├─────────────────────────────────────────────┤
│ Nov 1 | Apartment Clean | $150.00           │
│       | Platform fee (18%): -$27.00         │
│       | You receive: $123.00 | ✅ Paid out  │
├─────────────────────────────────────────────┤
│ Oct 30 | House Clean | $200.00              │
│        | Platform fee (18%): -$36.00        │
│        | You receive: $164.00 | 🔄 Pending  │
└─────────────────────────────────────────────┘
```

#### AdminFinancials.jsx (Admin View)
```
┌─────────────────────────────────────────────┐
│ Financial Dashboard                         │
├─────────────────────────────────────────────┤
│ Platform Revenue                            │
│ ┌──────────┬──────────┬──────────┐          │
│ │ This Month│This Year │All Time │          │
│ ├──────────┼──────────┼──────────┤          │
│ │ $1,240.00│$12,500.00│$45,000.00│          │
│ └──────────┴──────────┴──────────┘          │
├─────────────────────────────────────────────┤
│ Pending Payout Requests (3)                 │
├─────────────────────────────────────────────┤
│ Maria K.  | $250.00 | Requested 2h ago      │
│ [Approve] [Reject]                          │
├─────────────────────────────────────────────┤
│ Nikos D.  | $450.00 | Requested 5h ago      │
│ [Approve] [Reject]                          │
└─────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Backend (Est. 2-3 hours)
1. ✅ Review existing models (DONE)
2. ⏳ Create PayoutRequest model
3. ⏳ Create serializers for all payout endpoints
4. ⏳ Create views for payment history
5. ⏳ Create views for payout balance/history
6. ⏳ Create views for payout requests
7. ⏳ Create admin financial endpoints
8. ⏳ Add URL routing
9. ⏳ Create Stripe Connect helper functions

### Phase 2: Frontend (Est. 3-4 hours)
1. ⏳ Create Payments.jsx (client view)
2. ⏳ Create Payouts.jsx (cleaner view)
3. ⏳ Create AdminFinancials.jsx (admin view)
4. ⏳ Add routes to App.jsx
5. ⏳ Update Navigation links
6. ⏳ Add API functions to api.js

### Phase 3: Testing (Est. 1-2 hours)
1. ⏳ Test client payment history
2. ⏳ Test cleaner Stripe onboarding
3. ⏳ Test payout requests
4. ⏳ Test admin approval flow
5. ⏳ Verify no existing features broken

---

## Key Features

### ✅ Security
- Role-based access control (client/cleaner/admin)
- Cleaners can only see their own payouts
- Clients can only see their own payments
- Admin approval required for payouts

### ✅ Stripe Connect
- Secure onboarding flow
- Bank account verification
- Automatic transfer to cleaner accounts
- Dashboard access for cleaners

### ✅ Transparency
- Cleaners see platform fee (18%) clearly
- Job-by-job earnings breakdown
- Full transaction history

### ✅ Manual Payouts
- Cleaners request when they want
- No minimum threshold (user requested)
- Admin approval workflow
- 24-hour hold after job completion

---

## Business Logic

### Platform Fee Calculation
```python
job_amount = 150.00
platform_fee = job_amount * 0.18  # 18%
platform_fee = 27.00
cleaner_receives = job_amount - platform_fee
cleaner_receives = 123.00
```

### Available Balance Calculation
```python
total_completed_jobs = Payment.objects.filter(
    cleaner=cleaner,
    status='succeeded',
    paid_at__lte=now() - timedelta(hours=24)  # 24hr hold
).aggregate(total=Sum('cleaner_payout'))

total_payouts_made = PayoutRequest.objects.filter(
    cleaner=cleaner,
    status__in=['completed', 'processing']
).aggregate(total=Sum('amount'))

available_balance = total_completed_jobs - total_payouts_made
```

### Pending Balance Calculation
```python
pending_jobs = Payment.objects.filter(
    cleaner=cleaner,
    status='succeeded',
    paid_at__gt=now() - timedelta(hours=24)  # Within 24hrs
).aggregate(total=Sum('cleaner_payout'))
```

---

## Next Steps

1. ⏳ Create PayoutRequest model
2. ⏳ Build backend API endpoints
3. ⏳ Create frontend pages
4. ⏳ Test end-to-end
5. ⏳ Update documentation
6. ⏳ Commit to Git

**Estimated Total Time:** 6-9 hours  
**Priority:** HIGH (core monetization feature)

---

