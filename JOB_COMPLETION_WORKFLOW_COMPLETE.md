# Job Completion Accept/Reject Workflow Implementation

## Overview
Implemented a complete workflow allowing clients to accept OR reject completed work when jobs are in 'awaiting_review' status. This separates job completion verification from the optional review process.

**Date**: December 2024  
**Status**: ✅ Complete (pending testing)

---

## Problem Statement

### Original Issue
Clients couldn't review jobs in 'awaiting_review' status, and review submission was incorrectly conflated with job completion acceptance.

### User Requirements
When a job is awaiting review from the client:
1. Client must see job details clearly
2. Client must see before/after photos for comparison
3. Client must have **TWO buttons**: Accept AND Reject
4. Accept → Job transitions to 'completed', client can optionally review later
5. Reject → Job goes back to cleaner with specific feedback for fixes

---

## Implementation Details

### Backend Changes

#### 1. Models (`backend/job_lifecycle/models.py`)

**JobAction.ACTION_TYPE_CHOICES** - Added rejection action:
```python
ACTION_TYPE_CHOICES = [
    ('confirm_bid', 'Confirm Accepted Bid'),
    ('start_job', 'Start Job'),
    ('finish_job', 'Finish Job'),
    ('accept_completion', 'Accept Job Completion'),
    ('reject_completion', 'Reject Job Completion'),  # NEW
    ('upload_photos', 'Upload Photos'),
    ('add_note', 'Add Note'),
]
```

**JobNotification.NOTIFICATION_TYPE_CHOICES** - Added notification types:
```python
NOTIFICATION_TYPE_CHOICES = [
    ('bid_accepted', 'Your bid was accepted!'),
    ('job_confirmed', 'Job confirmed by cleaner'),
    ('job_ready', 'Job ready to start'),
    ('job_started', 'Job has started'),
    ('job_finished', 'Job completed - please review'),
    ('job_accepted', 'Client accepted your work'),      # NEW
    ('job_rejected', 'Work needs revision'),            # NEW
    ('payment_processed', 'Payment processed'),
    ('review_received', 'Review received'),
]
```

#### 2. Views (`backend/job_lifecycle/views.py`)

**Updated Permissions** - Allow client actions:
```python
if action_type in ['accept_completion', 'reject_completion']:
    # Only client can accept or reject completion
    if request.user.role != 'client' or job.client != request.user:
        raise PermissionDenied("Only the client can accept or reject job completion.")
```

**New Handler: `_reject_completion()`**:
- **Validates**: Job must be in 'awaiting_review' status
- **Requires**: Rejection reason (minimum 10 characters)
- **Transitions**: Job status from 'awaiting_review' → 'in_progress'
- **Records**: JobAction with rejection notes
- **Creates**: JobLifecycleEvent for audit trail
- **Notifies**: Cleaner with rejection details

**Workflow**:
```python
def _reject_completion(self, job, notes):
    """Client rejects the completed work and sends job back to cleaner for fixes"""
    if job.status != 'awaiting_review':
        raise ValidationError("Job must be awaiting review to reject completion.")
    
    if not notes or len(notes.strip()) < 10:
        raise ValidationError("Please provide a detailed reason...")
    
    # Transition back to in_progress
    old_status = job.status
    job.status = 'in_progress'
    job.save()
    
    # Record action, event, and notify cleaner
    # ...
```

**Routing** - Added reject_completion case:
```python
elif action_type == 'reject_completion':
    return self._reject_completion(job, notes)
```

#### 3. Review System (`backend/reviews/models.py`, `views.py`, `serializers.py`)

**Previously Updated**:
- `Review.save()` - Removed auto-transition to 'completed' (reviews are now independent)
- `can_be_reviewed_by()` - Accepts both 'awaiting_review' AND 'completed' statuses
- `JobReviewEligibilityView` - Updated eligibility checks
- `ReviewSerializer.validate_job()` - Accepts both statuses

---

### Frontend Changes

#### 1. API Service (`frontend/src/services/jobLifecycleAPI.js`)

