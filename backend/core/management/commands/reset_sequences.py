"""
Management command to reset PostgreSQL sequences after manual data insertion.

This fixes ID collision issues when records are created via SQL scripts or
manual database operations that don't update the auto-increment sequences.

Usage:
    python manage.py reset_sequences
    python manage.py reset_sequences --table users_user
    python manage.py reset_sequences --verbose
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.apps import apps


class Command(BaseCommand):
    help = 'Reset PostgreSQL sequences to prevent ID collisions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--table',
            type=str,
            help='Specific table to reset (optional, resets all if not specified)',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output',
        )

    def handle(self, *args, **options):
        specific_table = options.get('table')
        verbose = options.get('verbose')

        self.stdout.write('🔧 Resetting PostgreSQL sequences...\n')

        if specific_table:
            self._reset_table_sequence(specific_table, verbose)
        else:
            self._reset_all_sequences(verbose)

        self.stdout.write(self.style.SUCCESS('\n✨ Sequence reset complete!'))
        self.stdout.write('💡 All new records will now use unique sequential IDs')

    def _reset_all_sequences(self, verbose):
        """Reset sequences for all tables with primary keys"""
        
        # Get all models
        models_to_check = []
        for app_config in apps.get_app_configs():
            if not app_config.name.startswith('django.'):
                models_to_check.extend(app_config.get_models())

        if verbose:
            self.stdout.write(f'Found {len(models_to_check)} models to check\n')

        # Header for output
        self.stdout.write(f'{"Table":<45} {"Max ID":>8} {"Next ID":>10}')
        self.stdout.write('=' * 65)

        reset_count = 0
        with connection.cursor() as cursor:
            for model in models_to_check:
                table_name = model._meta.db_table
                
                try:
                    result = self._reset_sequence(cursor, table_name)
                    if result:
                        max_id, next_id = result
                        self.stdout.write(f'{table_name:<45} {max_id:>8} {next_id:>10}')
                        reset_count += 1
                except Exception as e:
                    if verbose:
                        self.stdout.write(
                            self.style.WARNING(f'{table_name:<45} Skipped: {str(e)[:30]}')
                        )

        self.stdout.write(f'\nReset {reset_count} sequences')

    def _reset_table_sequence(self, table_name, verbose):
        """Reset sequence for a specific table"""
        
        self.stdout.write(f'Resetting sequence for table: {table_name}')
        
        with connection.cursor() as cursor:
            try:
                result = self._reset_sequence(cursor, table_name)
                if result:
                    max_id, next_id = result
                    self.stdout.write(
                        self.style.SUCCESS(f'✅ Max ID: {max_id} → Next ID: {next_id}')
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING('⚠️  Table has no records or no sequence')
                    )
            except Exception as e:
                raise CommandError(f'Error resetting sequence: {str(e)}')

    def _reset_sequence(self, cursor, table_name):
        """
        Reset a single table's sequence
        
        Returns:
            tuple: (max_id, next_id) or None if no sequence
        """
        try:
            # Get current max ID
            cursor.execute(f'SELECT MAX(id) FROM {table_name};')
            max_id = cursor.fetchone()[0]
            
            # Handle empty tables
            if max_id is None or max_id == 0:
                max_id = 0
                use_is_called = False
            else:
                use_is_called = True
            
            # Reset sequence
            # Note: GREATEST ensures we never set sequence below 1
            sequence_name = f'{table_name}_id_seq'
            cursor.execute(
                f"SELECT setval('{sequence_name}', GREATEST({max_id}, 1), {str(use_is_called).lower()});"
            )
            next_val = cursor.fetchone()[0]
            next_id = next_val + 1 if use_is_called else next_val
            
            return (max_id, next_id)
            
        except Exception as e:
            # Table might not exist or not have a sequence
            if 'does not exist' in str(e):
                return None
            raise

