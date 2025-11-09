# Review System Testing Guide

**Date:** November 2, 2025  
**Status:** Ready for Testing 🧪

---

## 🎯 Quick Start

### Prerequisites
- ✅ Backend server running: `python manage.py runserver`
- ✅ Frontend server running: `npm start`
- ✅ Test data created: 10 completed jobs across multiple users

---

## 📊 Test Data Summary

### Available Test Accounts

#### **Clients (with completed jobs):**
| Username | Email | Completed Jobs |
|----------|-------|----------------|
| `vaskoclient` | vaskoclient@mail.com | 3 jobs |
| `client.kolonaki` | client.kolonaki@test.gr | 2 jobs |
| `client.syntagma` | client.syntagma@test.gr | 3 jobs |
| `client.glyfada` | client.glyfada@test.gr | 1 job |
| `client.kifisia` | client.kifisia@test.gr | 2 jobs |

#### **Cleaners (with completed jobs):**
| Username | Email | Completed Jobs |
|----------|-------|----------------|
| `vaskoclean` | vaskoclean@mail.com | 4 jobs |
| `cleaner.central` | cleaner.central@test.gr | 2 jobs |
| `cleaner.south` | cleaner.south@test.gr | 1 job |
| `cleaner.piraeus` | cleaner.piraeus@test.gr | 2 jobs |
| `cleaner.far.north` | cleaner.far.north@test.gr | 1 job |
| `cleaner.far.south` | cleaner.far.south@test.gr | 1 job |

**Default Password for All:** `Test1234!`

### Completed Test Jobs
| Job ID | Client → Cleaner | Price | Completion Date |
|--------|------------------|-------|-----------------|
| 7 | client.glyfada → cleaner.central | $114.32 | Nov 1 (1 day ago) |
| 8 | vaskoclient → cleaner.piraeus | $166.80 | Oct 29 (4 days ago) |
| 15 | client.kolonaki → cleaner.central | $78.11 | Oct 29 (4 days ago) |
| 11 | client.syntagma → vaskoclean | $54.78 | Oct 27 (6 days ago) |
| 10 | vaskoclient → cleaner.far.south | $41.96 | Oct 27 (6 days ago) |
| 16 | client.syntagma → cleaner.south | $178.17 | Oct 25 (8 days ago) |
| 12 | client.syntagma → vaskoclean | $195.79 | Oct 24 (9 days ago) |
| 14 | client.kifisia → vaskoclean | $127.34 | Oct 24 (9 days ago) |
| 13 | client.kifisia → cleaner.far.north | $78.75 | Oct 23 (10 days ago) |
| 9 | client.kolonaki → cleaner.piraeus | $55.18 | Oct 23 (10 days ago) |

---

## 🧪 Test Scenarios

### Test 1: Client Submits Review for Cleaner ✅

**Objective:** Verify client can submit review with ratings and comment

**Steps:**
1. **Log in as client:**
   - URL: `http://localhost:3000/login`
   - Username: `vaskoclient`
   - Password: `Test1234!`

2. **Navigate to Completed Jobs:**
   - Click "Completed Jobs" in navigation
   - Or go to: `http://localhost:3000/completed-jobs`

3. **Select a completed job:**
   - Click on Job #8 (vaskoclient → cleaner.piraeus)
   - Job details should appear

4. **Check review eligibility:**
   - Look for "Leave a Review" button
   - Should be visible if job is eligible (completed, within 30 days, not already reviewed)

5. **Submit review:**
   - Click "Leave a Review" button
   - Review form should expand below
   - Set overall rating (e.g., 9/10) using slider
   - Set sub-ratings:
     * Quality: 9/10
     * Communication: 8/10
     * Professionalism: 10/10
     * Timeliness: 9/10
   - Write comment (min 10 characters): "Excellent service! Very thorough and professional."
   - Click "Submit Review"

6. **Verify review appears:**
   - Form should close
   - Review should appear in "Reviews for [cleaner name]" section below
   - ReviewStats card should update with new average
   - Review should show your name, rating, sub-ratings, comment, timestamp