**New Method: `rejectCompletion()`**:
```javascript
rejectCompletion: async (jobId, notes) => {
  return apiCall(
    async () => {
      if (!notes || notes.trim().length < 10) {
        throw new Error('Please provide a detailed reason...');
      }

      const formData = new FormData();
      formData.append('action_type', 'reject_completion');
      formData.append('notes', notes);

      const response = await api.post(`/lifecycle/jobs/${jobId}/workflow/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    {
      loadingKey: `reject_completion_${jobId}`,
      successMessage: 'Work rejected. The cleaner has been notified to make corrections.',
      showSuccess: true
    }
  );
}
```

#### 2. UI Component (`frontend/src/components/CompletedJobsDashboard.jsx`)

**New State Variables**:
```javascript
const [showRejectModal, setShowRejectModal] = useState(false);
const [rejectionReason, setRejectionReason] = useState('');
```

**New Handler: `handleRejectCompletion()`**:
- Validates job status is 'awaiting_review'
- Validates rejection reason (minimum 10 characters)
- Calls `jobWorkflowAPI.rejectCompletion()`
- Closes modal and resets state
- Refreshes job list and selected job

**Updated Verification Section** (lines ~975-1020):
- Changed background from green to blue gradient
- Shows **both** before AND after photo counts
- Two buttons side-by-side:
  - **Accept Work** (green) - Accepts completion
  - **Request Fixes** (red) - Opens rejection modal

**New Rejection Modal**:
- Full-screen overlay with centered modal
- Warning icon and clear title
- Required textarea for rejection reason (min 10 chars)
- Character counter
- Cancel and Submit buttons
- Form validation (Submit disabled until 10+ characters)

---

## Workflow Diagram

```
Cleaner finishes job + uploads after photos
            ↓
Job status: 'awaiting_review'
            ↓
Client views job details in CompletedJobsDashboard
            ↓
Client sees before/after photos
            ↓
┌─────────────────────────────────┐
│   Client Decision Point         │
├─────────────────────────────────┤
│  [Accept Work]  [Request Fixes] │
└─────────────────────────────────┘
         ↓                    ↓
    ACCEPT PATH         REJECT PATH
         ↓                    ↓
Status: 'completed'    Modal opens for reason
         ↓                    ↓
Cleaner notified       Status: 'in_progress'
         ↓                    ↓
Client can review      Cleaner notified
   (optional)          Must fix issues
