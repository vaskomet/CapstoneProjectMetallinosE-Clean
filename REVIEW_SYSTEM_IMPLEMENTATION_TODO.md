# Review System Implementation TODO

## Overview
This document outlines the step-by-step approach to implementing the Review & Rating System on top of our existing codebase **without breaking any existing functionality**.

**Key Principles:**
- ✅ Build incrementally - test after each phase
- ✅ Add new code, don't modify existing core logic
- ✅ Use Django migrations carefully to avoid data loss
- ✅ Keep existing endpoints working throughout implementation
- ✅ Test with existing data after each change

---

## Phase 1: Database Models & Migrations (SAFE - Additive Only)

### Files to CREATE (NEW FILES - No risk to existing code):
1. **`backend/reviews/models.py`** (NEW app)
   - Create `Review` model
   - Create `ReviewRating` model  
   - Create `ReviewResponse` model
   - Create `ReviewFlag` model

2. **`backend/reviews/migrations/0001_initial.py`** (AUTO-GENERATED)
   - Django will create this via `python manage.py makemigrations reviews`

### Files to MODIFY (Minimal changes):
3. **`backend/e_clean_backend/settings.py`**
   - **Change:** Add `'reviews'` to `INSTALLED_APPS` list (line ~40)
   - **Risk:** NONE - Just adding a new app
   - **Verification:** Run `python manage.py check` - must show no errors

### Safety Checks:
```bash
# After creating models:
python manage.py check  # Must pass
python manage.py makemigrations reviews  # Should create 0001_initial.py
python manage.py migrate --plan  # Review migration plan (DON'T RUN YET)
# Manually inspect the migration file before running
python manage.py migrate reviews  # Only if inspection looks good
```

### Testing After Phase 1:
- ✅ Server starts normally: `python manage.py runserver`
- ✅ Admin panel accessible: http://localhost:8000/admin/
- ✅ Existing functionality works: Test login, create job, make payment
- ✅ No errors in console

---

## Phase 2: Model Registration & Admin Interface (SAFE - View Only)

### Files to CREATE:
4. **`backend/reviews/admin.py`** (NEW)
   - Register Review, ReviewRating, ReviewResponse, ReviewFlag models
   - Add read-only admin views for testing
   - Add moderation actions for ReviewFlag

### Files to CREATE:
5. **`backend/reviews/__init__.py`** (NEW - Empty file)

### Safety Checks:
```bash
python manage.py check
# Visit admin panel and verify review models appear
# Try creating a test review manually via admin
```

