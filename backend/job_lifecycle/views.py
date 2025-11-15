"""
Job Lifecycle Views

API endpoints for enhanced job workflow management including:
- Photo upload for before/after documentation
- Job action workflow (confirm, start, finish)
- Notification management
- Lifecycle event tracking
"""

from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.conf import settings

from .models import JobPhoto, JobLifecycleEvent, JobAction
from .serializers import (
    JobPhotoSerializer, JobLifecycleEventSerializer, 
    JobActionSerializer,
    JobWorkflowSerializer, JobStatusUpdateSerializer
)
from cleaning_jobs.models import CleaningJob, JobBid
# Import generic notification utility for consolidation
from notifications.utils import create_and_send_notification


class JobPhotoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing job photos (before/after/progress).
    Only cleaners can upload photos for their assigned jobs.
    """
    serializer_class = JobPhotoSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter photos based on user role and job access"""
        user = self.request.user
        
        if user.role == 'admin':
            return JobPhoto.objects.all()
        elif user.role == 'cleaner':
            # Cleaners can see photos for jobs they're assigned to
            return JobPhoto.objects.filter(job__cleaner=user)
        elif user.role == 'client':
            # Clients can see photos for their jobs
            return JobPhoto.objects.filter(job__client=user)
        
        return JobPhoto.objects.none()
    
    def perform_create(self, serializer):
        """Set the uploader and validate job access"""
        job_id = self.request.data.get('job')
        job = get_object_or_404(CleaningJob, id=job_id)
        
        # Only assigned cleaner can upload photos
        if self.request.user != job.cleaner:
            raise PermissionDenied("Only the assigned cleaner can upload photos for this job.")
        
        # Save with uploader info
        photo = serializer.save(uploaded_by=self.request.user)
        
        # Create lifecycle event
        JobLifecycleEvent.objects.create(
            job=job,
            event_type='photo_uploaded',
            triggered_by=self.request.user,
            description=f"{photo.photo_type.title()} photo uploaded: {photo.description or 'No description'}"
        )


