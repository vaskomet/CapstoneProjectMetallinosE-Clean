from rest_framework import serializers
from .models import Payment, StripeAccount, Transaction, Refund, PayoutRequest
from django.contrib.auth import get_user_model
from cleaning_jobs.models import CleaningJob

User = get_user_model()


class PaymentSerializer(serializers.ModelSerializer):
    """
    Serializer for Payment model.
    Provides detailed payment information for API responses.
    """
    job_id = serializers.IntegerField(write_only=True)
    client_name = serializers.SerializerMethodField()
    cleaner_name = serializers.SerializerMethodField()
    job_title = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id',
            'job',
            'job_id',
            'job_title',
            'client',
            'client_name',
            'cleaner',
            'cleaner_name',
            'amount',
            'platform_fee',
            'cleaner_payout',
            'stripe_payment_intent_id',
            'stripe_charge_id',
            'status',
            'currency',
            'description',
            'payment_method_type',
            'payment_method_last4',
            'payment_method_brand',
            'refunded_amount',
            'refund_reason',
            'created_at',
            'updated_at',
            'paid_at',
            'refunded_at',
        ]
        read_only_fields = [
            'id',
            'job',
            'client',
            'cleaner',
            'stripe_payment_intent_id',
            'stripe_charge_id',
            'status',
            'platform_fee',
            'cleaner_payout',
            'payment_method_type',
            'payment_method_last4',
            'payment_method_brand',
            'refunded_amount',
            'refund_reason',
            'created_at',
            'updated_at',
            'paid_at',
            'refunded_at',
        ]
    
    def get_client_name(self, obj):
        if obj.client:
            return f"{obj.client.first_name} {obj.client.last_name}".strip() or obj.client.username
        return None
    
    def get_cleaner_name(self, obj):
        if obj.cleaner:
            return f"{obj.cleaner.first_name} {obj.cleaner.last_name}".strip() or obj.cleaner.username
        return None
    
    def get_job_title(self, obj):
        if obj.job and obj.job.property:
            return f"Cleaning at {obj.job.property}"
        return "Cleaning Job"


class PaymentIntentCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a Stripe PaymentIntent.
    Used when client accepts a bid and initiates payment.
    """
    bid_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    
    def validate(self, data):
        """Validate bid and job"""
        user = self.context['request'].user
        bid_id = data['bid_id']
        amount = data['amount']
        
        # Get the bid
        from cleaning_jobs.models import JobBid
        try:
            bid = JobBid.objects.select_related('job', 'cleaner').get(id=bid_id)
        except JobBid.DoesNotExist:
            raise serializers.ValidationError("Bid not found")
        
        # Validate job ownership
        if bid.job.client != user:
            raise serializers.ValidationError("You can only create payments for bids on your own jobs")
        
        # Validate job status
        if bid.job.status != 'open_for_bids':
            raise serializers.ValidationError(f"Cannot create payment for job with status: {bid.job.status}")
        
        # Validate bid amount matches
        if bid.bid_amount != amount:
            raise serializers.ValidationError("Payment amount does not match bid amount")
        
        # Check if payment already exists for this bid
        existing_payment = Payment.objects.filter(
            job=bid.job,
            status__in=['pending', 'processing', 'succeeded']
        ).first()
        
        if existing_payment:
            raise serializers.ValidationError(
                f"Payment already exists for this job (Payment #{existing_payment.id})"
            )
        
        # Store validated objects for view
        data['bid'] = bid
        data['job'] = bid.job
        return data


class PaymentConfirmSerializer(serializers.Serializer):
    """
    Serializer for confirming a payment after client completes Stripe checkout.
    """
    payment_intent_id = serializers.CharField()
    
    def validate_payment_intent_id(self, value):
        """Validate that payment intent exists and belongs to user"""
        user = self.context['request'].user
        try:
            payment = Payment.objects.get(stripe_payment_intent_id=value)
        except Payment.DoesNotExist:
            raise serializers.ValidationError("Payment not found")
        
        if payment.client != user:
            raise serializers.ValidationError("This payment does not belong to you")
        
        return value


class StripeAccountSerializer(serializers.ModelSerializer):
    """
    Serializer for StripeAccount model.
    Used for displaying cleaner's Stripe Connect account information.
    """
    cleaner_name = serializers.SerializerMethodField()
    can_receive_payouts = serializers.SerializerMethodField()
    
    class Meta:
        model = StripeAccount
        fields = [
            'id',
            'cleaner',
            'cleaner_name',
            'stripe_account_id',
            'status',
            'charges_enabled',
            'payouts_enabled',
            'details_submitted',
            'onboarding_link',
            'onboarding_link_expires_at',
            'bank_account_last4',
            'bank_name',
            'total_earnings',
            'total_payouts',
            'can_receive_payouts',
            'created_at',
            'updated_at',
            'activated_at',
        ]
        read_only_fields = [
            'id',
            'cleaner',
            'stripe_account_id',
            'status',
            'charges_enabled',
            'payouts_enabled',
            'details_submitted',
            'onboarding_link',
            'onboarding_link_expires_at',
            'bank_account_last4',
            'bank_name',
            'total_earnings',
            'total_payouts',
            'created_at',
            'updated_at',
            'activated_at',
        ]
    
    def get_cleaner_name(self, obj):
        if obj.cleaner:
            return f"{obj.cleaner.first_name} {obj.cleaner.last_name}".strip() or obj.cleaner.username
        return None
    
    def get_can_receive_payouts(self, obj):
        return obj.is_ready_for_payouts()


class TransactionSerializer(serializers.ModelSerializer):
    """
    Serializer for Transaction model.
    Provides transaction history for audit and accounting.
    """
    from_user_name = serializers.SerializerMethodField()
    to_user_name = serializers.SerializerMethodField()
    payment_job_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = [
            'id',
            'payment',
            'payment_job_id',
            'transaction_type',
            'amount',
            'status',
            'from_user',
            'from_user_name',
            'to_user',
            'to_user_name',
            'stripe_transfer_id',
            'stripe_payout_id',
            'description',
            'metadata',
            'created_at',
            'updated_at',
            'completed_at',
        ]
        read_only_fields = [
            'id',
            'payment',
            'transaction_type',
            'amount',
            'status',
            'from_user',
            'to_user',
            'stripe_transfer_id',
            'stripe_payout_id',
            'description',
            'metadata',
            'created_at',
            'updated_at',
            'completed_at',
        ]
    
    def get_from_user_name(self, obj):
        if obj.from_user:
            return f"{obj.from_user.first_name} {obj.from_user.last_name}".strip() or obj.from_user.username
        return None
    
    def get_to_user_name(self, obj):
        if obj.to_user:
            return f"{obj.to_user.first_name} {obj.to_user.last_name}".strip() or obj.to_user.username
        return None
    
    def get_payment_job_id(self, obj):
        if obj.payment and obj.payment.job:
            return obj.payment.job.id
        return None


class RefundSerializer(serializers.ModelSerializer):
    """
    Serializer for Refund model.
    Used for creating and displaying refund requests.
    """
    payment_amount = serializers.SerializerMethodField()
    job_id = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Refund
        fields = [
            'id',
            'payment',
            'payment_amount',
            'job_id',
            'amount',
            'reason',
            'reason_details',
            'status',
            'stripe_refund_id',
            'requested_by',
            'requested_by_name',
            'approved_by',
            'approved_by_name',
            'created_at',
            'processed_at',
        ]
        read_only_fields = [
            'id',
            'stripe_refund_id',
            'requested_by',
            'approved_by',
            'status',
            'created_at',
            'processed_at',
        ]
    
    def get_payment_amount(self, obj):
        return obj.payment.amount if obj.payment else None
    
    def get_job_id(self, obj):
        if obj.payment and obj.payment.job:
            return obj.payment.job.id
        return None
    
    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return f"{obj.requested_by.first_name} {obj.requested_by.last_name}".strip() or obj.requested_by.username
        return None
    
    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip() or obj.approved_by.username
        return None
    
    def validate(self, data):
        """Validate refund request"""
        payment = data.get('payment')
        amount = data.get('amount')
        
        if not payment:
            raise serializers.ValidationError("Payment is required")
        
        if not payment.can_be_refunded():
            raise serializers.ValidationError(
                f"Payment cannot be refunded. Status: {payment.status}, "
                f"Refunded amount: ${payment.refunded_amount}"
            )
        
        remaining = payment.remaining_refundable_amount()
        if amount > remaining:
            raise serializers.ValidationError(
                f"Refund amount ${amount} exceeds remaining refundable amount ${remaining}"
            )
        
        return data


class StripeConnectOnboardingSerializer(serializers.Serializer):
    """
    Serializer for creating Stripe Connect onboarding links for cleaners.
    """
    return_url = serializers.URLField(required=False)
    refresh_url = serializers.URLField(required=False)
    
    def validate(self, data):
        """Add default URLs if not provided"""
        request = self.context.get('request')
        
        if not data.get('return_url'):
            # Default return URL (frontend cleaner dashboard)
            data['return_url'] = f"{request.scheme}://{request.get_host()}/cleaner/stripe-connect/return"
        
        if not data.get('refresh_url'):
            # Default refresh URL (restart onboarding)
            data['refresh_url'] = f"{request.scheme}://{request.get_host()}/cleaner/stripe-connect/refresh"
        
        return data


class PayoutRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for PayoutRequest model.
    Provides payout request information for cleaners and admins.
    """
    cleaner_name = serializers.SerializerMethodField()
    cleaner_email = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    bank_account_last4 = serializers.SerializerMethodField()
    
    class Meta:
        model = PayoutRequest
        fields = [
            'id',
            'cleaner',
            'cleaner_name',
            'cleaner_email',
            'amount',
            'status',
            'stripe_transfer_id',
            'stripe_payout_id',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'rejection_reason',
            'requested_at',
            'processed_at',
            'notes',
            'bank_account_last4',
        ]
        read_only_fields = [
            'id',
            'stripe_transfer_id',
            'stripe_payout_id',
            'approved_by',
            'approved_at',
            'requested_at',
            'processed_at',
        ]
    
    def get_cleaner_name(self, obj):
        profile = getattr(obj.cleaner, 'cleaner_profile', None)
        if profile and profile.company_name:
            return profile.company_name
        return f"{obj.cleaner.first_name} {obj.cleaner.last_name}".strip() or obj.cleaner.username
    
    def get_cleaner_email(self, obj):
        return obj.cleaner.email
    
    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip() or obj.approved_by.username
        return None
    
    def get_bank_account_last4(self, obj):
        try:
            stripe_account = StripeAccount.objects.get(cleaner=obj.cleaner)
            return stripe_account.bank_account_last4
        except StripeAccount.DoesNotExist:
            return None


