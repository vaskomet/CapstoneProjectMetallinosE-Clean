"""
Management command to list and display payment transaction details.

Usage:
    python manage.py list_payments
    python manage.py list_payments --limit 10
    python manage.py list_payments --status succeeded
"""

from django.core.management.base import BaseCommand
from payments.models import Payment, Transaction
from django.utils import timezone


class Command(BaseCommand):
    help = 'List payment transactions with detailed information'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=20,
            help='Number of payments to display (default: 20)'
        )
        parser.add_argument(
            '--status',
            type=str,
            choices=['pending', 'processing', 'succeeded', 'failed', 'cancelled'],
            help='Filter by payment status'
        )
        parser.add_argument(
            '--job',
            type=int,
            help='Filter by job ID'
        )
        parser.add_argument(
            '--client',
            type=str,
            help='Filter by client username'
        )

    def handle(self, *args, **options):
        limit = options['limit']
        status_filter = options.get('status')
        job_filter = options.get('job')
        client_filter = options.get('client')

        # Build query
        queryset = Payment.objects.select_related(
            'job', 'client', 'cleaner'
        ).prefetch_related('transactions').order_by('-created_at')

        # Apply filters
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if job_filter:
            queryset = queryset.filter(job_id=job_filter)
        if client_filter:
            queryset = queryset.filter(client__username=client_filter)

        payments = queryset[:limit]

        if not payments:
            self.stdout.write(self.style.WARNING('No payments found'))
            return

        self.stdout.write(self.style.SUCCESS(f'\n{"=" * 100}'))
        self.stdout.write(self.style.SUCCESS(f'PAYMENT TRANSACTIONS (Total: {queryset.count()})'))
        self.stdout.write(self.style.SUCCESS(f'{"=" * 100}\n'))

        for payment in payments:
            self._display_payment(payment)

    def _display_payment(self, payment):
        """Display detailed information for a single payment"""
        
        # Status color coding
        status_style = {
            'succeeded': self.style.SUCCESS,
            'failed': self.style.ERROR,
            'pending': self.style.WARNING,
            'processing': self.style.WARNING,
            'cancelled': self.style.ERROR,
        }.get(payment.status, self.style.NOTICE)

        self.stdout.write(self.style.HTTP_INFO(f'\n┌─ Payment #{payment.id} ─────────────────────────────────────'))
        self.stdout.write(f'│ Status: {status_style(payment.status.upper())}')
        self.stdout.write(f'│ Amount: ${payment.amount} {payment.currency.upper()}')
        self.stdout.write(f'│   ├─ Platform Fee (15%): ${payment.platform_fee}')
        self.stdout.write(f'│   └─ Cleaner Payout (85%): ${payment.cleaner_payout}')
        
        self.stdout.write(f'│')
        self.stdout.write(f'│ Client: {payment.client.username} ({payment.client.email})')
        if payment.cleaner:
            self.stdout.write(f'│ Cleaner: {payment.cleaner.username} ({payment.cleaner.email})')
        
        self.stdout.write(f'│ Job ID: #{payment.job.id}')
        
        self.stdout.write(f'│')
        self.stdout.write(f'│ Stripe Details:')
        self.stdout.write(f'│   ├─ Payment Intent: {payment.stripe_payment_intent_id}')
        if payment.stripe_charge_id:
            self.stdout.write(f'│   ├─ Charge ID: {payment.stripe_charge_id}')
        if payment.payment_method_type:
            card_info = f'{payment.payment_method_brand} •••• {payment.payment_method_last4}'
            self.stdout.write(f'│   └─ Payment Method: {card_info}')
        
        self.stdout.write(f'│')
        self.stdout.write(f'│ Timestamps:')
        self.stdout.write(f'│   ├─ Created: {self._format_datetime(payment.created_at)}')
        if payment.paid_at:
            self.stdout.write(f'│   ├─ Paid: {self._format_datetime(payment.paid_at)}')
        if payment.refunded_at:
            self.stdout.write(f'│   └─ Refunded: {self._format_datetime(payment.refunded_at)}')
        
        # Display transactions
        transactions = payment.transactions.all()
        if transactions:
            self.stdout.write(f'│')
            self.stdout.write(f'│ Transactions:')
            for trans in transactions:
                trans_status_style = {
                    'completed': self.style.SUCCESS,
                    'failed': self.style.ERROR,
                    'pending': self.style.WARNING,
                }.get(trans.status, self.style.NOTICE)
                
                self.stdout.write(
                    f'│   ├─ {trans.transaction_type.upper()}: '
                    f'${trans.amount} - {trans_status_style(trans.status)}'
                )
        
        # Display refunds
        if payment.refund_amount and payment.refund_amount > 0:
            self.stdout.write(f'│')
            self.stdout.write(self.style.ERROR(f'│ REFUNDED: ${payment.refund_amount}'))
            if payment.refund_reason:
                self.stdout.write(f'│ Reason: {payment.refund_reason}')
        
        self.stdout.write(self.style.HTTP_INFO(f'└{"─" * 75}\n'))

    def _format_datetime(self, dt):
        """Format datetime for display"""
        if not dt:
            return 'N/A'
        return dt.strftime('%Y-%m-%d %H:%M:%S')
