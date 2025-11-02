from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
import stripe

from .models import Payment, StripeAccount, Transaction, Refund
from .serializers import (
    PaymentSerializer,
    PaymentIntentCreateSerializer,
    PaymentConfirmSerializer,
    StripeAccountSerializer,
    TransactionSerializer,
    RefundSerializer,
    StripeConnectOnboardingSerializer
)
from cleaning_jobs.models import CleaningJob
from decimal import Decimal

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class CreatePaymentIntentView(views.APIView):
    """
    Create a Stripe PaymentIntent for a cleaning job.
    Called when client accepts a bid and proceeds to payment.
    
    POST /api/payments/create-intent/
    Body: { "job_id": 123 }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Payment intent request data: {request.data}")
        logger.info(f"Request user: {request.user.username}")
        
        serializer = PaymentIntentCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            logger.error(f"Validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        job = serializer.validated_data['job']
        bid = serializer.validated_data['bid']
        amount = serializer.validated_data['amount']
        
        # Temporarily assign cleaner and accepted bid to job for payment creation
        # This allows the payment system to work without permanently accepting the bid
        original_cleaner = job.cleaner
        original_accepted_bid = job.accepted_bid
        original_final_price = job.final_price
        
        job.cleaner = bid.cleaner
        job.accepted_bid = bid
        job.final_price = amount
        
        # Get or create Stripe customer for client
        client = job.client
        if not client.stripe_customer_id:
            try:
                stripe_customer = stripe.Customer.create(
                    email=client.email,
                    name=f"{client.first_name} {client.last_name}".strip() or client.username,
                    metadata={'user_id': client.id}
                )
                client.stripe_customer_id = stripe_customer.id
                client.save(update_fields=['stripe_customer_id'])
            except stripe.error.StripeError as e:
                return Response(
                    {'error': f'Failed to create Stripe customer: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Calculate payment amount (use the validated amount)
        amount_cents = int(amount * 100)  # Convert to cents
        
        try:
            # Create Stripe PaymentIntent
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency='usd',
                customer=client.stripe_customer_id,
                metadata={
                    'job_id': job.id,
                    'client_id': client.id,
                    'cleaner_id': job.cleaner.id if job.cleaner else None,
                },
                description=f"Payment for cleaning job #{job.id}"
            )
            
            # Create Payment record in database
            payment = Payment.objects.create(
                job=job,
                client=client,
                cleaner=job.cleaner,
                amount=amount,
                stripe_payment_intent_id=payment_intent.id,
                status='pending',
                description=f"Payment for cleaning job #{job.id}",
                currency='usd'
            )
            
            # Calculate platform fee and cleaner payout
            payment.calculate_fees(platform_fee_percentage=settings.PLATFORM_FEE_PERCENTAGE)
            
            # Create charge transaction
            Transaction.objects.create(
                payment=payment,
                transaction_type='charge',
                amount=amount,
                status='pending',
                from_user=client,
                to_user=job.cleaner,
                description=f"Charge for job #{job.id}"
            )
            
            # Restore original job values (don't save permanently)
            job.cleaner = original_cleaner
            job.accepted_bid = original_accepted_bid
            job.final_price = original_final_price
            
            return Response({
                'payment_id': payment.id,
                'client_secret': payment_intent.client_secret,
                'amount': float(amount),
                'platform_fee': float(payment.platform_fee),
                'cleaner_payout': float(payment.cleaner_payout),
                'stripe_publishable_key': settings.STRIPE_PUBLISHABLE_KEY
            }, status=status.HTTP_201_CREATED)
            
        except stripe.error.StripeError as e:
            # Restore original job values on error
            job.cleaner = original_cleaner
            job.accepted_bid = original_accepted_bid
            job.final_price = original_final_price
            
            return Response(
                {'error': f'Stripe error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConfirmPaymentView(views.APIView):
    """
    Confirm payment after client completes Stripe checkout.
    Updates payment status and job status.
    
    POST /api/payments/confirm/
    Body: { "payment_intent_id": "pi_xxx" }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = PaymentConfirmSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        payment_intent_id = serializer.validated_data['payment_intent_id']
        
        try:
            # Retrieve PaymentIntent from Stripe with expanded charges
            payment_intent = stripe.PaymentIntent.retrieve(
                payment_intent_id,
                expand=['charges']
            )
            
            # Get payment from database
            payment = Payment.objects.select_related('job', 'client', 'cleaner').get(
                stripe_payment_intent_id=payment_intent_id
            )
            
            # Update payment based on Stripe status
            if payment_intent.status == 'succeeded':
                with transaction.atomic():
                    payment.status = 'succeeded'
                    # Access the latest_charge directly instead of charges.data
                    payment.stripe_charge_id = payment_intent.latest_charge if hasattr(payment_intent, 'latest_charge') else None
                    payment.paid_at = timezone.now()
                    
                    # Update payment method info
                    if payment_intent.payment_method:
                        pm = stripe.PaymentMethod.retrieve(payment_intent.payment_method)
                        payment.payment_method_type = pm.type
                        if pm.type == 'card':
                            payment.payment_method_last4 = pm.card.last4
                            payment.payment_method_brand = pm.card.brand
                    
                    payment.save()
                    
                    # Accept the bid and update job status
                    job = payment.job
                    from cleaning_jobs.models import JobBid
                    
                    # Find the bid that matches this payment (by cleaner and amount)
                    bid = JobBid.objects.filter(
                        job=job,
                        cleaner=payment.cleaner,
                        bid_amount=payment.amount
                    ).first()
                    
                    if bid:
                        with transaction.atomic():
                            # Accept the bid
                            bid.status = 'accepted'
                            bid.save()
                            
                            # Update job
                            job.cleaner = payment.cleaner
                            job.accepted_bid = bid
                            job.final_price = payment.amount
                            job.status = 'confirmed'
                            job.save()
                    else:
                        # Fallback: just update job status if bid not found
                        if job.status == 'open_for_bids':
                            job.status = 'confirmed'
                            job.save(update_fields=['status'])
                    
                    # Update transaction
                    trans = payment.transactions.filter(transaction_type='charge').first()
                    if trans:
                        trans.status = 'completed'
                        trans.completed_at = timezone.now()
                        trans.save()
                    
                    # TODO: Emit event for real-time notification
                    # TODO: Send email notification to client and cleaner
                
                return Response({
                    'message': 'Payment confirmed successfully',
                    'payment': PaymentSerializer(payment).data
                }, status=status.HTTP_200_OK)
            
            elif payment_intent.status in ['processing', 'requires_payment_method', 'requires_confirmation']:
                payment.status = 'processing'
                payment.save(update_fields=['status'])
                
                return Response({
                    'message': 'Payment is still processing',
                    'payment': PaymentSerializer(payment).data
                }, status=status.HTTP_200_OK)
            
            else:
                # Payment failed
                payment.status = 'failed'
                payment.save(update_fields=['status'])
                
                trans = payment.transactions.filter(transaction_type='charge').first()
                if trans:
                    trans.status = 'failed'
                    trans.save()
                
                return Response({
                    'message': 'Payment failed',
                    'payment': PaymentSerializer(payment).data
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except stripe.error.StripeError as e:
            return Response(
                {'error': f'Stripe error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Payment.DoesNotExist:
            return Response(
                {'error': 'Payment not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class PaymentListView(generics.ListAPIView):
    """
    List payments for the authenticated user.
    Clients see their payments, cleaners see payments they're receiving.
    
    GET /api/payments/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'client':
            return Payment.objects.filter(client=user).select_related(
                'job', 'client', 'cleaner'
            ).order_by('-created_at')
        elif user.role == 'cleaner':
            return Payment.objects.filter(cleaner=user).select_related(
                'job', 'client', 'cleaner'
            ).order_by('-created_at')
        else:
            # Admin sees all payments
            return Payment.objects.all().select_related(
                'job', 'client', 'cleaner'
            ).order_by('-created_at')


class PaymentDetailView(generics.RetrieveAPIView):
    """
    Retrieve a specific payment.
    Users can only see their own payments.
    
    GET /api/payments/<id>/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'admin':
            return Payment.objects.all().select_related('job', 'client', 'cleaner')
        elif user.role == 'client':
            return Payment.objects.filter(client=user).select_related('job', 'client', 'cleaner')
        elif user.role == 'cleaner':
            return Payment.objects.filter(cleaner=user).select_related('job', 'client', 'cleaner')
        else:
            return Payment.objects.none()


class StripeConnectOnboardingView(views.APIView):
    """
    Create Stripe Connect onboarding link for cleaners.
    Cleaners need to complete onboarding to receive payouts.
    
    POST /api/payments/stripe-connect/onboarding/
    Body: { "return_url": "...", "refresh_url": "..." } (optional)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        
        # Only cleaners can onboard
        if user.role != 'cleaner':
            return Response(
                {'error': 'Only cleaners can create Stripe Connect accounts'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = StripeConnectOnboardingSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        return_url = serializer.validated_data['return_url']
        refresh_url = serializer.validated_data['refresh_url']
        
        try:
            # Get or create StripeAccount
            stripe_account, created = StripeAccount.objects.get_or_create(cleaner=user)
            
            # If account doesn't have Stripe ID yet, create one
            if not stripe_account.stripe_account_id:
                account = stripe.Account.create(
                    type='standard',  # Standard Connect account
                    email=user.email,
                    metadata={'user_id': user.id}
                )
                stripe_account.stripe_account_id = account.id
                stripe_account.save(update_fields=['stripe_account_id'])
                
                # Also save to User model for quick access
                user.stripe_account_id = account.id
                user.save(update_fields=['stripe_account_id'])
            
            # Create account link for onboarding
            account_link = stripe.AccountLink.create(
                account=stripe_account.stripe_account_id,
                refresh_url=refresh_url,
                return_url=return_url,
                type='account_onboarding'
            )
            
            # Save onboarding link (expires in ~5 minutes)
            stripe_account.onboarding_link = account_link.url
            stripe_account.onboarding_link_expires_at = timezone.now() + timezone.timedelta(minutes=5)
            stripe_account.save(update_fields=['onboarding_link', 'onboarding_link_expires_at'])
            
            return Response({
                'onboarding_url': account_link.url,
                'expires_at': stripe_account.onboarding_link_expires_at,
                'stripe_account': StripeAccountSerializer(stripe_account).data
            }, status=status.HTTP_200_OK)
        
        except stripe.error.StripeError as e:
            return Response(
                {'error': f'Stripe error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StripeAccountDetailView(generics.RetrieveAPIView):
    """
    Retrieve cleaner's Stripe Connect account details.
    
    GET /api/payments/stripe-connect/account/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = StripeAccountSerializer
    
    def get_object(self):
        user = self.request.user
        
        if user.role != 'cleaner':
            return None
        
        try:
            return StripeAccount.objects.get(cleaner=user)
        except StripeAccount.DoesNotExist:
            return None
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        if instance is None:
            return Response({
                'message': 'No Stripe account found. Please complete onboarding.',
                'has_account': False
            }, status=status.HTTP_200_OK)
        
        serializer = self.get_serializer(instance)
        return Response({
            'has_account': True,
            **serializer.data
        }, status=status.HTTP_200_OK)


class TransactionListView(generics.ListAPIView):
    """
    List transactions for authenticated user.
    Provides detailed transaction history for accounting.
    
    GET /api/payments/transactions/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'admin':
            return Transaction.objects.all().select_related(
                'payment', 'from_user', 'to_user'
            ).order_by('-created_at')
        else:
            # Show transactions where user is involved
            return Transaction.objects.filter(
                Q(from_user=user) | Q(to_user=user)
            ).select_related(
                'payment', 'from_user', 'to_user'
            ).order_by('-created_at')


class RefundCreateView(generics.CreateAPIView):
    """
    Create a refund request.
    Clients can request refunds, admins can approve.
    
    POST /api/payments/refunds/
    Body: { "payment": 1, "amount": 50.00, "reason": "...", "reason_details": "..." }
    """
    permission_classes = [IsAuthenticated]
    serializer_class = RefundSerializer
    
    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)


class RefundListView(generics.ListAPIView):
    """
    List refunds for authenticated user.
    
    GET /api/payments/refunds/
    """
    permission_classes = [IsAuthenticated]
    serializer_class = RefundSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'admin':
            return Refund.objects.all().select_related(
                'payment', 'requested_by', 'approved_by'
            ).order_by('-created_at')
        else:
            # Show refunds requested by user or for their payments
            return Refund.objects.filter(
                Q(requested_by=user) | 
                Q(payment__client=user) |
                Q(payment__cleaner=user)
            ).select_related(
                'payment', 'requested_by', 'approved_by'
            ).order_by('-created_at')
