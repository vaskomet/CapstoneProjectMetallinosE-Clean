from rest_framework import generics, status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
import stripe

from .models import Payment, StripeAccount, Transaction, Refund, PayoutRequest
from core.events import publish_event
from .serializers import (
    PaymentSerializer,
    PaymentIntentCreateSerializer,
    PaymentConfirmSerializer,
    StripeAccountSerializer,
    TransactionSerializer,
    RefundSerializer,
    StripeConnectOnboardingSerializer,
    PayoutRequestSerializer,
    PayoutBalanceSerializer,
    JobEarningsSerializer,
    PaymentHistorySerializer,
    AdminFinancialSummarySerializer
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
                    
                    # Publish event for real-time notification to cleaner
                    publish_event(
                        topic='payments',
                        event_type='payment_received',
                        data={
                            'payment_id': payment.id,
                            'cleaner_id': payment.cleaner.id,
                            'client_id': payment.client.id,
                            'client_name': f"{payment.client.first_name} {payment.client.last_name}".strip() or payment.client.username,
                            'job_id': job.id,
                            'job_title': job.services_description[:50] + '...' if len(job.services_description) > 50 else job.services_description,
                            'amount': str(payment.amount),
                        }
                    )
                
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


# ============================================================
# PAYOUT REQUEST VIEWS
# ============================================================

class PayoutRequestListView(generics.ListAPIView):
    """
    List payout requests for cleaners or admins.
    
    GET /api/payouts/requests/
    
    Cleaner: sees only their own requests
    Admin: sees all requests, can filter by status
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PayoutRequestSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'admin':
            # Admin sees all requests
            queryset = PayoutRequest.objects.all()
            
            # Filter by status if provided
            status_filter = self.request.query_params.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)
            
            # Filter by cleaner if provided
            cleaner_id = self.request.query_params.get('cleaner')
            if cleaner_id:
                queryset = queryset.filter(cleaner_id=cleaner_id)
            
            return queryset.select_related('cleaner', 'approved_by').order_by('-requested_at')
        
        elif user.role == 'cleaner':
            # Cleaner sees only their own requests
            return PayoutRequest.objects.filter(
                cleaner=user
            ).select_related('approved_by').order_by('-requested_at')
        
        else:
            # Clients shouldn't access this
            return PayoutRequest.objects.none()


class PayoutRequestCreateView(views.APIView):
    """
    Create a new payout request for a cleaner.
    
    POST /api/payouts/request/
    Body: { "amount": 250.00 }
    
    Validates:
    - User is a cleaner
    - Has Stripe account set up
    - Requested amount <= available balance
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        user = request.user
        
        # Only cleaners can request payouts
        if user.role != 'cleaner':
            return Response(
                {'error': 'Only cleaners can request payouts'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if cleaner has Stripe account set up
        try:
            stripe_account = StripeAccount.objects.get(cleaner=user)
            if not stripe_account.is_ready_for_payouts():
                return Response(
                    {'error': 'Please complete your Stripe account setup before requesting payouts'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except StripeAccount.DoesNotExist:
            return Response(
                {'error': 'Please set up your Stripe account before requesting payouts'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get requested amount
        try:
            requested_amount = Decimal(str(request.data.get('amount', 0)))
        except:
            return Response(
                {'error': 'Invalid amount'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if requested_amount <= 0:
            return Response(
                {'error': 'Amount must be greater than 0'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate available balance
        from datetime import timedelta
        from django.db.models import Sum
        
        # Jobs completed more than 24 hours ago
        cutoff_time = timezone.now() - timedelta(hours=24)
        total_earned = Payment.objects.filter(
            cleaner=user,
            status='succeeded',
            paid_at__lte=cutoff_time
        ).aggregate(total=Sum('cleaner_payout'))['total'] or Decimal('0.00')
        
        # Subtract already paid out amounts
        total_paid_out = PayoutRequest.objects.filter(
            cleaner=user,
            status__in=['completed', 'processing', 'approved']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        available_balance = total_earned - total_paid_out
        
        # Validate requested amount
        if requested_amount > available_balance:
            return Response(
                {
                    'error': f'Insufficient balance. Available: ${available_balance:.2f}',
                    'available_balance': str(available_balance),
                    'requested_amount': str(requested_amount)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create payout request
        payout_request = PayoutRequest.objects.create(
            cleaner=user,
            amount=requested_amount,
            status='pending'
        )
        
        serializer = PayoutRequestSerializer(payout_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PayoutRequestDetailView(views.APIView):
    """
    Get, approve, or reject a specific payout request.
    
    GET /api/payouts/requests/<id>/
    POST /api/payouts/requests/<id>/approve/
    POST /api/payouts/requests/<id>/reject/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        user = request.user
        
        try:
            payout_request = PayoutRequest.objects.select_related(
                'cleaner', 'approved_by'
            ).get(pk=pk)
        except PayoutRequest.DoesNotExist:
            return Response(
                {'error': 'Payout request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions
        if user.role == 'admin':
            # Admin can see all
            pass
        elif user.role == 'cleaner' and payout_request.cleaner == user:
            # Cleaner can see their own
            pass
        else:
            return Response(
                {'error': 'You do not have permission to view this payout request'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = PayoutRequestSerializer(payout_request)
        return Response(serializer.data)


class PayoutRequestApproveView(views.APIView):
    """
    Approve a payout request (admin only).
    
    POST /api/payouts/requests/<id>/approve/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        user = request.user
        
        if user.role != 'admin':
            return Response(
                {'error': 'Only admins can approve payout requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            payout_request = PayoutRequest.objects.get(pk=pk)
        except PayoutRequest.DoesNotExist:
            return Response(
                {'error': 'Payout request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if payout_request.status != 'pending':
            return Response(
                {'error': f'Cannot approve request with status: {payout_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Approve the request
        payout_request.approve(user)
        
        # TODO: Initiate actual Stripe transfer here
        # For now, just mark as approved - Stripe integration can be added later
        
        serializer = PayoutRequestSerializer(payout_request)
        return Response(serializer.data)


class PayoutRequestRejectView(views.APIView):
    """
    Reject a payout request (admin only).
    
    POST /api/payouts/requests/<id>/reject/
    Body: { "reason": "Insufficient balance" }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        user = request.user
        
        if user.role != 'admin':
            return Response(
                {'error': 'Only admins can reject payout requests'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            payout_request = PayoutRequest.objects.get(pk=pk)
        except PayoutRequest.DoesNotExist:
            return Response(
                {'error': 'Payout request not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if payout_request.status != 'pending':
            return Response(
                {'error': f'Cannot reject request with status: {payout_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reason = request.data.get('reason', 'No reason provided')
        payout_request.reject(user, reason)
        
        serializer = PayoutRequestSerializer(payout_request)
        return Response(serializer.data)


# ============================================================
# PAYOUT BALANCE & EARNINGS VIEWS
# ============================================================

class PayoutBalanceView(views.APIView):
    """
    Get cleaner's payout balance information.
    
    GET /api/payouts/balance/
    
    Returns:
    - available_balance: amount ready to withdraw
    - pending_balance: amount in 24hr hold
    - total_earnings: lifetime earnings
    - stripe_account_status
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        if user.role != 'cleaner':
            return Response(
                {'error': 'Only cleaners can view payout balance'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from datetime import timedelta
        from django.db.models import Sum
        
        # Check Stripe account status
        try:
            stripe_account = StripeAccount.objects.get(cleaner=user)
            stripe_account_id = stripe_account.stripe_account_id
            stripe_onboarding_complete = stripe_account.is_ready_for_payouts()
        except StripeAccount.DoesNotExist:
            stripe_account_id = None
            stripe_onboarding_complete = False
        
        # Calculate available balance (24+ hours old)
        cutoff_time = timezone.now() - timedelta(hours=24)
        available_payments = Payment.objects.filter(
            cleaner=user,
            status='succeeded',
            paid_at__lte=cutoff_time
        ).aggregate(total=Sum('cleaner_payout'))['total'] or Decimal('0.00')
        
        # Calculate pending balance (<24 hours old)
        pending_payments = Payment.objects.filter(
            cleaner=user,
            status='succeeded',
            paid_at__gt=cutoff_time
        ).aggregate(total=Sum('cleaner_payout'))['total'] or Decimal('0.00')
        
        # Calculate total earnings (all time)
        total_earnings = Payment.objects.filter(
            cleaner=user,
            status='succeeded'
        ).aggregate(total=Sum('cleaner_payout'))['total'] or Decimal('0.00')
        
        # Calculate total already paid out
        total_payouts = PayoutRequest.objects.filter(
            cleaner=user,
            status__in=['completed', 'processing', 'approved']
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        available_balance = available_payments - total_payouts
        
        data = {
            'available_balance': available_balance,
            'pending_balance': pending_payments,
            'total_earnings': total_earnings,
            'total_payouts': total_payouts,
            'stripe_account_id': stripe_account_id,
            'stripe_onboarding_complete': stripe_onboarding_complete,
            'can_request_payout': stripe_onboarding_complete and available_balance > 0
        }
        
        serializer = PayoutBalanceSerializer(data)
        return Response(serializer.data)


class JobEarningsView(generics.ListAPIView):
    """
    List cleaner's job earnings breakdown.
    
    GET /api/payouts/earnings/
    
    Shows each job with:
    - Job details
    - Amount earned
    - Platform fee (18%)
    - Net payout
    - Status (available/pending/paid out)
    """
    permission_classes = [IsAuthenticated]
    serializer_class = JobEarningsSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role != 'cleaner':
            return []
        
        from datetime import timedelta
        
        payments = Payment.objects.filter(
            cleaner=user,
            status='succeeded'
        ).select_related('job', 'client').order_by('-paid_at')
        
        # Build earnings data
        earnings_data = []
        cutoff_time = timezone.now() - timedelta(hours=24)
        
        for payment in payments:
            hours_since_paid = int((timezone.now() - payment.paid_at).total_seconds() / 3600)
            is_available = payment.paid_at <= cutoff_time
            
            # Calculate platform fee percentage
            platform_fee_pct = (payment.platform_fee / payment.amount * 100) if payment.amount > 0 else Decimal('0.00')
            
            # Get job title from services_description
            if payment.job and payment.job.services_description:
                desc = payment.job.services_description
                job_title = desc[:50] + "..." if len(desc) > 50 else desc
            else:
                job_title = "Cleaning Service"
            
            client_name = f"{payment.client.first_name} {payment.client.last_name}".strip() if payment.client else "Unknown"
            
            earnings_data.append({
                'job_id': payment.job.id if payment.job else None,
                'job_title': job_title,
                'client_name': client_name,
                'amount': payment.amount,
                'platform_fee': payment.platform_fee,
                'platform_fee_percentage': platform_fee_pct,
                'cleaner_payout': payment.cleaner_payout,
                'status': 'available' if is_available else 'pending',
                'paid_at': payment.paid_at,
                'hours_since_paid': hours_since_paid,
                'is_available_for_payout': is_available
            })
        
        return earnings_data
    
    def list(self, request, *args, **kwargs):
        data = self.get_queryset()
        serializer = self.get_serializer(data, many=True)
        return Response(serializer.data)


# ============================================================
# PAYMENT HISTORY VIEWS (CLIENT)
# ============================================================

class PaymentHistoryView(generics.ListAPIView):
    """
    List user's payment history.
    
    GET /api/payments/history/
    
    Shows all payments the user was involved in:
    - Clients: payments they made
    - Cleaners: payments they received
    - Admins: all payments
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentHistorySerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Admins can see all payments
        if user.role == 'admin':
            queryset = Payment.objects.all()
        # Clients see payments they made
        elif user.role == 'client':
            queryset = Payment.objects.filter(client=user)
        # Cleaners see payments they received
        elif user.role == 'cleaner':
            queryset = Payment.objects.filter(cleaner=user)
        else:
            return Payment.objects.none()
        
        # Exclude pending/failed duplicates for the same job
        # Only show succeeded payments, OR pending/processing if no succeeded payment exists for that job
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


# ============================================================
# ADMIN FINANCIAL DASHBOARD VIEWS
# ============================================================

class AdminFinancialSummaryView(views.APIView):
    """
    Get financial summary for admin dashboard.
    
    GET /api/admin/financials/summary/
    
    Returns:
    - Total payments processed
    - Platform revenue (fees collected)
    - Total payouts made
    - Pending payout requests
    - Refund metrics
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        
        if user.role != 'admin':
            return Response(
                {'error': 'Only admins can access financial dashboard'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from django.db.models import Sum, Count
        from datetime import datetime, timedelta
        
        # Date ranges
        now = timezone.now()
        first_day_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        first_day_of_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Payment metrics
        all_payments = Payment.objects.filter(status='succeeded')
        total_payments = all_payments.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payments_this_month = all_payments.filter(
            paid_at__gte=first_day_of_month
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payments_this_year = all_payments.filter(
            paid_at__gte=first_day_of_year
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payment_count = all_payments.count()
        
        # Platform revenue (fees)
        platform_revenue_total = all_payments.aggregate(
            total=Sum('platform_fee')
        )['total'] or Decimal('0.00')
        platform_revenue_this_month = all_payments.filter(
            paid_at__gte=first_day_of_month
        ).aggregate(total=Sum('platform_fee'))['total'] or Decimal('0.00')
        platform_revenue_this_year = all_payments.filter(
            paid_at__gte=first_day_of_year
        ).aggregate(total=Sum('platform_fee'))['total'] or Decimal('0.00')
        
        # Payout metrics
        completed_payouts = PayoutRequest.objects.filter(status='completed')
        total_payouts = completed_payouts.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payouts_this_month = completed_payouts.filter(
            processed_at__gte=first_day_of_month
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payouts_this_year = completed_payouts.filter(
            processed_at__gte=first_day_of_year
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        payout_count = completed_payouts.count()
        
        # Pending payout requests
        pending_requests = PayoutRequest.objects.filter(status='pending')
        pending_payout_requests = pending_requests.count()
        pending_payout_amount = pending_requests.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0.00')
        
        # Refund metrics
        completed_refunds = Refund.objects.filter(status='completed')
        total_refunds = completed_refunds.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        refund_count = completed_refunds.count()
        pending_refund_requests = Refund.objects.filter(status='pending').count()
        
        data = {
            'total_payments': total_payments,
            'payments_this_month': payments_this_month,
            'payments_this_year': payments_this_year,
            'payment_count': payment_count,
            'platform_revenue_total': platform_revenue_total,
            'platform_revenue_this_month': platform_revenue_this_month,
            'platform_revenue_this_year': platform_revenue_this_year,
            'total_payouts': total_payouts,
            'payouts_this_month': payouts_this_month,
            'payouts_this_year': payouts_this_year,
            'payout_count': payout_count,
            'pending_payout_requests': pending_payout_requests,
            'pending_payout_amount': pending_payout_amount,
            'total_refunds': total_refunds,
            'refund_count': refund_count,
            'pending_refund_requests': pending_refund_requests,
        }
        
        serializer = AdminFinancialSummarySerializer(data)
        return Response(serializer.data)
