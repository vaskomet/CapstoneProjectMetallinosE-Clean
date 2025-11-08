# 💰 E-Clean Payment Flow & Architecture

## 🎯 **When Payment Happens**

Payment is **required and triggered** when a **Client accepts a Cleaner's bid**.

---

## 📋 Complete Job & Payment Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JOB LIFECYCLE                               │
└─────────────────────────────────────────────────────────────────────┘

1. CLIENT POSTS JOB
   ├─ Status: "pending"
   ├─ Payment: None
   └─ Action: Job visible in CleaningJobsPool

2. CLEANERS SUBMIT BIDS
   ├─ Status: Still "pending"
   ├─ Payment: None
   └─ Action: Bids appear in job modal

3. CLIENT CLICKS "ACCEPT & PAY" 🔔 [PAYMENT EVENT]
   ├─ Status: Still "pending"
   ├─ Payment: PaymentModal opens
   ├─ Location: CleaningJobsPool.jsx → handleAcceptBid()
   └─ Frontend: Opens Stripe Checkout form

4. CLIENT ENTERS CARD & SUBMITS
   ├─ Status: Still "pending" 
   ├─ Payment: Processing via Stripe
   └─ Backend: Creates PaymentIntent, charges card

5. PAYMENT SUCCEEDS ✅
   ├─ Status: Changes to "accepted"
   ├─ Payment: payment_info.status = "succeeded"
   ├─ Database: Payment record created
   └─ Job: Now shows payment badge with card details

6. CLEANER STARTS WORK
   ├─ Status: "in_progress"
   ├─ Payment: Validated (must be "succeeded")
   ├─ Validation: JobWorkflowModal checks payment_info
   └─ Error if payment not complete: "Payment must be completed..."

7. CLEANER FINISHES WORK
   ├─ Status: "completed"
   ├─ Payment: Validated again
   └─ Backend: Triggers payout to cleaner's Stripe account

8. CLIENT CONFIRMS & REVIEWS
   ├─ Status: "confirmed"
   ├─ Payment: Funds released to cleaner
   └─ Platform fee deducted
```

---

## 🔒 **Payment Validation Rules**

### **Jobs that REQUIRE successful payment:**
1. ✅ **Starting a job** (`start` action)
2. ✅ **Finishing a job** (`finish` action)

### **Validation Location:**
- File: `frontend/src/components/JobWorkflowModal.jsx`
- Lines: 97-101

```javascript
// Validate payment status for certain actions
if ((action === 'start' || action === 'finish') && job.payment_info) {
  if (job.payment_info.status !== 'succeeded') {
    toast.error('Payment must be completed before starting or finishing the job');
    return;
  }
}
```

---

## 📍 **File Locations**

### **Frontend Payment Components:**

1. **Payment Trigger:**
   - File: `frontend/src/components/CleaningJobsPool.jsx`
   - Function: `handleAcceptBid()` (line 486)
   - Action: Opens PaymentModal when client accepts bid

2. **Payment Modal:**
   - File: `frontend/src/components/payments/PaymentModal.jsx`
   - Purpose: Wraps Stripe Elements, handles payment submission
   - Shows: Card form, job details, amount

3. **Checkout Form:**
   - File: `frontend/src/components/payments/CheckoutForm.jsx`
   - Purpose: Stripe CardElement, processes payment
   - Calls: `/api/payments/create-intent/` and `/api/payments/confirm/`

4. **Payment Validation:**
   - File: `frontend/src/components/JobWorkflowModal.jsx`
   - Lines: 97-101, 204-214, 244-260
   - Shows: Payment status badges, validation warnings

5. **Payment History Page:**
   - File: `frontend/src/pages/PaymentHistory.jsx`
   - Purpose: View all past payments, refunds, receipts
   - Route: `/payments`

---

### **Backend Payment Endpoints:**

1. **Create Payment Intent:**
   - Endpoint: `POST /api/payments/create-intent/`
   - File: `backend/payments/views.py` → `CreatePaymentIntentView`
   - Purpose: Initialize Stripe PaymentIntent for job

2. **Confirm Payment:**
   - Endpoint: `POST /api/payments/confirm/`
   - File: `backend/payments/views.py` → `ConfirmPaymentView`
   - Purpose: Verify payment succeeded, update job status

3. **Webhook Handler:**
   - Endpoint: `POST /api/payments/webhooks/stripe/`
   - File: `backend/payments/webhooks.py` → `stripe_webhook`
   - Purpose: Handle async Stripe events (payment.succeeded, etc.)

4. **Payment History:**
   - Endpoint: `GET /api/payments/history/`
   - File: `backend/payments/views.py` → `PaymentHistoryView`
   - Purpose: List user's payment transactions

5. **Cleaner Onboarding:**
   - Endpoint: `POST /api/payments/stripe-connect/onboard/`
   - File: `backend/payments/views.py` → `StripeConnectOnboardView`
   - Purpose: Create Stripe Connect account for cleaners to receive payouts

---

## 💳 **Payment States**

| Status | Description | Actions Allowed |
|--------|-------------|----------------|
| `pending` | Payment intent created | Cancel only |
| `processing` | Card being charged | Wait |
| `succeeded` | Payment complete ✅ | Start job, finish job |
| `failed` | Payment declined | Retry payment |
| `refunded` | Money returned to client | None |
| `canceled` | Payment canceled | Create new payment |

---

## 🎨 **UI Elements**

### **1. "Accept & Pay" Button**
- Location: Job modal when viewing bids
- Component: `CleaningJobsPool.jsx`
- Appears: Only for clients, only on pending bids
- Action: Opens `PaymentModal`

### **2. Payment Modal**
- Shows: Job title, amount, Stripe card form
- Component: `PaymentModal.jsx`
- Stripe: Uses `@stripe/react-stripe-js` Elements

### **3. Payment Status Badge**
- Location: Job detail view
- Shows: "Paid ✅", card brand & last 4 digits
- Colors:
  - Green: Succeeded
  - Blue: Processing
  - Red: Failed
  - Gray: Pending

### **4. Payment Warning Banner**
- Location: JobWorkflowModal when trying to start/finish
- Shows: "Payment Required" message if not succeeded
- Prevents: Starting or finishing unpaid jobs

---

## 🔄 **Payment Processing Flow**

```
┌──────────────┐
│ Client clicks│
│ "Accept&Pay" │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ handleAcceptBid()│
│ - Save job info  │
│ - Open modal     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  PaymentModal    │
│ - Show Stripe    │
│ - Load Elements  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  CheckoutForm    │
│ - CardElement    │
│ - Enter card     │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Submit Payment   │
│ - Disable button │
│ - Show loading   │
└──────┬───────────┘
       │
       ▼
