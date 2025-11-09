# Review and Rating System Design

**Date:** November 2, 2025  
**Purpose:** Foundation for recommendation system and platform trust  
**Phase:** Phase 1 Enhancement

---

## 1. System Overview

### Core Objectives
1. **Trust Building** - Enable clients to rate cleaners and vice versa
2. **Quality Control** - Identify top performers and areas for improvement
3. **Recommendation Foundation** - Collect data for future ML-based matching
4. **Dispute Resolution** - Provide context for payment/service disputes

### Key Features
- ⭐ 5-star rating system
- 💬 Written reviews with photos (optional)
- 🔄 Bidirectional reviews (client ↔ cleaner)
- 📊 Aggregate ratings and statistics
- ✅ Verification (only for completed jobs)
- 🚫 Report/flag inappropriate reviews

---

## 2. Database Schema

### Review Model

```python
# backend/reviews/models.py

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from users.models import User
from cleaning_jobs.models import CleaningJob

class Review(models.Model):
    """
    Bidirectional review system for completed cleaning jobs.
    Supports client → cleaner and cleaner → client reviews.
    """
    REVIEW_TYPE_CHOICES = [
        ('client_to_cleaner', 'Client reviewing Cleaner'),
        ('cleaner_to_client', 'Cleaner reviewing Client'),
    ]
    
    # Core relationships
    job = models.ForeignKey(
        CleaningJob,
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    reviewer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_given'
    )
    reviewee = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='reviews_received'
    )
    
    # Review type (client→cleaner or cleaner→client)
    review_type = models.CharField(
        max_length=20,
        choices=REVIEW_TYPE_CHOICES
    )
    
    # Rating (1-5 stars)
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Overall rating (1-5 stars)"
    )
    
    # Detailed ratings (optional, for cleaner reviews)
    quality_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Quality of work (cleaners only)"
    )
    communication_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Communication quality"
    )
    professionalism_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Professionalism"
    )
    timeliness_rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        null=True,
        blank=True,
        help_text="Timeliness and punctuality"
    )
    
    # Written review
    comment = models.TextField(
        blank=True,
        help_text="Written review (optional)"
    )
    
    # Photos (optional, for before/after)
    # photos = models.ManyToManyField('photos.Photo', blank=True)  # Phase 4
    
    # Moderation
    is_flagged = models.BooleanField(
        default=False,
        help_text="Flagged for review by admin"
    )
    flag_reason = models.TextField(blank=True)
    
    is_hidden = models.BooleanField(
        default=False,
        help_text="Hidden by admin (violates guidelines)"
    )
    admin_notes = models.TextField(blank=True)
    
    # Response from reviewee (optional)
    response = models.TextField(
        blank=True,
        help_text="Response from the person being reviewed"
    )
    response_date = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['reviewer', '-created_at']),
            models.Index(fields=['reviewee', '-created_at']),
            models.Index(fields=['job']),
            models.Index(fields=['rating']),
        ]
        # Only one review per person per job
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'reviewer'],
                name='unique_review_per_job_per_reviewer'
            )
        ]
    
    def __str__(self):
        return f"{self.reviewer.username} → {self.reviewee.username} ({self.rating}★)"
    
    def save(self, *args, **kwargs):
        # Auto-set review_type based on reviewer role
        if not self.review_type:
            if self.reviewer.role == 'client' and self.reviewee.role == 'cleaner':
                self.review_type = 'client_to_cleaner'
            elif self.reviewer.role == 'cleaner' and self.reviewee.role == 'client':
                self.review_type = 'cleaner_to_client'
        super().save(*args, **kwargs)


class ReviewRating(models.Model):
    """
    Aggregate rating statistics for users (denormalized for performance).
    Updated via signals when reviews are created/updated/deleted.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='rating_stats'
    )
    
    # Overall statistics
    average_rating = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=0.00,
        help_text="Average of all ratings received"
    )
    total_reviews = models.IntegerField(
        default=0,
        help_text="Total number of reviews received"
    )
    
    # Rating distribution (for display)
    five_star_count = models.IntegerField(default=0)
    four_star_count = models.IntegerField(default=0)
    three_star_count = models.IntegerField(default=0)
    two_star_count = models.IntegerField(default=0)
    one_star_count = models.IntegerField(default=0)
    
    # Detailed averages (for cleaners)
    avg_quality = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True
    )
    avg_communication = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True
    )
    avg_professionalism = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True
    )
    avg_timeliness = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True
    )
    
    # Metadata
    last_review_date = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}: {self.average_rating}★ ({self.total_reviews} reviews)"
    
    def update_statistics(self):
        """Recalculate all statistics from reviews."""
        from django.db.models import Avg, Count, Q
        
        reviews = Review.objects.filter(
            reviewee=self.user,
            is_hidden=False
        )
        
        # Overall stats
        self.total_reviews = reviews.count()
        
        if self.total_reviews > 0:
            self.average_rating = reviews.aggregate(Avg('rating'))['rating__avg'] or 0
            
            # Rating distribution
            self.five_star_count = reviews.filter(rating=5).count()
            self.four_star_count = reviews.filter(rating=4).count()
            self.three_star_count = reviews.filter(rating=3).count()
            self.two_star_count = reviews.filter(rating=2).count()
            self.one_star_count = reviews.filter(rating=1).count()
            
            # Detailed averages (for cleaners)
            if self.user.role == 'cleaner':
                self.avg_quality = reviews.aggregate(Avg('quality_rating'))['quality_rating__avg']
                self.avg_communication = reviews.aggregate(Avg('communication_rating'))['communication_rating__avg']
                self.avg_professionalism = reviews.aggregate(Avg('professionalism_rating'))['professionalism_rating__avg']
                self.avg_timeliness = reviews.aggregate(Avg('timeliness_rating'))['timeliness_rating__avg']
            
            # Last review date
            self.last_review_date = reviews.order_by('-created_at').first().created_at
        else:
            # Reset to defaults
            self.average_rating = 0
            self.five_star_count = 0
            self.four_star_count = 0
            self.three_star_count = 0
            self.two_star_count = 0
            self.one_star_count = 0
            self.avg_quality = None
            self.avg_communication = None
            self.avg_professionalism = None
            self.avg_timeliness = None
            self.last_review_date = None
        
        self.save()


class ReviewFlag(models.Model):
    """
    User-reported flags for inappropriate reviews.
    """
    FLAG_REASON_CHOICES = [
        ('spam', 'Spam or fake review'),
        ('offensive', 'Offensive language'),
        ('personal_info', 'Contains personal information'),
        ('irrelevant', 'Irrelevant content'),
        ('false_info', 'False or misleading information'),
        ('other', 'Other'),
    ]
    
    review = models.ForeignKey(
        Review,
        on_delete=models.CASCADE,
        related_name='flags'
    )
    flagger = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='review_flags'
    )
    reason = models.CharField(
        max_length=20,
        choices=FLAG_REASON_CHOICES
    )
    details = models.TextField(blank=True)
    
    # Moderation
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Review'),
            ('reviewed', 'Reviewed - No Action'),
            ('action_taken', 'Action Taken'),
        ],
        default='pending'
    )
    admin_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_flags'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        # One flag per user per review
        constraints = [
            models.UniqueConstraint(
                fields=['review', 'flagger'],
                name='unique_flag_per_review_per_user'
            )
        ]
```