```

---

## Database Migrations

**Migration Created**: `job_lifecycle/migrations/0002_alter_jobaction_action_type_and_more.py`

**Changes**:
- Added 'reject_completion' to JobAction.action_type choices
- Added 'job_accepted' and 'job_rejected' to JobNotification.notification_type choices

**Applied**: ✅ Migration successfully applied

---

## UI Changes Summary

### Before (Original)
- Only "Accept Completion" button (green)
- Only showed after photo count
- No way to reject completed work

### After (New)
- Two buttons side-by-side: "Accept Work" (green) and "Request Fixes" (red)
- Shows both before AND after photo counts
- Rejection modal with required detailed reason
- Blue gradient background (neutral, not green)

### Rejection Modal Features
- Clear warning icon and title
- Helpful instruction text
- Required textarea with minimum 10 characters
- Real-time character counter
- Disabled submit until validation passes
- Cancel option to close without action

---

## File Changes

### Backend Files Modified (5)
1. `backend/job_lifecycle/models.py` - Added action and notification types
2. `backend/job_lifecycle/views.py` - Added `_reject_completion()` handler and routing
3. `backend/reviews/models.py` - Removed auto-transition (previous session)
4. `backend/cleaning_jobs/models.py` - Updated review eligibility (previous session)
5. `backend/reviews/views.py` - Updated eligibility checks (previous session)

### Frontend Files Modified (2)
1. `frontend/src/services/jobLifecycleAPI.js` - Added `rejectCompletion()` method
2. `frontend/src/components/CompletedJobsDashboard.jsx` - Added reject button, modal, and handler

### New Migrations (1)
1. `backend/job_lifecycle/migrations/0002_alter_jobaction_action_type_and_more.py`

---

## Testing Checklist

### Accept Path
- [ ] Cleaner finishes job → status = 'awaiting_review'
- [ ] Client sees job in CompletedJobsDashboard with 'awaiting_review' status
- [ ] Before/after photos are displayed clearly
- [ ] Client clicks "Accept Work" button
- [ ] Job transitions to 'completed' status
- [ ] Cleaner receives notification: "Client accepted your work"
- [ ] Client can optionally submit review after accepting
- [ ] Job appears in completed list with 'completed' status

### Reject Path
- [ ] Client clicks "Request Fixes" button
- [ ] Modal opens with rejection form
- [ ] Submit button is disabled until 10+ characters entered
- [ ] Character counter updates in real-time
- [ ] Cancel button closes modal without action
- [ ] Client enters rejection reason and clicks "Send to Cleaner"
- [ ] Job transitions back to 'in_progress' status
- [ ] Cleaner receives notification: "Work needs revision" with rejection reason
- [ ] JobAction record created with rejection notes
- [ ] JobLifecycleEvent created for audit trail
- [ ] Modal closes and job list refreshes

### Edge Cases
- [ ] Cannot accept if job not in 'awaiting_review'
- [ ] Cannot reject if job not in 'awaiting_review'
- [ ] Cannot reject without 10+ character reason
- [ ] Only client (job owner) can accept/reject
- [ ] Cleaner cannot accept/reject (permission denied)
- [ ] After photos must exist before client can accept
- [ ] Validation messages are user-friendly

---

## API Endpoints

### Accept Completion
```http
POST /lifecycle/jobs/{job_id}/workflow/
Content-Type: multipart/form-data

action_type=accept_completion
notes=(optional acceptance notes)
```

**Response**:
```json
{
  "message": "Job completion accepted successfully",
  "job_status": "completed",
  "after_photos_count": 3
}
```

### Reject Completion
```http
POST /lifecycle/jobs/{job_id}/workflow/
Content-Type: multipart/form-data

action_type=reject_completion
notes=(required rejection reason, min 10 chars)
```

**Response**:
```json
{
  "message": "Job completion rejected. The cleaner has been notified to make corrections.",
  "job_status": "in_progress",
  "rejection_reason": "(user's rejection reason)"
}
```

---

## Notifications

### Client Accepts Work
**Recipient**: Cleaner  
**Type**: `job_accepted`  
**Title**: "Job Accepted by Client"  
**Message**: "Great work! The client has accepted the completion of this job."  
**Action URL**: `/cleaner/jobs/{job_id}`

### Client Rejects Work
**Recipient**: Cleaner  
**Type**: `job_rejected`  
**Title**: "Work Needs Revision"  
**Message**: "The client has requested additional work on this job. Reason: {rejection_reason}"  
**Action URL**: `/cleaner/jobs/{job_id}`

---

## Next Steps

1. **Testing**: Run complete end-to-end tests for both accept and reject paths
2. **Documentation**: Update user guides for clients and cleaners
3. **Analytics**: Add tracking for rejection rates and reasons
4. **Improvements**: Consider:
   - Rejection reason templates/categories
   - Before/after side-by-side photo comparison view
   - History of rejections for repeat issues
   - Dispute escalation if multiple rejections

---

## Related Documentation

- `PAYMENT_FLOW_EXPLANATION.md` - Payment happens at bid acceptance, not completion
- `CHAT_SYSTEM_COMPLETE.md` - Chat room creation tied to job workflow
- `DATABASE_BEST_PRACTICES.md` - Sequence management after data creation
- `PROJECT_STATUS.md` - Overall implementation status

---

## Conclusion

The job completion verification workflow is now complete with both accept and reject functionality. Clients have full control over verifying work quality before finalizing job completion, with clear feedback mechanisms to cleaners when corrections are needed.

**Key Achievement**: Separated job completion verification from the optional review process, giving clients the power to enforce quality standards before accepting work as complete.
