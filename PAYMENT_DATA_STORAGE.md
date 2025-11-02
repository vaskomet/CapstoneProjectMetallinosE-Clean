# Payment Data Storage & Logging Guide

## Overview

All payment information is stored in the PostgreSQL database with complete transaction details, Stripe IDs, and audit trails. This document explains where data is stored, how to access it, and how to log/track transactions.

---

## Database Tables

### 1. **payments_payment** (Main Payment Records)

**Location**: PostgreSQL database `ecloud_db`  
**Model**: `backend/payments/models.py` - `Payment` class

**Schema**:
```sql
CREATE TABLE payments_payment (
    id SERIAL PRIMARY KEY,
    
    -- References
    job_id INTEGER REFERENCES jobs_cleaningjob(id),
    client_id INTEGER REFERENCES auth_user(id),
    cleaner_id INTEGER REFERENCES auth_user(id),
    
    -- Amounts
    amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    cleaner_payout DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    
    -- Stripe IDs
    stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_charge_id VARCHAR(255),
    
    -- Payment Method Details
    payment_method_type VARCHAR(50),      -- 'card', 'bank_account', etc.
    payment_method_last4 VARCHAR(4),      -- Last 4 digits
    payment_method_brand VARCHAR(50),     -- 'visa', 'mastercard', etc.
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, succeeded, failed, cancelled
    
    -- Refund Information
    refund_amount DECIMAL(10, 2) DEFAULT 0,
    refund_reason TEXT,
    refunded_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    
    -- Additional
    metadata JSONB,
    description TEXT
);
```

**Fields Explained**:
- `id`: Unique payment ID (auto-incremented)
- `stripe_payment_intent_id`: Stripe PaymentIntent ID (e.g., `pi_3SMUfcQ1SldwUSm92tASE3le`)
- `stripe_charge_id`: Stripe Charge ID (e.g., `ch_3SMUfcQ1SldwUSm92tASE3le`)
- `amount`: Total amount charged to client
- `platform_fee`: 15% platform fee (e.g., $15 on $100)
- `cleaner_payout`: 85% amount paid to cleaner (e.g., $85 on $100)
- `payment_method_last4`: Last 4 digits of card (e.g., "4242")
- `payment_method_brand`: Card brand (e.g., "visa", "mastercard")
- `status`: Payment status lifecycle
- `created_at`: When payment was initiated
- `paid_at`: When payment succeeded

---

### 2. **payments_transaction** (Transaction Audit Trail)

**Location**: PostgreSQL database `ecloud_db`  
**Model**: `backend/payments/models.py` - `Transaction` class

**Schema**:
```sql
CREATE TABLE payments_transaction (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments_payment(id),
    
    transaction_type VARCHAR(20) NOT NULL, -- 'charge', 'refund', 'payout'
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,           -- 'pending', 'completed', 'failed'
    
    stripe_transaction_id VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    metadata JSONB
);
```

**Purpose**: Tracks individual transaction events:
- **charge**: Initial payment charge
- **refund**: Refund transaction
- **payout**: Payout to cleaner (future feature)

---

### 3. **payments_refund** (Refund Records)

**Location**: PostgreSQL database `ecloud_db`  
**Model**: `backend/payments/models.py` - `Refund` class

**Schema**:
```sql
CREATE TABLE payments_refund (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments_payment(id),
    
    amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    
    stripe_refund_id VARCHAR(255),
    
    requested_by_id INTEGER REFERENCES auth_user(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);
```

---

### 4. **payments_stripeaccount** (Cleaner Payout Accounts)

**Location**: PostgreSQL database `ecloud_db`  
**Model**: `backend/payments/models.py` - `StripeAccount` class

**Schema**:
```sql
CREATE TABLE payments_stripeaccount (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_user(id) UNIQUE,
    
    stripe_account_id VARCHAR(255) UNIQUE NOT NULL,
    account_type VARCHAR(20) DEFAULT 'express', -- 'express', 'standard'
    
    is_verified BOOLEAN DEFAULT FALSE,
    is_payouts_enabled BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

**Purpose**: Stores Stripe Connect account info for cleaner payouts (Phase 2 feature).

---

## How to Access Payment Data

### Method 1: Django Management Command (RECOMMENDED)

```bash
# List all recent payments
docker exec ecloud_backend_dev python manage.py list_payments