class PayoutBalanceSerializer(serializers.Serializer):
    """
    Serializer for cleaner payout balance information.
    Shows available, pending, and total earnings.
    """
    available_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    pending_balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_earnings = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_payouts = serializers.DecimalField(max_digits=10, decimal_places=2)
    stripe_account_id = serializers.CharField(allow_null=True)
    stripe_onboarding_complete = serializers.BooleanField()
    can_request_payout = serializers.BooleanField()


class JobEarningsSerializer(serializers.Serializer):
    """
    Serializer for individual job earnings breakdown.
    Shows job details, amounts, and platform fees.
    """
    job_id = serializers.IntegerField()
    job_title = serializers.CharField()
    client_name = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    platform_fee = serializers.DecimalField(max_digits=10, decimal_places=2)
    platform_fee_percentage = serializers.DecimalField(max_digits=5, decimal_places=2)
    cleaner_payout = serializers.DecimalField(max_digits=10, decimal_places=2)
    status = serializers.CharField()
    paid_at = serializers.DateTimeField()
    hours_since_paid = serializers.IntegerField()
    is_available_for_payout = serializers.BooleanField()


class PaymentHistorySerializer(serializers.ModelSerializer):
    """
    Serializer for payment history.
    Shows all payments the user was involved in:
    - Clients see payments they made (with cleaner info)
    - Cleaners see payments they received (with client info)
    - Admins see all payments (with both)
    """
    job_title = serializers.SerializerMethodField()
    job_address = serializers.SerializerMethodField()
    job_bedrooms = serializers.SerializerMethodField()
    job_bathrooms = serializers.SerializerMethodField()
    cleaner_name = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()
    can_request_refund = serializers.SerializerMethodField()
    
    class Meta:
        model = Payment
        fields = [
            'id',
            'job',
            'job_title',
            'job_address',
            'job_bedrooms',
            'job_bathrooms',
            'client',
            'client_name',
            'cleaner',
            'cleaner_name',
            'amount',
            'platform_fee',
            'status',
            'payment_method_type',
            'payment_method_last4',
            'payment_method_brand',
            'refunded_amount',
            'refund_reason',
            'created_at',
            'paid_at',
            'refunded_at',
            'can_request_refund',
        ]
    
    def get_job_title(self, obj):
        if obj.job and obj.job.services_description:
            # Truncate long descriptions
            desc = obj.job.services_description
            return desc[:50] + "..." if len(desc) > 50 else desc
        return "Cleaning Service"
    
    def get_job_address(self, obj):
        if obj.job and obj.job.property:
            prop = obj.job.property
            # Build address from components (matching Property.__str__)
            return f"{prop.address_line1}, {prop.city}, {prop.state}"
        return None
    
    def get_job_bedrooms(self, obj):
        # Property model doesn't have bedrooms field
        return None
    
    def get_job_bathrooms(self, obj):
        # Property model doesn't have bathrooms field
        return None
    
    def get_client_name(self, obj):
        if not obj.client:
            return None
        return f"{obj.client.first_name} {obj.client.last_name}".strip() or obj.client.username
    
    def get_cleaner_name(self, obj):
        if not obj.cleaner:
            return None
        profile = getattr(obj.cleaner, 'cleaner_profile', None)
        if profile and profile.company_name:
            return profile.company_name
        return f"{obj.cleaner.first_name} {obj.cleaner.last_name}".strip() or obj.cleaner.username
    
    def get_can_request_refund(self, obj):
        return obj.can_be_refunded() if hasattr(obj, 'can_be_refunded') else False