---

## 3. Signals (Auto-update Statistics)

```python
# backend/reviews/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Review, ReviewRating

@receiver(post_save, sender=Review)
def update_rating_on_review_save(sender, instance, created, **kwargs):
    """Update ReviewRating stats when a review is created or updated."""
    # Get or create rating stats for reviewee
    rating_stats, _ = ReviewRating.objects.get_or_create(user=instance.reviewee)
    rating_stats.update_statistics()

@receiver(post_delete, sender=Review)
def update_rating_on_review_delete(sender, instance, **kwargs):
    """Update ReviewRating stats when a review is deleted."""
    try:
        rating_stats = ReviewRating.objects.get(user=instance.reviewee)
        rating_stats.update_statistics()
    except ReviewRating.DoesNotExist:
        pass


# backend/reviews/apps.py

from django.apps import AppConfig

class ReviewsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reviews'
    
    def ready(self):
        import reviews.signals  # noqa
```

---

## 4. API Endpoints

### 4.1 Core Endpoints

```
POST   /api/reviews/                    Create review
GET    /api/reviews/                    List all reviews (filterable)
GET    /api/reviews/{id}/               Get review details
PUT    /api/reviews/{id}/               Update review (owner only)
DELETE /api/reviews/{id}/               Delete review (owner only)

# Job-specific
GET    /api/reviews/job/{job_id}/       Get reviews for a job
POST   /api/reviews/job/{job_id}/       Create review for a job

# User-specific
GET    /api/reviews/user/{user_id}/     Get reviews for a user (received)
GET    /api/reviews/stats/{user_id}/    Get rating statistics

# Response
POST   /api/reviews/{id}/respond/       Respond to a review (reviewee only)

# Moderation
POST   /api/reviews/{id}/flag/          Flag review as inappropriate
GET    /api/reviews/flags/              List flagged reviews (admin)
POST   /api/reviews/flags/{id}/review/  Review a flag (admin)
```

