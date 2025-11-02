from django.contrib import admin
from .models import Payment, StripeAccount, Transaction, Refund


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'job', 'client', 'cleaner', 'amount', 'status', 'created_at']
    list_filter = ['status', 'currency', 'created_at']
    search_fields = ['stripe_payment_intent_id', 'client__username', 'cleaner__username']
    readonly_fields = [
        'stripe_payment_intent_id', 
        'stripe_charge_id', 
        'platform_fee', 
        'cleaner_payout',
        'created_at', 
        'updated_at', 
        'paid_at', 
        'refunded_at'
    ]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('job', 'client', 'cleaner', 'amount', 'status', 'description')
        }),
        ('Stripe Information', {
            'fields': ('stripe_payment_intent_id', 'stripe_charge_id', 'currency')
        }),
        ('Fee Breakdown', {
            'fields': ('platform_fee', 'cleaner_payout')
        }),
        ('Payment Method', {
            'fields': ('payment_method_type', 'payment_method_last4', 'payment_method_brand')
        }),
        ('Refund Information', {
            'fields': ('refunded_amount', 'refund_reason', 'refunded_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'paid_at')
        }),
    )


@admin.register(StripeAccount)
class StripeAccountAdmin(admin.ModelAdmin):
    list_display = ['id', 'cleaner', 'status', 'charges_enabled', 'payouts_enabled', 'total_earnings', 'created_at']
    list_filter = ['status', 'charges_enabled', 'payouts_enabled']
    search_fields = ['cleaner__username', 'stripe_account_id']
    readonly_fields = [
        'stripe_account_id',
        'charges_enabled',
        'payouts_enabled',
        'details_submitted',
        'total_earnings',
        'total_payouts',
        'created_at',
        'updated_at',
        'activated_at'
    ]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'transaction_type', 'amount', 'status', 'from_user', 'to_user', 'created_at']
    list_filter = ['transaction_type', 'status', 'created_at']
    search_fields = ['stripe_transfer_id', 'stripe_payout_id', 'description']
    readonly_fields = [
        'stripe_transfer_id',
        'stripe_payout_id',
        'created_at',
        'updated_at',
        'completed_at'
    ]


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ['id', 'payment', 'amount', 'reason', 'status', 'requested_by', 'created_at']
    list_filter = ['status', 'reason', 'created_at']
    search_fields = ['stripe_refund_id', 'reason_details']
    readonly_fields = [
        'stripe_refund_id',
        'requested_by',
        'created_at',
        'processed_at'
    ]
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('payment', 'amount', 'status')
        }),
        ('Refund Details', {
            'fields': ('reason', 'reason_details', 'stripe_refund_id')
        }),
        ('Approval Workflow', {
            'fields': ('requested_by', 'approved_by')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'processed_at')
        }),
    )
