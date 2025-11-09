# Payment System Testing Guide

## 🔒 Test Mode Configuration

### Current Status: **NOT CONFIGURED (Safe Mode)**

The payment system is currently **NOT configured with any Stripe keys**, which means:

✅ **No actual transactions possible** - System is completely safe  
✅ **No real cards can be charged** - Frontend will show Stripe errors  
✅ **No webhook processing** - All operations are simulated  
✅ **Development-only state** - Perfect for testing UI/UX flow  

### How Test Mode Works

When Stripe keys ARE configured with **test mode keys** (starting with `sk_test_` and `pk_test_`):

1. **Test Cards Only**: Only Stripe test card numbers work (e.g., 4242 4242 4242 4242)
2. **No Real Money**: All transactions are simulated in Stripe's sandbox
3. **Test Webhooks**: Webhook events are test events that can be triggered manually
4. **Separate Dashboard**: Test data is completely isolated from production

---

## 🚀 Quick Setup for Testing

### Step 1: Get Stripe Test Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Toggle to **Test mode** (top right)
3. Copy your test keys:
   - **Secret key**: `sk_test_...` (for backend)
   - **Publishable key**: `pk_test_...` (for frontend)

### Step 2: Configure Backend

Add to `.env.dev`:

```bash
# Stripe Configuration (TEST MODE)
STRIPE_SECRET_KEY=sk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Configure Frontend

Add to `frontend/.env`:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 4: Restart Services

```bash
docker-compose -f docker-compose.dev.yml restart backend frontend
```

---

## 🧪 Test Scenarios

### Scenario 1: Successful Payment Flow

**Test Card**: `4242 4242 4242 4242`

**Steps**:
1. Log in as Client (email: `client@example.com`, password from TEST_CREDENTIALS.md)
2. Navigate to "Cleaning Jobs" or "All Jobs"
3. Find a job with bids
4. Click "Accept & Pay" on a bid
5. Payment modal opens with job details
6. Enter test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - Zip: Any 5 digits (e.g., `12345`)
7. Click "Pay $XX.XX"

**Expected Results**:
- ✅ Payment processing spinner appears
- ✅ Success toast: "Payment successful! Your booking is confirmed."
- ✅ Modal closes automatically
- ✅ Job status updates to "confirmed"
- ✅ Payment status badge shows "Succeeded" (green)
- ✅ Job list refreshes with updated data
- ✅ Payment details visible in job modal (amount, card, date)

**Backend Verification**:
```bash
# Check payment record
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from payment.models import Payment
payment = Payment.objects.latest('created_at')
print(f'Status: {payment.status}')
print(f'Amount: ${payment.amount}')
print(f'Job: {payment.job.id}')
print(f'Stripe ID: {payment.stripe_payment_intent_id}')
"
```

---

### Scenario 2: Card Declined

**Test Card**: `4000 0000 0000 0002`

**Steps**:
1. Follow Scenario 1 steps 1-5
2. Enter declined card: `4000 0000 0000 0002`
3. Click "Pay $XX.XX"

**Expected Results**:
- ✅ Payment processing spinner appears
- ✅ Error toast: "Your card was declined."
- ✅ Modal stays open
- ✅ User can try again with different card
- ✅ Job status remains "pending"
- ✅ No payment record created (or status = "failed")

---

### Scenario 3: Insufficient Funds

**Test Card**: `4000 0000 0000 9995`

**Steps**:
1. Follow Scenario 1 steps 1-5
2. Enter card: `4000 0000 0000 9995`
3. Click "Pay $XX.XX"

**Expected Results**:
- ✅ Payment processing spinner appears
- ✅ Error toast: "Your card has insufficient funds."
- ✅ Modal stays open for retry
- ✅ Job status unchanged

---

### Scenario 4: 3D Secure Authentication

**Test Card**: `4000 0025 0000 3155`

**Steps**:
1. Follow Scenario 1 steps 1-5
2. Enter card: `4000 0025 0000 3155`
3. Click "Pay $XX.XX"
4. Stripe 3D Secure modal appears
5. Click "Complete authentication"

**Expected Results**:
- ✅ 3D Secure challenge appears
- ✅ After authentication: Payment succeeds
- ✅ Same success flow as Scenario 1
- ✅ Payment status shows "Succeeded"

---

### Scenario 5: Payment Validation in Workflow

**Prerequisites**: Job with unpaid or failed payment

**Steps**:
1. Log in as Cleaner assigned to job
2. Navigate to "My Jobs"
3. Try to "Start Job" without payment
4. Try to "Finish Job" without payment

**Expected Results**:
- ✅ Red warning banner appears: "Payment Required"
- ✅ Submit button disabled or shows error
- ✅ Toast error: "Payment must be completed before starting/finishing"
- ✅ Current payment status displayed
- ✅ Action blocked until payment succeeds

**After Payment Succeeds**:
- ✅ Warning banner disappears
- ✅ Start/Finish buttons become active
- ✅ Workflow proceeds normally

---

### Scenario 6: Payment Status Display

**Test**: Visual verification of payment information

**Steps**:
1. Complete Scenario 1 (successful payment)
2. Open job details modal
3. Check payment status section

**Expected UI Elements**:
- ✅ Payment Status badge (green "Succeeded")
- ✅ Amount: `$XX.XX` (formatted correctly)
- ✅ Card brand icon (e.g., "VISA")
- ✅ Last 4 digits: `•••• 4242`
- ✅ Paid date: `Oct 26, 2025, 10:30 AM` (formatted)
- ✅ All info displayed in blue bordered box

**In Workflow Modal**:
- ✅ Payment status in job details grid
- ✅ Status badge with same formatting
- ✅ Card details displayed

---

### Scenario 7: Payment Modal Cancellation

**Test**: User cancels payment process

**Steps**:
1. Click "Accept & Pay" on a bid
2. Payment modal opens
3. Click "Cancel" or close modal (X button)
4. Modal closes without payment

**Expected Results**:
- ✅ Modal closes cleanly
- ✅ No error messages
- ✅ Job status remains "pending"
- ✅ Bid remains unaccepted
- ✅ Can try again later
- ✅ No payment record created

---

### Scenario 8: Payment History View

**Test**: View all payments for a client

**Steps**:
1. Log in as Client with completed payments
2. Navigate to "Payments" page
3. View payment history list

**Expected Results**:
- ✅ All payments listed chronologically
- ✅ Each payment shows:
  - Job title/address
  - Amount with breakdown
  - Status badge
  - Card details
  - Date/time
- ✅ Pagination works (if >10 payments)
- ✅ Status filters work (All/Succeeded/Failed/etc.)
- ✅ Click payment opens details

---

### Scenario 9: Stripe Connect Onboarding

**Test**: Cleaner connects Stripe account for payouts

**Steps**:
1. Log in as Cleaner
2. Navigate to "Stripe Connect" page
3. Click "Connect with Stripe"
4. Complete onboarding flow

**Expected Results**:
- ✅ Redirects to Stripe Connect onboarding
- ✅ Test mode: Can use test bank account
- ✅ After completion: Redirects back to app
- ✅ Account status shows "Active" or "Pending"
- ✅ Can view account details
- ✅ Future job completions trigger payouts

---

### Scenario 10: Webhook Processing

**Test**: Stripe webhooks update payment status

**Prerequisites**: Configured webhook endpoint in Stripe Dashboard

**Manual Test**:
1. Complete a payment in UI
2. Go to Stripe Dashboard → Developers → Events
3. Find `payment_intent.succeeded` event
4. Click "Resend" to trigger webhook

**Expected Results**:
- ✅ Webhook received by backend
- ✅ Payment status updated in database
- ✅ Frontend reflects updated status
- ✅ Webhook logs show successful processing

**Automated Test**:
```bash
# Trigger test webhook
stripe trigger payment_intent.succeeded
```

---

## 🎴 Stripe Test Card Reference

### Success Cards

| Card Number | Scenario | Result |
|-------------|----------|--------|
| `4242 4242 4242 4242` | Basic success | ✅ Payment succeeds |
| `4000 0566 5566 5556` | Debit card | ✅ Payment succeeds (debit) |
| `5555 5555 5555 4444` | Mastercard | ✅ Payment succeeds |
| `3782 822463 10005` | American Express | ✅ Payment succeeds |

### Failure Cards

| Card Number | Scenario | Error |
|-------------|----------|-------|
| `4000 0000 0000 0002` | Card declined | ❌ Generic decline |
| `4000 0000 0000 9995` | Insufficient funds | ❌ Insufficient funds |
| `4000 0000 0000 0069` | Expired card | ❌ Card expired |
| `4000 0000 0000 0127` | Incorrect CVC | ❌ CVC check failed |
| `4000 0000 0000 0119` | Processing error | ❌ Processing error |

### Special Cards

| Card Number | Scenario |
|-------------|----------|
| `4000 0025 0000 3155` | 3D Secure authentication required |
| `4000 0000 0000 3220` | 3D Secure 2 authentication required |
| `4000 0000 0000 0341` | Attaching succeeds, charging fails |

**All test cards**:
- Expiry: Any future date
- CVC: Any 3 digits (4 for Amex)
- Zip: Any 5 digits

---

## 🔍 Backend Testing Commands

### Check Payment Records

```bash
# List all payments
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from payment.models import Payment
for p in Payment.objects.all().order_by('-created_at')[:10]:
    print(f'{p.id}: Job {p.job.id} - ${p.amount} - {p.status}')