### Testing After Phase 2:
- ✅ Admin panel shows "Reviews" section
- ✅ Can create test review via admin (don't use API yet)
- ✅ All existing apps still work (jobs, payments, auth)

---

## Phase 3: Serializers (SAFE - No API exposure yet)

### Files to CREATE:
6. **`backend/reviews/serializers.py`** (NEW)
   - Create `ReviewSerializer` (with nested ratings)
   - Create `ReviewRatingSerializer`
   - Create `ReviewResponseSerializer`
   - Create `ReviewFlagSerializer`
   - Create `ReviewListSerializer` (optimized for listings)
   - Create `ReviewStatsSerializer` (for average ratings)

### Safety Checks:
```bash
python manage.py check
# No API endpoints yet, so nothing to test externally
# Serializers are just Python classes at this point
```

### Testing After Phase 3:
- ✅ No errors when importing serializers in Django shell:
  ```python
  from reviews.serializers import ReviewSerializer
  ```
- ✅ Existing functionality untouched

---

## Phase 4: API Views (CAREFUL - New Endpoints Only)

### Files to CREATE:
7. **`backend/reviews/views.py`** (NEW)
   - `ReviewListCreateView` - List reviews for a cleaner/client, create new review
   - `ReviewDetailView` - View/edit/delete single review
   - `ReviewResponseView` - Add response to a review
   - `ReviewFlagView` - Flag inappropriate reviews
   - `ReviewStatsView` - Get cleaner/client average ratings

8. **`backend/reviews/permissions.py`** (NEW)
   - `IsReviewer` - Only the reviewer can edit/delete
   - `IsReviewee` - Only the reviewee can respond
   - `CanReview` - Only if job is completed, not already reviewed, within 30 days

### Files to CREATE:
9. **`backend/reviews/urls.py`** (NEW)
   - Define review API routes
   - **NO CHANGES TO EXISTING URL FILES YET**

### Safety Checks:
```bash
python manage.py check
# Views are created but NOT connected to main URL config yet
# Existing API endpoints unchanged
```

### Testing After Phase 4:
- ✅ Import views in Django shell without errors
- ✅ Existing API endpoints work: `/api/jobs/`, `/api/payments/`, etc.
- ✅ New review endpoints NOT accessible yet (that's intentional)

---

## Phase 5: URL Integration (CAREFUL - Connecting New Routes)

### Files to MODIFY:
10. **`backend/e_clean_backend/urls.py`** (MAIN URL CONFIG)
    - **Change:** Add `path('api/reviews/', include('reviews.urls'))` to `urlpatterns`
    - **Location:** After existing API paths (around line 30)
    - **Risk:** LOW - Using `include()` keeps routes isolated
    - **Verification:** Test ALL existing endpoints still work

### Safety Checks:
```bash
python manage.py check
# Test existing endpoints:
curl http://localhost:8000/api/jobs/
curl http://localhost:8000/api/payments/
# Test new endpoints:
curl http://localhost:8000/api/reviews/  # Should work now
```

### Testing After Phase 5:
- ✅ ALL existing endpoints still work
- ✅ New review endpoints accessible (but return empty lists)
- ✅ Frontend still loads and functions normally

---

## Phase 6: Backend Business Logic (CAREFUL - Job Model Integration)

### Files to MODIFY:
11. **`backend/jobs/models.py`** (CleaningJob model)
    - **Change:** Add method `can_be_reviewed_by(user)` (NEW METHOD - doesn't change existing behavior)
    - **Location:** Add to CleaningJob class (around line 50)
    - **Risk:** LOW - Just adding a helper method
    
    ```python
    def can_be_reviewed_by(self, user):
        """Check if user can leave a review for this job"""
        from django.utils import timezone
        from datetime import timedelta
        
        if self.status != 'completed':
            return False
        
        if not self.completion_date:
            return False
            
        # Must review within 30 days
        if timezone.now() > self.completion_date + timedelta(days=30):
            return False
            
        # Client reviews cleaner
        if user == self.client:
            from reviews.models import Review
            return not Review.objects.filter(job=self, reviewer=user).exists()
            
        # Cleaner reviews client  
        if user == self.cleaner:
            from reviews.models import Review
            return not Review.objects.filter(job=self, reviewer=user).exists()
            
        return False
    ```

### Files to MODIFY:
12. **`backend/reviews/views.py`** (UPDATE - Add business logic)
    - **Change:** Add validation in `ReviewListCreateView.perform_create()`
    - **Risk:** MEDIUM - Affects new functionality only
    - Add checks:
      - Job must be completed
      - Within 30-day window
      - No duplicate reviews
      - Reviewer must be participant

### Safety Checks:
```bash
python manage.py check
# Test job listing still works
curl http://localhost:8000/api/jobs/
# Test creating a review (should validate properly)
```

### Testing After Phase 6:
- ✅ Existing job endpoints work
- ✅ Can list jobs as before
- ✅ Review validation prevents invalid reviews
- ✅ Cannot review incomplete jobs
- ✅ Cannot review twice

---

## Phase 7: Frontend Components (SAFE - New Components Only)

### Files to CREATE:
13. **`frontend/src/components/ReviewCard.jsx`** (NEW)
    - Display single review with ratings
    - Show reviewer name, date, comment
    - Show response if exists

14. **`frontend/src/components/ReviewForm.jsx`** (NEW)
    - x/10 rating slider
    - Sub-rating inputs (Quality, Communication, Professionalism, Timeliness)
    - Comment textarea
    - Submit button

15. **`frontend/src/components/ReviewList.jsx`** (NEW)
    - Display list of reviews
    - Pagination
    - Filter by rating

16. **`frontend/src/components/ReviewStats.jsx`** (NEW)
    - Show average rating (x/10)
    - Show sub-rating averages
    - Show total review count

### Safety Checks:
```bash
# Components created but not used yet
npm run build  # Should compile without errors
```

### Testing After Phase 7:
- ✅ Frontend compiles successfully
- ✅ No import errors
- ✅ Existing pages still work

---

## Phase 8: Frontend Page Integration (CAREFUL - Modifying Existing Pages)

### Files to MODIFY:
17. **`frontend/src/pages/JobDetails.jsx`** (JOB DETAIL PAGE)
    - **Change:** Add `<ReviewForm />` at bottom (only if job completed)
    - **Location:** After job details, before related jobs section
    - **Risk:** LOW - Conditional rendering won't break existing UI
    
    ```jsx
    {job.status === 'completed' && !job.user_has_reviewed && (
      <div className="mt-6">
        <h3>Leave a Review</h3>
        <ReviewForm jobId={job.id} onSubmit={handleReviewSubmit} />
      </div>
    )}
    ```

18. **`frontend/src/pages/CleanerProfile.jsx`** (CLEANER PROFILE PAGE)
    - **Change:** Add `<ReviewStats />` and `<ReviewList />` components
    - **Location:** After cleaner bio, before availability section
    - **Risk:** LOW - Just adding new sections
    
    ```jsx
    <div className="mt-6">
      <ReviewStats cleanerId={cleaner.id} />
      <ReviewList cleanerId={cleaner.id} />
    </div>
    ```

### Files to MODIFY:
19. **`frontend/src/pages/ClientDashboard.jsx`** (CLIENT DASHBOARD)
    - **Change:** Add "Review Pending" indicator to completed jobs
    - **Location:** In job list item rendering
    - **Risk:** LOW - Just visual indicator
    
    ```jsx
    {job.status === 'completed' && !job.user_has_reviewed && (
      <button onClick={() => handleReview(job.id)}>
        Leave Review
      </button>
    )}
    ```

### Safety Checks:
```bash
npm run build
# Visit each modified page in browser
# Verify existing functionality works
# Verify new components render without breaking layout
```

### Testing After Phase 8:
- ✅ Job details page shows review form for completed jobs
- ✅ Cleaner profile shows reviews and ratings
- ✅ Client dashboard shows review prompts
- ✅ All existing dashboard functionality works
- ✅ No layout breaks or CSS conflicts

---

## Phase 9: API Integration & Data Flow (CAREFUL - Real Data Operations)

### Files to MODIFY:
20. **`frontend/src/pages/JobDetails.jsx`** (ADD API CALLS)
    - **Change:** Add `handleReviewSubmit()` function
    - **Risk:** MEDIUM - Creates real database records
    
    ```jsx
    const handleReviewSubmit = async (reviewData) => {
      try {
        const response = await fetch(`/api/reviews/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            job: jobId,
            ...reviewData
          })
        });
        
        if (response.ok) {
          toast.success('Review submitted successfully!');
          // Refresh job data to hide review form
          fetchJobDetails();
        }
      } catch (error) {
        console.error('Review submission error:', error);
        toast.error('Failed to submit review');
      }
    };
    ```

21. **`frontend/src/components/ReviewList.jsx`** (ADD API CALLS)
    - **Change:** Add `useEffect()` to fetch reviews
    - **Risk:** LOW - Read-only operation

### Safety Checks:
```bash
# Test with real data:
# 1. Complete a test job
# 2. Submit a review
# 3. Verify review appears on cleaner profile
# 4. Verify cannot submit duplicate review
# 5. Verify existing job/payment data unaffected
```

### Testing After Phase 9:
- ✅ Can submit reviews for completed jobs
- ✅ Reviews display on cleaner profiles
- ✅ Cannot submit duplicate reviews
- ✅ Validation messages show correctly
- ✅ All existing functionality works (jobs, payments, auth)

---

## Phase 10: Response & Moderation Features (SAFE - Optional Features)

### Files to MODIFY:
22. **`frontend/src/components/ReviewCard.jsx`** (ADD RESPONSE UI)
    - **Change:** Add "Respond" button for reviewees
    - **Risk:** LOW - Only shows to review target
    
    ```jsx
    {canRespond && !review.response && (
      <button onClick={() => setShowResponseForm(true)}>
        Respond to Review
      </button>
    )}
    
    {showResponseForm && (
      <ResponseForm 
        reviewId={review.id}
        onSubmit={handleResponseSubmit}
      />
    )}
    ```

23. **`frontend/src/components/ReviewCard.jsx`** (ADD FLAG UI)
    - **Change:** Add "Report" button for all users
    - **Risk:** LOW - Just a flag, doesn't delete content

### Files to CREATE:
24. **`frontend/src/pages/AdminReviews.jsx`** (NEW - ADMIN ONLY)
    - Admin moderation dashboard
    - View flagged reviews
    - Approve/reject/delete reviews

### Files to MODIFY:
25. **`frontend/src/App.jsx`** (ADD ADMIN ROUTE)
    - **Change:** Add route for admin reviews page
    - **Location:** With other admin routes
    - **Risk:** LOW - Admin-only access

### Safety Checks:
```bash
# Test response submission
# Test flagging a review
# Test admin moderation panel
# Verify only admins can access moderation
```

### Testing After Phase 10:
- ✅ Reviewees can respond to reviews
- ✅ Users can flag inappropriate reviews
- ✅ Admins can moderate flagged content
- ✅ All role-based permissions work correctly

---

## Phase 11: Performance Optimization (SAFE - Query Improvements)

### Files to MODIFY:
26. **`backend/reviews/views.py`** (OPTIMIZE QUERIES)
    - **Change:** Add `select_related()` and `prefetch_related()`
    - **Risk:** LOW - Performance optimization only
    
    ```python
    queryset = Review.objects.select_related(
        'reviewer', 'reviewee', 'job'
    ).prefetch_related(
        'ratings', 'response', 'flags'
    )
    ```

27. **`backend/reviews/models.py`** (ADD INDEXES)
    - **Change:** Add database indexes for common queries
    - **Risk:** LOW - Just improves performance
    
    ```python
    class Meta:
        indexes = [
            models.Index(fields=['reviewee', '-created_at']),
            models.Index(fields=['job']),
            models.Index(fields=['is_visible', '-created_at']),
        ]
    ```

### Files to CREATE:
28. **`backend/reviews/migrations/0002_add_indexes.py`** (AUTO-GENERATED)
    - Run `python manage.py makemigrations reviews`

### Safety Checks:
```bash
python manage.py makemigrations reviews
python manage.py migrate --plan
python manage.py migrate reviews
# Test that queries still return correct results
# Use Django Debug Toolbar to verify query count reduced
```

### Testing After Phase 11:
- ✅ Review lists load faster
- ✅ Fewer database queries
- ✅ All data still displays correctly

---

## Phase 12: Final Integration & Testing (VERIFICATION)

### Final Checklist:

**Existing Functionality (MUST ALL WORK):**
- ✅ User registration/login
- ✅ Client can post jobs
- ✅ Cleaner can browse/bid on jobs
- ✅ Job lifecycle (pending → accepted → in_progress → completed)
- ✅ Payment processing (client pays)
- ✅ Payout requests (cleaner withdraws)
- ✅ Admin dashboard (all panels)
- ✅ Chat system
- ✅ Notifications

**New Review Functionality (MUST ALL WORK):**
- ✅ Client can review cleaner after job completion
- ✅ Cleaner can review client after job completion
- ✅ x/10 rating system with 4 sub-ratings
- ✅ Cannot review same job twice
- ✅ Cannot review before job completion
- ✅ 30-day review window enforced
- ✅ Reviewee can respond to review
- ✅ Reviews display on cleaner profile
- ✅ Average ratings calculated correctly
- ✅ Users can flag inappropriate reviews
- ✅ Admins can moderate flagged reviews

**Edge Cases to Test:**
- ✅ Attempt to review incomplete job (should fail)
- ✅ Attempt to review after 30 days (should fail)
- ✅ Attempt to review same job twice (should fail)
- ✅ Submit review with missing fields (should fail with validation)
- ✅ Submit rating outside 1-10 range (should fail)
- ✅ Non-participant tries to review job (should fail)

### Performance Testing:
```bash
# Load test with multiple reviews
# Verify cleaner profile loads quickly with 100+ reviews
# Check database query count
```

---

## Important Design Adjustment Needed

**⚠️ RATING SCALE CHANGE REQUIRED:**

The current design document (`REVIEW_RATING_SYSTEM_DESIGN.md`) uses a **5-star rating system (1-5)**.

User requested: **"x out of 10 Rating System"**

### Changes Needed Before Implementation:

**In Models (`backend/reviews/models.py`):**
```python
# CHANGE THIS:
overall_rating = models.IntegerField(
    validators=[MinValueValidator(1), MaxValueValidator(5)]
)

