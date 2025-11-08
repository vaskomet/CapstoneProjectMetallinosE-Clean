"""
Django management command to run the event subscriber service.

This command starts the Redis Pub/Sub event subscriber that processes
events published by the application and converts them into notifications,
WebSocket updates, and other actions.

Usage:
    python manage.py run_event_subscriber

    Options:
        --topics: Comma-separated list of topics to subscribe to
        --verbosity: Set logging verbosity (0-3)
"""

import signal
import sys
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from core.subscribers import EventSubscriber
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    """
    Management command to run the event subscriber service.
    
    This command runs the EventSubscriber that listens to Redis Pub/Sub
    channels and processes events as they arrive.
    """
    
    help = 'Run event subscriber for Redis Pub/Sub messaging'
    
    def add_arguments(self, parser):
        """Add command line arguments."""
        parser.add_argument(
            '--topics',
            type=str,
            default=None,
            help='Comma-separated list of topics to subscribe to (default: from settings)'
        )
        parser.add_argument(
            '--test-connection',
            action='store_true',
            help='Test Redis connection and exit'
        )
    
    def handle(self, *args, **options):
        """Main command handler."""
        
        # Set up logging
        log_level = {
            0: logging.WARNING,
            1: logging.INFO,
            2: logging.DEBUG,
            3: logging.DEBUG
        }.get(options['verbosity'], logging.INFO)
        
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        )
        
        try:
            # Initialize subscriber
            subscriber = EventSubscriber()
            
            # Test connection if requested
            if options['test_connection']:
                self.test_connection(subscriber)
                return
            
            # Set up signal handlers for graceful shutdown
            signal.signal(signal.SIGINT, self.signal_handler)
            signal.signal(signal.SIGTERM, self.signal_handler)
            
            # Determine topics to subscribe to
            topics = self.get_topics(options)
            
            self.stdout.write(
                self.style.SUCCESS(f'Starting event subscriber for topics: {topics}')
            )
            self.stdout.write('Press Ctrl+C to stop the subscriber')
            
            # Start subscribing to events
            subscriber.subscribe_to_topics(topics)
            
        except Exception as e:
            raise CommandError(f'Failed to start event subscriber: {e}')
    
    def test_connection(self, subscriber):
        """Test Redis connection."""
        try:
            subscriber.redis_client.ping()
            self.stdout.write(
                self.style.SUCCESS('✅ Redis connection successful')
            )
            
            # Test publishing a test event
            test_result = subscriber.redis_client.publish('test:channel', 'test message')
            self.stdout.write(
                self.style.SUCCESS(f'✅ Test publish successful (subscribers: {test_result})')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Redis connection failed: {e}')
            )
            sys.exit(1)
    
    def get_topics(self, options):
        """Get list of topics to subscribe to."""
        if options['topics']:
            topics = [topic.strip() for topic in options['topics'].split(',')]
        else:
            topics = getattr(settings, 'EVENT_SUBSCRIBER_TOPICS', ['jobs', 'notifications'])
        
        if not topics:
            raise CommandError('No topics specified. Use --topics or set EVENT_SUBSCRIBER_TOPICS in settings.')
        
        return topics
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        self.stdout.write(
            self.style.WARNING('\nReceived shutdown signal. Stopping event subscriber...')
        )
        sys.exit(0)