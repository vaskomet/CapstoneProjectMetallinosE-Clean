"""
Stripe Webhook Handler
Handles webhook events from Stripe for payment processing and account updates.

Best Practices Applied:
- Signature verification for security
- Idempotent event processing (prevent duplicates)
- Proper error handling and logging
- Database transactions for data consistency
- Event-driven architecture integration
"""

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings
from django.utils import timezone
from django.db import transaction as db_transaction
import stripe
import json
import logging

from .models import Payment, StripeAccount, Transaction, Refund
from cleaning_jobs.models import CleaningJob
from notifications.models import Notification

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@csrf_exempt
@require_POST
def stripe_webhook(request):
    """
    Handle incoming Stripe webhook events.
    Verifies signature and routes to appropriate handler.
    
    Webhook endpoint: POST /api/payments/webhooks/stripe/
    """
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    # Verify webhook signature for security
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        logger.error(f"Stripe webhook: Invalid payload - {str(e)}")
        return HttpResponse(status=400)
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        logger.error(f"Stripe webhook: Invalid signature - {str(e)}")
        return HttpResponse(status=400)
    
    # Log the event
    logger.info(f"Stripe webhook received: {event['type']} - {event['id']}")
    
    # Route to appropriate handler based on event type
    handler_map = {
        'payment_intent.succeeded': handle_payment_intent_succeeded,
        'payment_intent.payment_failed': handle_payment_intent_failed,
        'payment_intent.canceled': handle_payment_intent_canceled,
        'charge.refunded': handle_charge_refunded,
        'account.updated': handle_account_updated,
        'transfer.created': handle_transfer_created,
        'transfer.failed': handle_transfer_failed,
        'payout.paid': handle_payout_paid,
        'payout.failed': handle_payout_failed,
    }
    
    handler = handler_map.get(event['type'])
    
    if handler:
        try:
            handler(event)
            logger.info(f"Successfully processed webhook: {event['type']}")
        except Exception as e:
            logger.error(f"Error processing webhook {event['type']}: {str(e)}", exc_info=True)
            return HttpResponse(status=500)
    else:
        logger.warning(f"Unhandled webhook event type: {event['type']}")
    
    # Return 200 to acknowledge receipt
    return HttpResponse(status=200)


def handle_payment_intent_succeeded(event):
    """
    Handle successful payment.
    Updates payment status, job status, and sends notifications.
    
    Event: payment_intent.succeeded
    """
    payment_intent = event['data']['object']
    payment_intent_id = payment_intent['id']
    
    try:
        with db_transaction.atomic():
            # Get payment from database
            payment = Payment.objects.select_related('job', 'client', 'cleaner').get(
                stripe_payment_intent_id=payment_intent_id
            )
            
            # Prevent duplicate processing (idempotency)
            if payment.status == 'succeeded':
                logger.info(f"Payment {payment.id} already marked as succeeded. Skipping.")
                return
            
            # Update payment status
            payment.status = 'succeeded'
            payment.paid_at = timezone.now()
            
            # Get charge information
            if payment_intent.get('charges') and payment_intent['charges'].get('data'):
                charge = payment_intent['charges']['data'][0]
                payment.stripe_charge_id = charge['id']
                
                # Update payment method details
                if charge.get('payment_method_details'):
                    pm_details = charge['payment_method_details']
                    payment.payment_method_type = pm_details['type']
                    
                    if pm_details['type'] == 'card' and pm_details.get('card'):
                        payment.payment_method_last4 = pm_details['card'].get('last4', '')
                        payment.payment_method_brand = pm_details['card'].get('brand', '')
            
            payment.save()
            
            # Update associated job status
            job = payment.job
            if job.status == 'bid_accepted':
                job.status = 'confirmed'
                job.save(update_fields=['status', 'updated_at'])
            
            # Update transaction status
            charge_transaction = payment.transactions.filter(
                transaction_type='charge',
                status='pending'
            ).first()
            
            if charge_transaction:
                charge_transaction.status = 'completed'
                charge_transaction.completed_at = timezone.now()
                charge_transaction.save()
            
            # Create platform fee transaction
            Transaction.objects.create(
                payment=payment,
                transaction_type='platform_fee',
                amount=payment.platform_fee,
                status='completed',
                from_user=payment.cleaner,
                to_user=None,  # Platform
                description=f"Platform fee for job #{job.id}",
                completed_at=timezone.now()
            )
            
            # Send notifications
            _send_payment_success_notifications(payment)
            
            logger.info(
                f"Payment {payment.id} succeeded. "
                f"Job {job.id} status updated to {job.status}"
            )
    
    except Payment.DoesNotExist:
        logger.error(f"Payment not found for PaymentIntent: {payment_intent_id}")
    except Exception as e:
        logger.error(f"Error handling payment_intent.succeeded: {str(e)}", exc_info=True)
        raise