# TO THIS:
overall_rating = models.IntegerField(
    validators=[MinValueValidator(1), MaxValueValidator(10)]
)
```

**In ReviewRating Model:**
```python
# CHANGE THIS:
rating = models.IntegerField(
    validators=[MinValueValidator(1), MaxValueValidator(5)]
)

# TO THIS:
rating = models.IntegerField(
    validators=[MinValueValidator(1), MaxValueValidator(10)]
)
```

**In Frontend (`ReviewForm.jsx`):**
```jsx
// CHANGE FROM: 5 star selector
// TO: Slider input (1-10)

<div className="rating-input">
  <label>Overall Rating: {rating}/10</label>
  <input 
    type="range" 
    min="1" 
    max="10" 
    value={rating}
    onChange={(e) => setRating(e.target.value)}
  />
</div>
```

---

## Files Summary

**NEW FILES TO CREATE (25 files):**
1. `backend/reviews/__init__.py`
2. `backend/reviews/models.py`
3. `backend/reviews/admin.py`
4. `backend/reviews/serializers.py`
5. `backend/reviews/views.py`
6. `backend/reviews/permissions.py`
7. `backend/reviews/urls.py`
8. `backend/reviews/migrations/0001_initial.py` (auto-generated)
9. `backend/reviews/migrations/0002_add_indexes.py` (auto-generated)
10. `frontend/src/components/ReviewCard.jsx`
11. `frontend/src/components/ReviewForm.jsx`
12. `frontend/src/components/ReviewList.jsx`
13. `frontend/src/components/ReviewStats.jsx`
14. `frontend/src/components/ResponseForm.jsx`
15. `frontend/src/pages/AdminReviews.jsx`

**EXISTING FILES TO MODIFY (10 files):**
16. `backend/e_clean_backend/settings.py` (add 'reviews' to INSTALLED_APPS)
17. `backend/e_clean_backend/urls.py` (add reviews URL path)
18. `backend/jobs/models.py` (add can_be_reviewed_by() method)
19. `frontend/src/pages/JobDetails.jsx` (add ReviewForm component)
20. `frontend/src/pages/CleanerProfile.jsx` (add ReviewStats and ReviewList)
21. `frontend/src/pages/ClientDashboard.jsx` (add review prompts)
22. `frontend/src/App.jsx` (add admin reviews route)

**TOTAL: 15 new files + 10 modifications = 25 file operations**

---

## Safety Principles

### ✅ DO:
- Create new files (apps, models, views) - ZERO risk to existing code
- Add new methods to existing models - doesn't change existing behavior
- Use conditional rendering in frontend - only shows when appropriate
- Test after EVERY phase - catch issues early
- Use Django migrations properly - review before applying
- Add URL patterns with `include()` - keeps routes isolated
- Use serializers to validate input - prevents bad data

### ❌ DON'T:
- Modify existing API endpoints (jobs, payments, auth)
- Change existing database columns
- Remove or rename existing model fields
- Modify core business logic (job status transitions)
- Change existing permission classes
- Alter existing serializers (create new ones for reviews)
- Touch the payment processing logic
- Modify authentication system

---

## Rollback Plan (If Something Breaks)

### If Database Issue:
```bash
# Roll back last migration
python manage.py migrate reviews 0001_initial  # or `zero` to remove entirely

