# Phase 1: Detailed Implementation Guide
## Complete Core Marketplace - Ultra-Specific Action Plan

**Timeline**: 4-6 weeks  
**Goal**: Production-ready transactional marketplace  
**Last Updated**: October 26, 2025

---

## 📐 Architecture Overview

### Current Tech Stack
```
Backend:
├── Django 4.2+ (Python 3.11+)
├── Django REST Framework
├── Django Channels (WebSocket)
├── PostgreSQL (Database)
├── Redis (Cache + Channel Layer)
└── Celery (Background Tasks - to add)

Frontend:
├── React 18+
├── React Router v6
├── Tailwind CSS
├── Axios (HTTP client)
└── WebSocket (native)

Infrastructure:
├── Docker (Development)
├── Docker Compose
└── Production: TBD (AWS/DigitalOcean)
```

---

## 🎯 TASK 1: Payment Integration (CRITICAL)

**Estimated Time**: 8-10 hours  
**Priority**: HIGHEST  
**Status**: Not Started

### 1.1 Choose Payment Provider

**Recommendation**: **Stripe** (easier integration, better docs)

**Why Stripe?**
- ✅ Excellent documentation
- ✅ React SDK available
- ✅ Webhook support
- ✅ Test mode (no real charges)
- ✅ PCI compliant (they handle card data)
- ✅ Supports marketplace payments (Connect API)

**Alternative**: PayPal (if users prefer PayPal)

**Decision Point**: Choose one provider for Phase 1

---

### 1.2 Backend: Stripe Setup

#### Step 1: Install Dependencies

```bash
# In backend directory
cd backend
docker-compose -f ../docker-compose.dev.yml exec backend bash

# Install Stripe Python SDK
pip install stripe==7.0.0

# Add to requirements.txt
echo "stripe==7.0.0" >> requirements.txt
```

#### Step 2: Create Payments App

```bash
# Inside backend container
python manage.py startapp payments
```

#### Step 3: Add to INSTALLED_APPS

**File**: `backend/e_clean_backend/settings.py`

```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    # ... existing apps ...
    'cleaning_jobs',
    'notifications',
    'payments',  # ← ADD THIS
]
```

#### Step 4: Configure Environment Variables

**File**: `backend/.env` (create if doesn't exist)

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Get from Stripe Dashboard
STRIPE_PUBLISHABLE_KEY=pk_test_... # Get from Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_... # Get after creating webhook

# Platform Fee (%)
PLATFORM_FEE_PERCENTAGE=15.0  # E-Clean takes 15%
```

**File**: `backend/e_clean_backend/settings.py` (add at bottom)

```python
# Stripe Configuration
STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY')
STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET')
PLATFORM_FEE_PERCENTAGE = float(os.getenv('PLATFORM_FEE_PERCENTAGE', '15.0'))
```

#### Step 5: Create Payment Models

**File**: `backend/payments/models.py`

```python
from django.db import models
from django.conf import settings
from cleaning_jobs.models import CleaningJob
from decimal import Decimal

class PaymentMethod(models.Model):
    """Saved payment methods for users"""
    CARD_TYPES = [
        ('visa', 'Visa'),
        ('mastercard', 'Mastercard'),
        ('amex', 'American Express'),
        ('discover', 'Discover'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payment_methods'
    )
    stripe_payment_method_id = models.CharField(max_length=255, unique=True)
    card_type = models.CharField(max_length=20, choices=CARD_TYPES)
    last4 = models.CharField(max_length=4)
    exp_month = models.IntegerField()
    exp_year = models.IntegerField()
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-is_default', '-created_at']
    
    def __str__(self):
        return f"{self.card_type} •••• {self.last4}"


class Payment(models.Model):
    """Payment transactions"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('canceled', 'Canceled'),
    ]
    
    job = models.OneToOneField(
        CleaningJob,
        on_delete=models.CASCADE,
        related_name='payment'
    )
    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments_made'
    )
    payee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments_received'
    )
    
    # Amounts (in cents to avoid float issues)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2)
    cleaner_payout = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Stripe IDs
    stripe_payment_intent_id = models.CharField(max_length=255, unique=True)
    stripe_charge_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_transfer_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    failure_reason = models.TextField(blank=True, null=True)
    
    # Metadata
    payment_method = models.ForeignKey(
        PaymentMethod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    receipt_url = models.URLField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payer', '-created_at']),
            models.Index(fields=['payee', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]
    
    def __str__(self):
        return f"Payment #{self.id} - {self.job} - ${self.amount}"
    
    def calculate_fees(self):
        """Calculate platform fee and cleaner payout"""
        fee_percentage = Decimal(str(settings.PLATFORM_FEE_PERCENTAGE)) / 100
        self.platform_fee = (self.amount * fee_percentage).quantize(Decimal('0.01'))
        self.cleaner_payout = self.amount - self.platform_fee


class Refund(models.Model):
    """Refund records"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('canceled', 'Canceled'),
    ]
    
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='refunds'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    
    stripe_refund_id = models.CharField(max_length=255, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='initiated_refunds'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Refund #{self.id} - ${self.amount}"
```

#### Step 6: Create Migration

```bash
python manage.py makemigrations payments
python manage.py migrate payments
```

#### Step 7: Register Models in Admin

**File**: `backend/payments/admin.py`

```python
from django.contrib import admin
from .models import PaymentMethod, Payment, Refund

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'card_type', 'last4', 'exp_month', 'exp_year', 'is_default', 'created_at']
    list_filter = ['card_type', 'is_default']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'last4']
    readonly_fields = ['stripe_payment_method_id', 'created_at']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'job', 'payer', 'payee', 'amount', 'platform_fee', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['job__id', 'payer__email', 'payee__email', 'stripe_payment_intent_id']
    readonly_fields = [
        'stripe_payment_intent_id', 
        'stripe_charge_id', 
        'stripe_transfer_id',
        'created_at', 
        'updated_at', 
        'paid_at'
    ]
    
    fieldsets = (
        ('Job & Participants', {
            'fields': ('job', 'payer', 'payee')
        }),
        ('Amounts', {
            'fields': ('amount', 'platform_fee', 'cleaner_payout')
        }),
        ('Stripe IDs', {
            'fields': ('stripe_payment_intent_id', 'stripe_charge_id', 'stripe_transfer_id')
        }),
        ('Status', {
            'fields': ('status', 'failure_reason', 'payment_method', 'receipt_url')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'paid_at')
        }),
    )


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ['id', 'payment', 'amount', 'status', 'initiated_by', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['payment__id', 'stripe_refund_id']
    readonly_fields = ['stripe_refund_id', 'created_at', 'processed_at']
```

#### Step 8: Create Stripe Service

**File**: `backend/payments/stripe_service.py`

```python
import stripe
from django.conf import settings
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    """Service for interacting with Stripe API"""
    
    @staticmethod
    def create_payment_intent(amount, customer_email, metadata=None):
        """
        Create a payment intent
        
        Args:
            amount (Decimal): Amount in dollars (e.g., 150.00)
            customer_email (str): Customer email
            metadata (dict): Additional metadata
        
        Returns:
            dict: Payment intent object
        """
        try:
            # Convert to cents
            amount_cents = int(amount * 100)
            
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='usd',  # or 'eur' for Europe
                receipt_email=customer_email,
                metadata=metadata or {},
                automatic_payment_methods={
                    'enabled': True,
                },
            )
            
            logger.info(f"Created payment intent: {intent.id}")
            return intent
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating payment intent: {e}")
            raise
    
    @staticmethod
    def confirm_payment_intent(payment_intent_id):
        """Confirm a payment intent"""
        try:
            intent = stripe.PaymentIntent.confirm(payment_intent_id)
            logger.info(f"Confirmed payment intent: {payment_intent_id}")
            return intent
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error confirming payment: {e}")
            raise
    
    @staticmethod
    def retrieve_payment_intent(payment_intent_id):
        """Retrieve payment intent details"""
        try:
            return stripe.PaymentIntent.retrieve(payment_intent_id)
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error retrieving payment intent: {e}")
            raise
    
    @staticmethod
    def create_refund(payment_intent_id, amount=None, reason='requested_by_customer'):
        """
        Create a refund
        
        Args:
            payment_intent_id (str): Payment intent ID
            amount (int): Amount in cents (None for full refund)
            reason (str): Refund reason
        
        Returns:
            dict: Refund object
        """
        try:
            refund_data = {
                'payment_intent': payment_intent_id,
                'reason': reason,
            }
            
            if amount:
                refund_data['amount'] = amount
            
            refund = stripe.Refund.create(**refund_data)
            logger.info(f"Created refund: {refund.id}")
            return refund
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating refund: {e}")
            raise
    
    @staticmethod
    def save_payment_method(customer_id, payment_method_id):
        """Attach payment method to customer"""
        try:
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id,
            )
            logger.info(f"Attached payment method {payment_method_id} to customer {customer_id}")
            return True
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error saving payment method: {e}")
            raise
    
    @staticmethod
    def create_customer(email, name, metadata=None):
        """Create a Stripe customer"""
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata=metadata or {}
            )
            logger.info(f"Created Stripe customer: {customer.id}")
            return customer
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating customer: {e}")
            raise
```

#### Step 9: Create Serializers

**File**: `backend/payments/serializers.py`

```python
from rest_framework import serializers
from .models import Payment, PaymentMethod, Refund
from cleaning_jobs.serializers import CleaningJobSerializer
from users.serializers import UserSerializer

class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = [
            'id',
            'card_type',
            'last4',
            'exp_month',
            'exp_year',
            'is_default',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    job_details = CleaningJobSerializer(source='job', read_only=True)
    payer_details = UserSerializer(source='payer', read_only=True)
    payee_details = UserSerializer(source='payee', read_only=True)
    payment_method_details = PaymentMethodSerializer(source='payment_method', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id',
            'job',
            'job_details',
            'payer',
            'payer_details',
            'payee',
            'payee_details',
            'amount',
            'platform_fee',
            'cleaner_payout',
            'stripe_payment_intent_id',
            'status',
            'failure_reason',
            'payment_method',
            'payment_method_details',
            'receipt_url',
            'created_at',
            'updated_at',
            'paid_at',
        ]
        read_only_fields = [
            'id',
            'platform_fee',
            'cleaner_payout',
            'stripe_payment_intent_id',
            'stripe_charge_id',
            'stripe_transfer_id',
            'status',
            'failure_reason',
            'receipt_url',
            'created_at',
            'updated_at',
            'paid_at',
        ]


class CreatePaymentIntentSerializer(serializers.Serializer):
    """Serializer for creating payment intent"""
    job_id = serializers.IntegerField()
    payment_method_id = serializers.CharField(required=False, allow_blank=True)
    save_payment_method = serializers.BooleanField(default=False)


class RefundSerializer(serializers.ModelSerializer):
    payment_details = PaymentSerializer(source='payment', read_only=True)
    initiated_by_details = UserSerializer(source='initiated_by', read_only=True)
    
    class Meta:
        model = Refund
        fields = [
            'id',
            'payment',
            'payment_details',
            'amount',
            'reason',
            'stripe_refund_id',
            'status',
            'initiated_by',
            'initiated_by_details',
            'created_at',
            'processed_at',
        ]
        read_only_fields = [
            'id',
            'stripe_refund_id',
            'status',
            'created_at',
            'processed_at',
        ]
```

#### Step 10: Create Views

**File**: `backend/payments/views.py`

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings

from .models import Payment, PaymentMethod, Refund
from .serializers import (
    PaymentSerializer,
    PaymentMethodSerializer,
    RefundSerializer,
    CreatePaymentIntentSerializer,
)
from .stripe_service import StripeService
from cleaning_jobs.models import CleaningJob

import logging

logger = logging.getLogger(__name__)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing payments"""
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter payments for current user"""
        user = self.request.user
        return Payment.objects.filter(
            models.Q(payer=user) | models.Q(payee=user)
        ).select_related('job', 'payer', 'payee', 'payment_method')
    
    @action(detail=False, methods=['post'])
    def create_intent(self, request):
        """
        Create a payment intent for a job
        
        POST /api/payments/create_intent/
        Body: {
            "job_id": 123,
            "payment_method_id": "pm_..." (optional)
        }
        """
        serializer = CreatePaymentIntentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        job_id = serializer.validated_data['job_id']
        
        # Get job
        job = get_object_or_404(
            CleaningJob.objects.select_related('client', 'cleaner'),
            id=job_id
        )
        
        # Verify user is the client
        if job.client != request.user:
            return Response(
                {'error': 'Only the job client can make payment'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify job is in correct status
        if job.status not in ['bid_accepted', 'confirmed', 'in_progress', 'awaiting_review']:
            return Response(
                {'error': f'Cannot pay for job in status: {job.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if payment already exists
        if hasattr(job, 'payment'):
            if job.payment.status == 'succeeded':
                return Response(
                    {'error': 'Payment already completed for this job'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # If payment failed, we can create a new one
            if job.payment.status in ['pending', 'processing']:
                return Response(
                    {'error': 'Payment already in progress'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            # Get accepted bid amount
            accepted_bid = job.bids.filter(status='accepted').first()
            if not accepted_bid:
                return Response(
                    {'error': 'No accepted bid found for this job'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            amount = accepted_bid.bid_amount
            
            # Create payment intent with Stripe
            intent = StripeService.create_payment_intent(
                amount=amount,
                customer_email=request.user.email,
                metadata={
                    'job_id': job.id,
                    'client_id': job.client.id,
                    'cleaner_id': job.cleaner.id if job.cleaner else None,
                }
            )
            
            # Create Payment record
            payment = Payment.objects.create(
                job=job,
                payer=job.client,
                payee=job.cleaner,
                amount=amount,
                stripe_payment_intent_id=intent.id,
                status='pending',
            )
            
            # Calculate fees
            payment.calculate_fees()
            payment.save()
            
            logger.info(f"Created payment intent for job {job.id}: {intent.id}")
            
            return Response({
                'payment_id': payment.id,
                'client_secret': intent.client_secret,
                'amount': float(amount),
                'platform_fee': float(payment.platform_fee),
                'cleaner_payout': float(payment.cleaner_payout),
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating payment intent: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to create payment intent'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """
        Confirm payment success (called after frontend confirms with Stripe)
        
        POST /api/payments/{id}/confirm/
        """
        payment = self.get_object()
        
        # Verify payment belongs to current user
        if payment.payer != request.user:
            return Response(
                {'error': 'Not authorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Retrieve payment intent from Stripe
            intent = StripeService.retrieve_payment_intent(payment.stripe_payment_intent_id)
            
            if intent.status == 'succeeded':
                payment.status = 'succeeded'
                payment.paid_at = timezone.now()
                payment.stripe_charge_id = intent.charges.data[0].id if intent.charges.data else None
                payment.receipt_url = intent.charges.data[0].receipt_url if intent.charges.data else None
                payment.save()
                
                # Update job status
                payment.job.status = 'confirmed'
                payment.job.save()
                
                logger.info(f"Payment {payment.id} confirmed successfully")
                
                return Response({
                    'status': 'success',
                    'message': 'Payment confirmed',
                    'receipt_url': payment.receipt_url,
                })
            else:
                return Response(
                    {'error': f'Payment not succeeded. Status: {intent.status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        except Exception as e:
            logger.error(f"Error confirming payment: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to confirm payment'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PaymentMethodViewSet(viewsets.ModelViewSet):
    """ViewSet for managing payment methods"""
    serializer_class = PaymentMethodSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return PaymentMethod.objects.filter(user=self.request.user)


class RefundViewSet(viewsets.ModelViewSet):
    """ViewSet for managing refunds (admin only for creation)"""
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # Users can see refunds for their payments
        return Refund.objects.filter(
            models.Q(payment__payer=user) | models.Q(payment__payee=user)
        ).select_related('payment', 'initiated_by')
```

#### Step 11: Create URLs

**File**: `backend/payments/urls.py` (create new file)

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, PaymentMethodViewSet, RefundViewSet

router = DefaultRouter()
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'refunds', RefundViewSet, basename='refund')

urlpatterns = [
    path('', include(router.urls)),
]
```

**File**: `backend/e_clean_backend/urls.py` (update)

```python
urlpatterns = [
    # ... existing paths ...
    path('api/', include('payments.urls')),  # ← ADD THIS
]
```

#### Step 12: Create Webhook Handler

**File**: `backend/payments/webhook_handler.py`

```python
import stripe
from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from .models import Payment
import logging

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Handle Stripe webhooks
    
    Endpoint: /api/payments/webhook/
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid payload: {e}")
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid signature: {e}")
        return HttpResponse(status=400)
    
    # Handle the event
    if event.type == 'payment_intent.succeeded':
        payment_intent = event.data.object
        handle_payment_succeeded(payment_intent)
    
    elif event.type == 'payment_intent.payment_failed':
        payment_intent = event.data.object
        handle_payment_failed(payment_intent)
    
    elif event.type == 'charge.refunded':
        charge = event.data.object
        handle_refund(charge)
    
    else:
        logger.info(f"Unhandled event type: {event.type}")
    
    return HttpResponse(status=200)


def handle_payment_succeeded(payment_intent):
    """Handle successful payment"""
    try:
        payment = Payment.objects.get(stripe_payment_intent_id=payment_intent.id)
        payment.status = 'succeeded'
        payment.paid_at = timezone.now()
        
        if payment_intent.charges.data:
            charge = payment_intent.charges.data[0]
            payment.stripe_charge_id = charge.id
            payment.receipt_url = charge.receipt_url
        
        payment.save()
        
        # Update job status
        payment.job.status = 'confirmed'
        payment.job.save()
        
        logger.info(f"Payment {payment.id} marked as succeeded via webhook")
        
    except Payment.DoesNotExist:
        logger.warning(f"Payment not found for intent: {payment_intent.id}")


def handle_payment_failed(payment_intent):
    """Handle failed payment"""
    try:
        payment = Payment.objects.get(stripe_payment_intent_id=payment_intent.id)
        payment.status = 'failed'
        payment.failure_reason = payment_intent.last_payment_error.message if payment_intent.last_payment_error else None
        payment.save()
        
        logger.info(f"Payment {payment.id} marked as failed via webhook")
        
    except Payment.DoesNotExist:
        logger.warning(f"Payment not found for intent: {payment_intent.id}")


def handle_refund(charge):
    """Handle refund"""
    # Implementation for refund handling
    logger.info(f"Refund processed for charge: {charge.id}")
```

**File**: `backend/payments/urls.py` (update)

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, PaymentMethodViewSet, RefundViewSet
from .webhook_handler import stripe_webhook  # ← ADD

router = DefaultRouter()
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'refunds', RefundViewSet, basename='refund')

urlpatterns = [
    path('', include(router.urls)),
    path('webhook/', stripe_webhook, name='stripe-webhook'),  # ← ADD
]
```

---

### 1.3 Frontend: Stripe Integration

#### Step 1: Install Stripe SDK

```bash
cd frontend
npm install --save @stripe/stripe-js @stripe/react-stripe-js
```

#### Step 2: Create Stripe Context

**File**: `frontend/src/contexts/StripeContext.jsx`

```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const StripeContext = createContext();

export const useStripe = () => {
  const context = useContext(StripeContext);
  if (!context) {
    throw new Error('useStripe must be used within StripeProvider');
  }
  return context;
};

export const StripeProvider = ({ children }) => {
  const [stripePromise, setStripePromise] = useState(null);
  
  useEffect(() => {
    // Load Stripe publishable key from environment
    const publishableKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 
                          'pk_test_51...'; // Your Stripe test key
    
    setStripePromise(loadStripe(publishableKey));
  }, []);
  
  return (
    <StripeContext.Provider value={{ stripePromise }}>
      {children}
    </StripeContext.Provider>
  );
};
```

#### Step 3: Update App.jsx

**File**: `frontend/src/App.jsx`

```javascript
import { StripeProvider } from './contexts/StripeContext';  // ← ADD

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <LoadingProvider>
          <ToastProvider>
            <StripeProvider>  {/* ← ADD */}
              <WebSocketProvider>
                <UnifiedChatProvider>
                  {/* ... rest of app ... */}
                </UnifiedChatProvider>
              </WebSocketProvider>
            </StripeProvider>  {/* ← ADD */}
          </ToastProvider>
        </LoadingProvider>
      </UserProvider>
    </BrowserRouter>
  );
}
```

#### Step 4: Create Payment API Service

**File**: `frontend/src/services/paymentsAPI.js`

```javascript
import { api, apiCall } from './api';

export const paymentsAPI = {
  /**
   * Create payment intent for a job
   * @param {number} jobId - Job ID
   * @returns {Promise<Object>} Payment intent details
   */
  createIntent: async (jobId) => {
    return apiCall(
      async () => {
        const response = await api.post('/payments/create_intent/', {
          job_id: jobId
        });
        return response.data;
      },
      {
        loadingKey: 'create_payment_intent',
        showSuccess: false
      }
    );
  },
  
  /**
   * Confirm payment after Stripe processing
   * @param {number} paymentId - Payment ID
   * @returns {Promise<Object>} Confirmation details
   */
  confirmPayment: async (paymentId) => {
    return apiCall(
      async () => {
        const response = await api.post(`/payments/${paymentId}/confirm/`);
        return response.data;
      },
      {
        loadingKey: 'confirm_payment',
        successMessage: 'Payment confirmed successfully'
      }
    );
  },
  
  /**
   * Get all payments for current user
   * @returns {Promise<Array>} List of payments
   */
  getAll: async () => {
    return apiCall(
      async () => {
        const response = await api.get('/payments/');
        return response.data;
      },
      {
        loadingKey: 'payments_list',
        showSuccess: false
      }
    );
  },
  
  /**
   * Get payment by ID
   * @param {number} id - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  getById: async (id) => {
    return apiCall(
      async () => {
        const response = await api.get(`/payments/${id}/`);
        return response.data;
      },
      {
        loadingKey: `payment_${id}`,
        showSuccess: false
      }
    );
  }
};
```

#### Step 5: Create Payment Form Component

**File**: `frontend/src/components/payments/PaymentForm.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useStripe as useStripeContext } from '../../contexts/StripeContext';
import { paymentsAPI } from '../../services/paymentsAPI';
import { useToast } from '../../contexts/ToastContext';

const PaymentFormContent = ({ jobId, amount, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setIsProcessing(true);
    setErrorMessage(null);
    
    try {
      // Confirm payment with Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      
      if (error) {
        setErrorMessage(error.message);
        toast.error(error.message);
        setIsProcessing(false);
        return;
      }
      
      if (paymentIntent.status === 'succeeded') {
        // Confirm with backend
        // Note: Get payment_id from createIntent response
        // await paymentsAPI.confirmPayment(paymentId);
        
        toast.success('Payment successful!');
        onSuccess(paymentIntent);
      }
      
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Payment failed. Please try again.');
      setErrorMessage('An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Payment Details</h3>
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="flex justify-between mb-2">
            <span>Job Amount:</span>
            <span className="font-semibold">${amount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <PaymentElement />
      
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {errorMessage}
        </div>
      )}
      
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          disabled={isProcessing}
        >
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
};

const PaymentForm = ({ jobId, amount, onSuccess, onCancel }) => {
  const { stripePromise } = useStripeContext();
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();
  
  useEffect(() => {
    const initializePayment = async () => {
      try {
        const data = await paymentsAPI.createIntent(jobId);
        setClientSecret(data.client_secret);
        setPaymentId(data.payment_id);
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize payment:', err);
        setError('Failed to initialize payment. Please try again.');
        toast.error('Failed to initialize payment');
        setLoading(false);
      }
    };
    
    initializePayment();
  }, [jobId, toast]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }
  
  if (!clientSecret) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
        Unable to initialize payment.
      </div>
    );
  }
  
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#2563eb',
      },
    },
  };
  
  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentFormContent 
        jobId={jobId}
        amount={amount}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
};

export default PaymentForm;
```

#### Step 6: Create Payment Modal Component

**File**: `frontend/src/components/payments/PaymentModal.jsx`

```javascript
import React from 'react';
import PaymentForm from './PaymentForm';

const PaymentModal = ({ isOpen, onClose, jobId, amount, jobDetails, onSuccess }) => {
  if (!isOpen) return null;
  
  const handleSuccess = (paymentIntent) => {
    onSuccess(paymentIntent);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Complete Payment</h2>
            {jobDetails && (
              <p className="text-gray-600 mt-2">
                Job #{jobDetails.id} - {jobDetails.title}
              </p>
            )}
          </div>
          
          {/* Payment Form */}
          <PaymentForm
            jobId={jobId}
            amount={amount}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
```

#### Step 7: Integrate into Job Details Page

**File**: `frontend/src/pages/JobDetails.jsx` (update)

```javascript
import { useState } from 'react';
import PaymentModal from '../components/payments/PaymentModal';

const JobDetails = () => {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // ... existing code ...
  
  const handlePayment = () => {
    setShowPaymentModal(true);
  };
  
  const handlePaymentSuccess = (paymentIntent) => {
    console.log('Payment successful:', paymentIntent);
    // Refresh job details
    fetchJobDetails();
  };
  
  return (
    <div>
      {/* ... existing JSX ... */}
      
      {/* Show payment button if job status is bid_accepted */}
      {job.status === 'bid_accepted' && job.client.id === user.id && (
        <button
          onClick={handlePayment}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Make Payment (${acceptedBid?.bid_amount})
        </button>
      )}
      
      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        jobId={job.id}
        amount={acceptedBid?.bid_amount || 0}
        jobDetails={job}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};
```

---

### 1.4 Testing Payment Integration

#### Test Checklist

```bash
# Backend Tests
□ Payment intent creation
□ Payment confirmation
□ Webhook handling
□ Refund creation
□ Fee calculation
□ Database constraints

# Frontend Tests
□ Payment form renders
□ Stripe Elements load
□ Payment submission
□ Error handling
□ Success callback
□ Modal open/close

# Integration Tests
□ Full payment flow (client → Stripe → backend)
□ Webhook delivery
□ Job status update after payment
□ Payment history display
```

#### Manual Test Flow

1. **Create test job** (as client)
2. **Submit bid** (as cleaner)
3. **Accept bid** (as client)
4. **Click "Make Payment"**
5. **Enter test card**: `4242 4242 4242 4242`
6. **Complete payment**
7. **Verify**:
   - Payment record created
   - Job status updated to "confirmed"
   - Webhook received
   - Receipt email sent

---

## 📈 Progress Tracking

Create a checklist file to track your progress:

**File**: `PHASE_1_PROGRESS.md`

```markdown
# Phase 1 Progress Tracker

## Week 1: Payment Integration

### Day 1
- [ ] Choose Stripe as provider
- [ ] Create Stripe account
- [ ] Get API keys
- [ ] Install dependencies

### Day 2
- [ ] Create payments app
- [ ] Create models
- [ ] Run migrations
- [ ] Configure admin

### Day 3
- [ ] Create Stripe service
- [ ] Create serializers
- [ ] Create views
- [ ] Create URLs

### Day 4
- [ ] Create webhook handler
- [ ] Install frontend Stripe SDK
- [ ] Create Stripe context
- [ ] Update App.jsx

### Day 5
- [ ] Create payment API service
- [ ] Create PaymentForm component
- [ ] Create PaymentModal component
- [ ] Integrate into job details

### Weekend
- [ ] Test payment flow
- [ ] Fix bugs
- [ ] Documentation
```

---

## 🔄 TASK 2: Job Lifecycle Completion

**Estimated Time**: 6-8 hours  
**Priority**: HIGH  
**Status**: Not Started  
**Dependencies**: Task 1 (Payment Integration)

### 2.0 Job Lifecycle Overview

**Current Job Statuses** (from existing models):
```python
STATUS_CHOICES = [
    ('pending', 'Pending'),           # Job posted, awaiting bids
    ('bid_accepted', 'Bid Accepted'), # Client accepted a bid
    ('confirmed', 'Confirmed'),       # Payment completed
    ('in_progress', 'In Progress'),   # Cleaner started work
    ('awaiting_review', 'Awaiting Review'),  # Work completed, needs review
    ('completed', 'Completed'),       # Fully completed with review
    ('cancelled', 'Cancelled'),       # Job cancelled
]
```

**Complete Flow We're Building**:
```
1. pending → (client accepts bid) → bid_accepted
2. bid_accepted → (payment succeeds) → confirmed
3. confirmed → (cleaner starts) → in_progress
4. in_progress → (cleaner completes) → awaiting_review
5. awaiting_review → (client reviews) → completed
6. (any status) → (cancel) → cancelled
```

---

### 2.1 Backend: Audit Current Job Status Logic

#### Step 1: Review Existing CleaningJob Model

**File**: `backend/cleaning_jobs/models.py`

Let's check what we already have:

```bash
cd backend
docker-compose -f ../docker-compose.dev.yml exec backend bash
```

**Action**: Read the current `CleaningJob` model to understand existing fields.

**Expected fields to verify**:
- `status` (CharField with STATUS_CHOICES)
- `client` (ForeignKey to User)
- `cleaner` (ForeignKey to User, can be null)
- `scheduled_date` (DateTimeField)
- `completion_date` (DateTimeField, null/blank)
- `started_at` (DateTimeField - ADD if missing)
- `completed_at` (DateTimeField - ADD if missing)

#### Step 2: Add Missing Timestamp Fields

**File**: `backend/cleaning_jobs/models.py`

**Add these fields** to the `CleaningJob` model (if not already present):