class AdminFinancialSummarySerializer(serializers.Serializer):
    """
    Serializer for admin financial dashboard summary.
    Shows platform-wide financial metrics.
    """
    # Payment metrics
    total_payments = serializers.DecimalField(max_digits=10, decimal_places=2)
    payments_this_month = serializers.DecimalField(max_digits=10, decimal_places=2)
    payments_this_year = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_count = serializers.IntegerField()
    
    # Platform revenue (fees)
    platform_revenue_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    platform_revenue_this_month = serializers.DecimalField(max_digits=10, decimal_places=2)
    platform_revenue_this_year = serializers.DecimalField(max_digits=10, decimal_places=2)
    
    # Payout metrics
    total_payouts = serializers.DecimalField(max_digits=10, decimal_places=2)
    payouts_this_month = serializers.DecimalField(max_digits=10, decimal_places=2)
    payouts_this_year = serializers.DecimalField(max_digits=10, decimal_places=2)
    payout_count = serializers.IntegerField()
    
    # Pending payout requests
    pending_payout_requests = serializers.IntegerField()
    pending_payout_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    
    # Refund metrics
    total_refunds = serializers.DecimalField(max_digits=10, decimal_places=2)
    refund_count = serializers.IntegerField()
    pending_refund_requests = serializers.IntegerField()