"
```

### Check Stripe Account Status

```bash
# Check cleaner Stripe accounts
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from payment.models import StripeAccount
for acc in StripeAccount.objects.all():
    print(f'{acc.user.email}: {acc.status} - {acc.stripe_account_id}')
"
```

### Test Payment Creation API

```bash
# Create payment via API
curl -X POST http://localhost:8000/api/payments/create-payment-intent/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "job_id": 1,
    "amount": 150.00
  }'
```

### Test Webhook Endpoint

```bash
# Test webhook locally (requires ngrok or similar)
stripe trigger payment_intent.succeeded
```

---

## 📊 Test Checklist

### Pre-Testing Setup
- [ ] Stripe test keys configured in `.env.dev`
- [ ] Frontend Stripe key configured in `frontend/.env`
- [ ] Services restarted after configuration
- [ ] Test user accounts available (client, cleaner, admin)
- [ ] Test jobs and bids created

### Payment Flow Tests
- [ ] Successful payment with basic card (4242...)
- [ ] Card declined handling (0002)
- [ ] Insufficient funds handling (9995)
- [ ] 3D Secure authentication (3155)
- [ ] Payment modal cancellation
- [ ] Multiple payment attempts
- [ ] Different card brands (Visa, Mastercard, Amex)

### UI/UX Tests
- [ ] Payment status badge displays correctly
- [ ] Amount formatting is correct
- [ ] Card details shown properly
- [ ] Paid date formatting is readable
- [ ] Loading states during payment
- [ ] Error messages are clear
- [ ] Success messages appear
- [ ] Modal opens/closes smoothly

### Validation Tests
- [ ] Cannot start job without payment
- [ ] Cannot finish job without payment
- [ ] Warning banner shows for unpaid jobs
- [ ] Validation works in workflow modal
- [ ] Payment status prevents invalid actions

### Integration Tests
- [ ] Job status updates after payment
- [ ] Bid acceptance triggers payment flow
- [ ] Payment info serialized in API responses
- [ ] Webhook processing updates database
- [ ] Frontend refreshes after payment success

### Stripe Connect Tests
- [ ] Cleaner onboarding flow works
- [ ] Account status displays correctly
- [ ] Payout calculation is accurate (85%)
- [ ] Bank account linking works
- [ ] Account dashboard accessible

### Edge Cases
- [ ] Concurrent bid acceptances
- [ ] Network failure during payment
- [ ] Webhook arrival before API response
- [ ] Browser refresh during payment
- [ ] Multiple tabs handling
- [ ] Back button during payment flow

---

## 🐛 Common Issues & Solutions

### Issue 1: "Stripe publishable key not found"

**Cause**: Frontend Stripe key not configured

**Solution**:
```bash
# Add to frontend/.env
echo "VITE_STRIPE_PUBLISHABLE_KEY=pk_test_..." >> frontend/.env
# Restart frontend
docker-compose -f docker-compose.dev.yml restart frontend
```

### Issue 2: "Payment intent creation failed"

**Cause**: Backend Stripe key not configured or invalid

**Solution**:
```bash
# Check backend logs
docker-compose -f docker-compose.dev.yml logs backend | grep -i stripe
# Verify key in .env.dev
# Restart backend
docker-compose -f docker-compose.dev.yml restart backend
```

### Issue 3: Payment succeeds but status doesn't update

**Cause**: Webhook not configured or not firing

**Solution**:
- Check webhook logs in backend
- Verify STRIPE_WEBHOOK_SECRET is set
- Test webhook manually in Stripe Dashboard
- For local testing, use Stripe CLI: `stripe listen --forward-to localhost:8000/api/webhooks/stripe/`

### Issue 4: Payment modal doesn't open

**Cause**: JavaScript error or import issue

**Solution**:
```bash
# Check frontend console logs
# Verify PaymentModal import in CleaningJobsPool.jsx
# Check if Elements provider wraps App
# Restart frontend with clear cache
docker-compose -f docker-compose.dev.yml restart frontend
```

### Issue 5: "Job not found for this bid"

**Cause**: Bid data structure mismatch

**Solution**:
- Verify bid.job contains job ID
- Check API response structure
- Ensure handleAcceptBid receives bid object

---

## 🚀 Production Readiness Checklist

### Before Going Live (NOT YET):
- [ ] Replace test keys with live keys (sk_live_, pk_live_)
- [ ] Configure production webhook endpoint
- [ ] Test with real cards in Stripe Dashboard
- [ ] Set up proper error logging (Sentry)
- [ ] Configure email notifications for payment failures
- [ ] Add payment receipt generation
- [ ] Implement refund processing UI
- [ ] Set up monitoring/alerts for payment failures
- [ ] Review platform fee percentage
- [ ] Complete PCI compliance requirements
- [ ] Add terms of service acceptance
- [ ] Implement dispute handling
- [ ] Test all edge cases with real data
- [ ] Security audit of payment flow

---

## 📈 Testing Metrics to Track

### Success Metrics
- Payment success rate: Target **>95%**
- Average payment time: Target **<5 seconds**
- Webhook delivery rate: Target **100%**
- UI error rate: Target **<1%**

### Performance Metrics
- Payment modal load time: **<1 second**
- Stripe Elements initialization: **<2 seconds**
- API response time: **<500ms**
- Webhook processing time: **<1 second**

### User Experience Metrics
- Steps to complete payment: **4-5 clicks**
- Error message clarity: **User can resolve without support**
- Status visibility: **Always visible in UI**
- Mobile responsiveness: **Fully functional**

---

## 📝 Test Results Template

```markdown
## Test Session: [Date]
**Tester**: [Name]
**Environment**: Development (Docker)
**Stripe Mode**: Test