**Expected Results:**
- ✅ Review form validates input (requires all fields, min 10 chars comment)
- ✅ Review submits successfully
- ✅ Toast notification shows "Review submitted successfully"
- ✅ Review appears in list immediately
- ✅ Stats update with new averages
- ✅ "Leave a Review" button disappears (already reviewed)

---

### Test 2: Cleaner Responds to Review ✅

**Objective:** Verify cleaner can respond to client's review

**Steps:**
1. **Log out and log in as cleaner:**
   - URL: `http://localhost:3000/login`
   - Username: `cleaner.piraeus`
   - Password: `Test1234!`

2. **Navigate to Completed Jobs:**
   - Click "Completed Jobs"
   - Click on Job #8 (same job as Test 1)

3. **View client's review:**
   - Scroll down to "Reviews for [your name]" section
   - Should see the review you submitted in Test 1

4. **Respond to review:**
   - Click "Respond" button below the review
   - Response form should appear
   - Type response (min 10 chars): "Thank you so much! It was a pleasure working with you!"
   - Click "Submit Response"

5. **Verify response appears:**
   - Response form should close
   - Response should appear below the review
   - Should show "Response from [cleaner name]" with timestamp

**Expected Results:**
- ✅ Only reviewee (cleaner) sees "Respond" button
- ✅ Response validates min 10 characters
- ✅ Response submits successfully
- ✅ Response appears below review immediately
- ✅ "Respond" button disappears (already responded)

---

### Test 3: Bidirectional Reviews (Cleaner Reviews Client) ✅

**Objective:** Verify cleaners can review clients (bidirectional)

**Steps:**
1. **Logged in as cleaner (from Test 2):**
   - Still on Job #8 details page

2. **Review the client:**
   - Look for "Leave a Review" button
   - Should be visible if cleaner hasn't reviewed this job yet
   - Click "Leave a Review"

3. **Submit review for client:**
   - Set overall rating: 10/10
   - Set sub-ratings (all 10/10)
   - Write comment: "Wonderful client! Clear instructions, on-time payment, very respectful."
   - Click "Submit Review"

4. **Verify cleaner's review appears:**
   - Review should appear in "Reviews for [client name]" section
   - Should be separate from client's review of cleaner

**Expected Results:**
- ✅ Cleaners can review clients
- ✅ Both reviews coexist (bidirectional)
- ✅ Each user sees reviews they've written and received
- ✅ ReviewStats shows separate stats for client and cleaner

---

### Test 4: Flag Inappropriate Review 🚩

**Objective:** Verify users can flag inappropriate reviews

**Steps:**
1. **Log in as different user:**
   - Username: `client.kolonaki`
   - Password: `Test1234!`

2. **Navigate to completed job:**
   - Go to Completed Jobs
   - Select Job #9 (client.kolonaki → cleaner.piraeus)

3. **View cleaner's reviews:**
   - Scroll to ReviewList section
   - Should see reviews other clients left for this cleaner

4. **Flag a review:**
   - Click "Report" button on any review (not your own)
   - System prompts for reason (1-5):
     1. Inappropriate language
     2. Harassment
     3. Spam
     4. False information
     5. Other
   - Choose a reason (e.g., 5 for "Other")
   - Optionally provide details

5. **Verify flag submitted:**
   - Toast notification confirms flag submission
   - Review stays visible (awaiting admin moderation)

**Expected Results:**
- ✅ Cannot flag own reviews
- ✅ Can only flag once per review
- ✅ Flag submission works
- ✅ Admin receives flag for moderation

---

### Test 5: Review Validation Rules ⚠️

**Objective:** Verify business rules are enforced

#### 5.1 No Duplicate Reviews
**Steps:**
1. Log in as client who already reviewed a job (from Test 1)
2. Navigate to same job
3. Look for "Leave a Review" button
4. **Expected:** Button should NOT appear, message says "You have already reviewed this job"

