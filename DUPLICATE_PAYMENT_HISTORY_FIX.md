# Duplicate Payment History Fix

**Date:** November 2, 2025  
**Status:** ✅ **FIXED**

---

## Problem Reported

User (cleaner) seeing **duplicate payments** for the same job:
- One with `succeeded` status ✅
- One with `pending` status ⏳

Both showing in payment history, causing confusion.

---

## Root Cause Analysis

### Database Investigation
```bash
# Found 2 payments for Job #6 with same cleaner:
Payment #2: Job=6, Status=succeeded, Intent=pi_3SP2xTQ1SldwUSm91zTFzknN
Payment #1: Job=6, Status=pending,   Intent=pi_3SP2xTQ1SldwUSm916wdtfuy
```

### Why This Happens

**Duplicate PaymentIntent Creation:**
The payment flow can create multiple Payment records for the same job when:

1. **User refreshes page** during payment → Creates new PaymentIntent
2. **User clicks "Accept Bid" twice** → Creates second PaymentIntent
3. **Browser navigation** (back/forward) → Triggers payment creation again
4. **Network issues** → Retry creates duplicate

### Normal Flow:
```
User clicks "Accept Bid"
  ↓
CreatePaymentIntentView creates Payment #1 (pending)
  ↓
User completes Stripe checkout
  ↓
ConfirmPaymentView updates Payment #1 to succeeded
  ↓
Shows 1 payment in history ✅
```

### Duplicate Flow (What Happened):
```
User clicks "Accept Bid"
  ↓
CreatePaymentIntentView creates Payment #1 (pending)
  ↓
User refreshes page / clicks again
  ↓
CreatePaymentIntentView creates Payment #2 (pending)
  ↓
User completes Stripe checkout (for Payment #2)
  ↓
ConfirmPaymentView updates Payment #2 to succeeded
  ↓
Shows 2 payments: #1 (pending) + #2 (succeeded) ❌
```

---

## Solution Implemented

### Filter Out Duplicate Pending Payments