### Test Results

| Scenario | Status | Notes |
|----------|--------|-------|
| Successful Payment | ✅/❌ | |
| Card Declined | ✅/❌ | |
| Insufficient Funds | ✅/❌ | |
| 3D Secure | ✅/❌ | |
| Payment Validation | ✅/❌ | |
| Status Display | ✅/❌ | |
| Modal Cancellation | ✅/❌ | |
| Payment History | ✅/❌ | |
| Stripe Connect | ✅/❌ | |
| Webhook Processing | ✅/❌ | |

### Issues Found
1. [Description] - Severity: High/Medium/Low
2. ...

### Performance Notes
- Payment completion time: X seconds
- UI responsiveness: Good/Fair/Poor
- Error handling: Clear/Confusing

### Recommendations
- [ ] Fix issue #1
- [ ] Improve X
- [ ] Add feature Y
```

---

## 🎯 Next Steps After Testing

1. **Document Results**: Fill out test results template
2. **Fix Issues**: Address any bugs found during testing
3. **Performance Optimization**: If needed based on metrics
4. **User Acceptance Testing**: Get feedback from stakeholders
5. **Production Planning**: Prepare for live keys and real transactions

---

**Current Status**: ✅ Implementation Complete - Ready for Testing  
**Test Mode**: 🔒 Safe (No Stripe keys configured)  
**Estimated Testing Time**: 30-45 minutes for comprehensive testing