class JobWorkflowView(generics.GenericAPIView):
    """
    Handle complex job workflow actions like confirm, start, finish.
    Manages status transitions, photo uploads, and notifications.
    """
    serializer_class = JobWorkflowSerializer
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, job_id):
        """Execute a workflow action on a job"""
        print(f"Workflow request data: {request.data}")
        print(f"Workflow request files: {request.FILES}")
        
        job = get_object_or_404(CleaningJob, id=job_id)
        
        # Get action type to determine permission check
        action_type = request.data.get('action_type')
        
        # Different permissions for different actions
        if action_type in ['accept_completion', 'reject_completion']:
            # Only client can accept or reject completion
            if request.user.role != 'client' or job.client != request.user:
                raise PermissionDenied("Only the client can accept or reject job completion.")
        else:
            # Other actions are for cleaner only
            if request.user.role != 'cleaner' or job.cleaner != request.user:
                raise PermissionDenied("Only the assigned cleaner can perform job actions.")
        
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as e:
            print(f"Serializer validation error: {e}")
            print(f"Serializer errors: {serializer.errors}")
            raise
        
        action_type = serializer.validated_data['action_type']
        notes = serializer.validated_data.get('notes', '')
        latitude = serializer.validated_data.get('latitude')
        longitude = serializer.validated_data.get('longitude')
        
        # Execute the workflow action
        if action_type == 'confirm_bid':
            # Parse photos from multipart form data
            photos_data = self._parse_photos_from_request(request)
            return self._confirm_bid(job, photos_data, notes, latitude, longitude)
        elif action_type == 'start_job':
            # Parse photos from multipart form data
            photos_data = self._parse_photos_from_request(request)
            return self._start_job(job, photos_data, notes, latitude, longitude)
        elif action_type == 'finish_job':
            # Parse photos from multipart form data
            photos_data = self._parse_photos_from_request(request)
            return self._finish_job(job, photos_data, notes, latitude, longitude)
        elif action_type == 'accept_completion':
            # Client accepts the completed work
            return self._accept_completion(job, notes)
        elif action_type == 'reject_completion':
            # Client rejects the completed work
            return self._reject_completion(job, notes)
        else:
            return Response({"error": "Invalid action type"}, status=status.HTTP_400_BAD_REQUEST)
    
    def _parse_photos_from_request(self, request):
        """Parse photo files from multipart form data"""
        photos_data = []
        
        print(f"Request FILES: {request.FILES.keys()}")
        print(f"Request data keys: {request.data.keys()}")
        
        # Look for photo files in the request
        for key, file in request.FILES.items():
            print(f"Processing file key: {key}")
            if key.startswith('photo_'):
                index = key.split('_')[1]
                photo_type = request.data.get(f'photo_{index}_type', 'before')
                description = request.data.get(f'photo_{index}_description', '')
                
                print(f"Found photo: index={index}, type={photo_type}, desc={description}")
                
                photos_data.append({
                    'image': file,
                    'photo_type': photo_type,
                    'description': description
                })
        
        print(f"Parsed {len(photos_data)} photos")
        return photos_data
    
    def _confirm_bid(self, job, photos_data, notes, latitude, longitude):
        """Cleaner confirms the accepted bid"""
        if job.status != 'bid_accepted':
            raise ValidationError("Job must be in 'bid_accepted' status to confirm.")
        
        # Update job status
        old_status = job.status
        job.status = 'confirmed'
        job.cleaner_confirmed_at = timezone.now()
        job.save()
        
        # Handle any confirmation photos (optional)
        created_photos = []
        for photo_data in photos_data:
            photo_serializer = JobPhotoSerializer(data={
                **photo_data,
                'job': job.id,
                'photo_type': photo_data.get('photo_type', 'before')
            }, context={'request': self.request})
            
            if photo_serializer.is_valid():
                photo = photo_serializer.save(uploaded_by=self.request.user)
                created_photos.append(photo)
        
        # Record action
        JobAction.objects.create(
            job=job,
            action_type='confirm_bid',
            performed_by=self.request.user,
            notes=notes,
            latitude=latitude,
            longitude=longitude
        )
        
        # Create lifecycle event
        JobLifecycleEvent.objects.create(
            job=job,
            event_type='cleaner_confirmed',
            triggered_by=self.request.user,
            old_status=old_status,
            new_status=job.status,
            description=f"Cleaner confirmed accepted bid. Notes: {notes}"
        )
        
        # Notify client (using generic notification system)
        create_and_send_notification(
            recipient=job.client,
            notification_type='job_confirmed',
            title="Job Confirmed",
            message=f"Cleaner {f'{self.request.user.first_name} {self.request.user.last_name}'.strip() or self.request.user.username} has confirmed your job for {job.scheduled_date}.",
            priority='high',
            content_object=job,
            action_url=f"/client/jobs/{job.id}",
            metadata={'job_status': job.status}
        )
        
        return Response({
            "message": "Bid confirmed successfully",
            "job_status": job.status,
            "confirmed_at": job.cleaner_confirmed_at
        })
    
    def _start_job(self, job, photos_data, notes, latitude, longitude):
        """Start the job with before photos and timing validation"""
        if job.status not in ['confirmed', 'ready_to_start']:
            raise ValidationError("Job must be confirmed or ready to start.")
        
        # Validate that at least one before photo is provided
        if not photos_data:
            raise ValidationError("At least one before photo is required to start the job.")
        
        # Check timing constraints
        can_start, timing_message = job.can_start_job()
        if not can_start:
            raise ValidationError(f"Cannot start job now: {timing_message}")
        
        # Update job status
        old_status = job.status
        job.status = 'in_progress'
        job.actual_start_time = timezone.now()
        job.save()
        
        # Record action
        JobAction.objects.create(
            job=job,
            action_type='start_job',
            performed_by=self.request.user,
            notes=notes,
            latitude=latitude,
            longitude=longitude
        )
        
        # Handle before photos
        created_photos = []
        for photo_data in photos_data:
            photo_serializer = JobPhotoSerializer(data={
                **photo_data,
                'job': job.id,
                'photo_type': 'before'
            }, context={'request': self.request})
            
            if photo_serializer.is_valid():
                photo = photo_serializer.save(uploaded_by=self.request.user)
                created_photos.append(photo)
        
        # Create lifecycle event
        JobLifecycleEvent.objects.create(
            job=job,
            event_type='job_started',
            triggered_by=self.request.user,
            old_status=old_status,
            new_status=job.status,
            description=f"Job started with {len(created_photos)} before photos. Notes: {notes}",
            metadata={
                'photo_count': len(created_photos),
                'location': {'lat': latitude, 'lng': longitude} if latitude and longitude else None
            }
        )
        
        # Notify client (using generic notification system)
        create_and_send_notification(
            recipient=job.client,
            notification_type='job_started',
            title="Job Started",
            message=f"Your cleaning job has started. {len(created_photos)} before photos uploaded.",
            priority='high',
            content_object=job,
            action_url=f"/client/jobs/{job.id}",
            metadata={
                'job_status': job.status,
                'photo_count': len(created_photos),
                'location': {'lat': latitude, 'lng': longitude} if latitude and longitude else None
            }
        )
        
        return Response({
            "message": "Job started successfully",
            "job_status": job.status,
            "started_at": job.actual_start_time,
            "photos_uploaded": len(created_photos)
        })
    
    def _finish_job(self, job, photos_data, notes, latitude, longitude):
        """Finish the job with after photos"""
        if job.status != 'in_progress':
            raise ValidationError("Job must be in progress to finish.")
        
        # Update job status
        old_status = job.status
        job.status = 'awaiting_review'
        job.actual_end_time = timezone.now()
        job.save()
        
        # Record action
        JobAction.objects.create(
            job=job,
            action_type='finish_job',
            performed_by=self.request.user,
            notes=notes,
            latitude=latitude,
            longitude=longitude
        )
        
        # Handle after photos
        created_photos = []
        for photo_data in photos_data:
            photo_serializer = JobPhotoSerializer(data={
                **photo_data,
                'job': job.id,
                'photo_type': 'after'
            }, context={'request': self.request})
            
            if photo_serializer.is_valid():
                photo = photo_serializer.save(uploaded_by=self.request.user)
                created_photos.append(photo)
        
        # Calculate job duration
        duration = None
        if job.actual_start_time and job.actual_end_time:
            duration = job.actual_end_time - job.actual_start_time
        
        # Create lifecycle event
        JobLifecycleEvent.objects.create(
            job=job,
            event_type='job_finished',
            triggered_by=self.request.user,
            old_status=old_status,
            new_status=job.status,
            description=f"Job completed with {len(created_photos)} after photos. Duration: {duration}. Notes: {notes}",
            metadata={
                'photo_count': len(created_photos),
                'duration_minutes': duration.total_seconds() / 60 if duration else None,
                'location': {'lat': latitude, 'lng': longitude} if latitude and longitude else None
            }
        )
        
        # Notify client (using generic notification system)
        create_and_send_notification(
            recipient=job.client,
            notification_type='job_finished',
            title="Job Completed",
            message=f"Your cleaning job has been completed! Please review the work and provide feedback.",
            priority='high',
            content_object=job,
            action_url=f"/client/jobs/{job.id}/review",
            metadata={
                'job_status': job.status,
                'photo_count': len(created_photos),
                'duration_minutes': duration.total_seconds() / 60 if duration else None
            }
        )
        
        return Response({
            "message": "Job completed successfully",
            "job_status": job.status,
            "finished_at": job.actual_end_time,
            "duration": str(duration) if duration else None,
            "photos_uploaded": len(created_photos)
        })
    
    def _accept_completion(self, job, notes):
        """Client accepts the completed work and transitions job to 'completed' status"""
        if job.status != 'awaiting_review':
            raise ValidationError("Job must be awaiting review to accept completion.")
        
        # Verify after photos exist
        after_photos = JobPhoto.objects.filter(job=job, photo_type='after')
        if not after_photos.exists():
            raise ValidationError("Cannot accept completion without after photos from the cleaner.")
        
        # Update job status
        old_status = job.status
        job.status = 'completed'
        job.save()
        
        # Record action
        JobAction.objects.create(
            job=job,
            action_type='accept_completion',
            performed_by=self.request.user,
            notes=notes or "Client accepted job completion after reviewing work."
        )
        
        # Create lifecycle event
        JobLifecycleEvent.objects.create(
            job=job,
            event_type='status_change',
            triggered_by=self.request.user,
            old_status=old_status,
            new_status=job.status,
            description=f"Client accepted job completion. {after_photos.count()} after photos verified. Notes: {notes}",
            metadata={
                'after_photo_count': after_photos.count()
            }
        )
        
        # Notify cleaner (using generic notification system)
        create_and_send_notification(
            recipient=job.cleaner,
            notification_type='job_accepted',
            title="Job Accepted by Client",
            message=f"Great work! The client has accepted the completion of this job.",
            priority='high',
            content_object=job,
            action_url=f"/cleaner/jobs/{job.id}",
            metadata={
                'job_status': job.status,
                'after_photo_count': after_photos.count()
            }
        )
        
        return Response({
            "message": "Job completion accepted successfully",
            "job_status": job.status,
            "after_photos_count": after_photos.count()
        })
    
    def _reject_completion(self, job, notes):
        """Client rejects the completed work and sends job back to cleaner for fixes"""
        if job.status != 'awaiting_review':
            raise ValidationError("Job must be awaiting review to reject completion.")
        
        # Require rejection reason
        if not notes or len(notes.strip()) < 10:
            raise ValidationError("Please provide a detailed reason for rejecting the work (at least 10 characters).")
        
        # Update job status back to in_progress
        old_status = job.status
        job.status = 'in_progress'
        job.save()
        
        # Record action
        JobAction.objects.create(
            job=job,
            action_type='reject_completion',
            performed_by=self.request.user,
            notes=notes
        )
        
        # Create lifecycle event
        JobLifecycleEvent.objects.create(
            job=job,
            event_type='status_change',
            triggered_by=self.request.user,
            old_status=old_status,
            new_status=job.status,
            description=f"Client rejected job completion and requested fixes. Reason: {notes}"
        )
        
        # Send direct message to cleaner with rejection details and job link
        from chat.utils import send_system_message
        import base64
        
        # Get frontend URL from settings
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        # Encode job ID to obfuscate it in the URL
        encoded_job_id = base64.urlsafe_b64encode(str(job.id).encode()).decode()
        
        dm_message = (
            f"⚠️ Work Needs Revision - Job #{job.id}\n\n"
            f"The client has requested additional work on this job.\n\n"
            f"📝 Reason:\n{notes}\n\n"
            f"👉 Click here to view job details:\n{frontend_url}/jobs?ref={encoded_job_id}"
        )
        
        try:
            send_system_message(
                sender=self.request.user,  # Client
                recipient=job.cleaner,      # Cleaner
                message_content=dm_message,
                job=job
            )
        except Exception as e:
            # Log error but don't fail the rejection
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send rejection DM for job {job.id}: {e}", exc_info=True)
        
        # Also create notification for backup (using generic notification system)
        create_and_send_notification(
            recipient=job.cleaner,
            notification_type='job_rejected',
            title="Work Needs Revision",
            message=f"The client has requested additional work on this job. Check your messages for details.",
            priority='urgent',
            content_object=job,
            action_url=f"/cleaner/jobs/{job.id}",
            metadata={
                'job_status': job.status,
                'rejection_reason': notes
            }
        )
        
        return Response({
            "message": "Job completion rejected. The cleaner has been notified to make corrections.",
            "job_status": job.status,
            "rejection_reason": notes
        })