#### 5.2 30-Day Window Enforcement
**Steps:**
1. Create a job completed >30 days ago using management command:
   ```bash
   python manage.py create_test_completed_jobs --count 1 --days-ago 31
   ```
2. Log in as client from that job
3. Navigate to job details
4. **Expected:** "Leave a Review" button should NOT appear, message says "Review window (30 days) has expired"

#### 5.3 Incomplete Jobs Cannot Be Reviewed
**Steps:**
1. Navigate to a job with status != 'completed'
2. **Expected:** Review UI should not appear at all

#### 5.4 Rating Range Validation
**Steps:**
1. Try to submit review with rating < 1 or > 10
2. **Expected:** Frontend prevents submission (sliders constrained)
3. Try API directly with invalid rating
4. **Expected:** API returns 400 Bad Request with validation error

#### 5.5 Comment Minimum Length
**Steps:**
1. Try to submit review with comment < 10 characters
2. **Expected:** Frontend shows validation error
3. Cannot submit until min length met

**Expected Results:**
- ✅ All validation rules enforced server-side
- ✅ Frontend provides helpful validation messages
- ✅ No way to bypass business rules

---

### Test 6: Review Statistics Accuracy 📊

**Objective:** Verify aggregate statistics calculate correctly

**Steps:**
1. **Submit multiple reviews for same user:**
   - Log in as different clients
   - Each review the same cleaner (e.g., vaskoclean)
   - Submit varying ratings (e.g., 7, 8, 9, 10)

2. **Check ReviewStats card:**
   - Navigate to any job with that cleaner
   - ReviewStats should show:
     * Overall average (e.g., 8.5/10)
     * Total review count (e.g., "4 reviews")
     * Sub-rating averages (Quality, Communication, etc.)
     * Color coding (green for 8+, orange for 6-7, red for <6)

3. **Verify calculations:**
   - Overall average = (7+8+9+10)/4 = 8.5 ✅
   - Each sub-rating averaged correctly
   - Review count accurate

**Expected Results:**
- ✅ Statistics update in real-time
- ✅ Calculations are accurate
- ✅ Color coding reflects rating ranges
- ✅ Rating labels correct (Excellent, Great, Good, Fair, Needs Improvement)

---

### Test 7: Review Filtering 🔍

**Objective:** Verify review list filtering works

**Steps:**
1. **Navigate to user with multiple reviews:**
   - Log in and go to a job with cleaner who has multiple reviews

2. **Use filter buttons:**
   - Click "All" → Should show all reviews
   - Click "8+" → Should only show reviews with overall_rating >= 8
   - Click "6-7" → Should only show reviews with 6 <= overall_rating <= 7
   - Click "<6" → Should only show reviews with overall_rating < 6

3. **Verify filter counts:**
   - Each filter button should show count in parentheses
   - Counts should match number of reviews in each range

**Expected Results:**
- ✅ Filters work correctly
- ✅ Counts are accurate
- ✅ UI updates smoothly
- ✅ No reviews lost/duplicated

---

### Test 8: UI/UX Validation 🎨

**Objective:** Verify UI is clean, responsive, and user-friendly

**Checklist:**
- [ ] ReviewStats card has purple gradient background
- [ ] Overall rating circle color-coded (green/orange/red)
- [ ] Rating labels accurate (Excellent, Great, Good, Fair, Needs Improvement)
- [ ] Sub-rating bars show percentage fill
- [ ] Review form sliders are smooth and responsive
- [ ] Character counter updates in real-time
- [ ] Review cards have hover effects
- [ ] Reviewer avatars show first letter in circle
- [ ] Response section visually distinct from review
- [ ] Empty states show friendly messages
- [ ] Loading states show while fetching
- [ ] Mobile responsive (test on <768px width)
- [ ] No layout shifts or chaos in CompletedJobsDashboard
- [ ] Review UI is non-intrusive (collapsible form)

**Expected Results:**
- ✅ UI matches design specifications
- ✅ No visual bugs or overlaps
- ✅ Smooth animations and transitions
- ✅ Professional, clean appearance

---

## 🐛 Known Issues to Test

