from django.db import models
from django.contrib.auth import get_user_model
from cleaning_jobs.models import CleaningJob
from decimal import Decimal

User = get_user_model()


class Payment(models.Model):
    """
    Payment model tracks all payment transactions for cleaning jobs.
    Integrates with Stripe for payment processing.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('partially_refunded', 'Partially Refunded'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.AutoField(primary_key=True)
    
    # Relationships
    job = models.ForeignKey(
        CleaningJob,
        on_delete=models.CASCADE,
        related_name='payments',
        help_text="The cleaning job this payment is for"
    )
    
    client = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='client_payments',
        help_text="The client making the payment"
    )
    
    cleaner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='cleaner_payments',
        help_text="The cleaner receiving the payment"
    )
    
    # Payment details
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Total payment amount in dollars"
    )
    
    platform_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Platform fee amount (percentage of total)"
    )
    
    cleaner_payout = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Amount to be paid to cleaner after platform fee"
    )
    
    # Stripe integration
    stripe_payment_intent_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text="Stripe PaymentIntent ID"
    )
    
    stripe_charge_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Stripe Charge ID after successful payment"
    )
    
    # Payment status and metadata
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    
    currency = models.CharField(
        max_length=3,
        default='usd',
        help_text="Currency code (ISO 4217)"
    )
    
    description = models.TextField(
        blank=True,
        help_text="Payment description or notes"
    )
    
    # Payment method info (stored from Stripe)
    payment_method_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Type of payment method (card, bank_transfer, etc.)"
    )
    
    payment_method_last4 = models.CharField(
        max_length=4,
        blank=True,
        help_text="Last 4 digits of card/account"
    )
    
    payment_method_brand = models.CharField(
        max_length=50,
        blank=True,
        help_text="Card brand (Visa, Mastercard, etc.)"
    )
    
    # Refund tracking
    refunded_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total amount refunded"
    )
    
    refund_reason = models.TextField(
        blank=True,
        help_text="Reason for refund (if applicable)"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When payment was successfully completed"
    )
    refunded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When payment was refunded"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['job', 'status']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['cleaner', 'status']),
            models.Index(fields=['stripe_payment_intent_id']),
        ]

    def __str__(self):
        return f"Payment #{self.id} - Job #{self.job.id} - ${self.amount} ({self.status})"

    def calculate_fees(self, platform_fee_percentage=0.15):
        """Calculate platform fee and cleaner payout"""
        self.platform_fee = self.amount * Decimal(str(platform_fee_percentage))
        self.cleaner_payout = self.amount - self.platform_fee
        self.save(update_fields=['platform_fee', 'cleaner_payout'])

    def can_be_refunded(self):
        """Check if payment can be refunded"""
        return self.status in ['succeeded'] and self.refunded_amount < self.amount

    def remaining_refundable_amount(self):
        """Get remaining amount that can be refunded"""
        return self.amount - self.refunded_amount


class StripeAccount(models.Model):
    """
    StripeAccount model stores Stripe Connect account information for cleaners.
    Cleaners need a Stripe Connect account to receive payouts.
    """
    ACCOUNT_STATUS_CHOICES = [
        ('pending', 'Pending Setup'),
        ('active', 'Active'),
        ('restricted', 'Restricted'),
        ('disabled', 'Disabled'),
    ]

    id = models.AutoField(primary_key=True)
    
    # One-to-one relationship with cleaner
    cleaner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='stripe_account',
        limit_choices_to={'role': 'cleaner'}
    )
    
    # Stripe Connect account ID
    stripe_account_id = models.CharField(
        max_length=255,
        unique=True,
        help_text="Stripe Connect account ID"
    )
    
    # Account status
    status = models.CharField(
        max_length=20,
        choices=ACCOUNT_STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    
    # Capabilities (what the account can do)
    charges_enabled = models.BooleanField(
        default=False,
        help_text="Whether the account can accept charges"
    )
    
    payouts_enabled = models.BooleanField(
        default=False,
        help_text="Whether the account can receive payouts"
    )
    
    # Onboarding details
    details_submitted = models.BooleanField(
        default=False,
        help_text="Whether cleaner has completed onboarding"
    )
    
    onboarding_link = models.URLField(
        blank=True,
        help_text="Stripe onboarding URL (temporary)"
    )
    
    onboarding_link_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the onboarding link expires"
    )
    
    # Bank account info (last 4 digits only for display)
    bank_account_last4 = models.CharField(
        max_length=4,
        blank=True,
        help_text="Last 4 digits of bank account"
    )
    
    bank_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Name of bank"
    )
    
    # Total earnings tracking
    total_earnings = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total earnings (before platform fee)"
    )
    
    total_payouts = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total amount paid out to cleaner"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    activated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When account was fully activated"
    )

    class Meta:
        indexes = [
            models.Index(fields=['cleaner', 'status']),
            models.Index(fields=['stripe_account_id']),
        ]

    def __str__(self):
        return f"Stripe Account - {self.cleaner.username} ({self.status})"

    def is_ready_for_payouts(self):
        """Check if account is ready to receive payouts"""
        return (
            self.status == 'active' and
            self.charges_enabled and
            self.payouts_enabled and
            self.details_submitted
        )


class Transaction(models.Model):
    """
    Transaction model tracks individual financial transactions (charges, payouts, refunds).
    Provides detailed audit trail of all money movements.
    """
    TRANSACTION_TYPE_CHOICES = [
        ('charge', 'Charge'),
        ('payout', 'Payout'),
        ('refund', 'Refund'),
        ('platform_fee', 'Platform Fee'),
        ('adjustment', 'Adjustment'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.AutoField(primary_key=True)
    
    # Related payment
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='transactions',
        null=True,
        blank=True
    )
    
    # Transaction details
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        db_index=True
    )
    
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Transaction amount"
    )
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    
    # Parties involved
    from_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions_from',
        help_text="User money is coming from (if applicable)"
    )
    
    to_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transactions_to',
        help_text="User money is going to (if applicable)"
    )
    
    # Stripe IDs
    stripe_transfer_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Stripe Transfer ID (for Connect payouts)"
    )
    
    stripe_payout_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Stripe Payout ID"
    )
    
    # Metadata
    description = models.TextField(blank=True)
    
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional transaction metadata"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When transaction was completed"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment', 'transaction_type']),
            models.Index(fields=['from_user', 'status']),
            models.Index(fields=['to_user', 'status']),
        ]

    def __str__(self):
        return f"{self.transaction_type.title()} - ${self.amount} ({self.status})"


class Refund(models.Model):
    """
    Refund model tracks refund requests and their processing.
    """
    REFUND_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('succeeded', 'Succeeded'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    REFUND_REASON_CHOICES = [
        ('requested_by_client', 'Requested by Client'),
        ('service_not_provided', 'Service Not Provided'),
        ('poor_quality', 'Poor Quality'),
        ('cleaner_cancelled', 'Cleaner Cancelled'),
        ('duplicate_payment', 'Duplicate Payment'),
        ('fraudulent', 'Fraudulent'),
        ('other', 'Other'),
    ]

    id = models.AutoField(primary_key=True)
    
    # Related payment
    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name='refunds'
    )
    
    # Refund details
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Amount to refund"
    )
    
    reason = models.CharField(
        max_length=50,
        choices=REFUND_REASON_CHOICES,
        default='requested_by_client'
    )
    
    reason_details = models.TextField(
        blank=True,
        help_text="Additional details about refund reason"
    )
    
    status = models.CharField(
        max_length=20,
        choices=REFUND_STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    
    # Stripe refund ID
    stripe_refund_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text="Stripe Refund ID"
    )
    
    # Who requested the refund
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='requested_refunds'
    )
    
    # Admin approval
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_refunds',
        limit_choices_to={'role': 'admin'}
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When refund was processed"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payment', 'status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"Refund #{self.id} - Payment #{self.payment.id} - ${self.amount} ({self.status})"
