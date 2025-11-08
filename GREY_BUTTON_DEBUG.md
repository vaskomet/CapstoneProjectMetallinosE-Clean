# Quick Debug: Grey Button Issue

## Issue: Button shows but is grey/not clickable

This means `canReview` is `false`. Let's find out why!

## Quick Checks:

### 1. Open Browser Console (F12)
Look for these messages:
```
🔍 Checking review eligibility for job: X
✅ Review eligibility response: {...}
```

### 2. What does the response say?

**If you see:**
```json
{
  "can_review": false,
  "reason": "Some reason here"
}
```

**Common reasons:**
- "You have already reviewed this job"
- "Review window (30 days) has expired"
- "You can only review jobs you participated in"
- "Job must be completed before it can be reviewed"
- "Job must have a completion date to be reviewed"

### 3. Quick Test - Check Job Status

Run this in backend terminal:
```bash
cd /Users/vaskomet/Desktop/CapstoneProjectMetallinos/backend
/Users/vaskomet/Desktop/CapstoneProjectMetallinos/.venv/bin/python manage.py shell
```

Then in Python shell:
```python
from cleaning_jobs.models import CleaningJob
from django.contrib.auth import get_user_model

User = get_user_model()

# Check the job
job = CleaningJob.objects.get(id=8)  # Replace 8 with your job ID
print(f"Job Status: {job.status}")
print(f"Actual End Time: {job.actual_end_time}")
print(f"Client: {job.client.username}")
print(f"Cleaner: {job.cleaner.username}")

# Check if you already reviewed
from reviews.models import Review
user = User.objects.get(username='vaskoclient')  # Replace with your username
existing = Review.objects.filter(job=job, reviewer=user).exists()
print(f"Already Reviewed: {existing}")
```

---

## Most Likely Causes:

### Cause 1: You Already Reviewed This Job ⚠️
**Solution:** Try a different completed job that you haven't reviewed yet

### Cause 2: Job ID Mismatch
**Solution:** Make sure you're looking at the right job

### Cause 3: API Not Responding
**Solution:** Check backend terminal for errors

---

## Let me know what you see in the console!