# Remove app from settings
# Edit backend/e_clean_backend/settings.py
# Remove 'reviews' from INSTALLED_APPS

# Delete reviews app folder
rm -rf backend/reviews/
```

### If API Issue:
```python
# Comment out reviews URL in backend/e_clean_backend/urls.py
# path('api/reviews/', include('reviews.urls')),  # COMMENTED OUT
```

### If Frontend Issue:
```bash
# Remove reviews components from pages
# Revert changes to JobDetails.jsx, CleanerProfile.jsx, etc.
git checkout frontend/src/pages/JobDetails.jsx
```

---

## Estimated Timeline

- **Phase 1-2 (Models & Admin):** 1 hour
- **Phase 3-5 (Serializers & API):** 2 hours  
- **Phase 6 (Business Logic):** 1 hour
- **Phase 7-8 (Frontend Components):** 3 hours
- **Phase 9 (API Integration):** 2 hours
- **Phase 10 (Response/Moderation):** 2 hours
- **Phase 11 (Optimization):** 1 hour
- **Phase 12 (Testing):** 2 hours

**TOTAL: ~14 hours of development + testing**

---

## Success Criteria

✅ **All existing functionality works exactly as before**
✅ **Users can leave reviews for completed jobs**
✅ **Reviews display correctly on cleaner profiles**
✅ **x/10 rating system implemented with sub-ratings**
✅ **Bidirectional reviews work (client ↔ cleaner)**
✅ **Reviewees can respond to reviews**
✅ **Moderation tools work for admins**
✅ **No duplicate reviews possible**
✅ **30-day review window enforced**
✅ **Performance remains good (page load < 2 seconds)**

---

## Notes

- This implementation is **additive** - we're adding a new feature, not changing existing ones
- The review system is **isolated** - if it breaks, we can disable it without affecting jobs/payments
- All changes are **reversible** - we can roll back migrations and remove components
- Testing is **incremental** - we verify after each phase that nothing broke
- The approach is **conservative** - we favor safety over speed

**Ready to begin implementation once this TODO is reviewed and approved!** 🚀