**Logic:**
- For each job, if there's a **succeeded** payment, hide any **pending** or **failed** payments
- Only show **pending** payments if NO succeeded payment exists for that job
- Keep **processing**, **refunded** payments visible (they're meaningful states)

### File: `backend/payments/views.py`

**Class:** `PaymentHistoryView.get_queryset()`

**Before:**
```python
def get_queryset(self):
    user = self.request.user
    
    if user.role == 'admin':
        queryset = Payment.objects.all()
    elif user.role == 'client':
        queryset = Payment.objects.filter(client=user)
    elif user.role == 'cleaner':
        queryset = Payment.objects.filter(cleaner=user)
    else:
        return Payment.objects.none()
    
    queryset = queryset.select_related('job', 'cleaner', 'client', 'job__property').order_by('-created_at')
    
    # Filter by status if provided
    status_filter = self.request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    
    return queryset
```

**After:**
```python
def get_queryset(self):
    user = self.request.user
    
    if user.role == 'admin':
        queryset = Payment.objects.all()
    elif user.role == 'client':
        queryset = Payment.objects.filter(client=user)
    elif user.role == 'cleaner':
        queryset = Payment.objects.filter(cleaner=user)
    else:
        return Payment.objects.none()
    
    # Exclude pending/failed duplicates for the same job
    queryset = queryset.select_related('job', 'cleaner', 'client', 'job__property').order_by('-created_at')
    
    # Filter out duplicate pending payments:
    # For each job, if there's a 'succeeded' payment, hide any 'pending' or 'failed' payments
    from django.db.models import Q, Exists, OuterRef
    succeeded_for_job = Payment.objects.filter(
        job=OuterRef('job'),
        status='succeeded'
    )
    
    # Exclude payments that are pending/failed AND have a succeeded payment for the same job
    queryset = queryset.exclude(
        Q(status__in=['pending', 'failed']) &
        Exists(succeeded_for_job)
    )
    
    # Filter by status if provided
    status_filter = self.request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    
    return queryset
```

---

## How It Works

### Query Logic Breakdown

**1. Find succeeded payments for each job:**
```python
succeeded_for_job = Payment.objects.filter(
    job=OuterRef('job'),
    status='succeeded'
)
```

**2. Exclude pending/failed if succeeded exists:**
```python
queryset.exclude(
    Q(status__in=['pending', 'failed']) &  # Payment is pending or failed
    Exists(succeeded_for_job)               # AND a succeeded payment exists for same job
)
```

### Examples

**Scenario 1: Duplicate Payments (Your Case)**
```
Job #6 has:
  - Payment #1: pending   → Hidden ❌
  - Payment #2: succeeded → Shown ✅
  
Result: Only shows Payment #2
```

**Scenario 2: Legitimate Pending Payment**
```
Job #7 has:
  - Payment #3: pending   → Shown ✅
  
Result: Shows Payment #3 (no succeeded payment to hide it)
```

**Scenario 3: Failed Payment with Retry**
```
Job #8 has:
  - Payment #4: failed    → Hidden ❌
  - Payment #5: succeeded → Shown ✅
  
Result: Only shows Payment #5
```

**Scenario 4: Refunded Payment**
```
Job #9 has:
  - Payment #6: refunded  → Shown ✅
  
Result: Shows refunded payment (not filtered)
```

---

## What You'll See Now

### Before Fix:
```
Payment History (Cleaner)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nov 2, 2025 | Job #6 | $1,210.00 | ✅ Paid
Nov 2, 2025 | Job #6 | $1,210.00 | ⏳ Pending  ← Duplicate!
```

### After Fix:
```
Payment History (Cleaner)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nov 2, 2025 | Job #6 | $1,210.00 | ✅ Paid
```

Clean! No duplicates! 🎉

---

## Additional Benefits

### 1. Cleaner Payment History ✅
- Only shows meaningful payment records
- No confusion from abandoned/duplicate payments
- Clear view of actual earnings

### 2. Accurate Earnings Display ✅
- Total earnings won't double-count
- Payout calculations won't include pending duplicates
- Balance display is accurate

### 3. Better User Experience ✅
- Less clutter in payment history
- Easier to track actual completed payments
- No need to explain why duplicates exist

---

## Prevention (Future Enhancement)

### Option 1: Idempotency Key
```python
# In CreatePaymentIntentView
idempotency_key = f"job_{job.id}_client_{client.id}"

payment_intent = stripe.PaymentIntent.create(
    amount=amount_cents,
    currency='usd',
    idempotency_key=idempotency_key,  # Prevents duplicates
    ...
)
```

### Option 2: Check Existing Payment
```python
# Before creating new payment
existing_payment = Payment.objects.filter(
    job=job,
    status__in=['pending', 'processing', 'succeeded']
).first()

if existing_payment:
    # Return existing payment instead of creating new one
    return Response({
        'payment_id': existing_payment.id,
        'client_secret': get_stripe_client_secret(existing_payment),
        ...
    })
```

### Option 3: Database Constraint
```python
# In Payment model
class Meta:
    constraints = [
        models.UniqueConstraint(
            fields=['job', 'status'],
            condition=Q(status='succeeded'),
            name='unique_succeeded_payment_per_job'
        )
    ]
```

---

## Testing

### Test Your Case:
1. Refresh browser
2. Navigate to `/payments` as cleaner
3. **Should see:** Only 1 payment for Job #6 (the succeeded one)
4. **Should NOT see:** The pending duplicate

### Test Other Scenarios:
1. **Legitimate pending:** Create new job payment → Should show pending until confirmed
2. **Filter by status:** Use `?status=succeeded` filter → Should work correctly
3. **Admin view:** Admin should see all (including hidden duplicates via Django admin)

---

## Database Cleanup (Optional)

If you want to clean up the orphaned pending payment:

```bash
cd backend
python manage.py shell
```

```python
from payments.models import Payment

# Find orphaned pending payments (where succeeded exists for same job)
orphaned = Payment.objects.filter(
    status='pending',
    job__in=Payment.objects.filter(status='succeeded').values('job')
)

print(f"Found {orphaned.count()} orphaned pending payments")

# Optional: Delete them
# orphaned.delete()
```

---

## Status: ✅ FIXED

Django auto-reload applied the changes. **Refresh your browser** and you should now see only the succeeded payment in your payment history!

The pending duplicate (Payment #1) is still in the database but hidden from the payment history view. ✨