# List last 10 payments
docker exec ecloud_backend_dev python manage.py list_payments --limit 10

# Filter by status
docker exec ecloud_backend_dev python manage.py list_payments --status succeeded

# Filter by job
docker exec ecloud_backend_dev python manage.py list_payments --job 14

# Filter by client
docker exec ecloud_backend_dev python manage.py list_payments --client client1@test.com
```

**Output Example**:
```
┌─ Payment #5 ─────────────────────────────────────
│ Status: SUCCEEDED
│ Amount: $100.00 USD
│   ├─ Platform Fee (15%): $15.00
│   └─ Cleaner Payout (85%): $85.00
│
│ Client: client1@test.com (client1@test.com)
│ Cleaner: cleaner1@test.com (cleaner1@test.com)
│ Job ID: #14
│
│ Stripe Details:
│   ├─ Payment Intent: pi_3SMUfcQ1SldwUSm92tASE3le
│   ├─ Charge ID: ch_3SMUfcQ1SldwUSm92tASE3le
│   └─ Payment Method: visa •••• 4242
│
│ Timestamps:
│   ├─ Created: 2025-01-27 14:30:15
│   └─ Paid: 2025-01-27 14:30:45
└─────────────────────────────────────────────────
```

---

### Method 2: Django Shell (Advanced)

```bash
docker exec -it ecloud_backend_dev python manage.py shell
```

```python
from payments.models import Payment, Transaction
from django.contrib.auth import get_user_model

User = get_user_model()

# Get latest payment
payment = Payment.objects.select_related('job', 'client', 'cleaner').order_by('-id').first()

print(f"Payment ID: {payment.id}")
print(f"Amount: ${payment.amount}")
print(f"Platform Fee: ${payment.platform_fee}")
print(f"Cleaner Payout: ${payment.cleaner_payout}")
print(f"Status: {payment.status}")
print(f"Client: {payment.client.email}")
print(f"Cleaner: {payment.cleaner.email}")
print(f"Stripe Payment Intent: {payment.stripe_payment_intent_id}")
print(f"Card: {payment.payment_method_brand} •••• {payment.payment_method_last4}")
print(f"Created: {payment.created_at}")
print(f"Paid: {payment.paid_at}")

# Get all transactions for this payment
transactions = payment.transactions.all()
for trans in transactions:
    print(f"Transaction: {trans.transaction_type} - ${trans.amount} - {trans.status}")
```

---

### Method 3: Django Admin Panel

**URL**: http://localhost:8000/admin/payments/payment/

1. Navigate to Django admin
2. Go to **Payments** → **Payments**
3. View/filter/export payment records

**Custom Filters**:
- Status (succeeded, pending, failed)
- Date range (created_at, paid_at)
- Client
- Cleaner
- Job

---

### Method 4: Database Query (Direct SQL)

```bash
# Connect to PostgreSQL
docker exec -it ecloud_db psql -U ecloud -d ecloud_db
```

```sql
-- View recent payments
SELECT 
    p.id,
    p.amount,
    p.platform_fee,
    p.cleaner_payout,
    p.status,
    p.stripe_payment_intent_id,
    p.stripe_charge_id,
    p.payment_method_brand,
    p.payment_method_last4,
    c.email AS client_email,
    cl.email AS cleaner_email,
    j.id AS job_id,
    p.created_at,
    p.paid_at
FROM payments_payment p
JOIN auth_user c ON p.client_id = c.id
LEFT JOIN auth_user cl ON p.cleaner_id = cl.id
JOIN jobs_cleaningjob j ON p.job_id = j.id
ORDER BY p.created_at DESC
LIMIT 20;
```

```sql
-- Get payment statistics
SELECT 
    COUNT(*) AS total_payments,
    SUM(amount) AS total_revenue,
    SUM(platform_fee) AS total_fees,
    SUM(cleaner_payout) AS total_payouts,
    status
FROM payments_payment
GROUP BY status;
```

```sql
-- Get transactions for a payment
SELECT 
    t.id,
    t.transaction_type,
    t.amount,
    t.status,
    t.stripe_transaction_id,
    t.created_at,
    t.completed_at
