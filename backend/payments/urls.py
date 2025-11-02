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
    
    # Stripe Connect (for cleaners)
    path('stripe-connect/onboarding/', StripeConnectOnboardingView.as_view(), name='stripe-connect-onboarding'),
    path('stripe-connect/account/', StripeAccountDetailView.as_view(), name='stripe-account-detail'),
    
    # Transactions
    path('transactions/', TransactionListView.as_view(), name='transaction-list'),
    
    # Refunds
    path('refunds/', RefundListView.as_view(), name='refund-list'),
    path('refunds/create/', RefundCreateView.as_view(), name='refund-create'),
    
    # Stripe Webhooks (CSRF exempt, signature verified in handler)
    path('webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
]
