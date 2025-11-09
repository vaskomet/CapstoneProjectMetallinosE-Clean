# Testing Guide: Profile Navigation from Completed Jobs

## Quick Test Steps

### 🧪 Test as Client (Viewing Cleaner Profile)

1. **Login as Client**
   - Use test client credentials from `backend/cleaning_jobs/management/commands/test_credentials.py`

2. **Navigate to Completed Jobs**
   ```
   http://localhost:5173/completed-jobs
   ```

3. **Select a Completed Job**
   - Click on any job card in the sidebar
   - Job details should display on the right

4. **View Cleaner Profile**
   - In the "Your Cleaner" section, look for the purple **"View Profile"** button
   - It should be the first button above "Message Cleaner" and "Book Again"
   - Click the button

5. **Verify Profile Page**
   - URL should change to `/cleaner/:id`
   - Should see:
     - Cleaner's name and profile picture
     - Average rating, total reviews, and completed jobs
     - Review statistics with bar charts
     - List of reviews from other clients
     - Sub-ratings: Quality, Communication, Professionalism, Timeliness

6. **Return to Job**
   - Click the "Back" button at the top
   - Should return to completed jobs page

---

### 🧹 Test as Cleaner (Viewing Client Profile)

1. **Login as Cleaner**
   - Use test cleaner credentials from `backend/cleaning_jobs/management/commands/test_credentials.py`

2. **Navigate to Completed Jobs**
   ```
   http://localhost:5173/completed-jobs
   ```

3. **Select a Completed Job**
   - Click on any job card in the sidebar
   - Job details should display on the right

4. **View Client Profile**
   - In the "Client" section, look for the purple **"View Profile"** button
   - It should be next to the client's name and email
   - Click the button

5. **Verify Profile Page**
   - URL should change to `/client/:id`
   - Should see:
     - Client's name and profile picture
     - Average rating, total reviews, and completed jobs
     - Review statistics with bar charts
     - List of reviews from other cleaners
     - Sub-ratings: Communication, Professionalism, Responsiveness, Clarity

6. **Return to Job**
   - Click the "Back" button at the top
   - Should return to completed jobs page

---

## Expected Visual Layout

### Completed Jobs Dashboard - Client View
```
┌────────────────────────────────────────────────────────────┐
│ Completed Jobs Dashboard                                    │
├─────────────────┬──────────────────────────────────────────┤
│ Job List        │ Job Details                              │
│                 │                                          │
│ • Job #1        │ Your Cleaner                             │
│ • Job #2 ←      │ ┌──────────────────────────────────┐    │
│ • Job #3        │ │ John Doe                         │    │
│                 │ │ john@example.com                 │    │
│                 │ │                                  │    │
│                 │ │ [View Profile]    ← PURPLE       │    │
│                 │ │ [Message Cleaner]                │    │
│                 │ │ [Book Again]                     │    │
│                 │ └──────────────────────────────────┘    │
└─────────────────┴──────────────────────────────────────────┘
```

### Cleaner Profile Page
```
┌────────────────────────────────────────────────────────────┐
│ ← Back                                                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
││      GRADIENT HEADER (Blue → Purple)                     ││
││                                                           ││
││  👤    John Doe                                           ││
││       ⭐ 4.8  |  24 Reviews  |  45 Completed Jobs        ││
│└─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
││ Review Statistics                                         ││
││ Quality:           ████████░░ 4.8                        ││
││ Communication:     ███████░░░ 4.6                        ││
││ Professionalism:   █████████░ 4.9                        ││
││ Timeliness:        ████████░░ 4.7                        ││
│└─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
││ Reviews from Clients                                      ││
││ • Review 1...                                             ││
││ • Review 2...                                             ││
│└─────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

---

## API Testing

### Test Client Profile API
```bash
# Get client profile (replace <client_id> with actual ID)
curl http://localhost:8000/api/profile/client/<client_id>/
```

### Test Cleaner Profile API
```bash
# Get cleaner profile (replace <cleaner_id> with actual ID)
curl http://localhost:8000/api/profile/cleaner/<cleaner_id>/
```

---

## Common Issues & Solutions

### Issue: "Profile not found"
**Solution:** Ensure the user ID in the URL exists and has the correct role (client/cleaner)

### Issue: "No reviews showing"
**Solution:** User may not have any reviews yet. Create test reviews using the review system.

### Issue: "View Profile button not visible"
**Solution:** 
- Ensure job has both client and cleaner assigned
- Check user role matches the condition (client sees cleaner button, cleaner sees client button)

### Issue: "Back button doesn't work"
**Solution:** Use browser back or the "Back" button at top of profile page

---

## Test Data

If you need to create test data with reviews:

```bash
# From backend directory
python manage.py create_test_reviews
```

This will create completed jobs with reviews so you can test the profile navigation feature properly.

---

## Success Criteria

✅ **Pass if:**
- View Profile button appears in correct location
- Clicking button navigates to correct profile page
- Profile page loads without errors
- All profile information displays correctly
- Review statistics show proper data
- Reviews list appears (if reviews exist)
- Back button returns to previous page
- Both client and cleaner flows work

❌ **Fail if:**
- Button doesn't appear
- Navigation goes to wrong page
- Profile data doesn't load
- Page shows errors
- Reviews don't display properly
- Back button breaks

---

## Browser Console Checks

Open browser console (F12) and check for:

1. **No errors** during navigation
2. **Successful API calls**:
   - `GET /api/profile/client/:id` (status 200)
   - `GET /api/profile/cleaner/:id` (status 200)
3. **Proper data structure** in network responses

---

## Next Steps After Testing

If tests pass:
1. ✅ Mark as complete
2. Test with real user data
3. Consider adding analytics for profile views
4. Monitor performance with many reviews

If tests fail:
1. Check browser console for errors
2. Verify backend API responses
3. Check React component props
4. Review routing configuration