FROM payments_transaction t
WHERE t.payment_id = 5
ORDER BY t.created_at;
```

---

### Method 5: API Endpoints (For Frontend)

**Get user's payments** (as client):
```http
GET /api/payments/?user_type=client
Authorization: Bearer <token>
```

**Get user's payments** (as cleaner):
```http
GET /api/payments/?user_type=cleaner
Authorization: Bearer <token>
```

**Get specific payment**:
```http
GET /api/payments/<payment_id>/
Authorization: Bearer <token>
```

**Response Example**:
```json
{
  "id": 5,
  "job": {
    "id": 14,
    "service_type": "Deep Cleaning",
    "property_address": "123 Main St"
  },
  "client": {
    "id": 24,
    "email": "client1@test.com",
    "username": "client1@test.com"
  },
  "cleaner": {
    "id": 26,
    "email": "cleaner1@test.com",
    "username": "cleaner1@test.com"
  },
  "amount": "100.00",
  "platform_fee": "15.00",
  "cleaner_payout": "85.00",
  "currency": "usd",
  "status": "succeeded",
  "stripe_payment_intent_id": "pi_3SMUfcQ1SldwUSm92tASE3le",
  "stripe_charge_id": "ch_3SMUfcQ1SldwUSm92tASE3le",
  "payment_method_type": "card",
  "payment_method_brand": "visa",
  "payment_method_last4": "4242",
  "created_at": "2025-01-27T14:30:15.123456Z",
  "paid_at": "2025-01-27T14:30:45.654321Z"
}
```

---

## Payment Logging

### Current Logging Setup

**File**: `backend/payments/views.py`

All payment operations are logged with detailed information:

```python
import logging

logger = logging.getLogger('payments')

# Payment intent creation
logger.info(f"Creating payment intent for job {job.id}, client {request.user.id}")
logger.info(f"Payment created: ID={payment.id}, Intent={payment_intent.id}")

# Payment confirmation
logger.info(f"Confirming payment {payment_id} for user {request.user.id}")
logger.info(f"Payment {payment_id} confirmed successfully")

# Errors
logger.error(f"Payment confirmation failed: {str(e)}")
```

### View Logs

```bash
# Backend logs
docker logs ecloud_backend_dev --tail 100 -f | grep payment

# Filter by log level
docker logs ecloud_backend_dev --tail 1000 | grep -i "payment\|stripe"

# Save to file
docker logs ecloud_backend_dev > payment_logs.txt
```

---

## Enhanced Logging (Add This)

Create a detailed payment audit log:

**File**: `backend/payments/audit.py` (NEW)

```python
import logging
from django.utils import timezone
from .models import Payment

logger = logging.getLogger('payment_audit')

def log_payment_event(payment, event_type, details=None, user=None):
    """
    Log payment events with full context.
    
    Args:
        payment: Payment instance
        event_type: 'created', 'confirmed', 'failed', 'refunded'
        details: Additional event details
        user: User who triggered the event
    """
    log_data = {
        'timestamp': timezone.now().isoformat(),
        'event_type': event_type,
        'payment_id': payment.id,
        'job_id': payment.job_id,
        'client_id': payment.client_id,
        'cleaner_id': payment.cleaner_id,
        'amount': float(payment.amount),
        'status': payment.status,
        'stripe_payment_intent_id': payment.stripe_payment_intent_id,
        'stripe_charge_id': payment.stripe_charge_id,
    }
    
    if user:
        log_data['triggered_by'] = user.id
    
    if details:
        log_data['details'] = details
    
    logger.info(f"PAYMENT_AUDIT: {log_data}")
    
    return log_data
```

**Usage in views**:
```python
from .audit import log_payment_event

# In create_payment_intent
log_payment_event(payment, 'created', user=request.user)

# In confirm_payment
log_payment_event(payment, 'confirmed', details={'card_last4': payment.payment_method_last4}, user=request.user)

# On error
log_payment_event(payment, 'failed', details={'error': str(e)}, user=request.user)
```

---

## Stripe Dashboard

All payments are also visible in the Stripe Dashboard:

**Test Mode Dashboard**: https://dashboard.stripe.com/test/payments

**What you can see**:
- All PaymentIntents
- Charges
- Customer information
- Card details
- Payment timeline
- Refunds
- Disputes

**Webhook Events**: (Phase 2)
- `payment_intent.succeeded`
- `payment_intent.failed`
- `charge.refunded`
- `charge.dispute.created`

---

## Export Payment Data

### CSV Export

```bash
docker exec ecloud_backend_dev python manage.py shell
```

```python
import csv
from payments.models import Payment