### Issues to Verify are Fixed:
1. ✅ Decimal arithmetic error in test data generation → FIXED
2. ✅ CompletedJobsDashboard integration without breaking layout → VERIFIED

### Potential Edge Cases:
- [ ] Multiple users reviewing same cleaner simultaneously
- [ ] Very long comments (>1000 characters)
- [ ] Special characters in comments (emojis, etc.)
- [ ] User deletes review (soft delete)
- [ ] Admin moderates flagged review

---

## 📈 Performance Testing

### Query Optimization
**Objective:** Verify database queries are optimized

**Steps:**
1. Enable Django Debug Toolbar (if not already)
2. Navigate to CompletedJobsDashboard
3. Select a job with reviews
4. Check query count in Debug Toolbar

**Expected:**
- ✅ Review list uses `select_related('reviewer', 'reviewee', 'job')`
- ✅ Ratings use `prefetch_related('ratings')`
- ✅ No N+1 query problems
- ✅ Total queries < 20 for page load

### Load Testing
**Steps:**
1. Create 100+ completed jobs:
   ```bash
   python manage.py create_test_completed_jobs --count 100
   ```
2. Navigate to user with many reviews
3. Test page load time
4. Test filter performance

**Expected:**
- ✅ Page loads in <2 seconds
- ✅ Filters respond instantly
- ✅ No browser freezing

---

## 🔧 Admin Testing

### Admin Moderation
**Objective:** Verify admin can moderate flagged reviews

**Steps:**
1. **Log in to Django admin:**
   - URL: `http://localhost:8000/admin/`
   - Use superuser credentials

2. **View flagged reviews:**
   - Navigate to "Review flags"
   - Should see list of all flags

3. **Moderate a flag:**
   - Click on a flag
   - Change status to "reviewed" or "action_taken"
   - Add admin notes
   - Save

4. **Hide inappropriate review:**
   - Navigate to "Reviews"
   - Find the flagged review
   - Uncheck "Is visible" checkbox
   - Save

5. **Verify review is hidden:**
   - Log out of admin
   - Navigate to job with hidden review
   - Review should NOT appear in list

**Expected Results:**
- ✅ Admin can view all flags
- ✅ Admin can moderate flags
- ✅ Admin can hide reviews
- ✅ Hidden reviews don't appear in frontend

---

## 🎉 Success Criteria

### Must Pass:
- [x] All 8 test scenarios complete without errors
- [ ] No console errors in browser
- [ ] No Python exceptions in backend logs
- [ ] All validation rules enforce correctly
- [ ] Statistics calculate accurately
- [ ] Bidirectional reviews work
- [ ] Response functionality works
- [ ] Flag functionality works
- [ ] UI is clean and non-intrusive
- [ ] Mobile responsive

### Nice to Have:
- [ ] Performance under load acceptable
- [ ] Admin moderation workflow smooth
- [ ] Edge cases handled gracefully

---

## 📝 Bug Reporting Template

If you find issues during testing, please document:

```
**Bug Title:** [Short description]
**Severity:** Critical / High / Medium / Low
**Test Scenario:** [Which test scenario]
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Logs:**
[Attach any relevant screenshots or error logs]

**Environment:**
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14]
- User Role: [Client/Cleaner/Admin]
```

---

## 🚀 Next Steps After Testing

1. **If all tests pass:**
   - Mark Phase 9 complete in TODO
   - Move to Phase 11 (Performance Testing)
   - Move to Phase 12 (Integration Testing)
   - Commit to Git with full documentation

2. **If issues found:**
   - Document bugs using template above
   - Prioritize by severity
   - Fix critical/high issues first
   - Re-test after fixes

3. **Final checklist before Git commit:**
   - [ ] All tests pass
   - [ ] No console errors
   - [ ] No Python exceptions
   - [ ] Documentation complete
   - [ ] Code reviewed
   - [ ] Ready for production

---

**Testing by:** [Your name]  
**Date:** November 2, 2025  
**Status:** 🧪 IN PROGRESS