class JobStatusCheckView(generics.RetrieveAPIView):
    """
    Check job status and available actions based on timing constraints.
    Provides frontend with information about what actions are currently allowed.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, job_id):
        """Get job status information and available actions"""
        job = get_object_or_404(CleaningJob, id=job_id)
        
        # Validate user permissions
        if request.user.role == 'cleaner' and job.cleaner != request.user:
            raise PermissionDenied("Only the assigned cleaner can check job status.")
        elif request.user.role == 'client' and job.client != request.user:
            raise PermissionDenied("Only the job client can check job status.")
        
        # Get timing information
        can_start, timing_message = job.can_start_job()
        is_ready_window = job.is_ready_to_start_window()
        next_allowed_statuses = job.get_next_allowed_status()
        
        # Determine available actions for cleaner
        available_actions = []
        if request.user.role == 'cleaner' and job.cleaner == request.user:
            if job.status == 'bid_accepted':
                available_actions.append('confirm_bid')
            elif job.status in ['confirmed', 'ready_to_start'] and can_start:
                available_actions.append('start_job')
            elif job.status == 'in_progress':
                available_actions.append('finish_job')
        
        return Response({
            'job_id': job.id,
            'current_status': job.status,
            'can_start_job': can_start,
            'timing_message': timing_message,
            'is_ready_window': is_ready_window,
            'next_allowed_statuses': next_allowed_statuses,
            'available_actions': available_actions,
            'scheduled_datetime': f"{job.scheduled_date} {job.start_time}" if job.scheduled_date and job.start_time else None,
            'actual_start_time': job.actual_start_time,
            'actual_end_time': job.actual_end_time
        })


# JobNotificationViewSet REMOVED - consolidated with generic notifications system
#
# Use notifications.views.NotificationViewSet instead:
# - Endpoint: /api/notifications/
# - Features: list, retrieve, mark_read, mark_all_read, unread_count
# - Includes ALL notification types (jobs, chat, payments, system)
#
# Migration date: November 14, 2025
# See: NOTIFICATION_SYSTEM_DUPLICATION_ANALYSIS.md


class JobLifecycleEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing job lifecycle events.
    Provides audit trail for job progression.
    """
    serializer_class = JobLifecycleEventSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter events based on user role and job access"""
        user = self.request.user
        
        if user.role == 'admin':
            return JobLifecycleEvent.objects.all()
        elif user.role == 'cleaner':
            return JobLifecycleEvent.objects.filter(job__cleaner=user)
        elif user.role == 'client':
            return JobLifecycleEvent.objects.filter(job__client=user)
        
        return JobLifecycleEvent.objects.none()
