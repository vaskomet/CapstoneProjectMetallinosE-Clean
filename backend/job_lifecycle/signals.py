"""
Job Lifecycle Signals - DISABLED

The JobNotification model has been consolidated with the generic notifications system.
Signal handler removed as JobNotification.objects.create() calls have been replaced 
with notifications.utils.create_and_send_notification(), which handles WebSocket 
delivery internally.

Migration date: November 14, 2025
See: NOTIFICATION_SYSTEM_DUPLICATION_ANALYSIS.md
"""

# Signal handler no longer needed - generic notification system handles WebSocket delivery
pass