### 4.2 Query Parameters

```
GET /api/reviews/?reviewer={user_id}         Reviews given by user
GET /api/reviews/?reviewee={user_id}         Reviews received by user
GET /api/reviews/?job={job_id}               Reviews for job
GET /api/reviews/?rating__gte=4              Filter by rating
GET /api/reviews/?review_type=client_to_cleaner
GET /api/reviews/?ordering=-created_at       Sort by date
```

---

## 5. Business Rules

### 5.1 When Can Users Leave Reviews?

**Conditions:**
1. ✅ Job status must be `completed`
2. ✅ User must be either client or cleaner on the job
3. ✅ Payment must be `succeeded` (for client reviews)
4. ✅ User hasn't already reviewed this job
5. ✅ Within review window (e.g., 30 days after completion)

**Review Window:**
- **Immediate:** Available as soon as job is marked completed
- **Reminder:** Send email notification 24 hours after completion
- **Deadline:** 30 days after completion (configurable)

### 5.2 Rating Requirements

**Client → Cleaner:**
- ✅ Overall rating (required)
- ✅ Quality rating (optional but recommended)
- ✅ Communication rating (optional)
- ✅ Professionalism rating (optional)
- ✅ Timeliness rating (optional)
- ✅ Written comment (optional, min 10 chars if provided)

**Cleaner → Client:**
- ✅ Overall rating (required)
- ✅ Communication rating (optional)
- ✅ Written comment (optional)

### 5.3 Moderation Rules

**Auto-hide reviews if:**
- Contains profanity (use profanity filter library)
- Contains email addresses or phone numbers
- Less than 5 words (likely spam)
- Flagged by 3+ users

**Manual review required:**
- 1-star reviews (high impact)
- Reviews with responses
- Flagged reviews

---

## 6. Frontend Components

### 6.1 Review Display Components