```python
class CleaningJob(models.Model):
    # ... existing fields ...
    
    # Lifecycle timestamps
    started_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When cleaner started the job"
    )
    completed_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When cleaner marked job as complete"
    )
    reviewed_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When client submitted review"
    )
    cancelled_at = models.DateTimeField(
        null=True, 
        blank=True,
        help_text="When job was cancelled"
    )
    cancellation_reason = models.TextField(
        blank=True,
        null=True,
        help_text="Reason for cancellation"
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cancelled_jobs',
        help_text="User who cancelled the job"
    )
    
    # ... existing methods ...
    
    def can_transition_to(self, new_status, user):
        """
        Check if status transition is allowed
        
        Args:
            new_status (str): Target status
            user (User): User attempting transition
        
        Returns:
            tuple: (allowed: bool, reason: str)
        """
        current = self.status
        
        # Define allowed transitions
        transitions = {
            'pending': {
                'bid_accepted': lambda: user == self.client,
                'cancelled': lambda: user in [self.client, self.cleaner],
            },
            'bid_accepted': {
                'confirmed': lambda: user == self.client,  # After payment
                'cancelled': lambda: user in [self.client, self.cleaner],
            },
            'confirmed': {
                'in_progress': lambda: user == self.cleaner,
                'cancelled': lambda: user in [self.client, self.cleaner],
            },
            'in_progress': {
                'awaiting_review': lambda: user == self.cleaner,
                'cancelled': lambda: user == self.cleaner,
            },
            'awaiting_review': {
                'completed': lambda: user == self.client,
            },
            'completed': {},  # Terminal state
            'cancelled': {},  # Terminal state
        }
        
        if current not in transitions:
            return False, f"Unknown current status: {current}"
        
        if new_status not in transitions[current]:
            return False, f"Cannot transition from {current} to {new_status}"
        
        # Check user permission
        check_permission = transitions[current][new_status]
        if not check_permission():
            return False, "You don't have permission for this transition"
        
        return True, "Transition allowed"
    
    def transition_to(self, new_status, user, reason=None):
        """
        Transition job to new status with validation
        
        Args:
            new_status (str): Target status
            user (User): User performing transition
            reason (str): Optional reason (required for cancellation)
        
        Returns:
            bool: Success
        
        Raises:
            ValueError: If transition not allowed
        """
        allowed, message = self.can_transition_to(new_status, user)
        
        if not allowed:
            raise ValueError(message)
        
        # Update status
        old_status = self.status
        self.status = new_status
        
        # Update timestamps
        from django.utils import timezone
        now = timezone.now()
        
        if new_status == 'in_progress':
            self.started_at = now
        elif new_status == 'awaiting_review':
            self.completed_at = now
        elif new_status == 'completed':
            self.reviewed_at = now
        elif new_status == 'cancelled':
            self.cancelled_at = now
            self.cancellation_reason = reason
            self.cancelled_by = user
        
        self.save()
        
        # Emit signal for lifecycle event
        from .signals import job_status_changed
        job_status_changed.send(
            sender=self.__class__,
            job=self,
            old_status=old_status,
            new_status=new_status,
            user=user
        )
        
        return True
```

#### Step 3: Create Migration

```bash
python manage.py makemigrations cleaning_jobs
python manage.py migrate cleaning_jobs
```

#### Step 4: Update Signals

**File**: `backend/cleaning_jobs/signals.py`

**Add or update** the job lifecycle signal:

```python
from django.dispatch import Signal

# Job lifecycle signal
job_status_changed = Signal()  # providing_args=['job', 'old_status', 'new_status', 'user']

# Signal handlers
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CleaningJob

@receiver(job_status_changed)
def handle_job_status_change(sender, job, old_status, new_status, user, **kwargs):
    """
    Handle job status changes
    - Create notifications
    - Send emails
    - Update related records
    """
    from notifications.models import Notification
    from django.contrib.contenttypes.models import ContentType
    import logging
    
    logger = logging.getLogger(__name__)
    logger.info(f"Job {job.id} transitioned from {old_status} to {new_status} by user {user.id}")
    
    # Determine notification recipient and message
    notifications_to_create = []
    
    if new_status == 'in_progress':
        # Notify client that cleaner started
        notifications_to_create.append({
            'recipient': job.client,
            'title': 'Cleaner Started Job',
            'message': f'{job.cleaner.get_full_name()} has started working on your job: {job.title}',
            'notification_type': 'job_update',
        })
    
    elif new_status == 'awaiting_review':
        # Notify client that job is complete
        notifications_to_create.append({
            'recipient': job.client,
            'title': 'Job Completed - Review Needed',
            'message': f'{job.cleaner.get_full_name()} has completed your job: {job.title}. Please submit a review.',
            'notification_type': 'review_requested',
        })
    
    elif new_status == 'completed':
        # Notify cleaner that review was submitted
        notifications_to_create.append({
            'recipient': job.cleaner,
            'title': 'Client Reviewed Your Work',
            'message': f'{job.client.get_full_name()} has reviewed your work for: {job.title}',
            'notification_type': 'review_received',
        })
    
    elif new_status == 'cancelled':
        # Notify the other party
        other_user = job.cleaner if user == job.client else job.client
        if other_user:
            notifications_to_create.append({
                'recipient': other_user,
                'title': 'Job Cancelled',
                'message': f'Job "{job.title}" has been cancelled.',
                'notification_type': 'job_cancelled',
            })
    
    # Create notifications
    content_type = ContentType.objects.get_for_model(job)
    for notif_data in notifications_to_create:
        try:
            Notification.objects.create(
                recipient=notif_data['recipient'],
                title=notif_data['title'],
                message=notif_data['message'],
                notification_type=notif_data['notification_type'],
                content_type=content_type,
                object_id=job.id,
            )
        except Exception as e:
            logger.error(f"Failed to create notification: {e}")
```

---

### 2.2 Backend: Create Job Action Endpoints

#### Step 1: Create Job Actions Serializer

**File**: `backend/cleaning_jobs/serializers.py` (add to existing)

```python
from rest_framework import serializers

class JobActionSerializer(serializers.Serializer):
    """Serializer for job status transition actions"""
    action = serializers.ChoiceField(choices=[
        'start',      # confirmed → in_progress
        'complete',   # in_progress → awaiting_review
        'cancel',     # any → cancelled
    ])
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Required for cancellation"
    )
    
    def validate(self, data):
        """Validate that reason is provided for cancellation"""
        if data['action'] == 'cancel' and not data.get('reason'):
            raise serializers.ValidationError({
                'reason': 'Cancellation reason is required'
            })
        return data


class JobTimelineSerializer(serializers.Serializer):
    """Serializer for job timeline display"""
    status = serializers.CharField()
    timestamp = serializers.DateTimeField()
    user = serializers.SerializerMethodField()
    description = serializers.CharField()
    
    def get_user(self, obj):
        if obj.get('user'):
            return {
                'id': obj['user'].id,
                'name': obj['user'].get_full_name(),
                'email': obj['user'].email,
            }
        return None
```

#### Step 2: Add Action Methods to ViewSet

**File**: `backend/cleaning_jobs/views.py`

```python
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from .serializers import JobActionSerializer, JobTimelineSerializer

class CleaningJobViewSet(viewsets.ModelViewSet):
    # ... existing code ...
    
    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """
        Start a job (cleaner only)
        
        POST /api/cleaning-jobs/{id}/start/
        
        Transitions: confirmed → in_progress
        """
        job = self.get_object()
        
        # Verify user is the assigned cleaner
        if job.cleaner != request.user:
            return Response(
                {'error': 'Only the assigned cleaner can start this job'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify job is in correct status
        if job.status != 'confirmed':
            return Response(
                {'error': f'Cannot start job in status: {job.status}. Must be "confirmed".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            job.transition_to('in_progress', request.user)
            serializer = self.get_serializer(job)
            return Response({
                'message': 'Job started successfully',
                'job': serializer.data
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Mark job as complete (cleaner only)
        
        POST /api/cleaning-jobs/{id}/complete/
        
        Transitions: in_progress → awaiting_review
        """
        job = self.get_object()
        
        # Verify user is the assigned cleaner
        if job.cleaner != request.user:
            return Response(
                {'error': 'Only the assigned cleaner can complete this job'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify job is in correct status
        if job.status != 'in_progress':
            return Response(
                {'error': f'Cannot complete job in status: {job.status}. Must be "in_progress".'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            job.transition_to('awaiting_review', request.user)
            serializer = self.get_serializer(job)
            return Response({
                'message': 'Job marked as complete. Awaiting client review.',
                'job': serializer.data
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel a job (client or cleaner)
        
        POST /api/cleaning-jobs/{id}/cancel/
        Body: {
            "reason": "Reason for cancellation"
        }
        
        Transitions: any → cancelled
        """
        job = self.get_object()
        
        # Verify user is client or cleaner
        if request.user not in [job.client, job.cleaner]:
            return Response(
                {'error': 'Only the client or cleaner can cancel this job'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify job is not already in terminal state
        if job.status in ['completed', 'cancelled']:
            return Response(
                {'error': f'Cannot cancel job in status: {job.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get cancellation reason
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'error': 'Cancellation reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            job.transition_to('cancelled', request.user, reason=reason)
            
            # If payment was made, initiate refund
            if hasattr(job, 'payment') and job.payment.status == 'succeeded':
                # Import here to avoid circular import
                from payments.stripe_service import StripeService
                
                # Create refund
                try:
                    refund = StripeService.create_refund(
                        payment_intent_id=job.payment.stripe_payment_intent_id,
                        reason='requested_by_customer'
                    )
                    
                    # Create Refund record
                    from payments.models import Refund
                    Refund.objects.create(
                        payment=job.payment,
                        amount=job.payment.amount,
                        reason=reason,
                        stripe_refund_id=refund.id,
                        status='pending',
                        initiated_by=request.user,
                    )
                    
                    message = 'Job cancelled successfully. Refund initiated.'
                except Exception as e:
                    logger.error(f"Refund failed: {e}")
                    message = 'Job cancelled. Refund could not be processed automatically. Please contact support.'
            else:
                message = 'Job cancelled successfully'
            
            serializer = self.get_serializer(job)
            return Response({
                'message': message,
                'job': serializer.data
            })
        
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """
        Get job timeline
        
        GET /api/cleaning-jobs/{id}/timeline/
        
        Returns chronological list of status changes
        """
        job = self.get_object()
        
        # Build timeline from timestamps
        timeline = []
        
        # Created
        timeline.append({
            'status': 'pending',
            'timestamp': job.created_at,
            'user': job.client,
            'description': 'Job posted'
        })
        
        # Bid accepted (if cleaner assigned)
        if job.cleaner and job.status != 'pending':
            # We don't have bid_accepted timestamp, estimate from payment or started_at
            timestamp = job.started_at or job.created_at
            timeline.append({
                'status': 'bid_accepted',
                'timestamp': timestamp,
                'user': job.client,
                'description': 'Bid accepted'
            })
        
        # Payment confirmed
        if hasattr(job, 'payment') and job.payment.paid_at:
            timeline.append({
                'status': 'confirmed',
                'timestamp': job.payment.paid_at,
                'user': job.client,
                'description': 'Payment completed'
            })
        
        # Started
        if job.started_at:
            timeline.append({
                'status': 'in_progress',
                'timestamp': job.started_at,
                'user': job.cleaner,
                'description': 'Work started'
            })
        
        # Completed
        if job.completed_at:
            timeline.append({
                'status': 'awaiting_review',
                'timestamp': job.completed_at,
                'user': job.cleaner,
                'description': 'Work completed'
            })
        
        # Reviewed
        if job.reviewed_at:
            timeline.append({
                'status': 'completed',
                'timestamp': job.reviewed_at,
                'user': job.client,
                'description': 'Review submitted'
            })
        
        # Cancelled
        if job.cancelled_at:
            timeline.append({
                'status': 'cancelled',
                'timestamp': job.cancelled_at,
                'user': job.cancelled_by,
                'description': f'Job cancelled: {job.cancellation_reason}'
            })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x['timestamp'])
        
        serializer = JobTimelineSerializer(timeline, many=True)
        return Response(serializer.data)
```

---

### 2.3 Frontend: Job Status Action Buttons

#### Step 1: Create Job Actions API Service

**File**: `frontend/src/services/jobsAPI.js` (add to existing)

```javascript
export const jobsAPI = {
  // ... existing methods ...
  
  /**
   * Start a job (cleaner only)
   * @param {number} jobId - Job ID
   * @returns {Promise<Object>}
   */
  startJob: async (jobId) => {
    return apiCall(
      async () => {
        const response = await api.post(`/cleaning-jobs/${jobId}/start/`);
        return response.data;
      },
      {
        loadingKey: `start_job_${jobId}`,
        successMessage: 'Job started successfully!'
      }
    );
  },
  
  /**
   * Complete a job (cleaner only)
   * @param {number} jobId - Job ID
   * @returns {Promise<Object>}
   */
  completeJob: async (jobId) => {
    return apiCall(
      async () => {
        const response = await api.post(`/cleaning-jobs/${jobId}/complete/`);
        return response.data;
      },
      {
        loadingKey: `complete_job_${jobId}`,
        successMessage: 'Job completed! Awaiting client review.'
      }
    );
  },
  
  /**
   * Cancel a job
   * @param {number} jobId - Job ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>}
   */
  cancelJob: async (jobId, reason) => {
    return apiCall(
      async () => {
        const response = await api.post(`/cleaning-jobs/${jobId}/cancel/`, {
          reason
        });
        return response.data;
      },
      {
        loadingKey: `cancel_job_${jobId}`,
        successMessage: 'Job cancelled successfully'
      }
    );
  },
  
  /**
   * Get job timeline
   * @param {number} jobId - Job ID
   * @returns {Promise<Array>}
   */
  getTimeline: async (jobId) => {
    return apiCall(
      async () => {
        const response = await api.get(`/cleaning-jobs/${jobId}/timeline/`);
        return response.data;
      },
      {
        loadingKey: `job_timeline_${jobId}`,
        showSuccess: false
      }
    );
  }
};
```

#### Step 2: Create Job Status Actions Component

**File**: `frontend/src/components/jobs/JobActions.jsx`

```javascript
import React, { useState } from 'react';
import { jobsAPI } from '../../services/jobsAPI';
import { useToast } from '../../contexts/ToastContext';
import { useUser } from '../../contexts/UserContext';

const JobActions = ({ job, onJobUpdate }) => {
  const { user } = useUser();
  const toast = useToast();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const isCleaner = user?.id === job.cleaner?.id;
  const isClient = user?.id === job.client?.id;
  
  const handleStartJob = async () => {
    if (!window.confirm('Are you sure you want to start this job?')) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await jobsAPI.startJob(job.id);
      onJobUpdate(response.job);
    } catch (error) {
      console.error('Failed to start job:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCompleteJob = async () => {
    if (!window.confirm('Mark this job as complete? The client will be asked to review your work.')) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await jobsAPI.completeJob(job.id);
      onJobUpdate(response.job);
    } catch (error) {
      console.error('Failed to complete job:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancelJob = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await jobsAPI.cancelJob(job.id, cancelReason);
      onJobUpdate(response.job);
      setShowCancelModal(false);
      setCancelReason('');
    } catch (error) {
      console.error('Failed to cancel job:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Determine which actions are available
  const canStart = isCleaner && job.status === 'confirmed';
  const canComplete = isCleaner && job.status === 'in_progress';
  const canCancel = (isClient || isCleaner) && 
                    !['completed', 'cancelled'].includes(job.status);
  
  if (!canStart && !canComplete && !canCancel) {
    return null;
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Job Actions</h3>
      
      <div className="space-y-2">
        {/* Start Job Button */}
        {canStart && (
          <button
            onClick={handleStartJob}
            disabled={isProcessing}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Starting...' : 'Start Job'}
          </button>
        )}
        
        {/* Complete Job Button */}
        {canComplete && (
          <button
            onClick={handleCompleteJob}
            disabled={isProcessing}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Completing...' : 'Mark as Complete'}
          </button>
        )}
        
        {/* Cancel Job Button */}
        {canCancel && (
          <button
            onClick={() => setShowCancelModal(true)}
            disabled={isProcessing}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel Job
          </button>
        )}
      </div>
      
      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setShowCancelModal(false)}
          />
          
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Cancel Job
              </h3>
              
              <p className="text-gray-600 mb-4">
                Please provide a reason for cancellation:
              </p>
              
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              
              {job.payment && job.payment.status === 'succeeded' && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ A refund will be automatically initiated since payment was completed.
                  </p>
                </div>
              )}
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  disabled={isProcessing}
                >
                  Go Back
                </button>
                
                <button
                  onClick={handleCancelJob}
                  disabled={isProcessing || !cancelReason.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobActions;
```

#### Step 3: Create Job Timeline Component

**File**: `frontend/src/components/jobs/JobTimeline.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { jobsAPI } from '../../services/jobsAPI';
import { formatDistanceToNow, format } from 'date-fns';

const JobTimeline = ({ jobId }) => {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadTimeline();
  }, [jobId]);
  
  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await jobsAPI.getTimeline(jobId);
      setTimeline(data);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusIcon = (status) => {
    const icons = {
      'pending': '📝',
      'bid_accepted': '🤝',
      'confirmed': '💳',
      'in_progress': '🧹',
      'awaiting_review': '⏳',
      'completed': '✅',
      'cancelled': '❌'
    };
    return icons[status] || '•';
  };
  
  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-gray-100 border-gray-300',
      'bid_accepted': 'bg-blue-50 border-blue-300',
      'confirmed': 'bg-green-50 border-green-300',
      'in_progress': 'bg-yellow-50 border-yellow-300',
      'awaiting_review': 'bg-purple-50 border-purple-300',
      'completed': 'bg-green-100 border-green-400',
      'cancelled': 'bg-red-50 border-red-300'
    };
    return colors[status] || 'bg-gray-100 border-gray-300';
  };
  
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Job Timeline</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Job Timeline</h3>
      
      <div className="space-y-4">
        {timeline.map((event, index) => (
          <div key={index} className="flex">
            {/* Timeline line */}
            <div className="flex flex-col items-center mr-4">
              <div className={`w-10 h-10 rounded-full border-2 ${getStatusColor(event.status)} flex items-center justify-center text-xl`}>
                {getStatusIcon(event.status)}
              </div>
              {index < timeline.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 flex-1 mt-2"></div>
              )}
            </div>
            
            {/* Event details */}
            <div className="flex-1 pb-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {event.description}
                  </p>
                  {event.user && (
                    <p className="text-sm text-gray-600">
                      by {event.user.name}
                    </p>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {format(new Date(event.timestamp), 'PPpp')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobTimeline;
```

#### Step 4: Integrate into Job Details Page

**File**: `frontend/src/pages/JobDetails.jsx` (update)

```javascript
import JobActions from '../components/jobs/JobActions';
import JobTimeline from '../components/jobs/JobTimeline';

const JobDetails = () => {
  const [job, setJob] = useState(null);
  
  // ... existing code ...
  
  const handleJobUpdate = (updatedJob) => {
    setJob(updatedJob);
    // Optionally refresh timeline
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Job details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Existing job details */}
          
          {/* Job Timeline */}
          <JobTimeline jobId={job.id} />
        </div>
        
        {/* Right column - Actions */}
        <div className="space-y-6">
          {/* Job Actions */}
          <JobActions 
            job={job} 
            onJobUpdate={handleJobUpdate}
          />
          
          {/* Existing sidebar content */}
        </div>
      </div>
    </div>
  );
};
```

---

### 2.4 Testing Job Lifecycle

#### Test Checklist

```bash
# Backend Tests
□ Status transition validation
□ Permission checks (cleaner vs client)
□ Timestamp recording
□ Signal emission
□ Notification creation
□ Refund on cancellation

# Frontend Tests
□ Start button (cleaner only)
□ Complete button (cleaner only)
□ Cancel button (both parties)
□ Cancel modal with reason
□ Timeline display
□ Real-time updates

# Integration Tests
□ Full lifecycle: pending → completed
□ Cancellation at each stage
□ Refund processing
□ Notification delivery
□ Timeline accuracy
```

#### Manual Test Flow

**As Cleaner**:
1. View job in "confirmed" status
2. Click "Start Job"
3. Verify status changes to "in_progress"
4. Verify client receives notification
5. Click "Mark as Complete"
6. Verify status changes to "awaiting_review"
7. Verify client receives notification

**As Client**:
1. View job in "awaiting_review" status
2. Submit review (Task 3)
3. Verify status changes to "completed"
4. Verify cleaner receives notification

**Cancellation Flow**:
1. Click "Cancel Job"
2. Enter cancellation reason
3. If payment made, verify refund initiated
4. Verify other party receives notification
5. Verify timeline shows cancellation

---

### 2.5 Update Payment Integration

**Important**: Update the payment confirmation to trigger status change.

**File**: `backend/payments/views.py` (update confirm method)

```python
@action(detail=True, methods=['post'])
def confirm(self, request, pk=None):
    """Confirm payment success"""
    payment = self.get_object()
    
    # ... existing validation ...
    
    try:
        intent = StripeService.retrieve_payment_intent(payment.stripe_payment_intent_id)
        
        if intent.status == 'succeeded':
            payment.status = 'succeeded'
            payment.paid_at = timezone.now()
            payment.stripe_charge_id = intent.charges.data[0].id if intent.charges.data else None
            payment.receipt_url = intent.charges.data[0].receipt_url if intent.charges.data else None
            payment.save()
            
            # Update job status using transition method ← ADD THIS
            payment.job.transition_to('confirmed', request.user)
            
            logger.info(f"Payment {payment.id} confirmed successfully")
            
            return Response({
                'status': 'success',
                'message': 'Payment confirmed',
                'receipt_url': payment.receipt_url,
            })
        # ... rest of method ...
```

---

## 📈 Task 2 Progress Tracker

**File**: `PHASE_1_PROGRESS.md` (update)

```markdown
## Week 2: Job Lifecycle

### Day 1
- [ ] Add timestamp fields to CleaningJob model
- [ ] Add transition validation method
- [ ] Add transition_to method
- [ ] Create migration

### Day 2
- [ ] Update job status signals
- [ ] Add notification creation
- [ ] Create job action serializers
- [ ] Create timeline serializer

### Day 3
- [ ] Add start endpoint
- [ ] Add complete endpoint
- [ ] Add cancel endpoint
- [ ] Add timeline endpoint

### Day 4
- [ ] Create job actions API service
- [ ] Create JobActions component
- [ ] Create cancel modal
- [ ] Handle refunds on cancellation

### Day 5
- [ ] Create JobTimeline component
- [ ] Integrate into job details page
- [ ] Test full lifecycle flow
- [ ] Fix bugs

### Weekend
- [ ] Test cancellation scenarios
- [ ] Test refund processing
- [ ] Update documentation
```

---

**Task 2 Complete!** ✅

---

## ⭐ TASK 3: Review & Rating System

**Estimated Time**: 4-6 hours  
**Priority**: HIGH  
**Status**: Not Started  
**Dependencies**: Task 2 (Job Lifecycle)

### 3.0 Review System Overview

**Goal**: Allow clients to review and rate cleaners after job completion.

**Features**:
- ⭐ 5-star rating system
- 📝 Written feedback
- 📸 Optional photo uploads
- 🔒 One review per job
- 📊 Aggregate ratings for cleaners
- 🏆 Display on cleaner profiles
- ✅ Auto-transition job to "completed" after review

**Review Flow**:
```
Job Status: awaiting_review
    ↓
Client clicks "Submit Review"
    ↓
Client fills form (rating + feedback)
    ↓
Review saved
    ↓
Job status → completed
    ↓
Cleaner receives notification
    ↓
Cleaner's aggregate rating updated
```

---

### 3.1 Backend: Create Review Models

#### Step 1: Check if JobReview Model Exists

**File**: `backend/cleaning_jobs/models.py`

First, check if `JobReview` model already exists. If not, we'll create it.

```bash
cd backend
docker-compose -f ../docker-compose.dev.yml exec backend bash
grep -n "class JobReview" cleaning_jobs/models.py
```

If model doesn't exist, proceed to Step 2.

#### Step 2: Create JobReview Model

**File**: `backend/cleaning_jobs/models.py` (add to bottom)

```python
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Avg

class JobReview(models.Model):
    """Review submitted by client after job completion"""
    
    job = models.OneToOneField(
        'CleaningJob',
        on_delete=models.CASCADE,
        related_name='review',
        help_text="The job being reviewed"
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_given',
        help_text="Client who submitted the review"
    )
    cleaner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews_received',
        help_text="Cleaner being reviewed"
    )
    
    # Rating & Feedback
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Rating from 1-5 stars"
    )
    feedback = models.TextField(
        help_text="Written feedback",
        blank=True
    )
    
    # Additional ratings (optional breakdown)
    quality_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Quality of work rating"
    )
    communication_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Communication rating"
    )
    punctuality_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Punctuality rating"
    )
    
    # Photos
    photo1 = models.ImageField(
        upload_to='reviews/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Review photo 1"
    )
    photo2 = models.ImageField(
        upload_to='reviews/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Review photo 2"
    )
    photo3 = models.ImageField(
        upload_to='reviews/%Y/%m/%d/',
        blank=True,
        null=True,
        help_text="Review photo 3"
    )
    
    # Metadata
    is_featured = models.BooleanField(
        default=False,
        help_text="Featured review (shown prominently)"
    )
    helpful_count = models.IntegerField(
        default=0,
        help_text="Number of users who found this helpful"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['cleaner', '-created_at']),
            models.Index(fields=['rating', '-created_at']),
            models.Index(fields=['-is_featured', '-created_at']),
        ]
    
    def __str__(self):
        return f"Review by {self.reviewer.get_full_name()} for {self.cleaner.get_full_name()} - {self.rating}⭐"
    
    def save(self, *args, **kwargs):
        """Override save to update cleaner's aggregate rating"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new:
            # Update cleaner's profile with new aggregate rating
            self.cleaner.update_rating()


class CleanerProfile(models.Model):
    """Extended profile for cleaners with ratings"""
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cleaner_profile'
    )
    
    # Aggregate ratings
    average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.00,
        help_text="Average rating from all reviews"
    )
    total_reviews = models.IntegerField(
        default=0,
        help_text="Total number of reviews"
    )
    
    # Rating breakdown
    five_star_count = models.IntegerField(default=0)
    four_star_count = models.IntegerField(default=0)
    three_star_count = models.IntegerField(default=0)
    two_star_count = models.IntegerField(default=0)
    one_star_count = models.IntegerField(default=0)
    
    # Additional metrics
    total_jobs_completed = models.IntegerField(default=0)
    response_time_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0.00,
        help_text="Average response time in hours"
    )
    
    # Bio
    bio = models.TextField(
        blank=True,
        help_text="Cleaner's bio/description"
    )
    years_experience = models.IntegerField(
        default=0,
        help_text="Years of cleaning experience"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-average_rating']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.average_rating}⭐ ({self.total_reviews} reviews)"
    
    def update_rating(self):
        """Recalculate aggregate rating from all reviews"""
        reviews = JobReview.objects.filter(cleaner=self.user)
        
        # Calculate average
        aggregate = reviews.aggregate(
            avg_rating=Avg('rating'),
            total_count=models.Count('id')
        )
        
        self.average_rating = aggregate['avg_rating'] or 0.00
        self.total_reviews = aggregate['total_count'] or 0
        
        # Calculate breakdown
        self.five_star_count = reviews.filter(rating=5).count()
        self.four_star_count = reviews.filter(rating=4).count()
        self.three_star_count = reviews.filter(rating=3).count()
        self.two_star_count = reviews.filter(rating=2).count()
        self.one_star_count = reviews.filter(rating=1).count()
        
        # Update completed jobs count
        self.total_jobs_completed = CleaningJob.objects.filter(
            cleaner=self.user,
            status='completed'
        ).count()
        
        self.save()
    
    def get_rating_percentage(self, stars):
        """Get percentage of reviews with given star rating"""
        if self.total_reviews == 0:
            return 0
        
        count_map = {
            5: self.five_star_count,
            4: self.four_star_count,
            3: self.three_star_count,
            2: self.two_star_count,
            1: self.one_star_count,
        }
        
        return round((count_map.get(stars, 0) / self.total_reviews) * 100, 1)


# Add method to User model (if not using custom user model, create signal)
# Add this to your User model or create a signal
def update_user_rating(user):
    """Update or create cleaner profile and recalculate rating"""
    profile, created = CleanerProfile.objects.get_or_create(user=user)
    profile.update_rating()
    return profile

# Monkey patch User model (or add to custom User model)
from django.contrib.auth import get_user_model
User = get_user_model()
User.update_rating = update_user_rating
```

#### Step 3: Create Migration

```bash
python manage.py makemigrations cleaning_jobs
python manage.py migrate cleaning_jobs
```

#### Step 4: Register Models in Admin

**File**: `backend/cleaning_jobs/admin.py` (add)

