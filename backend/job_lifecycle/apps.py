from django.apps import AppConfig


class JobLifecycleConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'job_lifecycle'
    
    def ready(self):
        """Import signals when app is ready"""
        import job_lifecycle.signals