def handle_payment_intent_failed(event):
    """
    Handle failed payment.
    Updates payment status and sends notifications.
    
    Event: payment_intent.payment_failed
    """
    payment_intent = event['data']['object']
    payment_intent_id = payment_intent['id']
    
    try:
        with db_transaction.atomic():
            payment = Payment.objects.select_related('job', 'client', 'cleaner').get(
                stripe_payment_intent_id=payment_intent_id
            )
            
            # Update payment status
            payment.status = 'failed'
            payment.save()
            
            # Update transaction status
            charge_transaction = payment.transactions.filter(
                transaction_type='charge'
            ).first()
            
            if charge_transaction:
                charge_transaction.status = 'failed'
                charge_transaction.save()
            
            # Send failure notification to client
            Notification.objects.create(
                user=payment.client,
                notification_type='payment_failed',
                title='Payment Failed',
                message=f'Your payment for job #{payment.job.id} failed. Please try again.',
                related_object_type='payment',
                related_object_id=payment.id
            )
            
            logger.warning(f"Payment {payment.id} failed for job {payment.job.id}")
    
    except Payment.DoesNotExist:
        logger.error(f"Payment not found for PaymentIntent: {payment_intent_id}")


def handle_payment_intent_canceled(event):
    """
    Handle canceled payment.
    Updates payment status.
    
    Event: payment_intent.canceled
    """
    payment_intent = event['data']['object']
    payment_intent_id = payment_intent['id']
    
    try:
        payment = Payment.objects.get(stripe_payment_intent_id=payment_intent_id)
        payment.status = 'cancelled'
        payment.save()
        
        logger.info(f"Payment {payment.id} canceled")
    
    except Payment.DoesNotExist:
        logger.error(f"Payment not found for PaymentIntent: {payment_intent_id}")


def handle_charge_refunded(event):
    """
    Handle refunded charge.
    Updates payment and refund status.
    
    Event: charge.refunded
    """
    charge = event['data']['object']
    charge_id = charge['id']
    
    try:
        with db_transaction.atomic():
            # Find payment by charge ID
            payment = Payment.objects.select_related('job', 'client', 'cleaner').get(
                stripe_charge_id=charge_id
            )
            
            # Get refund information
            refunds = charge.get('refunds', {}).get('data', [])
            if refunds:
                latest_refund = refunds[0]
                refund_amount = latest_refund['amount'] / 100  # Convert from cents
                
                # Update payment refund info
                payment.refunded_amount += refund_amount
                
                # Update status based on refund amount
                if payment.refunded_amount >= payment.amount:
                    payment.status = 'refunded'
                else:
                    payment.status = 'partially_refunded'
                
                payment.refunded_at = timezone.now()
                payment.save()
                
                # Update Refund record if exists
                refund_obj = Refund.objects.filter(
                    payment=payment,
                    stripe_refund_id=latest_refund['id']
                ).first()
                
                if refund_obj:
                    refund_obj.status = 'succeeded'
                    refund_obj.processed_at = timezone.now()
                    refund_obj.save()
                
                # Create refund transaction
                Transaction.objects.create(
                    payment=payment,
                    transaction_type='refund',
                    amount=refund_amount,
                    status='completed',
                    from_user=None,  # Platform
                    to_user=payment.client,
                    description=f"Refund for job #{payment.job.id}",
                    completed_at=timezone.now()
                )
                
                # Send refund notification to client
                Notification.objects.create(
                    user=payment.client,
                    notification_type='payment_refunded',
                    title='Refund Processed',
                    message=f'Your refund of ${refund_amount:.2f} for job #{payment.job.id} has been processed.',
                    related_object_type='payment',
                    related_object_id=payment.id
                )
                
                logger.info(f"Refund processed for payment {payment.id}: ${refund_amount}")
    
    except Payment.DoesNotExist:
        logger.error(f"Payment not found for charge: {charge_id}")