┌──────────────────────┐
│ POST /create-intent/ │
│ Backend creates      │
│ PaymentIntent        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Stripe.confirmPayment│
│ - 3D Secure if needed│
│ - Charge card        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ POST /confirm/       │
│ Backend verifies     │
│ Updates job status   │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Success! ✅          │
│ - Close modal        │
│ - Show toast         │
│ - Refresh jobs       │
└──────────────────────┘
```

---

## 🧪 **How to Test Payment Flow**

### **Step-by-Step Test:**

1. **Login as Client**
2. **Navigate to "Cleaning Jobs"**
3. **Find a job with bids** (or create one and have cleaner bid)
4. **Click on a bid to view details**
5. **Click "Accept & Pay" button** 🔔 [PAYMENT EVENT STARTS HERE]
6. **PaymentModal opens with Stripe form**
7. **Enter test card:** `4242 4242 4242 4242`
8. **Expiry:** `12/25`, **CVC:** `123`, **ZIP:** `12345`
9. **Click "Pay $XX.XX" button**
10. **Payment processes** (watch console for logs)
11. **Success toast appears** ✅
12. **Modal closes automatically**
13. **Job now shows payment badge** with card details
14. **Try to start job** → Should work (payment validated)

### **Test without payment:**
1. **Create job, get bid**
2. **DON'T accept/pay**
3. **Try to start job anyway** (if you could mark it accepted manually)
4. **Should see error:** "Payment must be completed..."

---

## 📊 **Database Models**

### **Payment Model:**
- `job` → ForeignKey to CleaningJob
- `client` → ForeignKey to User
- `cleaner` → ForeignKey to User
- `amount` → Decimal (total amount)
- `platform_fee` → Decimal (calculated)
- `cleaner_payout` → Decimal (amount - fee)
- `status` → CharField (pending, succeeded, etc.)
- `stripe_payment_intent_id` → CharField
- `payment_method_details` → JSONField (card info)
- `paid_at` → DateTimeField

### **Job Model (payment fields):**
- `payment` → OneToOneField to Payment (nullable)
- Via serializer: `payment_info` → Dict with status, amount, card

---

## 🚨 **Common Issues & Solutions**

### **Issue: Modal doesn't open**
- Check: `handleAcceptBid` function called
- Check: `showPaymentModal` state updated
- Check: PaymentModal component imported

### **Issue: "Failed to resolve import api.js"**
- Problem: Vite can't find services/api.js
- Solution: Clear Vite cache, check file exists
- Workaround: Use explicit `.js` extension in imports

### **Issue: Payment succeeds but job not updated**
- Check: `/api/payments/confirm/` endpoint called
- Check: Backend logs for errors
- Check: Job refresh after payment

### **Issue: Can't start job after payment**
- Check: `payment_info.status === 'succeeded'`
- Check: JobWorkflowModal validation logic
- Check: Job serializer includes `payment_info`

---

## ✅ **Summary**

**Payment is required:** When client accepts a bid  
**Payment validates:** Before starting or finishing job  
**Payment processes:** Via Stripe with PaymentIntent  
**Payment stores:** In Payment model, linked to job  
**Payment displays:** Status badges, card details, history page  

**Key files to understand:**
1. `CleaningJobsPool.jsx` → Triggers payment
2. `PaymentModal.jsx` → Payment UI
3. `CheckoutForm.jsx` → Stripe integration
4. `JobWorkflowModal.jsx` → Payment validation
5. `backend/payments/views.py` → Payment API
6. `backend/payments/webhooks.py` → Stripe events

---

**Next Step:** Fix the Vite import issue so you can test the payment flow! 🚀