```python
from .models import JobReview, CleanerProfile

@admin.register(JobReview)
class JobReviewAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'job',
        'reviewer',
        'cleaner',
        'rating',
        'is_featured',
        'helpful_count',
        'created_at'
    ]
    list_filter = ['rating', 'is_featured', 'created_at']
    search_fields = [
        'reviewer__email',
        'reviewer__first_name',
        'reviewer__last_name',
        'cleaner__email',
        'cleaner__first_name',
        'cleaner__last_name',
        'feedback'
    ]
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Job & Participants', {
            'fields': ('job', 'reviewer', 'cleaner')
        }),
        ('Ratings', {
            'fields': (
                'rating',
                'quality_rating',
                'communication_rating',
                'punctuality_rating'
            )
        }),
        ('Feedback', {
            'fields': ('feedback',)
        }),
        ('Photos', {
            'fields': ('photo1', 'photo2', 'photo3'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('is_featured', 'helpful_count', 'created_at', 'updated_at')
        }),
    )


@admin.register(CleanerProfile)
class CleanerProfileAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'average_rating',
        'total_reviews',
        'total_jobs_completed',
        'years_experience',
        'created_at'
    ]
    list_filter = ['average_rating', 'years_experience']
    search_fields = [
        'user__email',
        'user__first_name',
        'user__last_name',
        'bio'
    ]
    readonly_fields = [
        'average_rating',
        'total_reviews',
        'five_star_count',
        'four_star_count',
        'three_star_count',
        'two_star_count',
        'one_star_count',
        'total_jobs_completed',
        'created_at',
        'updated_at'
    ]
    
    fieldsets = (
        ('User', {
            'fields': ('user',)
        }),
        ('Aggregate Ratings', {
            'fields': (
                'average_rating',
                'total_reviews',
                'five_star_count',
                'four_star_count',
                'three_star_count',
                'two_star_count',
                'one_star_count',
            )
        }),
        ('Metrics', {
            'fields': (
                'total_jobs_completed',
                'response_time_hours',
            )
        }),
        ('Profile Info', {
            'fields': ('bio', 'years_experience')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    actions = ['recalculate_ratings']
    
    def recalculate_ratings(self, request, queryset):
        """Admin action to recalculate ratings"""
        for profile in queryset:
            profile.update_rating()
        self.message_user(request, f"Recalculated ratings for {queryset.count()} profiles")
    recalculate_ratings.short_description = "Recalculate ratings"
```

---

### 3.2 Backend: Create Review Endpoints

#### Step 1: Create Review Serializers

**File**: `backend/cleaning_jobs/serializers.py` (add)

```python
from .models import JobReview, CleanerProfile

class JobReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.get_full_name', read_only=True)
    reviewer_avatar = serializers.SerializerMethodField()
    cleaner_name = serializers.CharField(source='cleaner.get_full_name', read_only=True)
    job_title = serializers.CharField(source='job.title', read_only=True)
    
    class Meta:
        model = JobReview
        fields = [
            'id',
            'job',
            'job_title',
            'reviewer',
            'reviewer_name',
            'reviewer_avatar',
            'cleaner',
            'cleaner_name',
            'rating',
            'quality_rating',
            'communication_rating',
            'punctuality_rating',
            'feedback',
            'photo1',
            'photo2',
            'photo3',
            'is_featured',
            'helpful_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'reviewer',
            'cleaner',
            'is_featured',
            'helpful_count',
            'created_at',
            'updated_at',
        ]
    
    def get_reviewer_avatar(self, obj):
        """Get reviewer avatar URL"""
        if hasattr(obj.reviewer, 'avatar') and obj.reviewer.avatar:
            return obj.reviewer.avatar.url
        return None
    
    def validate_job(self, value):
        """Validate that job can be reviewed"""
        # Check if job is in correct status
        if value.status != 'awaiting_review':
            raise serializers.ValidationError(
                "Job must be in 'awaiting_review' status to submit review"
            )
        
        # Check if review already exists
        if hasattr(value, 'review'):
            raise serializers.ValidationError(
                "Review already exists for this job"
            )
        
        return value
    
    def validate_rating(self, value):
        """Validate rating is between 1-5"""
        if value < 1 or value > 5:
            raise serializers.ValidationError("Rating must be between 1 and 5")
        return value
    
    def create(self, validated_data):
        """Create review and update job status"""
        # Get job and set reviewer/cleaner
        job = validated_data['job']
        validated_data['reviewer'] = self.context['request'].user
        validated_data['cleaner'] = job.cleaner
        
        # Create review
        review = super().create(validated_data)
        
        # Update job status to completed
        job.transition_to('completed', self.context['request'].user)
        
        return review


class CleanerProfileSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_avatar = serializers.SerializerMethodField()
    
    # Rating percentages
    rating_percentages = serializers.SerializerMethodField()
    
    # Recent reviews
    recent_reviews = serializers.SerializerMethodField()
    
    class Meta:
        model = CleanerProfile
        fields = [
            'id',
            'user',
            'user_name',
            'user_email',
            'user_avatar',
            'average_rating',
            'total_reviews',
            'five_star_count',
            'four_star_count',
            'three_star_count',
            'two_star_count',
            'one_star_count',
            'rating_percentages',
            'total_jobs_completed',
            'response_time_hours',
            'bio',
            'years_experience',
            'recent_reviews',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'average_rating',
            'total_reviews',
            'five_star_count',
            'four_star_count',
            'three_star_count',
            'two_star_count',
            'one_star_count',
            'total_jobs_completed',
            'created_at',
            'updated_at',
        ]
    
    def get_user_avatar(self, obj):
        """Get user avatar URL"""
        if hasattr(obj.user, 'avatar') and obj.user.avatar:
            return obj.user.avatar.url
        return None
    
    def get_rating_percentages(self, obj):
        """Get percentage breakdown of ratings"""
        return {
            '5': obj.get_rating_percentage(5),
            '4': obj.get_rating_percentage(4),
            '3': obj.get_rating_percentage(3),
            '2': obj.get_rating_percentage(2),
            '1': obj.get_rating_percentage(1),
        }
    
    def get_recent_reviews(self, obj):
        """Get 5 most recent reviews"""
        reviews = JobReview.objects.filter(cleaner=obj.user).order_by('-created_at')[:5]
        return JobReviewSerializer(reviews, many=True).data
```

#### Step 2: Create Review ViewSet

**File**: `backend/cleaning_jobs/views.py` (add)

```python
from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import JobReview, CleanerProfile
from .serializers import JobReviewSerializer, CleanerProfileSerializer

class JobReviewViewSet(viewsets.ModelViewSet):
    """ViewSet for job reviews"""
    serializer_class = JobReviewSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['cleaner', 'rating', 'is_featured']
    ordering_fields = ['created_at', 'rating', 'helpful_count']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter reviews based on user role"""
        user = self.request.user
        
        if self.action == 'list':
            # List all reviews (for browsing cleaner profiles)
            return JobReview.objects.all().select_related(
                'job', 'reviewer', 'cleaner'
            )
        
        # For detail/update/delete, only show reviews involving user
        return JobReview.objects.filter(
            models.Q(reviewer=user) | models.Q(cleaner=user)
        ).select_related('job', 'reviewer', 'cleaner')
    
    def perform_create(self, serializer):
        """Create review (client only)"""
        # Serializer handles validation and job status transition
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def mark_helpful(self, request, pk=None):
        """
        Mark review as helpful
        
        POST /api/reviews/{id}/mark_helpful/
        """
        review = self.get_object()
        review.helpful_count += 1
        review.save()
        
        return Response({
            'message': 'Marked as helpful',
            'helpful_count': review.helpful_count
        })


class CleanerProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for cleaner profiles (read-only public access)"""
    serializer_class = CleanerProfileSerializer
    permission_classes = [AllowAny]  # Public access to view cleaner profiles
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['years_experience']
    ordering_fields = ['average_rating', 'total_reviews', 'total_jobs_completed']
    ordering = ['-average_rating']
    search_fields = ['user__first_name', 'user__last_name', 'bio']
    
    def get_queryset(self):
        """Get all cleaner profiles"""
        return CleanerProfile.objects.all().select_related('user')
```

#### Step 3: Add URLs

**File**: `backend/cleaning_jobs/urls.py` (update)

```python
from rest_framework.routers import DefaultRouter
from .views import (
    CleaningJobViewSet,
    JobReviewViewSet,
    CleanerProfileViewSet,
)

router = DefaultRouter()
router.register(r'cleaning-jobs', CleaningJobViewSet, basename='cleaning-job')
router.register(r'reviews', JobReviewViewSet, basename='review')
router.register(r'cleaner-profiles', CleanerProfileViewSet, basename='cleaner-profile')

urlpatterns = router.urls
```

---

### 3.3 Frontend: Review Submission

#### Step 1: Create Review API Service

**File**: `frontend/src/services/reviewsAPI.js`

```javascript
import { api, apiCall } from './api';

export const reviewsAPI = {
  /**
   * Create a review for a job
   * @param {Object} reviewData - Review data
   * @returns {Promise<Object>}
   */
  create: async (reviewData) => {
    return apiCall(
      async () => {
        const formData = new FormData();
        
        // Add text fields
        formData.append('job', reviewData.job);
        formData.append('rating', reviewData.rating);
        formData.append('feedback', reviewData.feedback || '');
        
        // Add optional ratings
        if (reviewData.quality_rating) {
          formData.append('quality_rating', reviewData.quality_rating);
        }
        if (reviewData.communication_rating) {
          formData.append('communication_rating', reviewData.communication_rating);
        }
        if (reviewData.punctuality_rating) {
          formData.append('punctuality_rating', reviewData.punctuality_rating);
        }
        
        // Add photos
        if (reviewData.photo1) {
          formData.append('photo1', reviewData.photo1);
        }
        if (reviewData.photo2) {
          formData.append('photo2', reviewData.photo2);
        }
        if (reviewData.photo3) {
          formData.append('photo3', reviewData.photo3);
        }
        
        const response = await api.post('/reviews/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        return response.data;
      },
      {
        loadingKey: 'create_review',
        successMessage: 'Review submitted successfully!'
      }
    );
  },
  
  /**
   * Get reviews for a cleaner
   * @param {number} cleanerId - Cleaner user ID
   * @returns {Promise<Array>}
   */
  getByCleanerId: async (cleanerId) => {
    return apiCall(
      async () => {
        const response = await api.get('/reviews/', {
          params: { cleaner: cleanerId }
        });
        return response.data;
      },
      {
        loadingKey: `reviews_cleaner_${cleanerId}`,
        showSuccess: false
      }
    );
  },
  
  /**
   * Mark review as helpful
   * @param {number} reviewId - Review ID
   * @returns {Promise<Object>}
   */
  markHelpful: async (reviewId) => {
    return apiCall(
      async () => {
        const response = await api.post(`/reviews/${reviewId}/mark_helpful/`);
        return response.data;
      },
      {
        loadingKey: `mark_helpful_${reviewId}`,
        successMessage: 'Marked as helpful!'
      }
    );
  }
};
```

#### Step 2: Create Star Rating Component

**File**: `frontend/src/components/reviews/StarRating.jsx`

```javascript
import React from 'react';

const StarRating = ({ rating, onRatingChange, readonly = false, size = 'md' }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10'
  };
  
  const sizeClass = sizes[size] || sizes.md;
  
  const handleClick = (value) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value);
    }
  };
  
  return (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => handleClick(value)}
          disabled={readonly}
          className={`${sizeClass} ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'
          }`}
        >
          <svg
            className={`${sizeClass} ${
              value <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
};

export default StarRating;
```

#### Step 3: Create Review Form Component

**File**: `frontend/src/components/reviews/ReviewForm.jsx`

```javascript
import React, { useState } from 'react';
import StarRating from './StarRating';
import { reviewsAPI } from '../../services/reviewsAPI';
import { useToast } from '../../contexts/ToastContext';