def handle_account_updated(event):
    """
    Handle Stripe Connect account updates.
    Updates cleaner's StripeAccount status and capabilities.
    
    Event: account.updated
    """
    account = event['data']['object']
    account_id = account['id']
    
    try:
        with db_transaction.atomic():
            stripe_account = StripeAccount.objects.select_related('cleaner').get(
                stripe_account_id=account_id
            )
            
            # Update account capabilities
            stripe_account.charges_enabled = account.get('charges_enabled', False)
            stripe_account.payouts_enabled = account.get('payouts_enabled', False)
            stripe_account.details_submitted = account.get('details_submitted', False)
            
            # Update status based on capabilities
            if stripe_account.charges_enabled and stripe_account.payouts_enabled:
                stripe_account.status = 'active'
                if not stripe_account.activated_at:
                    stripe_account.activated_at = timezone.now()
            elif account.get('requirements', {}).get('disabled_reason'):
                stripe_account.status = 'restricted'
            else:
                stripe_account.status = 'pending'
            
            # Update bank account info if available
            if account.get('external_accounts', {}).get('data'):
                bank_account = account['external_accounts']['data'][0]
                if bank_account.get('last4'):
                    stripe_account.bank_account_last4 = bank_account['last4']
                if bank_account.get('bank_name'):
                    stripe_account.bank_name = bank_account['bank_name']
            
            stripe_account.save()
            
            # Notify cleaner if account is now active
            if stripe_account.status == 'active':
                Notification.objects.create(
                    user=stripe_account.cleaner,
                    notification_type='account_activated',
                    title='Stripe Account Activated',
                    message='Your Stripe account is now active. You can receive payouts for completed jobs!',
                    related_object_type='stripe_account',
                    related_object_id=stripe_account.id
                )
            
            logger.info(
                f"StripeAccount {stripe_account.id} updated. "
                f"Status: {stripe_account.status}, "
                f"Charges: {stripe_account.charges_enabled}, "
                f"Payouts: {stripe_account.payouts_enabled}"
            )
    
    except StripeAccount.DoesNotExist:
        logger.error(f"StripeAccount not found for account: {account_id}")


def handle_transfer_created(event):
    """
    Handle transfer to cleaner's Connect account.
    Creates payout transaction record.
    
    Event: transfer.created
    """
    transfer = event['data']['object']
    transfer_id = transfer['id']
    amount = transfer['amount'] / 100  # Convert from cents
    
    # Get payment from transfer metadata
    metadata = transfer.get('metadata', {})
    payment_id = metadata.get('payment_id')
    
    if payment_id:
        try:
            payment = Payment.objects.get(id=payment_id)
            
            # Create or update payout transaction
            Transaction.objects.update_or_create(
                stripe_transfer_id=transfer_id,
                defaults={
                    'payment': payment,
                    'transaction_type': 'payout',
                    'amount': amount,
                    'status': 'pending',
                    'from_user': None,  # Platform
                    'to_user': payment.cleaner,
                    'description': f"Payout for job #{payment.job.id}"
                }
            )
            
            logger.info(f"Transfer created for payment {payment_id}: ${amount}")
        
        except Payment.DoesNotExist:
            logger.error(f"Payment {payment_id} not found for transfer {transfer_id}")