```jsx
// ReviewCard.jsx
<div className="review-card">
  <div className="review-header">
    <Avatar user={reviewer} />
    <div>
      <h4>{reviewer.name}</h4>
      <StarRating rating={review.rating} />
      <span className="date">{formatDate(review.created_at)}</span>
    </div>
  </div>
  
  {/* Detailed ratings (for cleaners) */}
  {review.quality_rating && (
    <div className="detailed-ratings">
      <RatingBar label="Quality" value={review.quality_rating} />
      <RatingBar label="Communication" value={review.communication_rating} />
      <RatingBar label="Professionalism" value={review.professionalism_rating} />
      <RatingBar label="Timeliness" value={review.timeliness_rating} />
    </div>
  )}
  
  <p className="comment">{review.comment}</p>
  
  {/* Response */}
  {review.response && (
    <div className="review-response">
      <strong>Response from {reviewee.name}:</strong>
      <p>{review.response}</p>
    </div>
  )}
  
  {/* Actions */}
  <div className="actions">
    <button onClick={() => flagReview(review.id)}>
      <FlagIcon /> Report
    </button>
  </div>
</div>

// RatingsSummary.jsx
<div className="ratings-summary">
  <div className="overall">
    <h2>{stats.average_rating}</h2>
    <StarRating rating={stats.average_rating} />
    <p>{stats.total_reviews} reviews</p>
  </div>
  
  <div className="distribution">
    <RatingBar label="5 stars" count={stats.five_star_count} total={stats.total_reviews} />
    <RatingBar label="4 stars" count={stats.four_star_count} total={stats.total_reviews} />
    <RatingBar label="3 stars" count={stats.three_star_count} total={stats.total_reviews} />
    <RatingBar label="2 stars" count={stats.two_star_count} total={stats.total_reviews} />
    <RatingBar label="1 star" count={stats.one_star_count} total={stats.total_reviews} />
  </div>
</div>
```

### 6.2 Review Form

```jsx
// ReviewForm.jsx
<form onSubmit={handleSubmit}>
  <h3>Rate {reviewee.name}</h3>
  
  {/* Overall rating */}
  <StarRatingInput
    label="Overall Rating"
    value={rating}
    onChange={setRating}
    required
  />
  
  {/* Detailed ratings (for cleaners) */}
  {reviewType === 'client_to_cleaner' && (
    <>
      <StarRatingInput
        label="Quality of Work"
        value={qualityRating}
        onChange={setQualityRating}
      />
      <StarRatingInput
        label="Communication"
        value={communicationRating}
        onChange={setCommunicationRating}
      />
      <StarRatingInput
        label="Professionalism"
        value={professionalismRating}
        onChange={setProfessionalismRating}
      />
      <StarRatingInput
        label="Timeliness"
        value={timelinessRating}
        onChange={setTimelinessRating}
      />
    </>
  )}
  
  {/* Written review */}
  <textarea
    placeholder="Share your experience (optional)"
    value={comment}
    onChange={(e) => setComment(e.target.value)}
    minLength={10}
  />
  
  <button type="submit">Submit Review</button>
</form>
```

---

## 7. Integration Points

### 7.1 Completed Jobs Page
```jsx
// Show review prompt for unreviewed completed jobs
{job.status === 'completed' && !job.hasUserReviewed && (
  <div className="review-prompt">
    <p>How was your experience with {otherUser.name}?</p>
    <button onClick={() => openReviewModal(job)}>
      Write a Review
    </button>
  </div>
)}
```

### 7.2 Cleaner Profile
```jsx
// Display rating summary and recent reviews
<CleanerProfile cleaner={cleaner}>
  <RatingsSummary stats={cleaner.rating_stats} />
  <RecentReviews reviews={cleaner.recent_reviews} />
</CleanerProfile>
```

### 7.3 Find Cleaners Search
```jsx
// Filter by rating
<FilterOption>
  <label>Minimum Rating</label>
  <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
    <option value="">Any</option>
    <option value="4.5">4.5+ stars</option>
    <option value="4.0">4.0+ stars</option>
    <option value="3.0">3.0+ stars</option>
  </select>
</FilterOption>

// Display rating in results
<CleanerCard cleaner={cleaner}>
  <StarRating rating={cleaner.rating_stats.average_rating} />
  <span>({cleaner.rating_stats.total_reviews} reviews)</span>
</CleanerCard>
```

### 7.4 Notifications
```python
# Send notification when:
# 1. User receives a new review
# 2. User's review gets a response
# 3. Review is flagged/hidden
# 4. Reminder to leave review (24hrs after completion)
```

---

## 8. Recommendation System Foundation

### 8.1 Data Points for ML

The review system provides rich data for future recommendations:

