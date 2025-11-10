# E-Clean Model Field Reference

**Purpose**: Prevent field name errors by documenting actual model fields  
**Date**: November 10, 2025

## Core Models Field Reference

### 1. CleaningJob Model
**Location**: `backend/cleaning_jobs/models.py`

#### Key Fields:
```python
class CleaningJob(models.Model):
    id = models.AutoField(primary_key=True)
    client = models.ForeignKey(User, related_name='client_jobs')
    cleaner = models.ForeignKey(User, related_name='cleaner_jobs')
    property = models.ForeignKey(Property)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    
    # ❌ NO 'title' field - use 'services_description' instead
    services_description = models.TextField()  # ✅ Use this for job title/description
    
    client_budget = models.DecimalField(max_digits=10, decimal_places=2)
    checklist = models.JSONField(default=list)
    final_price = models.DecimalField(max_digits=10, decimal_places=2, null=True)
    accepted_bid = models.ForeignKey('JobBid', related_name='accepted_job')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

**Common Mistakes**:
- ❌ `job.title` → ✅ `job.services_description`

---

### 2. JobBid Model
**Location**: `backend/cleaning_jobs/models.py`

#### Key Fields:
```python
class JobBid(models.Model):
    id = models.AutoField(primary_key=True)
    job = models.ForeignKey('CleaningJob', related_name='bids')
    cleaner = models.ForeignKey(User, related_name='submitted_bids')
    
    # ❌ NO 'amount' field - use 'bid_amount' instead
    bid_amount = models.DecimalField(max_digits=10, decimal_places=2)  # ✅ Use this
    
    estimated_duration = models.DurationField()
    message = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=BID_STATUS_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

**Common Mistakes**:
- ❌ `bid.amount` → ✅ `bid.bid_amount`
- ❌ `job.accepted_bid.amount` → ✅ `job.accepted_bid.bid_amount`

---

### 3. Payment Model
**Location**: `backend/payments/models.py`

#### Key Fields:
```python
class Payment(models.Model):
    id = models.AutoField(primary_key=True)
    job = models.ForeignKey(CleaningJob, related_name='payments')
    client = models.ForeignKey(User, related_name='client_payments')
    cleaner = models.ForeignKey(User, related_name='cleaner_payments')
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # ✅ Correct name
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2)
    cleaner_payout = models.DecimalField(max_digits=10, decimal_places=2)
    
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True)
    stripe_charge_id = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    currency = models.CharField(max_length=3, default='usd')
    
    # Payment method info
    payment_method_type = models.CharField(max_length=50)
    payment_method_last4 = models.CharField(max_length=4)
    payment_method_brand = models.CharField(max_length=50)
    
    # Refund tracking
    refunded_amount = models.DecimalField(max_digits=10, decimal_places=2)
    refund_reason = models.TextField(blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True)
    refunded_at = models.DateTimeField(null=True)
```

---

### 4. Review Model
**Location**: `backend/reviews/models.py`

