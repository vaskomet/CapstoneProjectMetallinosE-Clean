from django.urls import path
from .views import (
    CreatePaymentIntentView,
    ConfirmPaymentView,
    PaymentListView,
    PaymentDetailView,
    StripeConnectOnboardingView,
    StripeAccountDetailView,
    TransactionListView,
    RefundCreateView,
    RefundListView,
    # Payout requests
    PayoutRequestListView,
    PayoutRequestCreateView,
    PayoutRequestDetailView,
    PayoutRequestApproveView,
    PayoutRequestRejectView,
    # Payout balance & earnings
    PayoutBalanceView,
    JobEarningsView,
    # Payment history
    PaymentHistoryView,
    # Admin financials
    AdminFinancialSummaryView,
)
from .webhooks import stripe_webhook

app_name = 'payments'

urlpatterns = [
    # Payment Intent & Confirmation
    path('create-intent/', CreatePaymentIntentView.as_view(), name='create-payment-intent'),
    path('confirm/', ConfirmPaymentView.as_view(), name='confirm-payment'),
    
    # Payment CRUD
    path('', PaymentListView.as_view(), name='payment-list'),
    path('<int:pk>/', PaymentDetailView.as_view(), name='payment-detail'),
    
    # Payment History (Client)
    path('history/', PaymentHistoryView.as_view(), name='payment-history'),
    
    # Stripe Connect (for cleaners)
    path('stripe-connect/onboarding/', StripeConnectOnboardingView.as_view(), name='stripe-connect-onboarding'),
    path('stripe-connect/account/', StripeAccountDetailView.as_view(), name='stripe-account-detail'),
    
    # Transactions
    path('transactions/', TransactionListView.as_view(), name='transaction-list'),
    
    # Refunds
    path('refunds/', RefundListView.as_view(), name='refund-list'),
    path('refunds/create/', RefundCreateView.as_view(), name='refund-create'),
    
    # Payout Requests
    path('payouts/requests/', PayoutRequestListView.as_view(), name='payout-request-list'),
    path('payouts/request/', PayoutRequestCreateView.as_view(), name='payout-request-create'),
    path('payouts/requests/<int:pk>/', PayoutRequestDetailView.as_view(), name='payout-request-detail'),
    path('payouts/requests/<int:pk>/approve/', PayoutRequestApproveView.as_view(), name='payout-request-approve'),
    path('payouts/requests/<int:pk>/reject/', PayoutRequestRejectView.as_view(), name='payout-request-reject'),
    
    # Payout Balance & Earnings (Cleaner)
    path('payouts/balance/', PayoutBalanceView.as_view(), name='payout-balance'),
    path('payouts/earnings/', JobEarningsView.as_view(), name='job-earnings'),
    
    # Admin Financial Dashboard
    path('admin/financials/summary/', AdminFinancialSummaryView.as_view(), name='admin-financial-summary'),
    
    # Stripe Webhooks (CSRF exempt, signature verified in handler)
    path('webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
]
