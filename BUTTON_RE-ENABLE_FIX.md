# Button Re-enable After Attempt Deletion Fix

## Problem
When an admin deletes a student's exam attempt, the "Attempted" button remains disabled on the student's exam list, preventing them from retaking the exam.

## Root Cause
The button state is determined by the `attempt_status` field from the `student_exam_attempts` table. When an admin deletes an attempt:

1. The `student_exam_attempts` record is deleted
2. The `exam_attempts` record is deleted
3. The API returns `attempt_status: null` for that exam
4. However, the frontend was not refetching the data, so the old "completed" status remained cached

## Solution

### 1. Auto-refetch on Page Focus
Updated `MultiExamEntry.tsx` to refetch exam data when:
- The page regains focus (user switches back to the tab)
- The page becomes visible (user returns from another app)
- The URL parameter changes

This ensures that when a student returns to the exams page after an admin deletes their attempt, they see the updated status.

### 2. Improved Button Logic
Updated the button rendering logic to properly handle all states:

```typescript
if (ex.attempt_status === "completed") {
  // Exam was submitted - always disabled
  buttonLabel = "Attempted";
  isDisabled = true;
} else if (ex.attempt_status === "in_progress") {
  // Exam is in progress
  if (timeFinished || ex.ended) {
    buttonLabel = "Exam Ended";
    isDisabled = true;
  } else {
    buttonLabel = "Continue to Exam";
    isDisabled = false;
  }
} else if (ex.ended || timeFinished) {
  // Time ended and no attempt (or deleted attempt)
  buttonLabel = "Exam Ended";
  isDisabled = true;
} else {
  // No attempt (null status) and exam is active
  // This includes when admin deletes an attempt
  buttonLabel = "Start Exam";
  isDisabled = false; // ✅ Button is enabled!
}
```

## How It Works

### Database Flow
1. Admin deletes attempt via `/api/admin/attempts/:attemptId`
2. Backend deletes from `student_exam_attempts` table
3. Backend deletes from `exam_attempts` table
4. Backend calls `admin_reset_student_attempts` RPC

### Frontend Flow
1. Student returns to exams page
2. Page focus event triggers refetch
3. API query returns `attempt_status: null` (no record found)
4. Button logic sees `null` status + active exam = enable button
5. Student can now start the exam again

## Important Notes

### Time-based Restrictions
If the exam time has already ended, the button will remain disabled even after the admin deletes the attempt. This is correct behavior because:
- Students shouldn't take exams after the time window closes
- To allow a retake after time expires, admin must:
  1. Extend the exam's end time
  2. Delete the attempt
  3. Student can then retake within the new time window

### Manual Refresh
Students may need to:
- Click back to the exams page if they're on a different page
- Refresh the browser if the auto-refetch doesn't trigger
- The refetch happens automatically on focus/visibility change

## Testing

To test the fix:
1. Student takes an exam (button shows "Attempted")
2. Admin deletes the attempt from admin panel
3. Student clicks back to exams page or switches to the tab
4. Button should now show "Start Exam" and be enabled (if exam is still active)
5. Student can retake the exam

## Files Modified
- `src/components/public/MultiExamEntry.tsx`
  - Updated `refetchIfCode` to check both URL param and stored code
  - Improved button rendering logic in `renderExamItem`
  - Added better comments explaining each state
