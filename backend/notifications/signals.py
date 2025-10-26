# DISABLED: This functionality is now handled by cleaning_jobs/signals.py
# Having two signal handlers for CleaningJob causes duplicate event publishing
# and errors. All job-related signals should be in the cleaning_jobs app.

# This file can be used for notification-specific signals in the future,
# but job signals should remain in cleaning_jobs/signals.py

pass  # Empty file placeholder