#### Key Fields:
```python
class Review(models.Model):
    id = models.AutoField(primary_key=True)
    job = models.ForeignKey(CleaningJob, related_name='reviews')
    
    # ❌ NO 'cleaner' field - use 'reviewee' and 'reviewer' instead
    reviewer = models.ForeignKey(User, related_name='reviews_given')  # Who wrote review
    reviewee = models.ForeignKey(User, related_name='reviews_received')  # Who is reviewed
    
    # ❌ NO 'rating' field - use 'overall_rating' instead
    overall_rating = models.IntegerField()  # ✅ Use this (1-5)
    
    communication_rating = models.IntegerField(null=True)
    quality_rating = models.IntegerField(null=True)
    professionalism_rating = models.IntegerField(null=True)
    review_text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

**Common Mistakes**:
- ❌ `Review.objects.filter(cleaner=user)` → ✅ `Review.objects.filter(reviewee=user)`
- ❌ `Avg('rating')` → ✅ `Avg('overall_rating')`

---

### 5. ServiceArea Model
**Location**: `backend/users/models.py`

#### Key Fields:
```python
class ServiceArea(models.Model):
    id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, related_name='service_areas')
    
    # ❌ NO 'municipality' field - use 'city' instead
    city = models.CharField(max_length=100)  # ✅ Use this
    
    state = models.CharField(max_length=2)
    postal_code = models.CharField(max_length=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

**Common Mistakes**:
- ❌ `ServiceArea.objects.values_list('municipality')` → ✅ `.values_list('city')`
- ❌ `property__municipality__in` → ✅ `property__city__in`
- Import: ❌ `from users.models import CleanerServiceArea` → ✅ `from users.models import ServiceArea`

---

### 6. User Model
**Location**: `backend/users/models.py`

#### Key Fields:
```python
class User(AbstractBaseUser, PermissionsMixin):
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    
    # Stripe integration
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_account_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Email verification
    email_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=255, blank=True, null=True)
    
    # Two-factor auth
    two_factor_enabled = models.BooleanField(default=False)
    
    # Cleaner verification
    is_verified_cleaner = models.BooleanField(default=False)
```

**Common Mistakes**:
- ❌ `user.get_full_name()` → ✅ `f"{user.first_name} {user.last_name}".strip() or user.username`
- ❌ Assuming Django's built-in `get_full_name()` exists → ✅ Manual string concatenation

**Correct Pattern for Full Name**:
```python
# ✅ Correct way to get full name with fallback
full_name = f"{user.first_name} {user.last_name}".strip() or user.username

# ✅ With email fallback
full_name = f"{user.first_name} {user.last_name}".strip() or user.email

# ❌ WRONG - method doesn't exist
full_name = user.get_full_name()  # AttributeError!
```

---

## Field Naming Patterns

### Amount Fields:
- `Payment.amount` ✅ (payment total)
- `JobBid.bid_amount` ✅ (bid amount)
- `CleaningJob.client_budget` ✅ (client's budget)
- `CleaningJob.final_price` ✅ (agreed price after bid acceptance)

### Description/Title Fields:
- `CleaningJob.services_description` ✅ (what work is needed)
- `Payment.description` ✅ (payment notes)
- `JobBid.message` ✅ (cleaner's message with bid)

### User Relationship Fields:
- `CleaningJob.client` ✅ (job client)
- `CleaningJob.cleaner` ✅ (assigned cleaner)
- `Review.reviewer` ✅ (who wrote review)
- `Review.reviewee` ✅ (who is being reviewed)

---

## Quick Reference Checklist

Before writing code that accesses model fields:

1. ✅ Check model definition in `backend/{app}/models.py`
2. ✅ Use Django shell to verify field names: `Model._meta.get_fields()`
3. ✅ Search codebase for existing correct usage patterns
4. ✅ Test with actual data before committing

---

## All Known Field Errors Fixed

### November 10, 2025 - Complete Model Field Audit

**Session 1 - Payment & Dashboard Fix**:
1. `backend/payments/views.py` - `job.title` → `job.services_description`
2. `backend/cleaning_jobs/dashboard_views.py` - Multiple fixes:
   - Line 76: `job.accepted_bid.amount` → `job.accepted_bid.bid_amount`
   - Line 88: `bid.job.title` → `bid.job.services_description`
   - Line 90: `bid.amount` → `bid.bid_amount`
   - Line 106: `job.title` → `job.services_description`
   - Line 206: `job.title` → `job.services_description`
   - Line 210: `job.accepted_bid.amount` → `job.accepted_bid.bid_amount`
   - Line 224: `job.title` → `job.services_description`

**Session 2 - Review & ServiceArea Fix** (Same Day):
- `Review.objects.filter(cleaner=user)` → `Review.objects.filter(reviewee=user)`
- `Avg('rating')` → `Avg('overall_rating')`
- `CleanerServiceArea` import → `ServiceArea` import
- `property__municipality__in` → `property__city__in`

**Session 3 - User.get_full_name() Fix** (Same Day):
Files fixed (5 total):
1. `backend/payments/views.py` (line 252) - `payment.client.get_full_name()` → `f"{payment.client.first_name} {payment.client.last_name}".strip()`
2. `backend/job_lifecycle/views.py` (line 198) - `self.request.user.get_full_name()` → `f"{self.request.user.first_name} {self.request.user.last_name}".strip()`
3. `backend/chat/models.py` (line 85) - `p.get_full_name()` → `f"{p.first_name} {p.last_name}".strip()`
4. `backend/chat/signals.py` (line 42) - `message.sender.get_full_name()` → `f"{message.sender.first_name} {message.sender.last_name}".strip()`
5. `backend/chat/signals.py` (line 67) - `message.sender.get_full_name()` → `f"{message.sender.first_name} {message.sender.last_name}".strip()`

**Root Cause**: Custom User model doesn't inherit Django's default `get_full_name()` method from AbstractUser.

---

## Verification Commands

```bash
# Check CleaningJob fields
docker compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from cleaning_jobs.models import CleaningJob
print([f.name for f in CleaningJob._meta.get_fields()])
"

# Check JobBid fields
docker compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from cleaning_jobs.models import JobBid
print([f.name for f in JobBid._meta.get_fields()])
"

# Check Payment fields
docker compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from payments.models import Payment
print([f.name for f in Payment._meta.get_fields()])
"

# Check Review fields
docker compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from reviews.models import Review
print([f.name for f in Review._meta.get_fields()])
"
```

---

## Best Practices

1. **Always Reference This Document** before accessing model fields
2. **Use IDE Autocomplete** - Models have proper field definitions
3. **Test in Django Shell** before writing view code
4. **Search Before Assume** - Grep codebase for correct patterns
5. **Document New Fields** - Add to this reference when models change

---

**Last Updated**: November 10, 2025  
**Maintainer**: Development Team  
**Status**: Living document - update when models change