```python
# Features for cleaner recommendation algorithm
cleaner_features = {
    # Rating metrics
    'overall_rating': cleaner.rating_stats.average_rating,
    'total_reviews': cleaner.rating_stats.total_reviews,
    'quality_score': cleaner.rating_stats.avg_quality,
    'communication_score': cleaner.rating_stats.avg_communication,
    'professionalism_score': cleaner.rating_stats.avg_professionalism,
    'timeliness_score': cleaner.rating_stats.avg_timeliness,
    
    # Rating distribution (reliability indicator)
    'rating_variance': calculate_variance(cleaner.reviews),
    'consistency_score': cleaner.rating_stats.five_star_count / cleaner.rating_stats.total_reviews,
    
    # Temporal features
    'days_since_last_review': (now - cleaner.rating_stats.last_review_date).days,
    'reviews_last_30_days': cleaner.reviews.filter(created_at__gte=thirty_days_ago).count(),
    
    # Client satisfaction
    'client_satisfaction_rate': cleaner.reviews.filter(rating__gte=4).count() / total,
    'repeat_client_rate': calculate_repeat_clients(cleaner),
}

# Collaborative filtering signals
user_preferences = {
    'preferred_communication_style': analyze_reviews(user.reviews_given),
    'quality_sensitivity': calculate_quality_weight(user.reviews_given),
    'price_sensitivity': calculate_price_weight(user.job_history),
}
```

### 8.2 Recommendation Queries

```python
# Query 1: Top-rated cleaners in area
top_cleaners = CleanerProfile.objects.filter(
    location__distance_lte=(client_location, 10000),  # 10km
    user__rating_stats__average_rating__gte=4.5,
    user__rating_stats__total_reviews__gte=10
).order_by('-user__rating_stats__average_rating')

# Query 2: Similar client preferences
similar_clients = find_similar_clients(
    client,
    features=['avg_rating_given', 'preferred_cleaners', 'job_types']
)
recommended_cleaners = get_cleaners_from_similar_clients(similar_clients)

# Query 3: Best match for job requirements
matches = rank_cleaners(
    job_requirements=job.services_description,
    client_preferences=client.preferences,
    cleaner_reviews=reviews
)
```

---

## 9. Implementation Checklist

### Phase 1: Core Review System
- [ ] Create `reviews` app
- [ ] Define models (Review, ReviewRating, ReviewFlag)
- [ ] Create migrations
- [ ] Set up signals for auto-updating stats
- [ ] Create serializers
- [ ] Build API endpoints
- [ ] Add permissions and validation
- [ ] Write unit tests

### Phase 2: Frontend Integration
- [ ] Create StarRating component
- [ ] Build ReviewForm component
- [ ] Build ReviewCard component
- [ ] Build RatingsSummary component
- [ ] Add review prompts to completed jobs page
- [ ] Integrate ratings into cleaner profiles
- [ ] Add rating filter to find cleaners search

### Phase 3: Moderation & Quality
- [ ] Implement profanity filter
- [ ] Build admin moderation interface
- [ ] Add email notifications for reviews
- [ ] Set up review reminder system
- [ ] Implement flag/report functionality

### Phase 4: Analytics & Recommendations
- [ ] Build analytics dashboard (admin)
- [ ] Track review trends over time
- [ ] Implement basic recommendation algorithm
- [ ] A/B test recommendation strategies

---

## 10. Future Enhancements

### Enhanced Features
- 📸 Photo uploads (before/after cleaning)
- 🎥 Video reviews (testimonials)
- 🏆 Badges and achievements (100+ 5-star reviews)
- 📊 Comparative analytics (vs. area average)
- 🤝 Verified client badges (multiple completed jobs)

### ML-Powered Features
- 🤖 Sentiment analysis on reviews
- 📈 Prediction of cleaner availability
- 🎯 Personalized cleaner recommendations
- ⚠️ Fraud detection (fake reviews)
- 📝 Auto-generated review summaries

---

## Summary

This review system provides:
- ✅ **Trust building** through transparent ratings
- ✅ **Quality control** via aggregate statistics
- ✅ **Data foundation** for ML recommendations
- ✅ **User engagement** with reviews and responses
- ✅ **Scalability** with denormalized stats
- ✅ **Moderation** tools for platform quality

Ready to implement! 🚀
