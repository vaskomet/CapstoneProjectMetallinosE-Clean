from django.apps import AppConfig


class CleaningJobsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'cleaning_jobs'
    
    def ready(self):
        """Import signal handlers when app is ready."""
        import cleaning_jobs.signals
