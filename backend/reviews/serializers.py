from rest_framework import serializers
from .models import Review, ReviewRating, ReviewResponse, ReviewFlag
from users.models import User
from cleaning_jobs.models import CleaningJob
from django.utils import timezone
from datetime import timedelta
from django.db.models import Avg


class ReviewRatingSerializer(serializers.ModelSerializer):
    """
    Serializer for ReviewRating model (sub-ratings).
    Validates x/10 rating scale.
    """
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    
    class Meta:
        model = ReviewRating
        fields = ['id', 'category', 'category_display', 'rating']
        read_only_fields = ['id']
    
    def validate_rating(self, value):
        """Ensure rating is between 1 and 10"""
        if value < 1 or value > 10:
            raise serializers.ValidationError("Rating must be between 1 and 10.")
        return value


class ReviewResponseSerializer(serializers.ModelSerializer):
    """
    Serializer for ReviewResponse model.
    Allows reviewees to respond to reviews.
    """
    respondent_name = serializers.SerializerMethodField()
    respondent_id = serializers.SerializerMethodField()
    
    class Meta:
        model = ReviewResponse
        fields = [
            'id',
            'review',
            'response_text',
            'respondent_name',
            'respondent_id',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_respondent_name(self, obj):
        """Return the name of the person who responded (reviewee)"""
        return f"{obj.review.reviewee.first_name} {obj.review.reviewee.last_name}".strip() or obj.review.reviewee.username
    
    def get_respondent_id(self, obj):
        """Return the ID of the person who responded"""
        return obj.review.reviewee.id
    
    def validate(self, data):
        """Ensure only the reviewee can respond"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            review = data.get('review')
            if review and review.reviewee != request.user:
                raise serializers.ValidationError("Only the reviewee can respond to this review.")
        return data


class ReviewSerializer(serializers.ModelSerializer):
    """
    Comprehensive serializer for Review model.
    Includes nested ratings, response, and user information.
    Validates bidirectional review logic and business rules.
    """
    # Nested serializers for related data
    ratings = ReviewRatingSerializer(many=True)
    response = ReviewResponseSerializer(read_only=True)
    
    # User information (read-only)
    reviewer_name = serializers.SerializerMethodField()
    reviewer_role = serializers.CharField(source='reviewer.role', read_only=True)
    reviewee_name = serializers.SerializerMethodField()
    reviewee_role = serializers.CharField(source='reviewee.role', read_only=True)
    
    # Job information (read-only)
    job_title = serializers.SerializerMethodField()
    job_date = serializers.DateField(source='job.scheduled_date', read_only=True)
    
    # Flag information (for moderation)
    flag_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Review
        fields = [
            'id',
            'job',
            'reviewer',
            'reviewer_name',
            'reviewer_role',
            'reviewee',
            'reviewee_name',
            'reviewee_role',
            'overall_rating',
            'comment',
            'ratings',
            'response',
            'is_visible',
            'job_title',
            'job_date',
            'flag_count',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'reviewer', 'reviewee', 'created_at', 'updated_at']
    
    def get_reviewer_name(self, obj):
        """Return full name or username of reviewer"""
        return f"{obj.reviewer.first_name} {obj.reviewer.last_name}".strip() or obj.reviewer.username
    
    def get_reviewee_name(self, obj):
        """Return full name or username of reviewee"""
        return f"{obj.reviewee.first_name} {obj.reviewee.last_name}".strip() or obj.reviewee.username
    
    def get_job_title(self, obj):
        """Return truncated job services description"""
        services = obj.job.services_description
        return services[:50] + '...' if len(services) > 50 else services
    
    def get_flag_count(self, obj):
        """Return number of flags on this review"""
        return obj.flags.count()
    
    def validate_overall_rating(self, value):
        """Ensure overall rating is between 1 and 10"""
        if value < 1 or value > 10:
            raise serializers.ValidationError("Overall rating must be between 1 and 10.")
        return value
    
    def validate_job(self, value):
        """Validate that the job can be reviewed"""
        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Authentication required.")
        
        user = request.user
        
        # Check if job is awaiting_review or completed
        if value.status not in ['awaiting_review', 'completed']:
            raise serializers.ValidationError("Only jobs that are awaiting review or completed can be reviewed.")
        
        # Check if user is a participant in the job
        if user != value.client and user != value.cleaner:
            raise serializers.ValidationError("You can only review jobs you participated in.")
        
        # Check if job has completion date (for 30-day window)
        if not value.actual_end_time:
            raise serializers.ValidationError("Job must have a completion date to be reviewed.")
        
        # Check if within 30-day review window
        thirty_days_ago = timezone.now() - timedelta(days=30)
        if value.actual_end_time < thirty_days_ago:
            raise serializers.ValidationError("Reviews must be submitted within 30 days of job completion.")
        
        # Check if user has already reviewed this job
        existing_review = Review.objects.filter(job=value, reviewer=user).first()
        if existing_review:
            raise serializers.ValidationError("You have already reviewed this job.")
        
        return value
    
    def validate_ratings(self, value):
        """Validate that all required sub-rating categories are present"""
        required_categories = ['quality', 'communication', 'professionalism', 'timeliness']
        provided_categories = [rating['category'] for rating in value]
        
        for category in required_categories:
            if category not in provided_categories:
                raise serializers.ValidationError(f"Missing required rating category: {category}")
        
        return value
    
    def create(self, validated_data):
        """
        Create review with nested ratings.
        Automatically set reviewee based on reviewer's role.
        Job status transition to 'completed' handled in Review model's save() method.
        """
        ratings_data = validated_data.pop('ratings')
        request = self.context.get('request')
        
        # Set reviewer to current user
        validated_data['reviewer'] = request.user
        
        # Create the review (reviewee will be set automatically by model's save() method)
        review = Review.objects.create(**validated_data)
        
        # Create associated ratings
        for rating_data in ratings_data:
            ReviewRating.objects.create(review=review, **rating_data)
        
        return review
    
    def update(self, instance, validated_data):
        """
        Update review and nested ratings.
        Only allow updating comment and ratings, not job/reviewer/reviewee.
        """
        ratings_data = validated_data.pop('ratings', None)
        
        # Update review fields
        instance.overall_rating = validated_data.get('overall_rating', instance.overall_rating)
        instance.comment = validated_data.get('comment', instance.comment)
        instance.save()
        
        # Update ratings if provided
        if ratings_data:
            # Delete existing ratings and create new ones
            instance.ratings.all().delete()
            for rating_data in ratings_data:
                ReviewRating.objects.create(review=instance, **rating_data)
        
        return instance


class ReviewListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for listing reviews.
    Optimized for performance with minimal data.
    """
    reviewer_name = serializers.SerializerMethodField()
    reviewee_name = serializers.SerializerMethodField()
    has_response = serializers.SerializerMethodField()
    
    class Meta:
        model = Review
        fields = [
            'id',
            'reviewer_name',
            'reviewee_name',
            'overall_rating',
            'comment',
            'has_response',
            'created_at'
        ]
    
    def get_reviewer_name(self, obj):
        return f"{obj.reviewer.first_name} {obj.reviewer.last_name}".strip() or obj.reviewer.username
    
    def get_reviewee_name(self, obj):
        return f"{obj.reviewee.first_name} {obj.reviewee.last_name}".strip() or obj.reviewee.username
    
    def get_has_response(self, obj):
        return hasattr(obj, 'response')


class ReviewStatsSerializer(serializers.Serializer):
    """
    Serializer for aggregate review statistics.
    Shows average ratings and review count for a user.
    """
    user_id = serializers.IntegerField()
    user_name = serializers.CharField()
    user_role = serializers.CharField()
    
    total_reviews = serializers.IntegerField()
    average_overall_rating = serializers.FloatField()
    
    # Sub-rating averages
    average_quality = serializers.FloatField()
    average_communication = serializers.FloatField()
    average_professionalism = serializers.FloatField()
    average_timeliness = serializers.FloatField()
    
    class Meta:
        fields = [
            'user_id',
            'user_name',
            'user_role',
            'total_reviews',
            'average_overall_rating',
            'average_quality',
            'average_communication',
            'average_professionalism',
            'average_timeliness'
        ]


class ReviewFlagSerializer(serializers.ModelSerializer):
    """
    Serializer for ReviewFlag model.
    Allows users to report inappropriate reviews.
    """
    flagger_name = serializers.SerializerMethodField()
    review_preview = serializers.SerializerMethodField()
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    moderation_status_display = serializers.CharField(source='get_moderation_status_display', read_only=True)
    
    class Meta:
        model = ReviewFlag
        fields = [
            'id',
            'review',
            'flagger',
            'flagger_name',
            'reason',
            'reason_display',
            'details',
            'moderation_status',
            'moderation_status_display',
            'admin_notes',
            'review_preview',
            'created_at',
            'reviewed_at'
        ]
        read_only_fields = [
            'id',
            'flagger',
            'moderation_status',
            'admin_notes',
            'created_at',
            'reviewed_at'
        ]
    
    def get_flagger_name(self, obj):
        """Return name of user who flagged the review"""
        return f"{obj.flagger.first_name} {obj.flagger.last_name}".strip() or obj.flagger.username
    
    def get_review_preview(self, obj):
        """Return preview of the flagged review"""
        comment = obj.review.comment
        return comment[:100] + '...' if len(comment) > 100 else comment
    
    def validate(self, data):
        """Ensure user hasn't already flagged this review"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            review = data.get('review')
            existing_flag = ReviewFlag.objects.filter(review=review, flagger=request.user).first()
            if existing_flag:
                raise serializers.ValidationError("You have already flagged this review.")
        return data
    
    def create(self, validated_data):
        """Set flagger to current user"""
        request = self.context.get('request')
        validated_data['flagger'] = request.user
        return super().create(validated_data)