def handle_transfer_failed(event):
    """
    Handle failed transfer to cleaner.
    Updates transaction status.
    
    Event: transfer.failed
    """
    transfer = event['data']['object']
    transfer_id = transfer['id']
    
    try:
        transaction = Transaction.objects.get(stripe_transfer_id=transfer_id)
        transaction.status = 'failed'
        transaction.save()
        
        # Notify admin of failed transfer
        logger.error(f"Transfer failed: {transfer_id}")
    
    except Transaction.DoesNotExist:
        logger.error(f"Transaction not found for transfer: {transfer_id}")


def handle_payout_paid(event):
    """
    Handle successful payout to cleaner's bank account.
    Updates transaction and StripeAccount totals.
    
    Event: payout.paid
    """
    payout = event['data']['object']
    payout_id = payout['id']
    amount = payout['amount'] / 100  # Convert from cents
    
    try:
        with db_transaction.atomic():
            # Update transaction
            transaction = Transaction.objects.select_related('to_user').filter(
                stripe_payout_id=payout_id
            ).first()
            
            if transaction:
                transaction.status = 'completed'
                transaction.completed_at = timezone.now()
                transaction.save()
                
                # Update cleaner's StripeAccount total payouts
                if transaction.to_user:
                    stripe_account = StripeAccount.objects.filter(
                        cleaner=transaction.to_user
                    ).first()
                    
                    if stripe_account:
                        stripe_account.total_payouts += amount
                        stripe_account.save(update_fields=['total_payouts'])
                
                logger.info(f"Payout completed: {payout_id} - ${amount}")
    
    except Exception as e:
        logger.error(f"Error handling payout.paid: {str(e)}", exc_info=True)


def handle_payout_failed(event):
    """
    Handle failed payout.
    Updates transaction status and notifies cleaner.
    
    Event: payout.failed
    """
    payout = event['data']['object']
    payout_id = payout['id']
    
    try:
        transaction = Transaction.objects.select_related('to_user').filter(
            stripe_payout_id=payout_id
        ).first()
        
        if transaction:
            transaction.status = 'failed'
            transaction.save()
            
            # Notify cleaner
            if transaction.to_user:
                Notification.objects.create(
                    user=transaction.to_user,
                    notification_type='payout_failed',
                    title='Payout Failed',
                    message='A payout to your bank account failed. Please check your Stripe account settings.',
                    related_object_type='transaction',
                    related_object_id=transaction.id
                )
            
            logger.error(f"Payout failed: {payout_id}")
    
    except Exception as e:
        logger.error(f"Error handling payout.failed: {str(e)}", exc_info=True)


def _send_payment_success_notifications(payment):
    """
    Helper function to send notifications after successful payment.
    
    Args:
        payment: Payment instance
    """
    try:
        # Notify client
        Notification.objects.create(
            user=payment.client,
            notification_type='payment_received',
            title='Payment Successful',
            message=f'Your payment of ${payment.amount:.2f} for job #{payment.job.id} was successful.',
            related_object_type='payment',
            related_object_id=payment.id
        )
        
        # Notify cleaner
        if payment.cleaner:
            Notification.objects.create(
                user=payment.cleaner,
                notification_type='payment_received',
                title='Payment Received',
                message=f'Payment of ${payment.cleaner_payout:.2f} received for job #{payment.job.id}. Your payout will be processed.',
                related_object_type='payment',
                related_object_id=payment.id
            )
        
        logger.info(f"Payment success notifications sent for payment {payment.id}")
    
    except Exception as e:
        logger.error(f"Error sending payment notifications: {str(e)}", exc_info=True)