# Export to CSV
with open('/tmp/payments_export.csv', 'w', newline='') as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow([
        'Payment ID', 'Date', 'Client Email', 'Cleaner Email', 
        'Amount', 'Platform Fee', 'Cleaner Payout', 'Status', 
        'Stripe Payment Intent', 'Card Brand', 'Card Last4'
    ])
    
    payments = Payment.objects.select_related('client', 'cleaner').all()
    for p in payments:
        writer.writerow([
            p.id,
            p.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            p.client.email,
            p.cleaner.email if p.cleaner else 'N/A',
            p.amount,
            p.platform_fee,
            p.cleaner_payout,
            p.status,
            p.stripe_payment_intent_id,
            p.payment_method_brand or 'N/A',
            p.payment_method_last4 or 'N/A'
        ])

print("Export complete: /tmp/payments_export.csv")
```

Copy from container:
```bash
docker cp ecloud_backend_dev:/tmp/payments_export.csv ./payments_export.csv
```

---

## Recommended Monitoring

### 1. **Daily Payment Report**

Create a cron job or scheduled task:

```python
# management/commands/daily_payment_report.py
from django.core.management.base import BaseCommand
from payments.models import Payment
from django.utils import timezone
from datetime import timedelta

class Command(BaseCommand):
    def handle(self, *args, **options):
        yesterday = timezone.now() - timedelta(days=1)
        payments = Payment.objects.filter(created_at__gte=yesterday)
        
        total_revenue = sum(p.amount for p in payments)
        total_fees = sum(p.platform_fee for p in payments)
        
        self.stdout.write(f"Daily Report for {yesterday.date()}")
        self.stdout.write(f"Total Payments: {payments.count()}")
        self.stdout.write(f"Total Revenue: ${total_revenue}")
        self.stdout.write(f"Platform Fees: ${total_fees}")
        self.stdout.write(f"Succeeded: {payments.filter(status='succeeded').count()}")
        self.stdout.write(f"Failed: {payments.filter(status='failed').count()}")
```

---

### 2. **Failed Payment Alerts**

```python
# Add to views.py
from django.core.mail import send_mail

def send_payment_failure_alert(payment, error):
    send_mail(
        subject=f'Payment Failed: #{payment.id}',
        message=f'Payment {payment.id} for job {payment.job_id} failed.\nError: {error}',
        from_email='alerts@ecloud.com',
        recipient_list=['admin@ecloud.com'],
    )
```

---

### 3. **Real-time Dashboard** (Future Enhancement)

Create a Django admin dashboard showing:
- Total payments today
- Total revenue today
- Success/failure rate
- Average transaction value
- Top clients/cleaners by volume

---

## Quick Reference

| **What** | **Command** |
|----------|-------------|
| List recent payments | `docker exec ecloud_backend_dev python manage.py list_payments` |
| View payment in admin | http://localhost:8000/admin/payments/payment/ |
| Query in Django shell | `docker exec -it ecloud_backend_dev python manage.py shell` |
| Export to CSV | See "Export Payment Data" section above |
| View logs | `docker logs ecloud_backend_dev \| grep payment` |
| Connect to database | `docker exec -it ecloud_db psql -U ecloud -d ecloud_db` |
| Stripe dashboard | https://dashboard.stripe.com/test/payments |

---

## Summary

**All payment information is stored in 4 main places:**

1. **PostgreSQL Database** (primary source)
   - `payments_payment`: Main payment records
   - `payments_transaction`: Transaction audit trail
   - `payments_refund`: Refund records
   - `payments_stripeaccount`: Cleaner payout accounts

2. **Django Logs** (application logs)
   - `docker logs ecloud_backend_dev`
   - File: `/app/logs/` (if configured)

3. **Stripe Dashboard** (external reference)
   - https://dashboard.stripe.com/test/payments
   - Complete payment history with Stripe metadata

4. **Django Admin Panel** (web interface)
   - http://localhost:8000/admin/payments/payment/
   - User-friendly view/filter/export

**For detailed transaction logging, use the custom management command:**
```bash
docker exec ecloud_backend_dev python manage.py list_payments
```

This provides a complete audit trail of all payment activity with full details.