const ReviewForm = ({ job, onSuccess, onCancel }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    rating: 0,
    quality_rating: 0,
    communication_rating: 0,
    punctuality_rating: 0,
    feedback: '',
    photo1: null,
    photo2: null,
    photo3: null,
  });
  const [photoPreviewsUrls, setPhotoPreviewUrls] = useState({
    photo1: null,
    photo2: null,
    photo3: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleRatingChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handlePhotoChange = (field, file) => {
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('File must be an image');
        return;
      }
      
      setFormData(prev => ({ ...prev, [field]: file }));
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviewUrls(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleRemovePhoto = (field) => {
    setFormData(prev => ({ ...prev, [field]: null }));
    setPhotoPreviewUrls(prev => ({ ...prev, [field]: null }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate overall rating
    if (formData.rating === 0) {
      toast.error('Please provide an overall rating');
      return;
    }
    
    // Validate feedback
    if (!formData.feedback.trim()) {
      toast.error('Please provide written feedback');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const reviewData = {
        job: job.id,
        ...formData
      };
      
      const review = await reviewsAPI.create(reviewData);
      onSuccess(review);
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Overall Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Overall Rating *
        </label>
        <StarRating
          rating={formData.rating}
          onRatingChange={(value) => handleRatingChange('rating', value)}
          size="xl"
        />
        {formData.rating > 0 && (
          <p className="text-sm text-gray-600 mt-1">
            {formData.rating} out of 5 stars
          </p>
        )}
      </div>
      
      {/* Detailed Ratings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quality of Work
          </label>
          <StarRating
            rating={formData.quality_rating}
            onRatingChange={(value) => handleRatingChange('quality_rating', value)}
            size="md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Communication
          </label>
          <StarRating
            rating={formData.communication_rating}
            onRatingChange={(value) => handleRatingChange('communication_rating', value)}
            size="md"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Punctuality
          </label>
          <StarRating
            rating={formData.punctuality_rating}
            onRatingChange={(value) => handleRatingChange('punctuality_rating', value)}
            size="md"
          />
        </div>
      </div>
      
      {/* Written Feedback */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Feedback *
        </label>
        <textarea
          value={formData.feedback}
          onChange={(e) => setFormData(prev => ({ ...prev, feedback: e.target.value }))}
          rows={6}
          placeholder="Share your experience with this cleaner..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <p className="text-sm text-gray-500 mt-1">
          {formData.feedback.length} characters
        </p>
      </div>
      
      {/* Photo Uploads */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photos (Optional)
        </label>
        <p className="text-sm text-gray-500 mb-3">
          Upload up to 3 photos of the completed work
        </p>
        
        <div className="grid grid-cols-3 gap-4">
          {['photo1', 'photo2', 'photo3'].map((field, index) => (
            <div key={field}>
              {photoPreviewUrls[field] ? (
                <div className="relative">
                  <img
                    src={photoPreviewUrls[field]}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(field)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="block w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoChange(field, e.target.files[0])}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm">Upload</span>
                  </div>
                </label>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Submit Buttons */}
      <div className="flex space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          disabled={isSubmitting}
        >
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={isSubmitting || formData.rating === 0 || !formData.feedback.trim()}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
};

export default ReviewForm;
```

#### Step 4: Create Review Modal

**File**: `frontend/src/components/reviews/ReviewModal.jsx`

```javascript
import React from 'react';
import ReviewForm from './ReviewForm';

const ReviewModal = ({ isOpen, onClose, job, onSuccess }) => {
  if (!isOpen) return null;
  
  const handleSuccess = (review) => {
    onSuccess(review);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Review Your Experience
            </h2>
            <p className="text-gray-600 mt-2">
              Job: {job.title} • Cleaner: {job.cleaner.first_name} {job.cleaner.last_name}
            </p>
          </div>
          
          {/* Review Form */}
          <ReviewForm
            job={job}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
```

#### Step 5: Integrate into Job Details Page

**File**: `frontend/src/pages/JobDetails.jsx` (update)

```javascript
import { useState } from 'react';
import ReviewModal from '../components/reviews/ReviewModal';

const JobDetails = () => {
  const [job, setJob] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  // ... existing code ...
  
  const handleReviewSuccess = (review) => {
    console.log('Review submitted:', review);
    // Refresh job details
    fetchJobDetails();
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Existing job details */}
          
          {/* Show review prompt if awaiting review */}
          {job.status === 'awaiting_review' && job.client.id === user.id && !job.review && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                📝 Review Needed
              </h3>
              <p className="text-yellow-800 mb-4">
                {job.cleaner.first_name} has completed the work. Please submit a review to finalize this job.
              </p>
              <button
                onClick={() => setShowReviewModal(true)}
                className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
              >
                Submit Review
              </button>
            </div>
          )}
          
          {/* Show review if completed */}
          {job.review && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Your Review
              </h3>
              <StarRating rating={job.review.rating} readonly size="lg" />
              <p className="text-gray-700 mt-4">{job.review.feedback}</p>
              {/* Show photos if any */}
            </div>
          )}
        </div>
      </div>
      
      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        job={job}
        onSuccess={handleReviewSuccess}
      />
    </div>
  );
};
```

---

### 3.4 Frontend: Display Reviews on Cleaner Profile

#### Step 1: Create Review Display Component

**File**: `frontend/src/components/reviews/ReviewCard.jsx`

```javascript
import React from 'react';
import StarRating from './StarRating';
import { formatDistanceToNow } from 'date-fns';

const ReviewCard = ({ review, onMarkHelpful }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {/* Reviewer Avatar */}
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
            {review.reviewer_avatar ? (
              <img
                src={review.reviewer_avatar}
                alt={review.reviewer_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <span className="text-xl font-semibold text-gray-600">
                {review.reviewer_name.charAt(0)}
              </span>
            )}
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900">
              {review.reviewer_name}
            </h4>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        
        {/* Rating */}
        <StarRating rating={review.rating} readonly size="sm" />
      </div>
      
      {/* Job Title */}
      {review.job_title && (
        <p className="text-sm text-gray-600 mb-3">
          Job: {review.job_title}
        </p>
      )}
      
      {/* Detailed Ratings */}
      {(review.quality_rating || review.communication_rating || review.punctuality_rating) && (
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          {review.quality_rating && (
            <div>
              <span className="text-gray-600">Quality:</span>
              <StarRating rating={review.quality_rating} readonly size="sm" />
            </div>
          )}
          {review.communication_rating && (
            <div>
              <span className="text-gray-600">Communication:</span>
              <StarRating rating={review.communication_rating} readonly size="sm" />
            </div>
          )}
          {review.punctuality_rating && (
            <div>
              <span className="text-gray-600">Punctuality:</span>
              <StarRating rating={review.punctuality_rating} readonly size="sm" />
            </div>
          )}
        </div>
      )}
      
      {/* Feedback */}
      <p className="text-gray-700 mb-4">{review.feedback}</p>
      
      {/* Photos */}
      {(review.photo1 || review.photo2 || review.photo3) && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[review.photo1, review.photo2, review.photo3]
            .filter(Boolean)
            .map((photo, index) => (
              <img
                key={index}
                src={photo}
                alt={`Review photo ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                onClick={() => window.open(photo, '_blank')}
              />
            ))}
        </div>
      )}
      
      {/* Helpful Button */}
      <div className="flex items-center space-x-4 pt-4 border-t">
        <button
          onClick={() => onMarkHelpful(review.id)}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-blue-600 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span>Helpful ({review.helpful_count})</span>
        </button>
      </div>
    </div>
  );
};

export default ReviewCard;
```

---

### 3.5 Testing Review System

#### Test Checklist

```bash
# Backend Tests
□ Review creation with validation
□ Job status transition after review
□ Aggregate rating calculation
□ Review permissions (client only)
□ Photo upload handling
□ CleanerProfile auto-creation

# Frontend Tests
□ Star rating interaction
□ Review form validation
□ Photo upload preview
□ Review modal open/close
□ Review submission
□ Review display on cleaner profile

# Integration Tests
□ Full flow: complete job → submit review → job status updated
□ Cleaner receives notification
□ Aggregate rating updates immediately
□ Review appears on cleaner profile
□ Photos display correctly
```

---

## 📈 Task 3 Progress Tracker

**File**: `PHASE_1_PROGRESS.md` (update)

```markdown
## Week 2 (cont.): Review System

### Day 6
- [ ] Create JobReview model
- [ ] Create CleanerProfile model
- [ ] Create migrations
- [ ] Register in admin

### Day 7
- [ ] Create review serializers
- [ ] Create review viewset
- [ ] Create cleaner profile viewset
- [ ] Add URLs

### Weekend
- [ ] Create StarRating component
- [ ] Create ReviewForm component
- [ ] Create ReviewModal component
- [ ] Create ReviewCard component
- [ ] Integrate into job details
- [ ] Test full review flow
```

---

**Task 3 Complete!** ✅

---

## 📱 TASK 4: Mobile Responsiveness & UI Polish

**Estimated Time**: 8-10 hours  
**Priority**: HIGH  
**Status**: Not Started  
**Dependencies**: Tasks 1-3 (all core features)

### 4.0 Mobile Responsiveness Overview

**Goal**: Make the application fully functional and beautiful on mobile devices.

**Target Devices**:
- 📱 **iPhone SE** (375px width) - Smallest modern iPhone
- 📱 **iPhone 12/13/14** (390px width) - Standard iPhone
- 📱 **iPhone Pro Max** (428px width) - Large iPhone
- 📱 **Android (small)** (360px width) - Galaxy S10/S20
- 📱 **Android (medium)** (393px width) - Pixel 5/6
- 📱 **iPad** (768px width) - Tablet
- 💻 **Desktop** (1024px+) - Laptop/Desktop

**Tailwind Breakpoints**:
```javascript
sm: '640px',   // Small tablets
md: '768px',   // Tablets
lg: '1024px',  // Small laptops
xl: '1280px',  // Desktops
2xl: '1536px'  // Large desktops
```

**Key Focus Areas**:
1. ✅ Navigation (hamburger menu)
2. ✅ Chat interface (mobile-optimized)
3. ✅ Forms (touch-friendly)
4. ✅ Job listings (card layout)
5. ✅ Job details (scrollable)
6. ✅ Payment forms (mobile-safe)
7. ✅ Review system (touch inputs)

---

### 4.1 Mobile Navigation

#### Step 1: Create Mobile Menu Component

**File**: `frontend/src/components/Navigation/MobileMenu.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useUnifiedChat } from '../../contexts/UnifiedChatContext';

const MobileMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { unreadCount } = useUnifiedChat();
  
  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);
  
  // Prevent body scroll when menu is open
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
  
  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsOpen(false);
  };
  
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/jobs', label: 'Browse Jobs', icon: '🔍' },
    { path: '/my-jobs', label: 'My Jobs', icon: '📋' },
    { path: '/chat', label: 'Messages', icon: '💬', badge: unreadCount },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];
  
  if (!user) return null;
  
  return (
    <>
      {/* Mobile Menu Button (visible on small screens only) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-lg shadow-lg hover:shadow-xl transition"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          // Close icon
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Hamburger icon with badge
          <div className="relative">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        )}
      </button>
      
      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Slide-in Menu */}
          <div className="lg:hidden fixed inset-y-0 right-0 w-80 max-w-full bg-white z-50 shadow-2xl transform transition-transform">
            {/* Menu Header */}
            <div className="bg-blue-600 text-white p-6">
              <div className="flex items-center space-x-3">
                {/* User Avatar */}
                <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.first_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold">
                      {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                    </span>
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-sm text-blue-100">{user.email}</p>
                </div>
              </div>
            </div>
            
            {/* Menu Items */}
            <nav className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg transition ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        
                        {item.badge > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 font-bold">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              
              {/* Divider */}
              <hr className="my-4 border-gray-200" />
              
              {/* Secondary Actions */}
              <ul className="space-y-2">
                <li>
                  <Link
                    to="/settings"
                    className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    <span className="text-2xl">⚙️</span>
                    <span>Settings</span>
                  </Link>
                </li>
                
                <li>
                  <Link
                    to="/help"
                    className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    <span className="text-2xl">❓</span>
                    <span>Help & Support</span>
                  </Link>
                </li>
                
                <li>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <span className="text-2xl">🚪</span>
                    <span>Logout</span>
                  </button>
                </li>
              </ul>
            </nav>
            
            {/* Menu Footer */}
            <div className="p-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                E-Clean v1.0 • Phase 1
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileMenu;
```

#### Step 2: Update Main Navigation

**File**: `frontend/src/components/Navigation/Navigation.jsx` (update)

```javascript
import MobileMenu from './MobileMenu';

const Navigation = () => {
  const { user } = useUser();
  
  return (
    <>
      {/* Desktop Navigation (hidden on mobile) */}
      <nav className="hidden lg:block bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl">🧹</span>
              <span className="text-xl font-bold text-blue-600">E-Clean</span>
            </Link>
            
            {/* Desktop Nav Items */}
            {user && (
              <div className="flex items-center space-x-6">
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
                <Link to="/jobs" className="nav-link">Browse Jobs</Link>
                <Link to="/my-jobs" className="nav-link">My Jobs</Link>
                <Link to="/chat" className="nav-link">Messages</Link>
                <Link to="/profile" className="nav-link">Profile</Link>
              </div>
            )}
          </div>
        </div>
      </nav>
      
      {/* Mobile Navigation */}
      <MobileMenu />
      
      {/* Mobile Header (shows logo on small screens) */}
      <div className="lg:hidden bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-2xl">🧹</span>
              <span className="text-xl font-bold text-blue-600">E-Clean</span>
            </Link>
            
            {/* Space for hamburger button (rendered by MobileMenu) */}
            <div className="w-10" />
          </div>
        </div>
      </div>
    </>
  );
};

export default Navigation;
```

---

### 4.2 Mobile-Optimized Chat Interface

#### Step 1: Update FloatingChatPanel for Mobile

**File**: `frontend/src/components/chat/FloatingChatPanel.jsx` (update)

Add mobile responsiveness:

```javascript
const FloatingChatPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Detect mobile screen
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // On mobile, chat takes full screen
  if (isMobile && isOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        {/* Mobile Header */}
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Messages</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-blue-700 rounded-lg transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Full-screen chat */}
        <div className="h-[calc(100vh-60px)]">
          <ChatList onSelectRoom={handleSelectRoom} />
        </div>
      </div>
    );
  }
  
  // Desktop floating panel (existing code)
  return (
    <div className={`hidden lg:block fixed bottom-0 right-4 w-96 bg-white shadow-2xl rounded-t-lg transition-transform ${
      isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-56px)]'
    }`}>
      {/* ... existing desktop chat code ... */}
    </div>
  );
};
```

#### Step 2: Mobile ChatRoom Component

**File**: `frontend/src/components/chat/ChatRoom.jsx` (update for mobile)

```javascript
const ChatRoom = ({ roomId, onClose }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div className={`flex flex-col ${isMobile ? 'h-screen' : 'h-[600px]'}`}>
      {/* Header */}
      <div className={`bg-blue-600 text-white ${isMobile ? 'px-4 py-4' : 'px-6 py-4'} flex items-center justify-between`}>
        <div className="flex items-center space-x-3">
          {isMobile && (
            <button
              onClick={onClose}
              className="mr-2 p-1 hover:bg-blue-700 rounded-lg transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
            <span className="text-lg font-bold">👤</span>
          </div>
          
          <div>
            <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>
              {otherUser?.name}
            </h3>
            <p className="text-xs text-blue-100">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        
        {!isMobile && (
          <button onClick={onClose} className="hover:bg-blue-700 p-2 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Messages Container */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-3' : 'p-4'} bg-gray-50`}>
        <InfiniteScrollMessages
          roomId={roomId}
          messageSize={isMobile ? 'sm' : 'md'}
        />
      </div>
      
      {/* Input */}
      <div className={`border-t bg-white ${isMobile ? 'p-3' : 'p-4'}`}>
        <MessageInput
          roomId={roomId}
          placeholder="Type a message..."
          size={isMobile ? 'sm' : 'md'}
        />
      </div>
    </div>
  );
};
```

---

### 4.3 Touch-Friendly Forms

#### Step 1: Create Mobile-Optimized Input Component

**File**: `frontend/src/components/forms/MobileInput.jsx`

```javascript
import React from 'react';

const MobileInput = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  required = false,
  error,
  icon,
  ...props
}) => {
  return (
    <div className="mb-4">
      {label && (
        <label
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="text-gray-400 text-xl">{icon}</span>
          </div>
        )}
        
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`
            w-full
            ${icon ? 'pl-12' : 'pl-4'}
            pr-4
            py-4
            text-base
            border
            ${error ? 'border-red-500' : 'border-gray-300'}
            rounded-lg
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500
            focus:border-transparent
            transition
            touch-manipulation
          `}
          style={{ fontSize: '16px' }} // Prevent iOS zoom on focus
          {...props}
        />
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default MobileInput;
```

#### Step 2: Create Mobile-Optimized Button

**File**: `frontend/src/components/forms/MobileButton.jsx`

```javascript
import React from 'react';

const MobileButton = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  ...props
}) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
    success: 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 active:bg-blue-100',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        rounded-lg
        font-semibold
        transition
        disabled:opacity-50
        disabled:cursor-not-allowed
        active:scale-95
        touch-manipulation
        flex
        items-center
        justify-center
        space-x-2
      `}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon && <span>{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export default MobileButton;
```

#### Step 3: Update Job Creation Form for Mobile

**File**: `frontend/src/pages/CreateJob.jsx` (update for mobile)

```javascript
import MobileInput from '../components/forms/MobileInput';
import MobileButton from '../components/forms/MobileButton';

const CreateJob = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  return (
    <div className={`${isMobile ? 'min-h-screen bg-gray-50' : 'container mx-auto px-4 py-8'}`}>
      <div className={`${isMobile ? '' : 'max-w-2xl mx-auto'} bg-white ${isMobile ? '' : 'rounded-lg shadow-lg'} ${isMobile ? 'min-h-screen' : 'p-8'}`}>
        {/* Header */}
        <div className={`${isMobile ? 'sticky top-0 bg-white z-10 px-4 py-4 border-b' : 'mb-6'}`}>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>
            Post a Cleaning Job
          </h1>
          <p className="text-gray-600 mt-2">
            Fill in the details below to get started
          </p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className={isMobile ? 'p-4' : ''}>
          <MobileInput
            label="Job Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Deep clean 3-bedroom apartment"
            required
            icon="📝"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Description
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={isMobile ? 6 : 8}
              placeholder="Describe what needs to be cleaned..."
              className="w-full px-4 py-4 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
              style={{ fontSize: '16px' }} // Prevent iOS zoom
              required
            />
          </div>
          
          <MobileInput
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="City or postal code"
            required
            icon="📍"
          />
          
          <MobileInput
            label="Scheduled Date"
            name="scheduled_date"
            type="datetime-local"
            value={formData.scheduled_date}
            onChange={handleChange}
            required
            icon="📅"
          />
          
          {/* Submit Buttons */}
          <div className={`${isMobile ? 'fixed bottom-0 left-0 right-0 bg-white border-t p-4' : 'mt-8'} space-y-3`}>
            <MobileButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              icon="✓"
            >
              Post Job
            </MobileButton>
            
            <MobileButton
              type="button"
              variant="outline"
              size="lg"
              fullWidth
              onClick={() => navigate('/jobs')}
              disabled={isSubmitting}
            >
              Cancel
            </MobileButton>
          </div>
          
          {/* Add bottom padding on mobile to account for fixed buttons */}
          {isMobile && <div className="h-32" />}
        </form>
      </div>
    </div>
  );
};
```

---

### 4.4 Responsive Job Listings

#### Step 1: Update JobCard for Mobile

**File**: `frontend/src/components/jobs/JobCard.jsx` (update)

```javascript
const JobCard = ({ job }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  if (isMobile) {
    // Mobile compact card
    return (
      <Link
        to={`/jobs/${job.id}`}
        className="block bg-white border border-gray-200 rounded-lg p-4 mb-3 active:bg-gray-50 transition touch-manipulation"
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-2">
            {job.title}
          </h3>
          <span className="text-lg font-bold text-blue-600 whitespace-nowrap">
            ${job.budget}
          </span>
        </div>
        
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {job.description}
        </p>
        
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
            📍 {job.location}
          </span>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
            📅 {formatDate(job.scheduled_date)}
          </span>
          <span className={`px-2 py-1 rounded ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
        </div>
      </Link>
    );
  }
  
  // Desktop card (existing code)
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition"
    >
      {/* ... existing desktop layout ... */}
    </Link>
  );
};
```

#### Step 2: Update Job List Grid

**File**: `frontend/src/pages/JobsList.jsx` (update)

```javascript
const JobsList = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile: No container padding */}
      <div className="lg:container lg:mx-auto lg:px-4 py-4 lg:py-8">
        {/* Header */}
        <div className="px-4 lg:px-0 mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            Browse Jobs
          </h1>
          <p className="text-gray-600">
            {jobs.length} jobs available
          </p>
        </div>
        
        {/* Filters - Horizontal scroll on mobile */}
        <div className="mb-6 overflow-x-auto px-4 lg:px-0">
          <div className="flex space-x-2 lg:space-x-4 pb-2">
            <FilterButton active>All</FilterButton>
            <FilterButton>Pending</FilterButton>
            <FilterButton>In Progress</FilterButton>
            <FilterButton>Completed</FilterButton>
          </div>
        </div>
        
        {/* Job Grid */}
        <div className="px-4 lg:px-0">
          {/* Mobile: Single column, Desktop: Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

### 4.5 Responsive Payment Form

#### Step 1: Update PaymentForm for Mobile

**File**: `frontend/src/components/payments/PaymentForm.jsx` (update)

```javascript
const PaymentFormContent = ({ jobId, amount, onSuccess, onCancel }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Amount Summary - Sticky on mobile */}
      <div className={`${isMobile ? 'sticky top-0 bg-white z-10 -mx-6 px-6 py-4 border-b' : ''}`}>
        <h3 className="text-lg font-semibold mb-2">Payment Summary</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Total Amount:</span>
            <span className="text-2xl font-bold text-blue-600">
              ${amount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Payment Element - Optimized for touch */}
      <div className={isMobile ? 'px-1' : ''}>
        <PaymentElement
          options={{
            layout: {
              type: 'accordion',
              defaultCollapsed: false,
              radios: true,
              spacedAccordionItems: true
            }
          }}
        />
      </div>
      
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}
      
      {/* Action Buttons - Fixed on mobile */}
      <div className={`${isMobile ? 'fixed bottom-0 left-0 right-0 bg-white border-t p-4' : ''} flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3`}>
        <MobileButton
          type="button"
          onClick={onCancel}
          variant="secondary"
          size="lg"
          fullWidth
          disabled={isProcessing}
        >
          Cancel
        </MobileButton>
        
        <MobileButton
          type="submit"
          disabled={!stripe || isProcessing}
          variant="primary"
          size="lg"
          fullWidth
          loading={isProcessing}
          icon="💳"
        >
          Pay ${amount.toFixed(2)}
        </MobileButton>
      </div>
      
      {/* Bottom padding on mobile for fixed buttons */}
      {isMobile && <div className="h-24" />}
    </form>
  );
};
```

---

### 4.6 Responsive Review Form

#### Step 1: Update ReviewForm for Mobile

**File**: `frontend/src/components/reviews/ReviewForm.jsx` (update)

```javascript
const ReviewForm = ({ job, onSuccess, onCancel }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Overall Rating - Larger on mobile */}
      <div className={isMobile ? 'text-center' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Overall Rating *
        </label>
        <div className="flex justify-center">
          <StarRating
            rating={formData.rating}
            onRatingChange={(value) => handleRatingChange('rating', value)}
            size={isMobile ? 'xl' : 'lg'}
          />
        </div>
        {formData.rating > 0 && (
          <p className={`text-sm text-gray-600 mt-2 ${isMobile ? 'text-center' : ''}`}>
            {formData.rating} out of 5 stars
          </p>
        )}
      </div>
      
      {/* Detailed Ratings - Stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={isMobile ? 'text-center' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quality
          </label>
          <div className="flex justify-center">
            <StarRating
              rating={formData.quality_rating}
              onRatingChange={(value) => handleRatingChange('quality_rating', value)}
              size="md"
            />
          </div>
        </div>
        
        <div className={isMobile ? 'text-center' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Communication
          </label>
          <div className="flex justify-center">
            <StarRating
              rating={formData.communication_rating}
              onRatingChange={(value) => handleRatingChange('communication_rating', value)}
              size="md"
            />
          </div>
        </div>
        
        <div className={isMobile ? 'text-center' : ''}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Punctuality
          </label>
          <div className="flex justify-center">
            <StarRating
              rating={formData.punctuality_rating}
              onRatingChange={(value) => handleRatingChange('punctuality_rating', value)}
              size="md"
            />
          </div>
        </div>
      </div>
      
      {/* Feedback - Taller on mobile */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Feedback *
        </label>
        <textarea
          value={formData.feedback}
          onChange={(e) => setFormData(prev => ({ ...prev, feedback: e.target.value }))}
          rows={isMobile ? 8 : 6}
          placeholder="Share your experience..."
          className="w-full px-4 py-4 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
          style={{ fontSize: '16px' }}
          required
        />
      </div>
      
      {/* Photo Upload - Larger touch targets on mobile */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photos (Optional)
        </label>
        <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3'} gap-3`}>
          {['photo1', 'photo2', 'photo3'].slice(0, isMobile ? 2 : 3).map((field, index) => (
            <div key={field}>
              {photoPreviewUrls[field] ? (
                <div className="relative">
                  <img
                    src={photoPreviewUrls[field]}
                    alt={`Preview ${index + 1}`}
                    className={`w-full ${isMobile ? 'h-40' : 'h-32'} object-cover rounded-lg`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(field)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 active:scale-95 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className={`block w-full ${isMobile ? 'h-40' : 'h-32'} border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 active:bg-blue-50 transition touch-manipulation`}>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment" // Use camera on mobile
                    onChange={(e) => handlePhotoChange(field, e.target.files[0])}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <svg className={`${isMobile ? 'w-12 h-12' : 'w-8 h-8'} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className={`${isMobile ? 'text-base' : 'text-sm'}`}>
                      {isMobile ? 'Add Photo' : 'Upload'}
                    </span>
                  </div>
                </label>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Submit Buttons - Fixed on mobile */}
      <div className={`${isMobile ? 'fixed bottom-0 left-0 right-0 bg-white border-t p-4' : 'pt-4 border-t'} flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3`}>
        <MobileButton
          type="button"
          onClick={onCancel}
          variant="secondary"
          size="lg"
          fullWidth
          disabled={isSubmitting}
        >
          Cancel
        </MobileButton>
        
        <MobileButton
          type="submit"
          disabled={isSubmitting || formData.rating === 0 || !formData.feedback.trim()}
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          icon="✓"
        >
          Submit Review
        </MobileButton>
      </div>
      
      {/* Bottom padding on mobile */}
      {isMobile && <div className="h-24" />}
    </form>
  );
};
```

---

### 4.7 Performance Optimization

#### Step 1: Add Image Optimization

**File**: `frontend/src/utils/imageOptimization.js`

```javascript
/**
 * Compress and resize image before upload
 * @param {File} file - Image file
 * @param {Object} options - Compression options
 * @returns {Promise<File>} - Compressed file
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    type = 'image/jpeg'
  } = options;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          },
          type,
          quality
        );
      };
      
      img.onerror = reject;
    };
    
    reader.onerror = reject;
  });
};

/**
 * Generate thumbnail from image
 * @param {File} file - Image file
 * @returns {Promise<string>} - Data URL of thumbnail
 */
export const generateThumbnail = async (file, size = 150) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        
        // Calculate crop dimensions (square crop from center)
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      
      img.onerror = reject;
    };
    
    reader.onerror = reject;
  });
};
```

#### Step 2: Add Lazy Loading for Images

**File**: `frontend/src/components/common/LazyImage.jsx`

```javascript
import React, { useState, useEffect, useRef } from 'react';

const LazyImage = ({ src, alt, className, placeholder }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, []);
  
  return (
    <div ref={imgRef} className={`${className} relative bg-gray-200`}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">
            {placeholder || '📷'}
          </div>
        </div>
      )}
      
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
        />
      )}
    </div>
  );
};

export default LazyImage;
```

---

### 4.8 Testing Mobile Responsiveness

#### Test Checklist

```bash
# Responsive Design Tests
□ Test on iPhone SE (375px)
□ Test on iPhone 12/13 (390px)
□ Test on iPhone Pro Max (428px)
□ Test on Android small (360px)
□ Test on Android medium (393px)
□ Test on iPad (768px)
□ Test on Desktop (1024px+)

# Navigation Tests
□ Hamburger menu opens/closes
□ Menu animations smooth
□ Unread badge visible
□ Menu items clickable
□ Menu closes on navigation

# Form Tests
□ Inputs don't zoom on iOS
□ Touch targets >= 44px
□ Fixed buttons don't overlap
□ Keyboard doesn't break layout
□ Date pickers work on mobile

# Chat Tests
□ Full-screen on mobile
□ Back button works
□ Messages scrollable
□ Input accessible with keyboard
□ Emoji picker works

# Performance Tests
□ Images load lazily
□ Page load < 3 seconds
□ Smooth scrolling
□ No layout shifts
□ Touch responses immediate
```

#### Manual Testing Procedure

**Chrome DevTools**:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device preset or custom dimensions
4. Test portrait and landscape
5. Throttle network to "Fast 3G"
6. Test all user flows

**Real Device Testing**:
1. Use ngrok or similar for HTTPS
2. Test on actual iPhone
3. Test on actual Android
4. Check Safari-specific issues
5. Check Chrome mobile issues

---

## 📈 Task 4 Progress Tracker

**File**: `PHASE_1_PROGRESS.md` (update)

```markdown
## Week 3: Mobile & UI Polish

### Day 1
- [ ] Create MobileMenu component
- [ ] Update Navigation for mobile
- [ ] Test hamburger menu
- [ ] Fix navigation issues

### Day 2
- [ ] Update FloatingChatPanel for mobile
- [ ] Update ChatRoom for mobile
- [ ] Test full-screen chat
- [ ] Fix chat layout issues

### Day 3
- [ ] Create MobileInput component
- [ ] Create MobileButton component
- [ ] Update CreateJob form
- [ ] Test form inputs on mobile

### Day 4
- [ ] Update JobCard for mobile
- [ ] Update JobsList grid
- [ ] Update PaymentForm for mobile
- [ ] Test responsive layouts

### Day 5
- [ ] Update ReviewForm for mobile
- [ ] Add image optimization utils
- [ ] Add lazy loading component
- [ ] Test performance

### Weekend
- [ ] Test on real devices
- [ ] Fix iOS-specific issues
- [ ] Fix Android-specific issues
- [ ] Polish animations
- [ ] Update documentation
```

---

**Task 4 Complete!** ✅

This comprehensive mobile guide covers:
- ✅ Mobile navigation with hamburger menu
- ✅ Full-screen mobile chat
- ✅ Touch-friendly forms (44px+ targets)
- ✅ Responsive job cards
- ✅ Mobile-optimized payment
- ✅ Mobile-optimized reviews
- ✅ Image optimization
- ✅ Lazy loading
- ✅ Performance optimization
- ✅ iOS/Android compatibility

---

## 🔧 TASK 5: Admin Dashboard Enhancements

**Estimated Time**: 4-6 hours  
**Priority**: MEDIUM  
**Status**: Not Started  
**Dependencies**: Tasks 1-4 (core features complete)

### 5.0 Admin Dashboard Overview

**Goal**: Create comprehensive admin interface for managing the platform.

**Admin Capabilities**:
- 👥 **User Management**: View, edit, block, approve users
- 📋 **Job Management**: Monitor all jobs, handle disputes
- 💳 **Payment Management**: View transactions, process refunds
- 📊 **Analytics**: Platform metrics and insights
- ⚙️ **Settings**: Configure platform parameters

**Access Control**:
- Only users with `is_staff` or `is_superuser` can access
- Role-based permissions (superuser has all permissions)

---

### 5.1 Backend: Admin Enhancements

#### Step 1: Update User Admin

**File**: `backend/users/admin.py` (enhance existing)

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from django.db.models import Q, Count, Avg
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = [
        'id',
        'email',
        'first_name',
        'last_name',
        'user_type',
        'is_active',
        'is_verified',
        'date_joined',
        'jobs_count',
        'rating_display'
    ]
    list_filter = [
        'user_type',
        'is_active',
        'is_verified',
        'is_staff',
        'is_superuser',
        'date_joined'
    ]
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    ordering = ['-date_joined']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('email', 'first_name', 'last_name', 'phone')
        }),
        ('User Type', {
            'fields': ('user_type',)
        }),
        ('Profile', {
            'fields': ('avatar', 'bio', 'address', 'city', 'postal_code')
        }),
        ('Status', {
            'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser')
        }),
        ('Permissions', {
            'fields': ('groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
        ('Dates', {
            'fields': ('date_joined', 'last_login'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['date_joined', 'last_login']
    
    actions = [
        'mark_as_verified',
        'mark_as_unverified',
        'block_users',
        'unblock_users'
    ]
    
    def get_queryset(self, request):
        """Optimize queryset with annotations"""
        qs = super().get_queryset(request)
        return qs.annotate(
            jobs_total=Count('client_jobs') + Count('cleaner_jobs'),
            avg_rating=Avg('reviews_received__rating')
        )
    
    def jobs_count(self, obj):
        """Display total jobs (as client + as cleaner)"""
        return obj.jobs_total or 0
    jobs_count.short_description = 'Total Jobs'
    jobs_count.admin_order_field = 'jobs_total'
    
    def rating_display(self, obj):
        """Display average rating with stars"""
        if obj.avg_rating:
            stars = '⭐' * round(obj.avg_rating)
            return format_html(
                '<span title="{:.2f}">{}</span>',
                obj.avg_rating,
                stars
            )
        return '-'
    rating_display.short_description = 'Rating'
    rating_display.admin_order_field = 'avg_rating'
    
    def mark_as_verified(self, request, queryset):
        """Bulk verify users"""
        updated = queryset.update(is_verified=True)
        self.message_user(request, f'{updated} users marked as verified')
    mark_as_verified.short_description = 'Mark as verified'
    
    def mark_as_unverified(self, request, queryset):
        """Bulk unverify users"""
        updated = queryset.update(is_verified=False)
        self.message_user(request, f'{updated} users marked as unverified')
    mark_as_unverified.short_description = 'Mark as unverified'
    
    def block_users(self, request, queryset):
        """Bulk block users"""
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} users blocked')
    block_users.short_description = 'Block users'
    
    def unblock_users(self, request, queryset):
        """Bulk unblock users"""
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} users unblocked')
    unblock_users.short_description = 'Unblock users'
```

#### Step 2: Enhanced CleaningJob Admin

**File**: `backend/cleaning_jobs/admin.py` (enhance existing)

```python
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.db.models import Q
from .models import CleaningJob

@admin.register(CleaningJob)
class CleaningJobAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'title_link',
        'client_link',
        'cleaner_link',
        'status_badge',
        'budget_display',
        'scheduled_date',
        'created_at',
        'payment_status'
    ]
    list_filter = [
        'status',
        'created_at',
        'scheduled_date',
        'is_recurring'
    ]
    search_fields = [
        'title',
        'description',
        'client__email',
        'client__first_name',
        'client__last_name',
        'cleaner__email',
        'cleaner__first_name',
        'cleaner__last_name'
    ]
    ordering = ['-created_at']
    
    readonly_fields = [
        'created_at',
        'updated_at',
        'started_at',
        'completed_at',
        'reviewed_at',
        'cancelled_at'
    ]
    
    fieldsets = (
        ('Job Details', {
            'fields': ('title', 'description', 'client', 'cleaner')
        }),
        ('Schedule', {
            'fields': ('scheduled_date', 'is_recurring', 'recurrence_pattern')
        }),
        ('Location', {
            'fields': ('address', 'city', 'postal_code', 'country')
        }),
        ('Budget', {
            'fields': ('budget',)
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Lifecycle Timestamps', {
            'fields': (
                'created_at',
                'started_at',
                'completed_at',
                'reviewed_at',
                'cancelled_at'
            ),
            'classes': ('collapse',)
        }),
        ('Cancellation', {
            'fields': ('cancellation_reason', 'cancelled_by'),
            'classes': ('collapse',)
        }),
    )
    
    actions = [
        'mark_as_confirmed',
        'mark_as_cancelled',
        'export_to_csv'
    ]
    
    def title_link(self, obj):
        """Make title clickable"""
        url = reverse('admin:cleaning_jobs_cleaningjob_change', args=[obj.id])
        return format_html('<a href="{}">{}</a>', url, obj.title)
    title_link.short_description = 'Title'
    
    def client_link(self, obj):
        """Link to client admin page"""
        if obj.client:
            url = reverse('admin:users_user_change', args=[obj.client.id])
            return format_html(
                '<a href="{}">{}</a>',
                url,
                obj.client.get_full_name()
            )
        return '-'
    client_link.short_description = 'Client'
    
    def cleaner_link(self, obj):
        """Link to cleaner admin page"""
        if obj.cleaner:
            url = reverse('admin:users_user_change', args=[obj.cleaner.id])
            return format_html(
                '<a href="{}">{}</a>',
                url,
                obj.cleaner.get_full_name()
            )
        return 'Not assigned'
    cleaner_link.short_description = 'Cleaner'
    
    def status_badge(self, obj):
        """Display status with color badge"""
        colors = {
            'pending': '#fbbf24',  # yellow
            'bid_accepted': '#3b82f6',  # blue
            'confirmed': '#10b981',  # green
            'in_progress': '#f59e0b',  # orange
            'awaiting_review': '#8b5cf6',  # purple
            'completed': '#22c55e',  # green
            'cancelled': '#ef4444'  # red
        }
        color = colors.get(obj.status, '#6b7280')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    status_badge.short_description = 'Status'
    
    def budget_display(self, obj):
        """Display budget formatted"""
        return f'${obj.budget:,.2f}'
    budget_display.short_description = 'Budget'
    budget_display.admin_order_field = 'budget'
    
    def payment_status(self, obj):
        """Display payment status"""
        if hasattr(obj, 'payment'):
            payment = obj.payment
            colors = {
                'pending': '#fbbf24',
                'processing': '#3b82f6',
                'succeeded': '#10b981',
                'failed': '#ef4444',
                'refunded': '#6b7280',
                'canceled': '#ef4444'
            }
            color = colors.get(payment.status, '#6b7280')
            return format_html(
                '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 8px; font-size: 10px;">{}</span>',
                color,
                payment.get_status_display()
            )
        return format_html(
            '<span style="color: #9ca3af;">No payment</span>'
        )
    payment_status.short_description = 'Payment'
    
    def mark_as_confirmed(self, request, queryset):
        """Bulk confirm jobs"""
        updated = queryset.filter(status='bid_accepted').update(status='confirmed')
        self.message_user(request, f'{updated} jobs marked as confirmed')
    mark_as_confirmed.short_description = 'Mark as confirmed'
    
    def mark_as_cancelled(self, request, queryset):
        """Bulk cancel jobs"""
        updated = queryset.exclude(
            status__in=['completed', 'cancelled']
        ).update(status='cancelled')
        self.message_user(request, f'{updated} jobs cancelled')
    mark_as_cancelled.short_description = 'Cancel jobs'
    
    def export_to_csv(self, request, queryset):
        """Export jobs to CSV"""
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="jobs.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Title', 'Client', 'Cleaner', 'Status',
            'Budget', 'Scheduled', 'Created'
        ])
        
        for job in queryset:
            writer.writerow([
                job.id,
                job.title,
                job.client.get_full_name(),
                job.cleaner.get_full_name() if job.cleaner else 'N/A',
                job.status,
                job.budget,
                job.scheduled_date,
                job.created_at
            ])
        
        return response
    export_to_csv.short_description = 'Export to CSV'
```

#### Step 3: Create Admin Dashboard Views

**File**: `backend/core/admin_views.py` (create new)

```python
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.db.models import Count, Sum, Avg, Q
from django.utils import timezone
from datetime import timedelta

from users.models import User
from cleaning_jobs.models import CleaningJob, JobReview
from payments.models import Payment

@staff_member_required
def admin_dashboard(request):
    """
    Custom admin dashboard with platform metrics
    """
    # Date ranges
    today = timezone.now().date()
    last_30_days = today - timedelta(days=30)
    last_7_days = today - timedelta(days=7)
    
    # User metrics
    total_users = User.objects.count()
    new_users_30d = User.objects.filter(date_joined__gte=last_30_days).count()
    active_users = User.objects.filter(is_active=True).count()
    cleaners_count = User.objects.filter(user_type='cleaner').count()
    clients_count = User.objects.filter(user_type='client').count()
    
    # Job metrics
    total_jobs = CleaningJob.objects.count()
    active_jobs = CleaningJob.objects.filter(
        status__in=['pending', 'bid_accepted', 'confirmed', 'in_progress']
    ).count()
    completed_jobs = CleaningJob.objects.filter(status='completed').count()
    cancelled_jobs = CleaningJob.objects.filter(status='cancelled').count()
    jobs_last_7d = CleaningJob.objects.filter(created_at__gte=last_7_days).count()
    
    # Payment metrics
    payments_aggregate = Payment.objects.filter(
        status='succeeded'
    ).aggregate(
        total_revenue=Sum('amount'),
        total_fees=Sum('platform_fee'),
        avg_job_value=Avg('amount')
    )
    
    total_revenue = payments_aggregate['total_revenue'] or 0
    platform_fees = payments_aggregate['total_fees'] or 0
    avg_job_value = payments_aggregate['avg_job_value'] or 0
    
    revenue_last_30d = Payment.objects.filter(
        status='succeeded',
        created_at__gte=last_30_days
    ).aggregate(total=Sum('amount'))['total'] or 0
    
    # Review metrics
    total_reviews = JobReview.objects.count()
    avg_rating = JobReview.objects.aggregate(avg=Avg('rating'))['avg'] or 0
    
    # Recent activity
    recent_jobs = CleaningJob.objects.select_related(
        'client', 'cleaner'
    ).order_by('-created_at')[:10]
    
    recent_payments = Payment.objects.select_related(
        'job', 'payer', 'payee'
    ).order_by('-created_at')[:10]
    
    # Status distribution
    job_status_distribution = CleaningJob.objects.values('status').annotate(
        count=Count('id')
    ).order_by('-count')
    
    context = {
        'total_users': total_users,
        'new_users_30d': new_users_30d,
        'active_users': active_users,
        'cleaners_count': cleaners_count,
        'clients_count': clients_count,
        
        'total_jobs': total_jobs,
        'active_jobs': active_jobs,
        'completed_jobs': completed_jobs,
        'cancelled_jobs': cancelled_jobs,
        'jobs_last_7d': jobs_last_7d,
        
        'total_revenue': total_revenue,
        'platform_fees': platform_fees,
        'avg_job_value': avg_job_value,
        'revenue_last_30d': revenue_last_30d,
        
        'total_reviews': total_reviews,
        'avg_rating': avg_rating,
        
        'recent_jobs': recent_jobs,
        'recent_payments': recent_payments,
        'job_status_distribution': job_status_distribution,
    }
    
    return render(request, 'admin/dashboard.html', context)
```

#### Step 4: Create Dashboard Template

**File**: `backend/templates/admin/dashboard.html` (create new)

```html
{% extends "admin/base_site.html" %}
{% load static %}

{% block title %}Dashboard - E-Clean Admin{% endblock %}

{% block content %}
<div style="padding: 20px;">
    <h1 style="margin-bottom: 30px; color: #1e40af; font-size: 32px;">Platform Dashboard</h1>
    
    <!-- Metrics Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px;">
        <!-- User Metrics -->
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">TOTAL USERS</h3>
            <p style="font-size: 36px; font-weight: bold; color: #1e40af; margin-bottom: 5px;">{{ total_users }}</p>
            <p style="color: #10b981; font-size: 14px;">+{{ new_users_30d }} this month</p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">ACTIVE JOBS</h3>
            <p style="font-size: 36px; font-weight: bold; color: #f59e0b; margin-bottom: 5px;">{{ active_jobs }}</p>
            <p style="color: #6b7280; font-size: 14px;">{{ jobs_last_7d }} posted this week</p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">TOTAL REVENUE</h3>
            <p style="font-size: 36px; font-weight: bold; color: #10b981; margin-bottom: 5px;">${{ total_revenue|floatformat:2 }}</p>
            <p style="color: #6b7280; font-size: 14px;">${{ revenue_last_30d|floatformat:2 }} this month</p>
        </div>
        
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">PLATFORM FEES</h3>
            <p style="font-size: 36px; font-weight: bold; color: #8b5cf6; margin-bottom: 5px;">${{ platform_fees|floatformat:2 }}</p>
            <p style="color: #6b7280; font-size: 14px;">Avg job: ${{ avg_job_value|floatformat:2 }}</p>
        </div>
    </div>
    
    <!-- Secondary Metrics -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 40px;">
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #3b82f6;">{{ cleaners_count }}</p>
            <p style="color: #6b7280; font-size: 13px;">Cleaners</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #3b82f6;">{{ clients_count }}</p>
            <p style="color: #6b7280; font-size: 13px;">Clients</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #10b981;">{{ completed_jobs }}</p>
            <p style="color: #6b7280; font-size: 13px;">Completed</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #ef4444;">{{ cancelled_jobs }}</p>
            <p style="color: #6b7280; font-size: 13px;">Cancelled</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #fbbf24;">{{ total_reviews }}</p>
            <p style="color: #6b7280; font-size: 13px;">Reviews</p>
        </div>
        
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
            <p style="font-size: 24px; font-weight: bold; color: #fbbf24;">{{ avg_rating|floatformat:1 }}⭐</p>
            <p style="color: #6b7280; font-size: 13px;">Avg Rating</p>
        </div>
    </div>
    
    <!-- Recent Activity -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Recent Jobs -->
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-bottom: 15px; color: #1e40af;">Recent Jobs</h3>
            <table style="width: 100%; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <th style="text-align: left; padding: 8px; color: #6b7280;">Job</th>
                        <th style="text-align: left; padding: 8px; color: #6b7280;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {% for job in recent_jobs %}
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px;">
                            <a href="{% url 'admin:cleaning_jobs_cleaningjob_change' job.id %}" style="color: #3b82f6;">
                                {{ job.title|truncatewords:5 }}
                            </a>
                        </td>
                        <td style="padding: 8px;">
                            <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
                                {{ job.get_status_display }}
                            </span>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        
        <!-- Recent Payments -->
        <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="margin-bottom: 15px; color: #1e40af;">Recent Payments</h3>
            <table style="width: 100%; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <th style="text-align: left; padding: 8px; color: #6b7280;">Job</th>
                        <th style="text-align: right; padding: 8px; color: #6b7280;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {% for payment in recent_payments %}
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px;">
                            <a href="{% url 'admin:payments_payment_change' payment.id %}" style="color: #3b82f6;">
                                {{ payment.job.title|truncatewords:5 }}
                            </a>
                        </td>
                        <td style="padding: 8px; text-align: right; color: #10b981; font-weight: bold;">
                            ${{ payment.amount }}
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
</div>
{% endblock %}
```

#### Step 5: Add Dashboard URL

**File**: `backend/e_clean_backend/urls.py` (update)

```python
from core.admin_views import admin_dashboard

urlpatterns = [
    path('admin/', admin.site.urls),
    path('admin/dashboard/', admin_dashboard, name='admin_dashboard'),  # ← ADD
    # ... rest of URLs
]
```

#### Step 6: Update Admin Site

**File**: `backend/core/admin.py` (create or update)

```python
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

# Customize admin site
admin.site.site_header = 'E-Clean Administration'
admin.site.site_title = 'E-Clean Admin'
admin.site.index_title = 'Platform Management'

# Add custom dashboard link
def get_admin_dashboard_link():
    """Add dashboard link to admin index"""
    return format_html(
        '<a href="{}" class="button" style="margin-left: 10px;">📊 View Dashboard</a>',
        reverse('admin_dashboard')
    )

# Monkey patch to add dashboard link (alternative: override admin templates)
# Note: For production, override templates/admin/index.html instead
```

---

### 5.2 Testing Admin Dashboard

#### Test Checklist

```bash
# Admin Access Tests
□ Only staff/superuser can access
□ Regular users see 403 error
□ Admin login page works
□ Logout works correctly

# User Management Tests
□ View all users
□ Search users by email/name
□ Filter by user type
□ Block/unblock users
□ Verify/unverify users
□ Bulk actions work

# Job Management Tests
□ View all jobs
□ Search jobs by title/client/cleaner
□ Filter by status
□ View job details
□ Export jobs to CSV
□ Bulk status changes

# Payment Management Tests
□ View all payments
□ Filter by status
□ View payment details
□ Process refunds
□ View revenue metrics

# Dashboard Tests
□ Metrics display correctly
□ Charts render (if added)
□ Recent activity shows
□ Links navigate correctly
□ Performance (loads < 2s)
```

---

## 📈 Task 5 Progress Tracker

**File**: `PHASE_1_PROGRESS.md` (update)

```markdown
## Week 3 (cont.): Admin Dashboard

### Day 6
- [ ] Enhance User admin
- [ ] Enhance CleaningJob admin
- [ ] Add bulk actions
- [ ] Add admin filters

### Day 7
- [ ] Create admin dashboard view
- [ ] Create dashboard template
- [ ] Add metrics calculation
- [ ] Add charts (optional)

### Weekend
- [ ] Test admin access control
- [ ] Test bulk actions
- [ ] Test CSV export
- [ ] Polish admin UI
- [ ] Documentation
```

---

**Task 5 Complete!** ✅

---

## 🧪 TASK 6: Testing & Quality Assurance

**Estimated Time**: 6-8 hours  
**Priority**: CRITICAL  
**Status**: Not Started  
**Dependencies**: Tasks 1-5 (all features complete)

### 6.0 Testing Strategy Overview

**Testing Pyramid**:
```
         /\
        /E2E\        ← End-to-End (Cypress)
       /------\
      /Integr.\     ← Integration Tests
     /----------\
    /Unit Tests  \   ← Unit Tests (Backend + Frontend)
   /--------------\
```

**Coverage Goals**:
- Backend: 80%+ code coverage
- Frontend: 70%+ code coverage
- Critical paths: 100% coverage

**Test Types**:
1. **Unit Tests**: Individual functions/components
2. **Integration Tests**: API endpoints, database interactions
3. **E2E Tests**: Full user flows
4. **Load Tests**: Performance under load
5. **Security Tests**: Vulnerabilities

---

### 6.1 Backend Testing

#### Step 1: Install Testing Dependencies

```bash
cd backend
docker-compose -f ../docker-compose.dev.yml exec backend bash

# Install pytest and plugins
pip install pytest==7.4.0 pytest-django==4.5.2 pytest-cov==4.1.0 factory-boy==3.3.0 faker==19.6.2

# Add to requirements.txt
cat >> requirements.txt << EOF
pytest==7.4.0
pytest-django==4.5.2
pytest-cov==4.1.0
factory-boy==3.3.0
faker==19.6.2
EOF
```

#### Step 2: Configure Pytest

**File**: `backend/pytest.ini` (create new)

```ini
[pytest]
DJANGO_SETTINGS_MODULE = e_clean_backend.settings
python_files = tests.py test_*.py *_tests.py
python_classes = Test*
python_functions = test_*
addopts = 
    --strict-markers
    --cov=.
    --cov-report=html
    --cov-report=term-missing
    --no-migrations
    --reuse-db
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow running tests
```

#### Step 3: Create Test Fixtures

**File**: `backend/conftest.py` (create new)

```python
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from cleaning_jobs.models import CleaningJob
from payments.models import Payment
import factory
from faker import Faker

User = get_user_model()
fake = Faker()

# Factories for creating test data
class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
    
    email = factory.LazyAttribute(lambda _: fake.email())
    first_name = factory.LazyAttribute(lambda _: fake.first_name())
    last_name = factory.LazyAttribute(lambda _: fake.last_name())
    user_type = 'client'
    is_active = True
    is_verified = True


class CleanerFactory(UserFactory):
    user_type = 'cleaner'


class JobFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CleaningJob
    
    title = factory.LazyAttribute(lambda _: fake.sentence(nb_words=5))
    description = factory.LazyAttribute(lambda _: fake.paragraph())
    client = factory.SubFactory(UserFactory)
    cleaner = factory.SubFactory(CleanerFactory)
    budget = factory.LazyAttribute(lambda _: fake.pydecimal(left_digits=3, right_digits=2, positive=True))
    status = 'pending'


# Pytest Fixtures
@pytest.fixture
def api_client():
    """API client for making requests"""
    return APIClient()


@pytest.fixture
def client_user(db):
    """Create a client user"""
    return UserFactory(user_type='client')


@pytest.fixture
def cleaner_user(db):
    """Create a cleaner user"""
    return CleanerFactory()


@pytest.fixture
def authenticated_client(api_client, client_user):
    """API client authenticated as client"""
    api_client.force_authenticate(user=client_user)
    return api_client


@pytest.fixture
def authenticated_cleaner(api_client, cleaner_user):
    """API client authenticated as cleaner"""
    api_client.force_authenticate(user=cleaner_user)
    return api_client


@pytest.fixture
def cleaning_job(client_user, cleaner_user):
    """Create a cleaning job"""
    return JobFactory(client=client_user, cleaner=cleaner_user)
```

#### Step 4: Write User Tests

**File**: `backend/users/tests/test_user_api.py` (create new)

```python
import pytest
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db


class TestUserRegistration:
    """Test user registration"""
    
    def test_register_client_success(self, api_client):
        """Test successful client registration"""
        url = reverse('user-register')  # Adjust to your URL name
        data = {
            'email': 'test@example.com',
            'password': 'SecurePassword123!',
            'first_name': 'John',
            'last_name': 'Doe',
            'user_type': 'client'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'token' in response.data or 'access' in response.data
        assert response.data['user']['email'] == 'test@example.com'
    
    def test_register_duplicate_email(self, api_client, client_user):
        """Test registration with duplicate email fails"""
        url = reverse('user-register')
        data = {
            'email': client_user.email,
            'password': 'SecurePassword123!',
            'first_name': 'Jane',
            'last_name': 'Doe',
            'user_type': 'client'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_register_weak_password(self, api_client):
        """Test registration with weak password fails"""
        url = reverse('user-register')
        data = {
            'email': 'test@example.com',
            'password': '123',  # Too weak
            'first_name': 'John',
            'last_name': 'Doe',
            'user_type': 'client'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestUserAuthentication:
    """Test user authentication"""
    
    def test_login_success(self, api_client, client_user):
        """Test successful login"""
        client_user.set_password('TestPassword123!')
        client_user.save()
        
        url = reverse('user-login')  # Adjust to your URL name
        data = {
            'email': client_user.email,
            'password': 'TestPassword123!'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'token' in response.data or 'access' in response.data
    
    def test_login_wrong_password(self, api_client, client_user):
        """Test login with wrong password fails"""
        client_user.set_password('TestPassword123!')
        client_user.save()
        
        url = reverse('user-login')
        data = {
            'email': client_user.email,
            'password': 'WrongPassword!'
        }
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST or response.status_code == status.HTTP_401_UNAUTHORIZED
```

#### Step 5: Write Job Tests

**File**: `backend/cleaning_jobs/tests/test_job_api.py` (create new)

```python
import pytest
from django.urls import reverse
from rest_framework import status
from cleaning_jobs.models import CleaningJob

pytestmark = pytest.mark.django_db


class TestJobCreation:
    """Test job creation"""
    
    def test_create_job_success(self, authenticated_client, client_user):
        """Test successful job creation by client"""
        url = reverse('cleaningjob-list')  # Adjust to your URL name
        data = {
            'title': 'Deep clean apartment',
            'description': 'Need a thorough cleaning of 2-bedroom apartment',
            'budget': 150.00,
            'scheduled_date': '2024-12-01T10:00:00Z',
            'address': '123 Main St',
            'city': 'Toronto',
            'postal_code': 'M5V 3A8',
            'country': 'Canada'
        }
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['title'] == 'Deep clean apartment'
        assert response.data['client'] == client_user.id
        assert response.data['status'] == 'pending'
    
    def test_create_job_unauthenticated(self, api_client):
        """Test job creation fails without authentication"""
        url = reverse('cleaningjob-list')
        data = {'title': 'Test job'}
        
        response = api_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestJobLifecycle:
    """Test job status transitions"""
    
    def test_start_job_as_cleaner(self, authenticated_cleaner, cleaning_job):
        """Test cleaner can start confirmed job"""
        cleaning_job.status = 'confirmed'
        cleaning_job.cleaner = authenticated_cleaner.handler._force_user
        cleaning_job.save()
        
        url = reverse('cleaningjob-start', kwargs={'pk': cleaning_job.id})
        
        response = authenticated_cleaner.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        cleaning_job.refresh_from_db()
        assert cleaning_job.status == 'in_progress'
        assert cleaning_job.started_at is not None
    
    def test_complete_job_as_cleaner(self, authenticated_cleaner, cleaning_job):
        """Test cleaner can complete in-progress job"""
        cleaning_job.status = 'in_progress'
        cleaning_job.cleaner = authenticated_cleaner.handler._force_user
        cleaning_job.save()
        
        url = reverse('cleaningjob-complete', kwargs={'pk': cleaning_job.id})
        
        response = authenticated_cleaner.post(url)
        
        assert response.status_code == status.HTTP_200_OK
        cleaning_job.refresh_from_db()
        assert cleaning_job.status == 'awaiting_review'
        assert cleaning_job.completed_at is not None


class TestJobPermissions:
    """Test job access permissions"""
    
    def test_client_cannot_start_job(self, authenticated_client, cleaning_job):
        """Test client cannot start job (cleaner only)"""
        cleaning_job.status = 'confirmed'
        cleaning_job.client = authenticated_client.handler._force_user
        cleaning_job.save()
        
        url = reverse('cleaningjob-start', kwargs={'pk': cleaning_job.id})
        
        response = authenticated_client.post(url)
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
```

#### Step 6: Write Payment Tests

**File**: `backend/payments/tests/test_payment_api.py` (create new)

```python
import pytest
from django.urls import reverse
from rest_framework import status
from unittest.mock import patch, MagicMock

pytestmark = pytest.mark.django_db


class TestPaymentIntent:
    """Test payment intent creation"""
    
    @patch('payments.stripe_service.StripeService.create_payment_intent')
    def test_create_payment_intent_success(self, mock_stripe, authenticated_client, cleaning_job):
        """Test successful payment intent creation"""
        # Mock Stripe response
        mock_stripe.return_value = MagicMock(
            id='pi_test123',
            client_secret='pi_test123_secret_abc',
            status='requires_payment_method'
        )
        
        cleaning_job.status = 'bid_accepted'
        cleaning_job.client = authenticated_client.handler._force_user
        cleaning_job.save()
        
        url = reverse('payment-create-intent')
        data = {'job_id': cleaning_job.id}
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_201_CREATED
        assert 'client_secret' in response.data
        assert response.data['amount'] == float(cleaning_job.budget)
    
    def test_create_payment_intent_wrong_status(self, authenticated_client, cleaning_job):
        """Test payment intent creation fails for wrong job status"""
        cleaning_job.status = 'pending'  # Not bid_accepted
        cleaning_job.client = authenticated_client.handler._force_user
        cleaning_job.save()
        
        url = reverse('payment-create-intent')
        data = {'job_id': cleaning_job.id}
        
        response = authenticated_client.post(url, data, format='json')
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
```

#### Step 7: Run Backend Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest backend/users/tests/test_user_api.py

# Run specific test class
pytest backend/cleaning_jobs/tests/test_job_api.py::TestJobCreation

# Run with verbose output
pytest -v

# Run and stop on first failure
pytest -x

# View coverage report
open htmlcov/index.html  # macOS
```

---

### 6.2 Frontend Testing

#### Step 1: Install Testing Dependencies

```bash
cd frontend

# Install Jest and React Testing Library
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom

# Install MSW for API mocking
npm install --save-dev msw
```

#### Step 2: Configure Jest

**File**: `frontend/jest.config.js` (create new)

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

#### Step 3: Setup Test Environment

**File**: `frontend/src/setupTests.js` (create new)

```javascript
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() { return []; }
  unobserve() {}
};
```

**File**: `frontend/__mocks__/fileMock.js` (create new)

```javascript
module.exports = 'test-file-stub';
```

#### Step 4: Write Component Tests

**File**: `frontend/src/components/reviews/__tests__/StarRating.test.jsx` (create new)

```javascript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StarRating from '../StarRating';

describe('StarRating Component', () => {
  it('renders 5 stars', () => {
    render(<StarRating rating={0} onRatingChange={() => {}} />);
    const stars = screen.getAllByRole('button');
    expect(stars).toHaveLength(5);
  });
  
  it('displays correct number of filled stars', () => {
    const { container } = render(<StarRating rating={3} readonly />);
    const filledStars = container.querySelectorAll('.text-yellow-400');
    expect(filledStars).toHaveLength(3);
  });
  
  it('calls onRatingChange when star is clicked', () => {
    const mockOnChange = jest.fn();
    render(<StarRating rating={0} onRatingChange={mockOnChange} />);
    
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[2]); // Click 3rd star
    
    expect(mockOnChange).toHaveBeenCalledWith(3);
  });
  
  it('does not call onRatingChange when readonly', () => {
    const mockOnChange = jest.fn();
    render(<StarRating rating={3} onRatingChange={mockOnChange} readonly />);
    
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[4]); // Try to click 5th star
    
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
```

#### Step 5: Write Context Tests

**File**: `frontend/src/contexts/__tests__/UserContext.test.jsx` (create new)

```javascript
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from '../UserContext';
import * as authAPI from '../../services/authAPI';

// Mock authAPI
jest.mock('../../services/authAPI');

// Test component that uses UserContext
const TestComponent = () => {
  const { user, login, logout } = useUser();
  
  return (
    <div>
      <div data-testid="user-email">{user?.email || 'Not logged in'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('UserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });
  
  it('provides user context to children', () => {
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );
    
    expect(screen.getByTestId('user-email')).toHaveTextContent('Not logged in');
  });
  
  it('handles successful login', async () => {
    authAPI.login.mockResolvedValue({
      user: { id: 1, email: 'test@example.com' },
      token: 'fake-token'
    });
    
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );
    
    fireEvent.click(screen.getByText('Login'));
    
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });
  });
  
  it('handles logout', async () => {
    authAPI.login.mockResolvedValue({
      user: { id: 1, email: 'test@example.com' },
      token: 'fake-token'
    });
    
    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );
    
    // Login first
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    });
    
    // Then logout
    fireEvent.click(screen.getByText('Logout'));
    
    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('Not logged in');
    });
  });
});
```

#### Step 6: Run Frontend Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- StarRating.test.jsx
```

---

### 6.3 End-to-End Testing (Optional but Recommended)

#### Install Cypress

```bash
cd frontend
npm install --save-dev cypress
```

#### Create E2E Test

**File**: `frontend/cypress/e2e/job_lifecycle.cy.js`

```javascript
describe('Job Lifecycle', () => {
  it('completes full job flow from creation to review', () => {
    // Login as client
    cy.visit('/login');
    cy.get('[name="email"]').type('client@example.com');
    cy.get('[name="password"]').type('password');
    cy.get('button[type="submit"]').click();
    
    // Create job
    cy.visit('/jobs/create');
    cy.get('[name="title"]').type('Deep clean apartment');
    cy.get('[name="description"]').type('Need a thorough cleaning');
    cy.get('[name="budget"]').type('150');
    cy.get('button[type="submit"]').click();
    
    // Verify job created
    cy.contains('Job posted successfully');
    
    // Logout and login as cleaner
    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="logout-button"]').click();
    
    // Login as cleaner
    cy.get('[name="email"]').type('cleaner@example.com');
    cy.get('[name="password"]').type('password');
    cy.get('button[type="submit"]').click();
    
    // Browse jobs and submit bid
    cy.visit('/jobs');
    cy.contains('Deep clean apartment').click();
    cy.get('button').contains('Submit Bid').click();
    cy.get('[name="bid_amount"]').type('150');
    cy.get('button[type="submit"]').click();
    
    // Verify bid submitted
    cy.contains('Bid submitted successfully');
  });
});
```

---

### 6.4 Load Testing (Optional)

#### Install Locust

```bash
pip install locust
```

#### Create Load Test

**File**: `backend/locustfile.py` (create new)

```python
from locust import HttpUser, task, between

class ECleenUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login before starting tasks"""
        response = self.client.post('/api/auth/login/', json={
            'email': 'test@example.com',
            'password': 'password'
        })
        if response.status_code == 200:
            self.token = response.json()['token']
    
    @task(3)
    def view_jobs(self):
        """View job listings"""
        self.client.get('/api/cleaning-jobs/', headers={
            'Authorization': f'Bearer {self.token}'
        })
    
    @task(2)
    def view_job_detail(self):
        """View specific job"""
        self.client.get('/api/cleaning-jobs/1/', headers={
            'Authorization': f'Bearer {self.token}'
        })
    
    @task(1)
    def create_job(self):
        """Create a job"""
        self.client.post('/api/cleaning-jobs/', json={
            'title': 'Test cleaning job',
            'description': 'Test description',
            'budget': 100.00
        }, headers={
            'Authorization': f'Bearer {self.token}'
        })
```

#### Run Load Test

```bash
# Start load test
locust -f backend/locustfile.py --host=http://localhost:8000

# Open browser to http://localhost:8089
# Set number of users and spawn rate
# Start swarming
```

---

### 6.5 Security Testing

#### Security Checklist

```bash
# Authentication & Authorization
□ Password strength validation
□ JWT token expiration
□ Permission checks on all endpoints
□ CSRF protection
□ XSS protection

# Data Protection
□ SQL injection prevention (use ORM)
□ Sensitive data encryption
□ Secure password storage (hashing)
□ HTTPS in production
□ Secure cookies

# File Upload Security
□ File type validation
□ File size limits
□ Malicious file scanning
□ Secure file storage

# API Security
□ Rate limiting
□ Input validation
□ Output sanitization
□ CORS configuration
□ API authentication

# Payment Security
□ PCI compliance (Stripe handles)
□ Webhook signature verification
□ Idempotent payment processing
□ Refund authorization
```

---

## 📈 Task 6 Progress Tracker

**File**: `PHASE_1_PROGRESS.md` (update)

```markdown
## Week 4: Testing & QA

### Day 1-2: Backend Testing
- [ ] Install pytest and dependencies
- [ ] Create test fixtures
- [ ] Write user API tests
- [ ] Write job API tests
- [ ] Write payment API tests
- [ ] Achieve 80%+ coverage

### Day 3-4: Frontend Testing
- [ ] Install Jest and React Testing Library
- [ ] Write component tests
- [ ] Write context tests
- [ ] Write integration tests
- [ ] Achieve 70%+ coverage

### Day 5: E2E & Load Testing
- [ ] Install Cypress
- [ ] Write critical path E2E tests
- [ ] Install Locust (optional)
- [ ] Run load tests
- [ ] Identify bottlenecks

### Weekend: Security & Documentation
- [ ] Security audit
- [ ] Fix vulnerabilities
- [ ] Document test procedures
- [ ] Create test data scripts
```

---

**Task 6 Complete!** ✅

This comprehensive testing guide covers:
- ✅ Backend unit tests with pytest
- ✅ Frontend component tests with Jest
- ✅ Integration tests for APIs
- ✅ E2E tests with Cypress
- ✅ Load testing with Locust
- ✅ Security testing checklist
- ✅ 80%+ backend coverage goal
- ✅ 70%+ frontend coverage goal

**Guide Status**: Tasks 1-6 Complete (9,400+ lines)

Remaining tasks available:
- **Task 7**: Documentation & User Guides
- **Task 8**: Production Deployment Preparation
- **Task 9**: Final Polish & Launch Checklist

---

## 📚 TASK 7: Documentation & User Guides

**Estimated Time**: 3-4 hours  
**Priority**: MEDIUM  
**Status**: Not Started  
**Dependencies**: Tasks 1-6 (all features complete)

### 7.0 Documentation Overview

**Goal**: Create comprehensive documentation for developers, users, and administrators.

**Documentation Types**:
1. 📘 **Developer Documentation**: Setup, API reference, architecture
2. 📗 **User Documentation**: How to use the platform
3. 📕 **Admin Documentation**: Platform management
4. 📙 **API Documentation**: Endpoint reference
5. 📓 **Deployment Documentation**: Production setup

**Documentation Tools**:
- README.md (GitHub landing page)
- Wiki or docs folder
- API documentation (Django REST framework built-in)
- Inline code comments

---

### 7.1 Update Main README

**File**: `README.md` (comprehensive update)

```markdown
# 🧹 E-Clean: Professional Cleaning Marketplace

[![Django](https://img.shields.io/badge/Django-4.2+-green.svg)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A modern marketplace connecting clients with professional cleaners. Built with Django REST Framework and React.

![E-Clean Platform](docs/images/platform-screenshot.png)

---

## 🌟 Features

### For Clients
- ✨ **Post Jobs**: Create cleaning job listings with detailed requirements
- 💰 **Receive Bids**: Get competitive bids from verified cleaners
- 💳 **Secure Payments**: Pay safely with Stripe integration
- ⭐ **Rate & Review**: Review cleaners after job completion
- 💬 **Real-time Chat**: Communicate directly with cleaners
- 📱 **Mobile Friendly**: Full mobile responsive design

### For Cleaners
- 🔍 **Browse Jobs**: Find cleaning opportunities in your area
- 📝 **Submit Bids**: Bid on jobs that match your skills
- 📊 **Profile & Ratings**: Build your reputation with reviews
- 💼 **Job Management**: Track your active and completed jobs
- 💰 **Secure Payouts**: Get paid through the platform
- 📱 **Mobile Access**: Manage jobs on the go

### Platform Features
- 🔐 **Secure Authentication**: JWT-based authentication
- 🔔 **Real-time Notifications**: WebSocket-powered notifications
- 📈 **Admin Dashboard**: Comprehensive platform management
- 🎨 **Modern UI**: Clean, intuitive Tailwind CSS design
- 🚀 **Scalable Architecture**: Docker-based deployment
- 🧪 **Tested**: 80%+ backend, 70%+ frontend test coverage

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     E-Clean Platform                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │   React     │───▶│  Django REST │───▶│ PostgreSQL │ │
│  │  Frontend   │◀───│   Framework  │◀───│  Database  │ │
│  └─────────────┘    └──────────────┘    └────────────┘ │
│         │                   │                            │
│         │            ┌──────▼───────┐                    │
│         │            │    Redis     │                    │
│         │            │ (Cache/WS)   │                    │
│         │            └──────────────┘                    │
│         │                                                 │
│         └──────────────────┐                             │
│                            │                             │
│                    ┌───────▼────────┐                    │
│                    │   WebSocket    │                    │
│                    │ (Django Chan.) │                    │
│                    └────────────────┘                    │
│                                                           │
│  External Services:                                       │
│  • Stripe (Payments)                                     │
│  • AWS S3 (Media Storage - Production)                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker** & **Docker Compose** (recommended)
- OR manually:
  - Python 3.11+
  - Node.js 18+
  - PostgreSQL 14+
  - Redis 7+

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/vaskomet/CapstoneProjectMetallinosE-Clean.git
cd CapstoneProjectMetallinosE-Clean

# Copy environment file
cp backend/.env.example backend/.env

# Add your credentials to backend/.env:
# - STRIPE_SECRET_KEY
# - STRIPE_PUBLISHABLE_KEY
# - SECRET_KEY (generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

# Start services
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Create superuser
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Create test data (optional)
docker-compose -f docker-compose.dev.yml exec backend python manage.py loaddata fixtures/test_data.json
```

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Admin Panel: http://localhost:8000/admin

### Option 2: Manual Setup

See [DEVELOPMENT_SETUP.md](DEVELOPMENT_SETUP.md) for detailed manual setup instructions.

---

## 📖 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - How to use the platform
- **[Admin Guide](docs/ADMIN_GUIDE.md)** - Platform management
- **[API Reference](docs/API_REFERENCE.md)** - API endpoints
- **[Development Guide](docs/DEVELOPMENT.md)** - Contributing & development
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment

---

## 🧪 Testing

### Backend Tests

```bash
# Run all tests
docker-compose -f docker-compose.dev.yml exec backend pytest

# Run with coverage
docker-compose -f docker-compose.dev.yml exec backend pytest --cov=. --cov-report=html

# Run specific test file
docker-compose -f docker-compose.dev.yml exec backend pytest backend/users/tests/test_user_api.py
```

### Frontend Tests

```bash
# Run all tests
cd frontend
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- StarRating.test.jsx
```

---

## 🛠️ Tech Stack

### Backend
- **Django 4.2+**: Web framework
- **Django REST Framework**: API development
- **Django Channels**: WebSocket support
- **PostgreSQL**: Primary database
- **Redis**: Caching & WebSocket channel layer
- **Celery**: Background tasks (future)
- **Stripe**: Payment processing

### Frontend
- **React 18**: UI library
- **React Router v6**: Navigation
- **Tailwind CSS**: Styling
- **Axios**: HTTP client
- **WebSocket API**: Real-time communication
- **Stripe React SDK**: Payment UI

### DevOps
- **Docker**: Containerization
- **Docker Compose**: Local development
- **GitHub Actions**: CI/CD (planned)
- **AWS/DigitalOcean**: Production hosting (planned)

---

## 📁 Project Structure

```
CapstoneProjectMetallinos/
├── backend/                    # Django backend
│   ├── cleaning_jobs/          # Job management app
│   ├── users/                  # User management
│   ├── payments/               # Stripe integration
│   ├── notifications/          # Notification system
│   ├── chat/                   # Real-time chat
│   ├── e_clean_backend/        # Project settings
│   ├── requirements.txt        # Python dependencies
│   └── manage.py               # Django management
│
├── frontend/                   # React frontend
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page components
│   │   ├── contexts/           # React contexts
│   │   ├── services/           # API services
│   │   ├── utils/              # Utility functions
│   │   └── App.jsx             # Root component
│   ├── package.json            # Node dependencies
│   └── tailwind.config.js      # Tailwind config
│
├── docs/                       # Documentation
├── docker-compose.dev.yml      # Development compose
├── docker-compose.prod.yml     # Production compose
└── README.md                   # This file
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 🐛 Bug Reports

Found a bug? Please open an issue with:
- **Description**: What happened?
- **Steps to reproduce**: How to trigger the bug?
- **Expected behavior**: What should happen?
- **Screenshots**: If applicable
- **Environment**: OS, browser, versions

---

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 👥 Team

**Developer**: Vasko Metallinos  
**Institution**: Capstone Project  
**Year**: 2024-2025

---

## 🙏 Acknowledgments

- Django REST Framework documentation
- React documentation
- Stripe API documentation
- Tailwind CSS
- All open-source contributors

---

## 📧 Contact

- **Email**: vasko@example.com
- **GitHub**: [@vaskomet](https://github.com/vaskomet)
- **Project**: [E-Clean Repository](https://github.com/vaskomet/CapstoneProjectMetallinosE-Clean)

---

## 🗺️ Roadmap

### Phase 1: Core Marketplace (Current)
- ✅ User authentication
- ✅ Job posting & bidding
- ✅ Payment integration
- ✅ Review system
- ✅ Real-time chat
- ✅ Mobile responsive

### Phase 2: Social Features (Planned)
- 🔲 User profiles & feeds
- 🔲 Social connections
- 🔲 Content sharing
- 🔲 Activity feeds
- 🔲 Notifications v2

### Phase 3: Advanced Features (Future)
- 🔲 Video chat
- 🔲 Advanced analytics
- 🔲 Multi-language support
- 🔲 Mobile apps (iOS/Android)
- 🔲 AI-powered matching

---

**Built with ❤️ by Vasko Metallinos**
```

---

### 7.2 Create User Guide

**File**: `docs/USER_GUIDE.md` (create new)

```markdown
# 📗 E-Clean User Guide

Welcome to E-Clean! This guide will help you get started with the platform.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [For Clients](#for-clients)
3. [For Cleaners](#for-cleaners)
4. [Common Tasks](#common-tasks)
5. [FAQ](#faq)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Creating an Account

1. Visit [E-Clean](http://localhost:3000) (or your deployment URL)
2. Click **"Sign Up"**
3. Choose your account type:
   - **Client**: I need cleaning services
   - **Cleaner**: I provide cleaning services
4. Fill in your details:
   - Email address
   - Password (min. 8 characters)
   - First & Last name
   - Phone number (optional)
5. Click **"Create Account"**
6. Check your email for verification link (if enabled)

### Logging In

1. Click **"Login"** on homepage
2. Enter your email and password
3. Click **"Sign In"**
4. You'll be redirected to your dashboard

---

## For Clients

### Posting a Job

1. **Navigate to Create Job**:
   - Click **"Post Job"** in navigation
   - Or go to Dashboard → **"New Job"**

2. **Fill Job Details**:
   - **Title**: Brief description (e.g., "Deep clean 3-bedroom apartment")
   - **Description**: Detailed requirements
   - **Location**: Full address
   - **Scheduled Date**: When you need the cleaning
   - **Budget**: Your budget (optional)
   - **Photos**: Upload up to 3 photos (optional)

3. **Submit**:
   - Review details
   - Click **"Post Job"**
   - Job will appear in your dashboard

### Reviewing Bids

1. **View Bids**:
   - Go to **"My Jobs"**
   - Click on your job
   - See list of bids under **"Bids Received"**

2. **Bid Information**:
   - Cleaner's name & rating
   - Bid amount
   - Estimated duration
   - Message from cleaner

3. **Accept a Bid**:
   - Click **"Accept"** on preferred bid
   - Other bids will be automatically declined
   - Job status changes to **"Bid Accepted"**

### Making Payment

1. **When to Pay**:
   - After accepting a bid
   - Before cleaner starts work

2. **Payment Process**:
   - Click **"Make Payment"** button
   - Review payment summary:
     - Job amount
     - Platform fee (15%)
     - Total
   - Enter payment method (Stripe)
   - Click **"Pay Now"**

3. **Payment Methods**:
   - Credit/Debit card
   - Save card for future use (optional)

4. **After Payment**:
   - Receive email receipt
   - Job status changes to **"Confirmed"**
   - Cleaner can now start work

### Tracking Job Progress

1. **Job Timeline**:
   - View job page
   - See status timeline:
     - ✅ Job Posted
     - ✅ Bid Accepted
     - ✅ Payment Confirmed
     - 🕐 Work in Progress
     - ⏳ Awaiting Review
     - ✅ Completed

2. **Real-time Updates**:
   - Receive notifications when:
     - Bids are submitted
     - Cleaner starts work
     - Work is completed

### Reviewing a Cleaner

1. **When to Review**:
   - After cleaner marks job as complete
   - Job status: **"Awaiting Review"**

2. **Submit Review**:
   - Click **"Submit Review"** button
   - Rate overall experience (1-5 stars)
   - Rate specific aspects:
     - Quality of work
     - Communication
     - Punctuality
   - Write detailed feedback
   - Upload up to 3 photos (optional)
   - Click **"Submit Review"**

3. **After Review**:
   - Job marked as **"Completed"**
   - Review appears on cleaner's profile
   - You can't edit review after submission

### Cancelling a Job

1. **When You Can Cancel**:
   - Any time before job completion
   - Note: Refund policy applies

2. **How to Cancel**:
   - Go to job page
   - Click **"Cancel Job"** (red button)
   - Enter cancellation reason
   - Confirm cancellation

3. **Refund Process**:
   - If paid: Automatic refund initiated
   - Refund takes 5-10 business days
   - Both parties notified

---

## For Cleaners

### Setting Up Profile

1. **Complete Your Profile**:
   - Go to **"Profile"** → **"Edit"**
   - Add profile photo
   - Write bio (describe your experience)
   - Add years of experience
   - Set hourly rate (optional)
   - Save changes

2. **Build Your Reputation**:
   - Complete jobs professionally
   - Encourage clients to leave reviews
   - Maintain high rating (4.5+ stars)

### Finding Jobs

1. **Browse Jobs**:
   - Click **"Browse Jobs"** in navigation
   - See all available jobs
   - Filter by:
     - Location
     - Budget range
     - Date
     - Job type

2. **Job Details**:
   - Click on job to see:
     - Full description
     - Client information
     - Location
     - Budget
     - Photos
     - Number of bids

### Submitting Bids

1. **Review Job Carefully**:
   - Read full description
   - Check location and date
   - Review client's rating

2. **Submit Bid**:
   - Click **"Submit Bid"**
   - Enter bid amount
   - Add estimated duration
   - Write message to client
   - Click **"Submit Bid"**

3. **Bid Strategy**:
   - Be competitive but fair
   - Explain your value
   - Be professional
   - Respond quickly

### Managing Active Jobs

1. **Starting a Job**:
   - When status is **"Confirmed"** (payment received)
   - Go to job page
   - Click **"Start Job"**
   - Status changes to **"In Progress"**
   - Client receives notification

2. **During Job**:
   - Communicate via chat if needed
   - Work according to requirements
   - Take before/after photos (optional)

3. **Completing a Job**:
   - When finished
   - Click **"Mark as Complete"**
   - Status changes to **"Awaiting Review"**
   - Client will submit review

### Getting Paid

1. **Payment Timeline**:
   - Client pays upfront (before work starts)
   - Funds held by platform
   - Released after job completion
   - Payout within 7 days

2. **Payout Methods**:
   - Bank transfer (default)
   - Stripe Connect account
   - Set up in **"Settings"** → **"Payment Methods"**

3. **Tracking Earnings**:
   - View in **"Dashboard"**
   - See:
     - Total earnings
     - Pending payments
     - Completed payouts

---

## Common Tasks

### Messaging

1. **Start Conversation**:
   - Go to job page
   - Click **"Message"** button
   - Type message
   - Send

2. **Real-time Chat**:
   - Messages appear instantly
   - Notifications when offline
   - Access via **"Messages"** in navigation

3. **Chat Features**:
   - Text messages
   - Emoji support
   - Typing indicators
   - Online/offline status

### Notifications

1. **Notification Types**:
   - New bids (clients)
   - Bid accepted (cleaners)
   - Payment received
   - Job started/completed
   - New messages
   - Review submitted

2. **Viewing Notifications**:
   - Bell icon in navigation
   - Shows unread count
   - Click to see all

3. **Managing Notifications**:
   - Mark as read
   - Clear all
   - Settings (enable/disable types)

### Profile Settings

1. **Edit Profile**:
   - **"Profile"** → **"Edit"**
   - Update:
     - Photo
     - Bio
     - Contact info
     - Location

2. **Change Password**:
   - **"Settings"** → **"Security"**
   - Enter current password
   - Enter new password
   - Confirm

3. **Account Settings**:
   - Email preferences
   - Notification settings
   - Privacy settings
   - Delete account

---

## FAQ

### General

**Q: Is E-Clean free to use?**  
A: Creating an account is free. We charge a 15% platform fee on completed jobs.

**Q: How do I verify my account?**  
A: Check your email for verification link after signing up.

**Q: Can I be both a client and a cleaner?**  
A: No, you must choose one account type. Create a separate account if needed.

### For Clients

**Q: How many bids will I receive?**  
A: It varies based on your job details, location, and budget. Typically 3-10 bids.

**Q: Can I cancel after accepting a bid?**  
A: Yes, but you may be charged a cancellation fee if close to scheduled date.

**Q: When do I get a refund?**  
A: Refunds are processed within 5-10 business days to your original payment method.

**Q: What if I'm not satisfied with the work?**  
A: Contact support immediately. We'll mediate disputes and may issue partial refunds.

### For Cleaners

**Q: How do I get more jobs?**  
A: Complete your profile, maintain high ratings, respond quickly, and submit competitive bids.

**Q: When do I get paid?**  
A: Payment is released 7 days after job completion (after review period).

**Q: What if a client cancels?**  
A: You'll be notified. If cancelled after work starts, you may receive partial payment.

**Q: Can I decline a job after bid is accepted?**  
A: Not recommended. Contact client and support immediately if you must cancel.

---

## Troubleshooting

### Login Issues

**Problem**: Can't log in  
**Solutions**:
- Check email/password are correct
- Reset password via **"Forgot Password"**
- Clear browser cache
- Try different browser

### Payment Issues

**Problem**: Payment fails  
**Solutions**:
- Check card details are correct
- Ensure sufficient funds
- Try different payment method
- Contact your bank
- Contact E-Clean support

### Notification Issues

**Problem**: Not receiving notifications  
**Solutions**:
- Check notification settings
- Allow browser notifications
- Check email spam folder
- Refresh page

### Chat Issues

**Problem**: Messages not sending  
**Solutions**:
- Check internet connection
- Refresh page
- Clear browser cache
- Try different browser

---

## Need Help?

- **Email Support**: support@eclean.com
- **Live Chat**: Available Mon-Fri 9am-5pm
- **Help Center**: [help.eclean.com](http://help.eclean.com)
- **Report Bug**: [GitHub Issues](https://github.com/vaskomet/CapstoneProjectMetallinosE-Clean/issues)

---

**Happy Cleaning! 🧹**
```

---

### 7.3 Create Admin Guide

**File**: `docs/ADMIN_GUIDE.md` (create new)

```markdown
# 📕 E-Clean Admin Guide

This guide is for platform administrators and staff members.

---

## Table of Contents

1. [Accessing Admin Panel](#accessing-admin-panel)
2. [Dashboard Overview](#dashboard-overview)
3. [User Management](#user-management)
4. [Job Management](#job-management)
5. [Payment Management](#payment-management)
6. [Content Moderation](#content-moderation)
7. [Platform Settings](#platform-settings)
8. [Reports & Analytics](#reports--analytics)

---

## Accessing Admin Panel

### Login

1. Navigate to: `http://your-domain.com/admin`
2. Enter superuser credentials
3. Click **"Log in"**

### Permissions

**Superuser**: Full access to all features  
**Staff**: Limited access based on permissions

---

## Dashboard Overview

### Metrics Displayed

1. **User Statistics**:
   - Total users
   - New users (last 30 days)
   - Active users
   - Cleaners count
   - Clients count

2. **Job Metrics**:
   - Total jobs
   - Active jobs
   - Completed jobs
   - Cancelled jobs
   - Jobs (last 7 days)

3. **Revenue**:
   - Total revenue
   - Platform fees collected
   - Average job value
   - Revenue (last 30 days)

4. **Reviews**:
   - Total reviews
   - Average rating

### Quick Actions

- View recent jobs
- View recent payments
- View recent users
- Export reports

---

## User Management

### Viewing Users

1. **Navigate**: `Admin` → `Users`
2. **View Options**:
   - List view (all users)
   - Grid view
   - Filter by type, status, date

### Searching Users

- Search by email
- Search by name
- Search by phone
- Filter by:
  - User type (client/cleaner)
  - Status (active/inactive)
  - Verified (yes/no)
  - Date joined

### User Actions

#### View User Details
1. Click on user in list
2. See:
   - Profile information
   - Job history (as client/cleaner)
   - Payment history
   - Reviews given/received
   - Chat history

#### Edit User
1. Click **"Edit"** button
2. Modify:
   - Name, email, phone
   - User type
   - Verification status
   - Active status
3. Click **"Save"**

#### Verify User
1. Select user(s)
2. Actions → **"Mark as verified"**
3. User receives notification

#### Block/Unblock User
1. Select user(s)
2. Actions → **"Block users"** or **"Unblock users"**
3. Blocked users cannot log in

#### Delete User
1. Click user
2. Scroll to bottom
3. Click **"Delete"** (red button)
4. Confirm deletion
5. ⚠️ **Warning**: This action cannot be undone

### Bulk Actions

- Select multiple users (checkboxes)
- Choose action from dropdown
- Click **"Go"**

Available bulk actions:
- Mark as verified/unverified
- Block/unblock users
- Export to CSV

---

## Job Management

### Viewing Jobs

1. **Navigate**: `Admin` → `Cleaning Jobs`
2. **Columns**:
   - ID
   - Title
   - Client
   - Cleaner
   - Status
   - Budget
   - Scheduled date
   - Created date

### Filtering Jobs

- By status (pending, in progress, completed, etc.)
- By date range
- By client
- By cleaner
- By budget range

### Job Actions

#### View Job Details
1. Click on job title
2. See:
   - Full description
   - Location details
   - Photos
   - Bids received
   - Payment information
   - Review (if completed)
   - Timeline

#### Edit Job
1. Click job
2. Modify fields as needed
3. Click **"Save"**

#### Change Job Status
1. Click job
2. Update **"Status"** field
3. Click **"Save"**

Or bulk action:
1. Select jobs
2. Actions → **"Mark as confirmed"** or **"Cancel jobs"**

#### Handle Disputes

If client/cleaner has issue:
1. Review job details
2. Check chat history
3. Review payment status
4. Contact both parties
5. Make decision:
   - Issue refund
   - Release payment
   - Cancel job

### Export Jobs

1. Select jobs (or select all)
2. Actions → **"Export to CSV"**
3. File downloads automatically
4. Contains: ID, title, client, cleaner, status, budget, dates

---

## Payment Management

### Viewing Payments

1. **Navigate**: `Admin` → `Payments`
2. **Columns**:
   - ID
   - Job
   - Payer (client)
   - Payee (cleaner)
   - Amount
   - Platform fee
   - Status
   - Created date

### Filtering Payments

- By status (pending, succeeded, failed, refunded)
- By date range
- By payer
- By payee
- By amount range

### Payment Actions

#### View Payment Details
1. Click payment ID
2. See:
   - Job details
   - Stripe payment intent ID
   - Stripe charge ID
   - Receipt URL
   - Timestamps
   - Refund history

#### Process Refund

1. Click payment
2. Scroll to **"Refunds"** section
3. Click **"Add refund"**
4. Enter:
   - Amount (full or partial)
   - Reason
5. Click **"Save"**
6. Refund processed via Stripe
7. Both parties notified

#### View Stripe Transaction

1. Click payment
2. Find **"Stripe payment intent ID"**
3. Copy ID
4. Go to Stripe Dashboard
5. Search by ID
6. View full Stripe transaction

### Payment Reports

1. Set date range
2. Select filters
3. Click **"Generate Report"**
4. Export as CSV or PDF

---

## Content Moderation

### Review Flagged Content

1. **Navigate**: `Admin` → `Flagged Content`
2. See:
   - Reported jobs
   - Reported reviews
   - Reported users

### Moderation Actions

#### Review Reports
1. Click flagged item
2. Review content
3. Check reporter's reason
4. Decide action:
   - Approve (no action needed)
   - Edit content
   - Remove content
   - Suspend user

#### Manage Reviews

Inappropriate reviews:
1. `Admin` → `Reviews`
2. Find review
3. Options:
   - Edit review text
   - Mark as not featured
   - Delete review (severe cases)

#### Manage Job Listings

Inappropriate jobs:
1. `Admin` → `Cleaning Jobs`
2. Find job
3. Options:
   - Edit job details
   - Cancel job
   - Contact poster
   - Delete job (extreme cases)

---

## Platform Settings

### General Settings

1. **Navigate**: `Admin` → `Settings`
2. Configure:
   - Platform name
   - Contact email
   - Support phone
   - Social media links

### Fee Configuration

1. **Navigate**: `Admin` → `Settings` → `Fees`
2. Set:
   - Platform fee percentage (default: 15%)
   - Cancellation fee
   - Minimum job amount
3. Click **"Save"**

### Email Templates

1. **Navigate**: `Admin` → `Email Templates`
2. Edit templates:
   - Welcome email
   - Bid notification
   - Payment confirmation
   - Review request
   - Newsletter

### Notification Settings

1. **Navigate**: `Admin` → `Notification Settings`
2. Configure:
   - Enable/disable notification types
   - Email delivery settings
   - Push notification settings
   - SMS settings (if integrated)

---

## Reports & Analytics

### User Analytics

1. **Navigate**: `Dashboard` → `User Analytics`
2. View:
   - User growth over time
   - User distribution (client vs cleaner)
   - Active users trend
   - User retention rate

### Job Analytics

1. **Navigate**: `Dashboard` → `Job Analytics`
2. View:
   - Jobs posted over time
   - Completion rate
   - Average job value
   - Popular job types
   - Geographic distribution

### Revenue Analytics

1. **Navigate**: `Dashboard` → `Revenue Analytics`
2. View:
   - Revenue over time
   - Platform fees collected
   - Average transaction value
   - Payment methods distribution
   - Refund rate

### Export Reports

1. Choose report type
2. Set date range
3. Select metrics
4. Click **"Export"**
5. Choose format (CSV, PDF, Excel)
6. Download file

---

## Common Admin Tasks

### Onboarding New Admin

1. Create user account
2. Set `is_staff = True`
3. Assign permissions groups
4. Send welcome email with credentials
5. Train on admin processes

### Handling Support Tickets

1. Review ticket details
2. Check related records (user, job, payment)
3. Communicate with user
4. Take necessary action
5. Close ticket with resolution notes

### Platform Maintenance

1. Monitor error logs
2. Check system performance
3. Review database backups
4. Update dependencies
5. Test critical features

### Security Checks

1. Review failed login attempts
2. Check for suspicious activity
3. Monitor payment anomalies
4. Update security patches
5. Review user permissions

---

## Best Practices

### User Support

- ✅ Respond within 24 hours
- ✅ Be professional and courteous
- ✅ Document all actions
- ✅ Escalate complex issues
- ✅ Follow up on resolutions

### Content Moderation

- ✅ Review context before action
- ✅ Be consistent with policies
- ✅ Document decisions
- ✅ Warn before suspending
- ✅ Provide appeal process

### Data Management

- ✅ Regular database backups
- ✅ Monitor storage usage
- ✅ Clean old logs
- ✅ Archive completed jobs
- ✅ Maintain data privacy

### Security

- ✅ Use strong passwords
- ✅ Enable 2FA for admin accounts
- ✅ Limit admin access
- ✅ Review audit logs
- ✅ Keep software updated

---

## Emergency Procedures

### Site Down

1. Check server status
2. Review error logs
3. Restart services if needed
4. Notify users via social media
5. Escalate to technical team

### Payment Issues

1. Check Stripe status
2. Review recent transactions
3. Contact affected users
4. Manual refund if needed
5. Report to Stripe support

### Security Breach

1. Immediately change admin passwords
2. Disable affected accounts
3. Review access logs
4. Contact security team
5. Notify affected users
6. Document incident

---

## Support Resources

- **Admin Email**: admin@eclean.com
- **Technical Support**: tech@eclean.com
- **Emergency Hotline**: +1-XXX-XXX-XXXX
- **Documentation**: docs.eclean.com/admin

---

**Admin Team - Keep E-Clean Running Smoothly! 🛠️**
```

---

### 7.4 Create API Documentation

**File**: `docs/API_REFERENCE.md` (create new)

```markdown
# 📙 E-Clean API Reference

REST API documentation for E-Clean platform.

---

## Base URL

- **Development**: `http://localhost:8000/api`
- **Production**: `https://api.eclean.com/api`

---

## Authentication

### Register User

```http
POST /auth/register/
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "user_type": "client"
}
```

**Response**: `201 Created`
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_type": "client"
  },
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Login

```http
POST /auth/login/
```

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response**: `200 OK`
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "user_type": "client"
  },
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Authenticated Requests

Include token in Authorization header:
```http
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

---

## Jobs

### List Jobs

```http
GET /cleaning-jobs/
```

**Query Parameters**:
- `status`: Filter by status
- `client`: Filter by client ID
- `cleaner`: Filter by cleaner ID
- `page`: Page number
- `page_size`: Results per page

**Response**: `200 OK`
```json
{
  "count": 45,
  "next": "/api/cleaning-jobs/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "title": "Deep clean apartment",
      "description": "...",
      "client": 5,
      "cleaner": null,
      "status": "pending",
      "budget": 150.00,
      "scheduled_date": "2024-12-01T10:00:00Z",
      "created_at": "2024-11-20T08:30:00Z"
    }
  ]
}
```

### Create Job

```http
POST /cleaning-jobs/
```

**Request Body**:
```json
{
  "title": "Deep clean apartment",
  "description": "Need thorough cleaning of 2-bedroom apartment",
  "budget": 150.00,
  "scheduled_date": "2024-12-01T10:00:00Z",
  "address": "123 Main St",
  "city": "Toronto",
  "postal_code": "M5V 3A8",
  "country": "Canada"
}
```

**Response**: `201 Created`

### Get Job Details

```http
GET /cleaning-jobs/{id}/
```

**Response**: `200 OK`
```json
{
  "id": 1,
  "title": "Deep clean apartment",
  "description": "...",
  "client": {
    "id": 5,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  },
  "cleaner": null,
  "status": "pending",
  "budget": 150.00,
  "scheduled_date": "2024-12-01T10:00:00Z",
  "bids": [],
  "payment": null,
  "review": null,
  "created_at": "2024-11-20T08:30:00Z"
}
```

### Start Job

```http
POST /cleaning-jobs/{id}/start/
```

**Response**: `200 OK`

### Complete Job

```http
POST /cleaning-jobs/{id}/complete/
```

**Response**: `200 OK`

### Cancel Job

```http
POST /cleaning-jobs/{id}/cancel/
```

**Request Body**:
```json
{
  "reason": "Schedule conflict"
}
```

**Response**: `200 OK`

---

## Payments

### Create Payment Intent

```http
POST /payments/create_intent/
```

**Request Body**:
```json
{
  "job_id": 1
}
```

**Response**: `201 Created`
```json
{
  "payment_id": 1,
  "client_secret": "pi_xxx_secret_yyy",
  "amount": 150.00,
  "platform_fee": 22.50,
  "cleaner_payout": 127.50
}
```

### Confirm Payment

```http
POST /payments/{id}/confirm/
```

**Response**: `200 OK`
```json
{
  "status": "success",
  "message": "Payment confirmed",
  "receipt_url": "https://..."
}
```

---

## Reviews

### Create Review

```http
POST /reviews/
Content-Type: multipart/form-data
```

**Request Body**:
```
job: 1
rating: 5
quality_rating: 5
communication_rating: 5
punctuality_rating: 5
feedback: "Excellent service!"
photo1: [file]
```

**Response**: `201 Created`

### Get Reviews for Cleaner

```http
GET /reviews/?cleaner={cleaner_id}
```

**Response**: `200 OK`

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request data",
  "details": {
    "email": ["This field is required."]
  }
}
```

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 403 Forbidden
```json
{
  "error": "You don't have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "detail": "Not found."
}
```

### 500 Internal Server Error
```json
{
  "error": "An unexpected error occurred"
}
```

---

## Rate Limiting

- **Limit**: 100 requests per hour per user
- **Headers**:
  - `X-RateLimit-Limit`: 100
  - `X-RateLimit-Remaining`: 95
  - `X-RateLimit-Reset`: 1638360000

---

## Pagination

All list endpoints support pagination:
- Default page size: 20
- Max page size: 100
- Use `page` and `page_size` query parameters

---

## Webhooks (Stripe)

```http
POST /payments/webhook/
```

Handles Stripe webhook events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

---

## Testing

Use test credentials:
- **Test Card**: 4242 4242 4242 4242
- **Any future expiry date**
- **Any CVC**

---

**Full API documentation**: http://localhost:8000/api/docs
```

---

## 📈 Task 7 Progress Tracker

**File**: `PHASE_1_PROGRESS.md` (update)

```markdown
## Week 4 (cont.): Documentation

### Day 6
- [ ] Update main README.md
- [ ] Add architecture diagram
- [ ] Add setup instructions
- [ ] Add contributing guidelines

### Day 7
- [ ] Create USER_GUIDE.md
- [ ] Create ADMIN_GUIDE.md
- [ ] Create API_REFERENCE.md
- [ ] Add screenshots/GIFs

### Weekend
- [ ] Review all documentation
- [ ] Fix typos and formatting
- [ ] Test all instructions
- [ ] Get feedback
```

---

**Task 7 Complete!** ✅

This comprehensive documentation guide includes:
- ✅ Updated README.md with full platform overview
- ✅ Architecture diagram and tech stack
- ✅ Quick start guides (Docker + Manual)
- ✅ Detailed USER_GUIDE.md (for clients & cleaners)
- ✅ Complete ADMIN_GUIDE.md (platform management)
- ✅ API_REFERENCE.md (endpoint documentation)
- ✅ FAQ and troubleshooting sections
- ✅ Contributing guidelines
- ✅ License and contact information

**Guide Status**: Tasks 1-7 Complete (10,800+ lines)

**Remaining tasks**:
- **Task 8**: Production Deployment Preparation
- **Task 9**: Final Polish & Launch Checklist

---

## 🚀 TASK 8: Production Deployment Preparation

**Estimated Time**: 6-8 hours  
**Priority**: CRITICAL  
**Status**: Not Started  
**Dependencies**: Tasks 1-7 (all features complete & documented)

### 8.0 Production Deployment Overview

**Goal**: Prepare the application for production deployment with security, performance, and reliability.

**Deployment Targets**:
- 🟦 **DigitalOcean**: Droplets + App Platform (recommended for beginners)
- 🟧 **AWS**: EC2 + RDS + S3 (scalable, more complex)
- 🟦 **Heroku**: Easy deployment (costs more)
- 🐳 **Docker**: Container-based deployment

**This Guide Focuses On**: DigitalOcean + Docker deployment

**Production Checklist**:
- ✅ Environment variables secured
- ✅ Database production-ready (PostgreSQL)
- ✅ Static files served efficiently
- ✅ Media files stored securely (S3)
- ✅ HTTPS/SSL enabled
- ✅ Domain configured
- ✅ Monitoring setup
- ✅ Backups automated
- ✅ Error logging configured
- ✅ Performance optimized

---

### 8.1 Production Environment Setup

#### Step 1: Create Production Environment File

**File**: `backend/.env.production` (create new, **DO NOT COMMIT**)

```bash
# Django Settings
DEBUG=False
SECRET_KEY=your-super-secret-production-key-here-change-this
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,api.yourdomain.com

# Database (Production PostgreSQL)
DATABASE_URL=postgresql://eclean_user:strong_password@db:5432/eclean_production

# Redis
REDIS_URL=redis://redis:6379/0

# Stripe (Production Keys)
STRIPE_SECRET_KEY=sk_live_your_production_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret

# Email (Production SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com  # or your SMTP provider
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=noreply@yourdomain.com
EMAIL_HOST_PASSWORD=your-email-password

# AWS S3 (Media Storage)
USE_S3=True
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_STORAGE_BUCKET_NAME=eclean-media-production
AWS_S3_REGION_NAME=us-east-1

# Security
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True
SECURE_SSL_REDIRECT=True
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=True
SECURE_HSTS_PRELOAD=True

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Sentry (Error Tracking - Optional)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Platform Settings
PLATFORM_FEE_PERCENTAGE=15.0
```

**⚠️ IMPORTANT**: Add to `.gitignore`:
```bash
echo ".env.production" >> .gitignore
```

#### Step 2: Update Django Settings for Production

**File**: `backend/e_clean_backend/settings.py` (update)

Add at the top:
```python
import os
from pathlib import Path
import dj_database_url
from urllib.parse import urlparse

# Build paths
BASE_DIR = Path(__file__).resolve().parent.parent

# Environment detection
DEBUG = os.getenv('DEBUG', 'False') == 'True'
SECRET_KEY = os.getenv('SECRET_KEY', 'development-secret-key-change-in-production')

# Hosts
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Security Settings (Production)
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    X_FRAME_OPTIONS = 'DENY'
```

Update database configuration:
```python
# Database
if os.getenv('DATABASE_URL'):
    # Production: Use DATABASE_URL
    DATABASES = {
        'default': dj_database_url.config(
            default=os.getenv('DATABASE_URL'),
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    # Development: SQLite or local PostgreSQL
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'eclean_dev'),
            'USER': os.getenv('DB_USER', 'postgres'),
            'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
            'HOST': os.getenv('DB_HOST', 'localhost'),
            'PORT': os.getenv('DB_PORT', '5432'),
        }
    }
```

Add S3 storage configuration:
```python
# AWS S3 Configuration
USE_S3 = os.getenv('USE_S3', 'False') == 'True'

if USE_S3:
    # S3 settings
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.getenv('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.getenv('AWS_S3_REGION_NAME', 'us-east-1')
    AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    AWS_DEFAULT_ACL = 'public-read'
    
    # Static and media files
    STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/static/'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'
    
    # Storage backends
    STATICFILES_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
else:
    # Local storage (development)
    STATIC_URL = '/static/'
    MEDIA_URL = '/media/'
    STATIC_ROOT = BASE_DIR / 'staticfiles'
    MEDIA_ROOT = BASE_DIR / 'media'
```

Add email configuration:
```python
# Email Configuration
EMAIL_BACKEND = os.getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'  # Development default
)

if not DEBUG:
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
    EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'E-Clean <noreply@yourdomain.com>')
```

Add logging configuration:
```python
# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'django.log',
            'maxBytes': 1024 * 1024 * 10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO' if not DEBUG else 'DEBUG',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# Create logs directory if it doesn't exist
LOGS_DIR = BASE_DIR / 'logs'
LOGS_DIR.mkdir(exist_ok=True)
```

Add Sentry error tracking (optional but recommended):
```python
# Sentry Error Tracking
if not DEBUG and os.getenv('SENTRY_DSN'):
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,  # Performance monitoring
        send_default_pii=False,
        environment='production',
    )
```

#### Step 3: Install Production Dependencies

**File**: `backend/requirements.txt` (add)

```bash
# Production dependencies
gunicorn==21.2.0          # Production WSGI server
dj-database-url==2.1.0    # Database URL parsing
psycopg2-binary==2.9.9    # PostgreSQL adapter
django-storages==1.14.2   # S3 storage backend
boto3==1.29.7             # AWS SDK
whitenoise==6.6.0         # Static file serving
sentry-sdk==1.38.0        # Error tracking (optional)
```

Install:
```bash
cd backend
pip install -r requirements.txt
```

#### Step 4: Create Production Dockerfile

**File**: `backend/Dockerfile.prod` (create new)

```dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    python3-dev \
    musl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . /app/

# Create logs directory
RUN mkdir -p /app/logs

# Collect static files
RUN python manage.py collectstatic --noinput || true

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "e_clean_backend.wsgi:application"]
```

#### Step 5: Create Production Docker Compose

**File**: `docker-compose.prod.yml` (update if exists, or create)

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    container_name: eclean_db_prod
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: eclean_production
      POSTGRES_USER: eclean_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    restart: always
    networks:
      - eclean_network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: eclean_redis_prod
    volumes:
      - redis_data_prod:/data
    restart: always
    networks:
      - eclean_network

  # Django Backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: eclean_backend_prod
    command: gunicorn --bind 0.0.0.0:8000 --workers 3 --timeout 120 e_clean_backend.wsgi:application
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
      - ./backend/logs:/app/logs
    env_file:
      - ./backend/.env.production
    depends_on:
      - db
      - redis
    restart: always
    networks:
      - eclean_network

  # Daphne (WebSocket Server)
  daphne:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    container_name: eclean_daphne_prod
    command: daphne -b 0.0.0.0 -p 8001 e_clean_backend.asgi:application
    env_file:
      - ./backend/.env.production
    depends_on:
      - db
      - redis
    restart: always
    networks:
      - eclean_network

  # React Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    container_name: eclean_frontend_prod
    restart: always
    networks:
      - eclean_network

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: eclean_nginx_prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static_volume:/app/staticfiles:ro
      - media_volume:/app/media:ro
    depends_on:
      - backend
      - daphne
      - frontend
    restart: always
    networks:
      - eclean_network

volumes:
  postgres_data_prod:
  redis_data_prod:
  static_volume:
  media_volume:

networks:
  eclean_network:
    driver: bridge
```

#### Step 6: Create Frontend Production Dockerfile

**File**: `frontend/Dockerfile.prod` (create new)

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**File**: `frontend/nginx.conf` (create new)

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

---

### 8.2 Nginx Configuration

#### Create Main Nginx Config

**File**: `nginx/nginx.conf` (create new)

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }

    upstream daphne {
        server daphne:8001;
    }

    upstream frontend {
        server frontend:80;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

    # HTTP server - redirect to HTTPS
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        # Max upload size
        client_max_body_size 10M;

        # API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_redirect off;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Admin panel
        location /admin/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket connections
        location /ws/ {
            proxy_pass http://daphne;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 86400;
        }

        # Static files
        location /static/ {
            alias /app/staticfiles/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Media files
        location /media/ {
            alias /app/media/;
            expires 30d;
            add_header Cache-Control "public";
        }

        # Frontend
        location / {
            limit_req zone=general_limit burst=50 nodelay;
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

---

### 8.3 SSL/HTTPS Setup

#### Option 1: Let's Encrypt (Free, Recommended)

**Install Certbot**:
```bash
# On your production server
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

**Generate SSL Certificate**:
```bash
# Stop nginx if running
sudo systemctl stop nginx

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates will be saved to:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

**Copy Certificates to Project**:
```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates (requires sudo)
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/
```

**Auto-renewal Setup**:
```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab for auto-renewal
sudo crontab -e

# Add this line (renews daily, certificate only renewed if needed)
0 0 * * * certbot renew --quiet && systemctl reload nginx
```

#### Option 2: Manual SSL Certificate

If you have purchased SSL certificate:
```bash
# Copy your certificate files
cp /path/to/your/certificate.crt nginx/ssl/fullchain.pem
cp /path/to/your/private.key nginx/ssl/privkey.pem
```

---

### 8.4 Database Migration & Setup

#### Production Database Setup

**Create PostgreSQL Database**:
```bash
# SSH into production server
ssh user@your-server-ip

# Access PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE eclean_production;
CREATE USER eclean_user WITH PASSWORD 'strong_secure_password_here';
ALTER ROLE eclean_user SET client_encoding TO 'utf8';
ALTER ROLE eclean_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE eclean_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE eclean_production TO eclean_user;
\q
```

#### Run Migrations

```bash
# On production server
cd /path/to/project

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Create superuser
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser

# Collect static files (if not using S3)
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

#### Database Backup Script

**File**: `scripts/backup_db.sh` (create new)

```bash
#!/bin/bash

# Database backup script
# Run daily via cron

BACKUP_DIR="/home/user/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/eclean_backup_$DATE.sql.gz"

# Create backup directory if doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U eclean_user eclean_production | gzip > $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "eclean_backup_*.sql.gz" -mtime +7 -delete

echo "Database backup completed: $BACKUP_FILE"
```

Make executable:
```bash
chmod +x scripts/backup_db.sh
```

Add to crontab:
```bash
crontab -e

# Add line (runs daily at 2 AM)
0 2 * * * /path/to/project/scripts/backup_db.sh
```

---

### 8.5 Frontend Production Build

#### Update Frontend Environment

**File**: `frontend/.env.production` (create new)

```bash
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_WS_URL=wss://yourdomain.com/ws
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_your_production_key
REACT_APP_SENTRY_DSN=https://your-frontend-sentry-dsn
```

#### Build Frontend

```bash
cd frontend

# Install dependencies
npm ci

# Build production bundle
npm run build

# Test production build locally
npm install -g serve
serve -s build
```

---

### 8.6 Deployment Script

**File**: `scripts/deploy.sh` (create new)

```bash
#!/bin/bash

# E-Clean Production Deployment Script

set -e  # Exit on error

echo "🚀 Starting E-Clean deployment..."

# Pull latest code
echo "📥 Pulling latest code from Git..."
git pull origin main

# Backend setup
echo "🔧 Setting up backend..."
cd backend

# Activate virtual environment (if not using Docker)
# source venv/bin/activate

# Install/update dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate --noinput

# Collect static files
python manage.py collectstatic --noinput

cd ..

# Frontend setup
echo "🎨 Building frontend..."
cd frontend

# Install dependencies
npm ci

# Build production bundle
npm run build

cd ..

# Restart services
echo "🔄 Restarting services..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Health check
echo "🏥 Running health check..."
sleep 10
curl -f http://localhost/api/health/ || echo "❌ Health check failed!"

echo "✅ Deployment completed!"
echo "📊 Check logs: docker-compose -f docker-compose.prod.yml logs -f"
```

Make executable:
```bash
chmod +x scripts/deploy.sh
```

---

### 8.7 Monitoring & Logging

#### Setup Application Monitoring

**1. Install Sentry** (Error Tracking):

Backend already configured in settings.py. Sign up at [sentry.io](https://sentry.io):
```bash
# Add to .env.production
SENTRY_DSN=https://your-key@sentry.io/project-id
```

Frontend:
```bash
cd frontend
npm install @sentry/react @sentry/tracing
```

**File**: `frontend/src/index.js` (update)

```javascript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
  });
}
```

**2. Setup Log Monitoring**:

View logs:
```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

**3. Create Health Check Endpoint**:

**File**: `backend/core/views.py` (create new)

```python
from django.http import JsonResponse
from django.db import connection

def health_check(request):
    """Health check endpoint for monitoring"""
    try:
        # Check database connection
        connection.ensure_connection()
        
        return JsonResponse({
            'status': 'healthy',
            'database': 'connected',
            'version': '1.0.0'
        })
    except Exception as e:
        return JsonResponse({
            'status': 'unhealthy',
            'error': str(e)
        }, status=500)
```

**File**: `backend/e_clean_backend/urls.py` (add)

```python
from core.views import health_check

urlpatterns = [
    # ... existing patterns
    path('api/health/', health_check, name='health-check'),
]
```

**4. Setup Uptime Monitoring**:

Use services like:
- **UptimeRobot** (free): https://uptimerobot.com
- **Pingdom**: https://pingdom.com
- **StatusCake** (free tier): https://statuscake.com

Configure to ping: `https://yourdomain.com/api/health/` every 5 minutes

---

### 8.8 Performance Optimization

#### Backend Optimization

**1. Database Connection Pooling**:

Already configured in settings.py:
```python
DATABASES = {
    'default': {
        # ... other settings
        'CONN_MAX_AGE': 600,  # Keep connections open for 10 minutes
    }
}
```

**2. Redis Caching**:

**File**: `backend/e_clean_backend/settings.py` (add)

```python
# Caching
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.getenv('REDIS_URL', 'redis://127.0.0.1:6379/1'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

# Session storage
SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'default'
```

**3. Database Query Optimization**:

Add to views:
```python
# Use select_related for foreign keys
jobs = CleaningJob.objects.select_related('client', 'cleaner')

# Use prefetch_related for many-to-many
jobs = CleaningJob.objects.prefetch_related('bids', 'bids__bidder')

# Add database indexes in models
class CleaningJob(models.Model):
    # ... fields
    class Meta:
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['client', '-created_at']),
            models.Index(fields=['cleaner', '-created_at']),
        ]
```

#### Frontend Optimization

**1. Code Splitting**:

**File**: `frontend/src/App.jsx` (update)

```javascript
import React, { lazy, Suspense } from 'react';

// Lazy load routes
const Dashboard = lazy(() => import('./pages/Dashboard'));
const JobDetails = lazy(() => import('./pages/JobDetails'));
const CreateJob = lazy(() => import('./pages/CreateJob'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/jobs/create" element={<CreateJob />} />
      </Routes>
    </Suspense>
  );
}
```

**2. Image Optimization**:

Already implemented in Task 4 (imageOptimization.js)

**3. Bundle Analysis**:

```bash
cd frontend

# Install analyzer
npm install --save-dev webpack-bundle-analyzer

# Analyze bundle
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

---

### 8.9 Security Hardening

#### Backend Security

**1. Update Django Security Middleware**:

**File**: `backend/e_clean_backend/settings.py`

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

**2. Configure CORS Properly**:

```python
# CORS Configuration
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'https://yourdomain.com'
    ).split(',')

CORS_ALLOW_CREDENTIALS = True
```

**3. Rate Limiting**:

Already configured in nginx.conf

**4. Environment Variables Security**:

```bash
# Never commit these files
.env
.env.production
.env.local

# Verify they're in .gitignore
cat .gitignore | grep .env
```

#### Server Security

**1. Firewall Setup**:

```bash
# Ubuntu/Debian
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

**2. Fail2Ban (Prevent Brute Force)**:

```bash
# Install
sudo apt-get install fail2ban

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**3. Regular Updates**:

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

---

### 8.10 Final Production Checklist

**Before Going Live**:

```bash
# Configuration
□ Environment variables set in .env.production
□ DEBUG=False in production
□ SECRET_KEY changed from default
□ ALLOWED_HOSTS configured
□ Database configured (PostgreSQL)
□ Redis configured

# Security
□ HTTPS/SSL enabled
□ Security headers configured
□ CORS properly configured
□ Rate limiting enabled
□ Firewall configured
□ Strong passwords used

# Services
□ Database backups automated
□ Error tracking setup (Sentry)
□ Logging configured
□ Health check endpoint working
□ Uptime monitoring setup

# Performance
□ Static files served efficiently
□ Media files on S3 (or CDN)
□ Caching enabled (Redis)
□ Database queries optimized
□ Frontend bundle optimized

# Stripe
□ Production API keys configured
□ Webhook endpoint configured
□ Webhook signature verification enabled
□ Test payment flow in production

# Testing
□ Run all tests (backend + frontend)
□ Test payment flow end-to-end
□ Test WebSocket connections
□ Test file uploads
□ Test on multiple devices

# Documentation
□ README updated with production info
□ Admin credentials documented (securely)
□ Backup/restore procedures documented
□ Monitoring dashboards set up

# Domain & DNS
□ Domain purchased
□ DNS A record points to server IP
□ SSL certificate installed
□ www subdomain configured

# Final Steps
□ Run database migrations
□ Create superuser account
□ Load initial data (if any)
□ Test admin panel access
□ Verify email sending works
□ Monitor logs for errors
```

---

### 8.11 Deployment to DigitalOcean

#### Step-by-Step DigitalOcean Deployment

**1. Create Droplet**:
```
- Log in to DigitalOcean
- Click "Create" → "Droplets"
- Choose:
  - Ubuntu 22.04 LTS
  - Basic Plan: $12/month (2 GB RAM, 1 CPU)
  - Add SSH key
  - Choose region closest to users
  - Hostname: eclean-production
```

**2. Initial Server Setup**:

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Create app user
adduser eclean
usermod -aG sudo eclean
usermod -aG docker eclean

# Switch to app user
su - eclean
```

**3. Clone and Setup**:

```bash
# Clone repository
git clone https://github.com/vaskomet/CapstoneProjectMetallinosE-Clean.git
cd CapstoneProjectMetallinosE-Clean

# Copy and configure environment
cp backend/.env.example backend/.env.production
nano backend/.env.production  # Edit with production values

# Deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**4. Configure Domain**:

```
- Go to your domain registrar
- Add A record:
  - Type: A
  - Name: @
  - Value: your-server-ip
  - TTL: 3600

- Add CNAME record (optional):
  - Type: CNAME
  - Name: www
  - Value: yourdomain.com
  - TTL: 3600
```

**5. Setup SSL**:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts
```

---

## 📈 Task 8 Progress Tracker

**File**: `PHASE_1_PROGRESS.md` (update)

```markdown
## Week 5: Production Deployment

### Day 1: Environment Setup
- [ ] Create .env.production
- [ ] Update Django settings for production
- [ ] Install production dependencies
- [ ] Create production Dockerfiles

### Day 2: Server & Database
- [ ] Create DigitalOcean droplet
- [ ] Setup PostgreSQL database
- [ ] Configure Redis
- [ ] Run migrations

### Day 3: Nginx & SSL
- [ ] Configure Nginx
- [ ] Setup SSL with Let's Encrypt
- [ ] Configure domain DNS
- [ ] Test HTTPS

### Day 4: Monitoring & Backups
- [ ] Setup Sentry error tracking
- [ ] Configure log monitoring
- [ ] Create database backup script
- [ ] Setup uptime monitoring

### Day 5: Optimization & Testing
- [ ] Enable caching
- [ ] Optimize database queries
- [ ] Build frontend production bundle
- [ ] Test full application

### Weekend: Go Live
- [ ] Final security audit
- [ ] Complete production checklist
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Celebrate launch! 🎉
```

---

**Task 8 Complete!** ✅

This comprehensive deployment guide covers:
- ✅ Production environment configuration
- ✅ Docker production setup (backend, frontend, nginx)
- ✅ PostgreSQL database setup
- ✅ SSL/HTTPS configuration (Let's Encrypt)
- ✅ Nginx reverse proxy & rate limiting
- ✅ Database backups automation
- ✅ Monitoring & logging (Sentry)
- ✅ Performance optimization (caching, queries, code splitting)
- ✅ Security hardening (headers, CORS, firewall, fail2ban)
- ✅ Complete production checklist
- ✅ DigitalOcean deployment walkthrough

---

## Task 9: Final Polish & Launch Checklist

**Objective**: Conduct comprehensive pre-launch testing, security audit, and final polish to ensure a smooth, successful platform launch.

**Time Estimate**: 4-6 hours

**Prerequisites**:
- All Tasks 1-8 completed
- Production environment configured
- Application deployed to staging/production

---

### 9.1 Pre-Launch Testing Strategy

#### Comprehensive UAT (User Acceptance Testing) Plan

**Test User Accounts** (Create these for testing):

```bash
# Backend Django shell
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from django.contrib.auth import get_user_model
from users.models import CleanerProfile

User = get_user_model()

# Test Client 1
client1 = User.objects.create_user(
    username='test_client_1',
    email='client1@test.com',
    password='TestPass123!',
    user_type='client',
    first_name='Sarah',
    last_name='Johnson'
)

# Test Client 2
client2 = User.objects.create_user(
    username='test_client_2',
    email='client2@test.com',
    password='TestPass123!',
    user_type='client',
    first_name='Michael',
    last_name='Chen'
)

# Test Cleaner 1
cleaner1 = User.objects.create_user(
    username='test_cleaner_1',
    email='cleaner1@test.com',
    password='TestPass123!',
    user_type='cleaner',
    first_name='Maria',
    last_name='Garcia'
)

# Create cleaner profile
CleanerProfile.objects.create(
    user=cleaner1,
    bio='Experienced cleaner with 5 years of service',
    hourly_rate=25.00,
    service_radius=20.0,
    latitude=37.7749,
    longitude=-122.4194
)

# Test Cleaner 2
cleaner2 = User.objects.create_user(
    username='test_cleaner_2',
    email='cleaner2@test.com',
    password='TestPass123!',
    user_type='cleaner',
    first_name='James',
    last_name='Brown'
)

CleanerProfile.objects.create(
    user=cleaner2,
    bio='Detail-oriented cleaner specializing in deep cleaning',
    hourly_rate=30.00,
    service_radius=15.0,
    latitude=37.7749,
    longitude=-122.4194
)

print("Test users created successfully!")
```

#### UAT Test Scenarios Checklist

**1. User Registration & Authentication** (30 mins)

- [ ] Register new client account
  - [ ] Email validation works
  - [ ] Password strength requirements enforced
  - [ ] Welcome email received
  - [ ] Redirected to dashboard after registration

- [ ] Register new cleaner account
  - [ ] Additional cleaner fields present
  - [ ] Profile photo upload works
  - [ ] Location services prompt appears
  - [ ] Verification pending message shown

- [ ] Login functionality
  - [ ] Correct credentials allow login
  - [ ] Wrong password shows error
  - [ ] "Remember me" persists session
  - [ ] JWT token stored correctly

- [ ] Password reset flow
  - [ ] Reset email sent
  - [ ] Reset link works (not expired)
  - [ ] New password saves successfully
  - [ ] Can login with new password

**2. Client Job Posting Flow** (45 mins)

- [ ] Create new cleaning job
  - [ ] Form validation works (required fields)
  - [ ] Date picker allows future dates only
  - [ ] Address autocomplete functions
  - [ ] Property type dropdown works
  - [ ] Property size calculated correctly
  - [ ] Photo upload (multiple images)
  - [ ] Special instructions text area works
  - [ ] Estimated price calculated

- [ ] View posted jobs
  - [ ] Job appears in "My Jobs" list
  - [ ] Status shows "Open for Bids"
  - [ ] Edit job option available
  - [ ] Delete job option works

- [ ] Receive and review bids
  - [ ] Bid notifications received (email + in-app)
  - [ ] Bid details visible (price, message, cleaner profile)
  - [ ] Can view cleaner profile from bid
  - [ ] Cleaner ratings/reviews visible
  - [ ] Accept bid button works
  - [ ] Reject bid button works

**3. Cleaner Job Discovery & Bidding** (45 mins)

- [ ] Browse available jobs
  - [ ] Jobs list loads correctly
  - [ ] Distance calculation accurate
  - [ ] Filters work (distance, price, property type)
  - [ ] Search by location works
  - [ ] Job details modal opens

- [ ] Submit bid on job
  - [ ] Bid form validation works
  - [ ] Can set custom price
  - [ ] Can add personal message
  - [ ] Estimated earnings shown
  - [ ] Submit bid success message

- [ ] View submitted bids
  - [ ] "My Bids" list accurate
  - [ ] Bid status updated (pending/accepted/rejected)
  - [ ] Can withdraw bid before acceptance
  - [ ] Notifications for bid status changes

**4. Payment Processing** (45 mins)

- [ ] Client payment for accepted job
  - [ ] Redirected to payment page after accepting bid
  - [ ] Stripe payment form loads
  - [ ] Test card works (4242 4242 4242 4242)
  - [ ] Payment intent created
  - [ ] Payment confirmation shown
  - [ ] Receipt email sent
  - [ ] Payment appears in "My Payments"

- [ ] Payment security
  - [ ] PCI compliance (no card data stored)
  - [ ] SSL/HTTPS enforced
  - [ ] 3D Secure test card works (if applicable)
  - [ ] Failed payment shows proper error

- [ ] Cleaner payout tracking
  - [ ] Expected payout visible after job completion
  - [ ] Platform fee calculated correctly (15%)
  - [ ] Payout schedule information shown
  - [ ] Stripe Connect dashboard link works

**5. Job Lifecycle Management** (60 mins)

- [ ] Job starts
  - [ ] Client can mark job as "In Progress"
  - [ ] Both parties notified
  - [ ] Status updates in real-time
  - [ ] Timer starts (if applicable)

- [ ] Job completion
  - [ ] Cleaner can mark as "Completed"
  - [ ] Before/after photos uploadable
  - [ ] Completion notes submittable
  - [ ] Client notified of completion

- [ ] Client approval
  - [ ] Client can review completed work
  - [ ] Can approve completion
  - [ ] Can request revision
  - [ ] Payment released upon approval

- [ ] Job cancellation
  - [ ] Client can cancel before start (full refund)
  - [ ] Cancellation within 24hrs (partial refund)
  - [ ] Cleaner compensated if applicable
  - [ ] Refund processed correctly

**6. Review & Rating System** (30 mins)

- [ ] Client reviews cleaner
  - [ ] Review prompt after job completion
  - [ ] Star rating (1-5) works
  - [ ] Written review submittable
  - [ ] Review appears on cleaner profile
  - [ ] Average rating updated

- [ ] Cleaner reviews client
  - [ ] Can submit review after job
  - [ ] Review visible to other cleaners (if public)
  - [ ] Cannot submit multiple reviews for same job

- [ ] Review moderation
  - [ ] Admin can view all reviews
  - [ ] Flagging inappropriate reviews works
  - [ ] Admin can hide/delete reviews

**7. Real-Time Chat & Messaging** (30 mins)

- [ ] Direct messaging
  - [ ] Can initiate chat with cleaner from bid
  - [ ] Can initiate chat with client from job
  - [ ] Messages send in real-time (WebSocket)
  - [ ] Message history loads
  - [ ] Unread count updates
  - [ ] Notifications for new messages

- [ ] Chat room for job
  - [ ] Dedicated chat per job after acceptance
  - [ ] Both parties have access
  - [ ] Can share photos in chat
  - [ ] Chat archived after job completion
  - [ ] Can search message history

**8. Notifications System** (30 mins)

- [ ] In-app notifications
  - [ ] Bell icon shows unread count
  - [ ] Notification dropdown works
  - [ ] Mark as read works
  - [ ] Clear all works
  - [ ] Notifications link to relevant page

- [ ] Email notifications
  - [ ] New bid received
  - [ ] Bid accepted/rejected
  - [ ] Payment confirmation
  - [ ] Job status changes
  - [ ] New message received
  - [ ] Review submitted
  - [ ] Unsubscribe link works

- [ ] Notification preferences
  - [ ] Can toggle email notifications
  - [ ] Can toggle push notifications (if implemented)
  - [ ] Preferences save correctly

**9. Admin Dashboard** (45 mins)

- [ ] User management
  - [ ] View all users (clients & cleaners)
  - [ ] Search users works
  - [ ] Filter by user type
  - [ ] View user details
  - [ ] Verify cleaner accounts
  - [ ] Block/unblock users
  - [ ] Bulk actions work

- [ ] Job management
  - [ ] View all jobs
  - [ ] Filter by status
  - [ ] View job details
  - [ ] Manually change job status
  - [ ] Handle disputes
  - [ ] Export to CSV works

- [ ] Payment management
  - [ ] View all transactions
  - [ ] Filter by date range
  - [ ] Process refunds
  - [ ] View Stripe dashboard link
  - [ ] Revenue analytics accurate

- [ ] Analytics dashboard
  - [ ] User growth chart loads
  - [ ] Job completion rate accurate
  - [ ] Revenue chart displays
  - [ ] Recent activity feed works

**10. Mobile Responsiveness** (45 mins)

Test on multiple devices/screen sizes:

- [ ] **iPhone (iOS Safari)** - 375x667px
  - [ ] Navigation menu hamburger works
  - [ ] Touch targets adequate size (44px minimum)
  - [ ] Forms keyboard-friendly
  - [ ] Job cards stack properly
  - [ ] Images scale correctly
  - [ ] No horizontal scroll

- [ ] **Android (Chrome)** - 360x640px
  - [ ] All iPhone tests pass
  - [ ] Back button behavior correct
  - [ ] Material design elements render

- [ ] **iPad (Safari)** - 768x1024px
  - [ ] Layout adapts to tablet size
  - [ ] Can use in portrait & landscape
  - [ ] Touch gestures work (swipe, pinch)

- [ ] **Desktop** - 1920x1080px
  - [ ] Multi-column layouts display
  - [ ] Hover states work
  - [ ] Mouse interactions smooth

**11. Cross-Browser Compatibility** (30 mins)

- [ ] **Chrome** (latest)
  - [ ] All features functional
  - [ ] WebSocket connections stable
  - [ ] No console errors

- [ ] **Firefox** (latest)
  - [ ] All features functional
  - [ ] Payment form renders
  - [ ] Chat works

- [ ] **Safari** (latest)
  - [ ] All features functional
  - [ ] Date pickers work
  - [ ] No webkit-specific issues

- [ ] **Edge** (latest)
  - [ ] All features functional
  - [ ] No compatibility warnings

---

### 9.2 Security Audit Checklist

#### OWASP Top 10 Security Verification

**1. Injection Attacks Prevention**

- [ ] **SQL Injection**
  - [ ] All queries use Django ORM (parameterized)
  - [ ] No raw SQL with user input
  - [ ] Test: Try `' OR '1'='1` in search fields
  - [ ] Result: Should return no results or error safely

- [ ] **Command Injection**
  - [ ] No `os.system()` or `subprocess` with user input
  - [ ] File uploads validated by type & content
  - [ ] Test: Upload file named `test.jpg; rm -rf /`
  - [ ] Result: Should sanitize filename

**2. Broken Authentication**

- [ ] **Password Security**
  - [ ] Passwords hashed (Django's PBKDF2)
  - [ ] Minimum 8 characters enforced
  - [ ] Must include uppercase, lowercase, number
  - [ ] Password reset tokens expire (1 hour)
  - [ ] Session timeout configured (2 weeks default)

- [ ] **JWT Token Security**
  - [ ] Access tokens expire (15 minutes)
  - [ ] Refresh tokens expire (7 days)
  - [ ] Tokens stored in httpOnly cookies (not localStorage)
  - [ ] Token revocation on logout works
  - [ ] Test: Use expired token → Should return 401

**3. Sensitive Data Exposure**

- [ ] **HTTPS/SSL Enforced**
  - [ ] All traffic redirected to HTTPS
  - [ ] SSL certificate valid (no warnings)
  - [ ] Test: Visit http://yourdomain.com → Should redirect to https://
  - [ ] HSTS header present (`Strict-Transport-Security`)

- [ ] **Data Protection**
  - [ ] Payment card data never stored (PCI compliance)
  - [ ] Only Stripe tokens stored
  - [ ] Passwords never logged
  - [ ] API keys in environment variables (not code)
  - [ ] `.env` files in `.gitignore`

- [ ] **Information Leakage**
  - [ ] DEBUG=False in production
  - [ ] Generic error messages (no stack traces to users)
  - [ ] No sensitive data in URLs
  - [ ] Test: Trigger 500 error → Should show generic page

**4. XML External Entities (XXE)**

- [ ] No XML parsing from user input
- [ ] If XML used, external entities disabled
- [ ] JSON preferred over XML

**5. Broken Access Control**

- [ ] **Authorization Checks**
  - [ ] Clients cannot access cleaner-only endpoints
  - [ ] Cleaners cannot access client-only endpoints
  - [ ] Users can only edit their own data
  - [ ] Test: As Client, try to POST to `/api/cleaner-profile/`
  - [ ] Result: Should return 403 Forbidden

- [ ] **Object-Level Authorization**
  - [ ] Cannot view/edit other users' jobs
  - [ ] Cannot view other users' payments
  - [ ] Test: Change job ID in URL to another user's job
  - [ ] Result: Should return 403 or 404

- [ ] **Admin Access**
  - [ ] Admin panel only accessible to staff users
  - [ ] Test: Login as regular user, visit `/admin/`
  - [ ] Result: Should redirect to login or show 403

**6. Security Misconfiguration**

- [ ] **Server Hardening**
  - [ ] Unnecessary services disabled
  - [ ] Default passwords changed
  - [ ] Security headers configured:
    ```
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    X-XSS-Protection: 1; mode=block
    Content-Security-Policy: (configured)
    Strict-Transport-Security: max-age=31536000; includeSubDomains
    ```

- [ ] **Error Handling**
  - [ ] Custom 404 page
  - [ ] Custom 500 page
  - [ ] No verbose error messages in production

**7. Cross-Site Scripting (XSS)**

- [ ] **Input Sanitization**
  - [ ] All user input escaped in templates
  - [ ] React automatically escapes (JSX)
  - [ ] Test: Submit `<script>alert('XSS')</script>` in bio
  - [ ] Result: Should display as text, not execute

- [ ] **Content Security Policy**
  - [ ] CSP header restricts script sources
  - [ ] Inline scripts avoided (use nonce if needed)

**8. Insecure Deserialization**

- [ ] No `pickle` or `eval()` on user data
- [ ] JSON deserialization validated
- [ ] Django Rest Framework handles safely

**9. Using Components with Known Vulnerabilities**

- [ ] **Dependency Audit**
  ```bash
  # Backend
  pip install safety
  safety check
  
  # Frontend
  npm audit
  npm audit fix
  ```

- [ ] All dependencies up-to-date
- [ ] No critical vulnerabilities
- [ ] Automated security scanning configured (Dependabot, Snyk)

**10. Insufficient Logging & Monitoring**

- [ ] **Logging Configured**
  - [ ] Failed login attempts logged
  - [ ] Payment transactions logged
  - [ ] Admin actions logged
  - [ ] Errors logged with context (Sentry)

- [ ] **Monitoring Alerts**
  - [ ] Sentry notifications for errors
  - [ ] Uptime monitoring configured
  - [ ] Unusual activity alerts (optional)

#### Penetration Testing Basics

**Manual Security Tests**:

1. **CSRF Protection**
   ```bash
   # Test: Remove CSRF token from form submission
   # Expected: 403 Forbidden
   ```

2. **Rate Limiting**
   ```bash
   # Test: Make 100 rapid API requests
   for i in {1..100}; do
     curl https://yourdomain.com/api/jobs/
   done
   # Expected: Rate limit error after 10-30 requests
   ```

3. **File Upload Security**
   - [ ] Upload executable file (.exe, .sh) → Should reject
   - [ ] Upload oversized file (>10MB) → Should reject
   - [ ] Upload with malicious filename → Should sanitize

4. **Session Hijacking Prevention**
   - [ ] SESSION_COOKIE_SECURE = True (HTTPS only)
   - [ ] SESSION_COOKIE_HTTPONLY = True (no JavaScript access)
   - [ ] SESSION_COOKIE_SAMESITE = 'Lax' (CSRF protection)

**Automated Security Scanning**:

```bash
# ZAP (Zed Attack Proxy) - Free OWASP tool
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://yourdomain.com

# Nikto - Web server scanner
nikto -h https://yourdomain.com

# SSLyze - SSL/TLS configuration scanner
sslyze yourdomain.com
```

---

### 9.3 Performance Optimization Final Pass

#### Page Load Speed Optimization

**1. Frontend Performance Audit**

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run Lighthouse audit
lighthouse https://yourdomain.com --output html --output-path ./lighthouse-report.html --view
```

**Performance Targets**:
- [ ] **Performance Score**: 90+ (Lighthouse)
- [ ] **First Contentful Paint**: < 1.8s
- [ ] **Largest Contentful Paint**: < 2.5s
- [ ] **Time to Interactive**: < 3.8s
- [ ] **Cumulative Layout Shift**: < 0.1

**2. Image Optimization Check**

- [ ] All images compressed (TinyPNG, ImageOptim)
- [ ] Modern formats used (WebP with JPEG fallback)
- [ ] Lazy loading implemented
- [ ] Responsive images with srcset
- [ ] Test: Check image sizes in Network tab
  - Profile photos: < 100KB
  - Property photos: < 300KB
  - Icons: < 10KB (SVG preferred)

**3. JavaScript Bundle Optimization**

```bash
# Analyze bundle size
cd frontend
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

**Bundle Size Targets**:
- [ ] Main bundle: < 250KB (gzipped)
- [ ] Vendor bundle: < 500KB (gzipped)
- [ ] Total JS: < 800KB (gzipped)

**Optimization Techniques**:
- [ ] Code splitting implemented (React.lazy)
- [ ] Tree shaking enabled (webpack)
- [ ] Unused dependencies removed
- [ ] Heavy libraries loaded on-demand (e.g., Stripe.js)

**4. CSS Optimization**

- [ ] Tailwind CSS purged (unused classes removed)
- [ ] Critical CSS inlined (above-the-fold)
- [ ] Non-critical CSS deferred
- [ ] Test: CSS bundle < 100KB (gzipped)

#### Database Performance Verification

**1. Query Performance Audit**

```bash
# Enable query logging in Django
# In settings.py (temporarily for testing)
LOGGING = {
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}

# Restart server and monitor queries
docker-compose -f docker-compose.prod.yml logs -f backend | grep "SELECT"
```

**Check for**:
- [ ] No N+1 queries (use `select_related`, `prefetch_related`)
- [ ] Queries < 50ms average
- [ ] No queries without WHERE clause on large tables
- [ ] Indexes used (check EXPLAIN output)

**2. Database Index Verification**

```python
# Django shell
from django.db import connection
from cleaning_jobs.models import Job

# Check query plan
jobs = Job.objects.filter(status='open').select_related('client')
print(connection.queries[-1])

# Should show index usage like:
# "Index Scan using cleaning_jobs_job_status_idx"
```

**Required Indexes** (verify in migrations):
- [ ] `Job.status`
- [ ] `Job.client_id`
- [ ] `Job.cleaner_id`
- [ ] `User.email`
- [ ] `User.user_type`
- [ ] `CleanerProfile.latitude, longitude` (spatial index if using PostGIS)

#### Caching Verification

**1. Redis Cache Working**

```bash
# Connect to Redis
docker-compose -f docker-compose.prod.yml exec redis redis-cli

# Check cached keys
KEYS *

# Should see keys like:
# - sessions:*
# - views.decorators.cache.cache_page:*
```

**2. Cache Hit Ratio**

```python
# Backend view to monitor cache
from django.core.cache import cache
from django.http import JsonResponse

def cache_stats(request):
    info = cache._cache.get_client().info()
    hit_rate = info['keyspace_hits'] / (info['keyspace_hits'] + info['keyspace_misses'])
    return JsonResponse({
        'hit_rate': f"{hit_rate * 100:.2f}%",
        'keys': info['db0']['keys']
    })
```

**Cache Targets**:
- [ ] Cache hit rate > 80%
- [ ] Frequently accessed data cached (job listings, user profiles)
- [ ] Cache invalidation works (update user → cache cleared)

#### CDN Setup (Optional but Recommended)

**Cloudflare Setup** (Free Tier):

1. [ ] Sign up at cloudflare.com
2. [ ] Add domain
3. [ ] Update nameservers at domain registrar
4. [ ] Enable CDN for static assets
5. [ ] Configure caching rules:
   - Images: Cache 1 month
   - JS/CSS: Cache 1 week
   - API endpoints: No cache
6. [ ] Enable minification (JS, CSS, HTML)
7. [ ] Enable Brotli compression
8. [ ] Test: Check response headers for `CF-Cache-Status: HIT`

---

### 9.4 Load Testing & Stress Testing

#### Locust Load Testing

**Create Load Test Script**: `backend/locustfile.py`

```python
from locust import HttpUser, task, between
import random

class ECleanUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login before starting tasks"""
        response = self.client.post("/api/auth/login/", json={
            "username": f"test_user_{random.randint(1, 100)}",
            "password": "TestPass123!"
        })
        if response.status_code == 200:
            self.token = response.json().get('access')
            self.client.headers.update({"Authorization": f"Bearer {self.token}"})
    
    @task(3)
    def view_jobs(self):
        """Browse available jobs (most common action)"""
        self.client.get("/api/jobs/", name="View Jobs")
    
    @task(2)
    def view_job_detail(self):
        """View specific job details"""
        job_id = random.randint(1, 50)
        self.client.get(f"/api/jobs/{job_id}/", name="View Job Detail")
    
    @task(1)
    def search_jobs(self):
        """Search jobs by location"""
        lat = 37.7749 + random.uniform(-0.1, 0.1)
        lon = -122.4194 + random.uniform(-0.1, 0.1)
        self.client.get(
            f"/api/jobs/?lat={lat}&lon={lon}&radius=10",
            name="Search Jobs"
        )
    
    @task(1)
    def view_profile(self):
        """View user profile"""
        self.client.get("/api/users/me/", name="View Profile")
    
    @task(1)
    def view_notifications(self):
        """Check notifications"""
        self.client.get("/api/notifications/", name="View Notifications")

class ClientUser(ECleanUser):
    """Client-specific behaviors"""
    
    @task(2)
    def create_job(self):
        """Post a new cleaning job"""
        self.client.post("/api/jobs/", json={
            "title": "House Cleaning Needed",
            "description": "3 bedroom house deep cleaning",
            "property_type": "house",
            "property_size": 2000,
            "address": "123 Main St, San Francisco, CA",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "scheduled_date": "2025-11-01",
            "scheduled_time": "10:00:00"
        }, name="Create Job")

class CleanerUser(ECleanUser):
    """Cleaner-specific behaviors"""
    
    @task(2)
    def submit_bid(self):
        """Submit bid on a job"""
        job_id = random.randint(1, 50)
        self.client.post(f"/api/jobs/{job_id}/bids/", json={
            "amount": random.randint(50, 200),
            "message": "I'm available for this job!",
            "estimated_hours": random.randint(2, 6)
        }, name="Submit Bid")
```

**Run Load Tests**:

```bash
# Install Locust
pip install locust

# Run with 100 users, spawn rate 10/second
locust -f backend/locustfile.py --host=https://yourdomain.com --users 100 --spawn-rate 10

# Access web UI at http://localhost:8089
```

**Load Test Targets**:
- [ ] **100 concurrent users**: Response time < 500ms (95th percentile)
- [ ] **500 concurrent users**: Response time < 1s (95th percentile)
- [ ] **1000 concurrent users**: No errors (< 1% failure rate)
- [ ] **Sustained load (30 min)**: No memory leaks, stable performance

**Monitor During Load Test**:

```bash
# CPU & Memory usage
docker stats

# Database connections
docker-compose -f docker-compose.prod.yml exec postgres psql -U eclean_user -d eclean_production -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory
docker-compose -f docker-compose.prod.yml exec redis redis-cli INFO memory
```

#### Stress Testing (Find Breaking Point)

```bash
# Gradually increase load until failure
locust -f backend/locustfile.py --host=https://yourdomain.com --users 2000 --spawn-rate 50

# Monitor for:
# - Response time degradation
# - Error rate increase
# - Server crashes
# - Database connection exhaustion
```

**Document Results**:
- Maximum concurrent users: ____
- Breaking point: ____
- Bottleneck identified: ____ (e.g., database connections, memory)

---

### 9.5 Launch Day Procedures

#### Pre-Launch Checklist (24 Hours Before)

**Technical Readiness**:
- [ ] All code merged to `main` branch
- [ ] Production deployment successful
- [ ] SSL certificate valid & auto-renewal configured
- [ ] Database backups running (verify latest backup)
- [ ] Monitoring alerts configured (Sentry, uptime)
- [ ] Admin accounts created and tested
- [ ] Test user accounts removed from production
- [ ] Payment gateway in live mode (Stripe keys)
- [ ] Email sending working (test welcome email)
- [ ] Domain DNS fully propagated (check with `dig yourdomain.com`)

**Content & Marketing**:
- [ ] Landing page finalized
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] FAQ page complete
- [ ] Social media accounts created (Facebook, Instagram, Twitter)
- [ ] Press release drafted
- [ ] Launch announcement email drafted
- [ ] Blog post written ("Introducing E-Clean")

**Team Readiness**:
- [ ] Launch checklist reviewed with team
- [ ] Roles assigned (who monitors what)
- [ ] Communication channel setup (Slack, Discord)
- [ ] Rollback procedure documented
- [ ] Support email setup (support@yourdomain.com)
- [ ] Customer support team briefed

#### Launch Day Timeline

**T-2 Hours: Final Checks**

```bash
# 1. Verify all services running
docker-compose -f docker-compose.prod.yml ps

# 2. Check application health
curl https://yourdomain.com/api/health/

# 3. Test user flows (one final time)
# - Register → Login → Post Job → Submit Bid → Payment → Complete

# 4. Check Sentry (no errors in last hour)
# Visit sentry.io dashboard

# 5. Verify monitoring (UptimeRobot green)

# 6. Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com | grep "Verify return code"
# Should show: "Verify return code: 0 (ok)"
```

**T-1 Hour: Pre-Announcement**

- [ ] Send "We're Live!" message to team
- [ ] Screenshot dashboard (before launch traffic)
- [ ] Enable verbose logging (temporarily)
- [ ] Open monitoring dashboards (Sentry, Server metrics)

**T-0: Go Live! 🚀**

- [ ] **Soft Launch**: Share with small group (friends, beta testers)
- [ ] Monitor for issues (next 30 minutes)
- [ ] Test a few user flows in production
- [ ] Check error rates (should be near zero)

**T+30 Minutes: Public Announcement**

- [ ] Post on social media
  ```
  🎉 Excited to announce E-Clean is now LIVE! 
  Find trusted cleaners for your home in minutes. 
  Sign up today: https://yourdomain.com
  #EClean #CleaningServices #OnDemand
  ```
- [ ] Send launch email to mailing list
- [ ] Publish blog post
- [ ] Submit to Product Hunt (if applicable)
- [ ] Post in relevant communities (Reddit, Facebook groups)

**T+2 Hours: First Checkpoint**

- [ ] Review Sentry (any new errors?)
- [ ] Check user registrations (how many?)
- [ ] Monitor server load (CPU, memory)
- [ ] Respond to support emails
- [ ] Engage with social media comments

**T+24 Hours: Day 1 Review**

- [ ] Analyze user metrics:
  - Total registrations: ____
  - Jobs posted: ____
  - Bids submitted: ____
  - Payments processed: ____
  - Error rate: ____%
- [ ] Review all error logs
- [ ] Address critical issues (if any)
- [ ] Send "Thank You" message to early users
- [ ] Plan next steps based on feedback

#### Rollback Procedure (If Needed)

**When to Rollback**:
- Critical bug affecting all users
- Payment processing failure
- Security vulnerability discovered
- Data loss risk

**Rollback Steps**:

```bash
# 1. Stop current deployment
docker-compose -f docker-compose.prod.yml down

# 2. Checkout previous stable version
git checkout <previous-release-tag>

# 3. Rollback database migrations (if needed)
docker-compose -f docker-compose.prod.yml run backend python manage.py migrate <app_name> <previous_migration_number>

# 4. Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# 5. Verify health
curl https://yourdomain.com/api/health/

# 6. Notify users (if downtime > 5 minutes)
# Post status update on social media and via email
```

**Post-Rollback**:
- [ ] Investigate root cause
- [ ] Fix in development environment
- [ ] Re-test thoroughly
- [ ] Deploy fix when ready

---

### 9.6 Post-Launch Monitoring (First Week)

#### Daily Monitoring Tasks

**Morning Routine** (15 minutes):
```bash
# 1. Check overnight errors (Sentry)
# Visit Sentry dashboard, filter by "Last 24 hours"

# 2. Verify backups completed
ls -lh /backups/ | tail -5

# 3. Check server health
docker-compose -f docker-compose.prod.yml ps
docker stats --no-stream

# 4. Review key metrics
docker-compose -f docker-compose.prod.yml exec backend python manage.py shell
```

```python
from django.contrib.auth import get_user_model
from cleaning_jobs.models import Job
from payments.models import Payment

User = get_user_model()

# Print daily stats
print(f"Total Users: {User.objects.count()}")
print(f"New Users (24h): {User.objects.filter(date_joined__gte=timezone.now() - timedelta(days=1)).count()}")
print(f"Total Jobs: {Job.objects.count()}")
print(f"New Jobs (24h): {Job.objects.filter(created_at__gte=timezone.now() - timedelta(days=1)).count()}")
print(f"Total Revenue: ${Payment.objects.filter(status='succeeded').aggregate(total=Sum('amount'))['total'] or 0:.2f}")
```

**Evening Routine** (10 minutes):
- [ ] Review day's support emails (response time < 2 hours)
- [ ] Check social media engagement (respond to comments)
- [ ] Monitor uptime (should be 99.9%+)
- [ ] Review analytics (Google Analytics, if integrated)

#### Key Metrics to Track (First Week)

**User Engagement**:
| Metric | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 |
|--------|-------|-------|-------|-------|-------|-------|-------|
| New Registrations | ___ | ___ | ___ | ___ | ___ | ___ | ___ |
| Active Users | ___ | ___ | ___ | ___ | ___ | ___ | ___ |
| Jobs Posted | ___ | ___ | ___ | ___ | ___ | ___ | ___ |
| Bids Submitted | ___ | ___ | ___ | ___ | ___ | ___ | ___ |
| Jobs Completed | ___ | ___ | ___ | ___ | ___ | ___ | ___ |
| Reviews Given | ___ | ___ | ___ | ___ | ___ | ___ | ___ |

**Technical Health**:
| Metric | Target | Actual |
|--------|--------|--------|
| Uptime | 99.9% | ___% |
| Avg Response Time | < 300ms | ___ms |
| Error Rate | < 0.1% | ___% |
| Page Load Time | < 2s | ___s |

**Business Metrics**:
- Total Revenue: $____
- Average Job Value: $____
- Platform Fee Earned: $____
- Conversion Rate (signup → job): ____%

#### User Feedback Collection

**In-App Feedback Widget**:

```jsx
// frontend/src/components/FeedbackWidget.jsx
import React, { useState } from 'react';
import axios from 'axios';

function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/feedback/', { message: feedback });
      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setFeedback('');
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback', error);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-indigo-700"
        >
          💬 Feedback
        </button>
      ) : (
        <div className="bg-white p-4 rounded-lg shadow-xl w-80">
          {submitted ? (
            <p className="text-green-600 font-medium">Thank you for your feedback!</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <h3 className="font-semibold mb-2">Send us feedback</h3>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full border rounded p-2 mb-2"
                rows="4"
                placeholder="What can we improve?"
                required
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default FeedbackWidget;
```

**Email Survey** (Send after 3 days):

```html
Subject: How's your E-Clean experience? [2-min survey]

Hi [User Name],

Thank you for being an early user of E-Clean! We'd love to hear your thoughts.

Could you spare 2 minutes for a quick survey?
[Survey Link]

Your feedback helps us improve the platform for everyone.

Best regards,
The E-Clean Team

P.S. As a thank you, we'll send you a $10 credit after completing the survey!
```

**Survey Questions** (Google Forms, Typeform):
1. How easy was it to sign up? (1-5 scale)
2. Did you encounter any technical issues? (Yes/No)
3. What feature do you wish E-Clean had?
4. How likely are you to recommend E-Clean? (NPS: 0-10)
5. Any additional comments?

---

### 9.7 Known Issues & Future Enhancements

#### Known Limitations (Document for Users)

**Current Version (v1.0)**:
- [ ] **Real-time location tracking**: Cleaners cannot be tracked in real-time during job (planned for v1.2)
- [ ] **Mobile apps**: Web-only for now (iOS/Android apps in Phase 2)
- [ ] **Multiple cleaners per job**: Only supports 1:1 jobs (team booking planned for v1.3)
- [ ] **Recurring jobs**: Must manually rebook (subscription feature in Phase 2)
- [ ] **Video calls**: No in-app video chat (considering for v1.5)
- [ ] **Instant booking**: All jobs require bidding (instant booking for verified cleaners in v1.4)

#### Bug Tracking & Hotfix Process

**Bug Prioritization**:
- **P0 (Critical)**: Fix within 4 hours (e.g., payment failure, site down)
- **P1 (High)**: Fix within 24 hours (e.g., broken job posting)
- **P2 (Medium)**: Fix within 1 week (e.g., UI glitch)
- **P3 (Low)**: Schedule for next release (e.g., typo, minor improvement)

**Hotfix Deployment**:

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-payment-bug main

# 2. Fix the bug, commit
git add .
git commit -m "Hotfix: Fix payment intent creation error"

# 3. Test locally
docker-compose -f docker-compose.dev.yml up --build

# 4. Merge to main (after testing)
git checkout main
git merge hotfix/critical-payment-bug
git push origin main

# 5. Deploy to production
ssh your-server
cd /path/to/e-clean
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build

# 6. Verify fix
curl https://yourdomain.com/api/health/
# Test the specific fixed functionality

# 7. Monitor for 30 minutes
# Check Sentry, logs, user reports
```

#### Feature Request Management

**Public Roadmap** (Use Trello, GitHub Projects, or Notion):

**Phase 1.x (Next 3 Months)**:
- [ ] Email verification for new signups
- [ ] Cleaner background check integration
- [ ] Instant booking for top-rated cleaners
- [ ] Advanced search filters (availability, price range)
- [ ] Favorite cleaners list
- [ ] Job templates (save common jobs)

**Phase 2 (Months 4-6)**:
- [ ] iOS & Android mobile apps
- [ ] Recurring job subscriptions
- [ ] Team booking (multiple cleaners)
- [ ] In-app chat improvements (file sharing, voice messages)
- [ ] Referral program (invite friends, earn credits)
- [ ] Gift cards

**Phase 3 (Months 7-12)**:
- [ ] AI-powered cleaner matching
- [ ] Dynamic pricing based on demand
- [ ] Cleaner training academy (video courses)
- [ ] Insurance integration
- [ ] Multi-language support (Spanish, French)
- [ ] Expansion to new cities

**Community Voting**:
- Let users vote on features (use Canny.io or similar)
- Implement top 3 requested features each quarter

---

### 9.8 Marketing & Growth Strategy

#### Launch Marketing Checklist

**Week 1: Awareness**

- [ ] **Social Media Campaign**
  - Post daily on Instagram, Facebook, Twitter
  - Share cleaner success stories
  - Before/after cleaning photos
  - Video testimonials from beta users
  - Use hashtags: #EClean #CleaningServices #GigEconomy #SmallBusiness

- [ ] **Content Marketing**
  - Blog post: "How E-Clean Works: A Complete Guide"
  - Blog post: "5 Tips for Choosing the Right Cleaner"
  - Blog post: "Become a Cleaner on E-Clean: Earn Extra Income"
  - Publish on Medium, LinkedIn

- [ ] **Partnerships**
  - Reach out to local cleaning companies (onboard their cleaners)
  - Partner with real estate agencies (property cleaning)
  - Connect with Airbnb hosts (turnover cleaning)

- [ ] **Press & PR**
  - Send press release to local news outlets
  - Pitch to tech blogs (TechCrunch, Product Hunt)
  - Appear on local podcasts/radio
  - Submit to startup directories (BetaList, Launching Next)

**Week 2-4: Growth**

- [ ] **Paid Advertising** (Budget: $500-1000)
  - Facebook/Instagram ads targeting homeowners (30-55 age)
  - Google Ads for keywords: "house cleaning near me", "hire cleaner"
  - Retargeting ads for website visitors who didn't sign up

- [ ] **Referral Program**
  - Give $10 credit to referrer + referee
  - Add "Invite Friends" button in dashboard
  - Email existing users with referral link

- [ ] **SEO Optimization**
  - Blog posts targeting long-tail keywords
  - Local SEO (Google My Business listing)
  - Backlinks from local directories

- [ ] **Community Engagement**
  - Host online Q&A session (Instagram Live, Twitter Spaces)
  - Offer free cleaning for first 10 signups (buzz generation)
  - Sponsor local community events

#### Customer Acquisition Metrics

**Track Weekly**:
| Channel | Signups | Cost | CAC (Cost per Acquisition) | Jobs Posted | Conversion Rate |
|---------|---------|------|------------------------------|-------------|-----------------|
| Organic Social | ___ | $0 | $0 | ___ | ___% |
| Paid Ads | ___ | $___ | $___ | ___ | ___% |
| Referrals | ___ | $___ | $___ | ___ | ___% |
| SEO/Blog | ___ | $0 | $0 | ___ | ___% |
| Press/PR | ___ | $0 | $0 | ___ | ___% |

**Goal**: CAC < $20 (Customer Lifetime Value target: $200+)

#### Customer Retention Strategy

**First 30 Days Critical**:
- [ ] **Day 1**: Welcome email with getting started guide
- [ ] **Day 3**: "Post your first job" nudge (if not done)
- [ ] **Day 7**: Success story email ("Meet Sarah, who found her perfect cleaner")
- [ ] **Day 14**: Check-in email ("How's your experience?")
- [ ] **Day 30**: Survey + $10 credit offer

**Retention Tactics**:
- Send weekly newsletter with cleaning tips
- Offer loyalty rewards (10th job free)
- VIP program for high-volume users
- Birthday/anniversary discounts

---

### 9.9 Legal & Compliance Final Check

#### Terms of Service & Privacy Policy

- [ ] **Terms of Service** reviewed by lawyer (or use template)
  - User responsibilities
  - Platform liability limitations
  - Payment terms (fees, refunds)
  - Dispute resolution process
  - Account termination clause

- [ ] **Privacy Policy** GDPR/CCPA compliant
  - Data collection disclosure (what data, why)
  - Cookie usage explained
  - User rights (access, deletion, portability)
  - Third-party services listed (Stripe, AWS S3, Sentry)
  - Contact for privacy inquiries

- [ ] **Cookie Consent Banner** (if EU users)
  ```jsx
  // frontend/src/components/CookieBanner.jsx
  import React, { useState, useEffect } from 'react';
  
  function CookieBanner() {
    const [showBanner, setShowBanner] = useState(false);
  
    useEffect(() => {
      const consent = localStorage.getItem('cookie_consent');
      if (!consent) {
        setShowBanner(true);
      }
    }, []);
  
    const acceptCookies = () => {
      localStorage.setItem('cookie_consent', 'true');
      setShowBanner(false);
    };
  
    if (!showBanner) return null;
  
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <p className="text-sm">
            We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.{' '}
            <a href="/privacy-policy" className="underline">Learn more</a>
          </p>
          <button
            onClick={acceptCookies}
            className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded ml-4"
          >
            Accept
          </button>
        </div>
      </div>
    );
  }
  
  export default CookieBanner;
  ```

#### Insurance & Liability

- [ ] **General Liability Insurance** (recommended)
  - Protects against platform-related claims
  - Cost: ~$500-1000/year
  - Providers: Hiscox, Chubb, Next Insurance

- [ ] **Cleaner Background Checks** (Phase 1.x)
  - Integrate with Checkr or similar service
  - Required for verified cleaner badge
  - Cost: ~$30-50 per check

- [ ] **Platform Terms** clarify:
  - Cleaners are independent contractors (not employees)
  - Platform is marketplace only (not cleaning service provider)
  - Users agree to resolve disputes among themselves first

#### Business Registration

- [ ] Business entity registered (LLC, Corp)
- [ ] EIN obtained (US tax ID)
- [ ] Business bank account opened
- [ ] Stripe Connect account verified (for payouts)
- [ ] Sales tax collection configured (if applicable by state/country)

---

### 9.10 Success Metrics & Milestones

#### First Month Goals

**User Acquisition**:
- [ ] 100+ registered users (50 clients, 50 cleaners)
- [ ] 50+ jobs posted
- [ ] 30+ jobs completed
- [ ] 20+ reviews submitted

**Technical Performance**:
- [ ] 99.5%+ uptime
- [ ] < 1% error rate
- [ ] < 500ms average API response time
- [ ] Zero critical security incidents

**Financial**:
- [ ] $5,000+ in total transaction volume
- [ ] $750+ in platform fees earned (15%)
- [ ] Positive unit economics (CAC < LTV)

#### Celebrate Milestones! 🎉

- [ ] **First Job Posted**: Screenshot & share on social media
- [ ] **First Completed Job**: Send thank you email to both users
- [ ] **10 Completed Jobs**: Blog post featuring early users
- [ ] **100 Users**: Announce milestone publicly, offer promo code
- [ ] **$10k in Transactions**: Internal team celebration
- [ ] **First Press Mention**: Frame it, share everywhere!

#### When to Consider Success

**Product-Market Fit Indicators**:
- Users spontaneously recommend E-Clean (word-of-mouth growth)
- Cleaners actively check platform daily for new jobs
- Clients rebook with same cleaners (repeat rate > 40%)
- NPS (Net Promoter Score) > 50
- Organic traffic growing week-over-week
- Low churn rate (< 10% monthly)

**Signs You're Ready to Scale**:
- Consistent demand in your launch city
- Supply-demand balance achieved (enough cleaners for all jobs)
- Customer support manageable (< 2 hours/day)
- Unit economics proven profitable
- Tech infrastructure stable under current load
- Funding secured (or cash flow positive)

**Next Steps After Phase 1**:
1. **Hire first team members** (customer support, marketing)
2. **Expand to 2-3 nearby cities** (test expansion playbook)
3. **Launch Phase 2 features** (mobile apps, recurring jobs)
4. **Raise funding** (if going VC route) or bootstrap with revenue
5. **Build brand** (professional marketing agency, influencer partnerships)

---

## Task 9 Progress Checklist

### Pre-Launch Testing
- [ ] Create test user accounts (clients + cleaners)
- [ ] Complete 11 UAT test scenarios
- [ ] Test on 4+ devices (iPhone, Android, iPad, Desktop)
- [ ] Test on 4 browsers (Chrome, Firefox, Safari, Edge)
- [ ] Document all bugs found

### Security Audit
- [ ] Verify OWASP Top 10 protections
- [ ] Run automated security scan (ZAP, Nikto)
- [ ] Test rate limiting
- [ ] Verify HTTPS/SSL configuration
- [ ] Check sensitive data handling

### Performance Optimization
- [ ] Run Lighthouse audit (score 90+)
- [ ] Optimize images (< 300KB each)
- [ ] Analyze bundle size (< 800KB total)
- [ ] Verify caching working (80%+ hit rate)
- [ ] Setup CDN (optional)

### Load Testing
- [ ] Run Locust with 100 users
- [ ] Run Locust with 500 users
- [ ] Stress test to find breaking point
- [ ] Document maximum capacity
- [ ] Identify bottlenecks

### Launch Preparation
- [ ] Complete pre-launch checklist (24h before)
- [ ] Prepare social media posts
- [ ] Draft launch email
- [ ] Setup monitoring dashboards
- [ ] Document rollback procedure

### Launch Day
- [ ] Execute T-2 hours final checks
- [ ] Soft launch (T-0)
- [ ] Public announcement (T+30 min)
- [ ] Monitor for issues (first 2 hours)
- [ ] Day 1 review (T+24 hours)

### Post-Launch (Week 1)
- [ ] Daily morning health checks
- [ ] Track key metrics (table above)
- [ ] Collect user feedback (survey)
- [ ] Respond to support requests (< 2 hours)
- [ ] Address any hotfixes needed

### Marketing & Growth
- [ ] Execute Week 1 awareness campaign
- [ ] Setup referral program
- [ ] Begin paid advertising ($500-1000)
- [ ] Track CAC by channel
- [ ] Send retention emails (Day 1, 3, 7, 14, 30)

### Legal & Compliance
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Cookie consent banner (if EU)
- [ ] Business registered
- [ ] Insurance obtained (optional)

### Success Tracking
- [ ] Set up analytics dashboard
- [ ] Track first month goals
- [ ] Celebrate milestones
- [ ] Assess product-market fit indicators
- [ ] Plan Phase 2 roadmap

---

## Estimated Time for Task 9: 4-6 hours

**Breakdown**:
- Pre-launch testing: 2-3 hours
- Security audit: 1 hour
- Performance optimization: 30 minutes
- Load testing: 30 minutes
- Launch preparation: 30 minutes
- Post-launch monitoring: Ongoing (15 min/day)

---

**🎉 PHASE 1 IMPLEMENTATION GUIDE COMPLETE! 🎉**

**Total Guide Statistics**:
- **Tasks Documented**: 9 of 9 (100% complete)
- **Total Lines**: ~15,800
- **Estimated Implementation Time**: 51-70 hours
- **Files Created/Modified**: 100+
- **Code Examples**: 200+

**You now have a complete, step-by-step blueprint to build E-Clean from start to launch!**

**Next Steps**:
1. Review this entire guide once more
2. Set up development environment (Task 1)
3. Follow tasks sequentially (don't skip ahead)
4. Test thoroughly at each step
5. Use this guide as your implementation checklist
6. Cross off items as you complete them
7. Launch with confidence! 🚀

**Good luck with your E-Clean marketplace platform!**

---

*Guide Version: 1.0*  
*Last Updated: October 26, 2025*  
*Created by: Vasileios Metallinos*
