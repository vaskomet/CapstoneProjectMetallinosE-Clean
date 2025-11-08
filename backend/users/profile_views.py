"""
User profile views for public cleaner profiles.
Used for clients to view cleaner reviews and stats before hiring.
"""

from rest_framework import generics, permissions as drf_permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Avg, Count, Q
from users.models import User
from cleaning_jobs.models import CleaningJob
from reviews.models import Review, ReviewRating


class CleanerPublicProfileView(APIView):
    """
    Public cleaner profile view - shows reviews, ratings, job stats.
    Accessible to anyone (no authentication required).
    """
    permission_classes = [drf_permissions.AllowAny]
    
    def get(self, request, user_id):
        """Get public profile for a cleaner"""
        cleaner = get_object_or_404(User, id=user_id, role='cleaner')
        
        # Basic info
        profile_data = {
            'id': cleaner.id,
            'first_name': cleaner.first_name,
            'last_name': cleaner.last_name,
            'email': cleaner.email,  # Consider privacy - maybe hide this
            'phone_number': cleaner.phone_number if hasattr(cleaner, 'phone_number') else None,
            'bio': cleaner.bio if hasattr(cleaner, 'bio') else None,
            'profile_picture': cleaner.profile_picture.url if hasattr(cleaner, 'profile_picture') and cleaner.profile_picture else None,
        }
        
        # Job stats
        completed_jobs = CleaningJob.objects.filter(
            cleaner=cleaner,
            status='completed'
        )
        
        profile_data['job_stats'] = {
            'total_completed': completed_jobs.count(),
            'total_jobs': CleaningJob.objects.filter(cleaner=cleaner).count(),
        }
        
        # Review stats
        reviews = Review.objects.filter(
            reviewee=cleaner,
            is_visible=True
        ).prefetch_related('ratings')
        
        if reviews.exists():
            # Overall average
            avg_overall = reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            
            # Sub-rating averages
            quality_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='quality'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            communication_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='communication'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            professionalism_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='professionalism'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            timeliness_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='timeliness'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            profile_data['review_stats'] = {
                'total_reviews': reviews.count(),
                'overall_average': round(avg_overall, 1) if avg_overall else 0,
                'sub_ratings': {
                    'quality': round(quality_avg, 1),
                    'communication': round(communication_avg, 1),
                    'professionalism': round(professionalism_avg, 1),
                    'timeliness': round(timeliness_avg, 1),
                }
            }
        else:
            profile_data['review_stats'] = {
                'total_reviews': 0,
                'overall_average': 0,
                'sub_ratings': {
                    'quality': 0,
                    'communication': 0,
                    'professionalism': 0,
                    'timeliness': 0,
                }
            }
        
        # Eco-impact (if available)
        eco_metrics = completed_jobs.exclude(
            eco_impact_metrics={}
        ).values('eco_impact_metrics')
        
        total_water_saved = 0
        total_chemicals_avoided = 0
        total_co2_saved = 0
        
        for job in eco_metrics:
            metrics = job.get('eco_impact_metrics', {})
            total_water_saved += metrics.get('water_saved_liters', 0)
            total_chemicals_avoided += metrics.get('chemicals_avoided_kg', 0)
            total_co2_saved += metrics.get('co2_saved_kg', 0)
        
        profile_data['eco_impact'] = {
            'water_saved_liters': round(total_water_saved, 1),
            'chemicals_avoided_kg': round(total_chemicals_avoided, 2),
            'co2_saved_kg': round(total_co2_saved, 2),
        }
        
        # Service areas (if available in location field)
        if hasattr(cleaner, 'location') and cleaner.location:
            profile_data['location'] = cleaner.location
        
        return Response(profile_data)


class ClientPublicProfileView(APIView):
    """
    Public client profile view - shows reviews, ratings, job stats.
    Accessible to authenticated cleaners to view client history.
    """
    permission_classes = [drf_permissions.AllowAny]
    
    def get(self, request, user_id):
        """Get public profile for a client"""
        client = get_object_or_404(User, id=user_id, role='client')
        
        # Basic info
        profile_data = {
            'id': client.id,
            'first_name': client.first_name,
            'last_name': client.last_name,
            'email': client.email,  # Consider privacy - maybe hide this
            'phone_number': client.phone_number if hasattr(client, 'phone_number') else None,
            'profile_picture': client.profile_picture.url if hasattr(client, 'profile_picture') and client.profile_picture else None,
        }
        
        # Job stats
        completed_jobs = CleaningJob.objects.filter(
            client=client,
            status='completed'
        )
        
        profile_data['job_stats'] = {
            'total_completed': completed_jobs.count(),
            'total_jobs': CleaningJob.objects.filter(client=client).count(),
        }
        
        # Review stats (reviews received by the client from cleaners)
        reviews = Review.objects.filter(
            reviewee=client,
            is_visible=True
        ).prefetch_related('ratings')
        
        if reviews.exists():
            # Overall average
            avg_overall = reviews.aggregate(Avg('overall_rating'))['overall_rating__avg']
            
            # Sub-rating averages
            communication_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='communication'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            professionalism_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='professionalism'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            responsiveness_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='responsiveness'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            clarity_avg = ReviewRating.objects.filter(
                review__in=reviews,
                category='clarity'
            ).aggregate(Avg('rating'))['rating__avg'] or 0
            
            profile_data['review_stats'] = {
                'total_reviews': reviews.count(),
                'overall_average': round(avg_overall, 1) if avg_overall else 0,
                'sub_ratings': {
                    'communication': round(communication_avg, 1),
                    'professionalism': round(professionalism_avg, 1),
                    'responsiveness': round(responsiveness_avg, 1),
                    'clarity': round(clarity_avg, 1),
                }
            }
        else:
            profile_data['review_stats'] = {
                'total_reviews': 0,
                'overall_average': 0,
                'sub_ratings': {
                    'communication': 0,
                    'professionalism': 0,
                    'responsiveness': 0,
                    'clarity': 0,
                }
            }
        
        # Member since
        profile_data['member_since'] = client.date_joined.strftime('%B %Y')
        
        return Response(profile_data)
