# Continue Exam Feature - Implementation Complete

## Feature Description
When a student starts an exam but exits the app (closes browser, loses connection, etc.), they can now click the "Continue" button to resume their existing attempt directly, without creating a new attempt.

## Problem Solved
Previously, clicking "Continue" would call the exam access API which might:
- Try to create a new attempt (causing errors if one already exists)
- Redirect to the welcome page instead of the exam itself
- Not properly resume the in-progress attempt

## Solution Implemented

### 1. Updated `startOrContinueExam` Function
Added logic to check for existing attempt ID before making API calls:

```typescript
const startOrContinueExam = useCallback(async (examId: string, overrideCode?: string, existingAttemptId?: string | null) => {
  // If there's an existing attempt, redirect directly to it
  if (existingAttemptId) {
    console.log('[MultiExamEntry] Continuing existing attempt:', existingAttemptId);
    const attemptUrl = `/attempt/${existingAttemptId}`;
    router.push(attemptUrl);
    return;
  }

  // Otherwise, start a new attempt via API
  // ... existing code
}, [code, isValidCode, locale, storeCode, router, handleApiError, t]);
```

### 2. Updated Button Click Handler
Modified the exam item renderer to pass the `attempt_id` when clicking the button:

```typescript
<button
  onClick={() => startOrContinueExam(ex.id, undefined, ex.attempt_id)}
  className="btn btn-primary"
>
  {buttonLabel}
</button>
```

## User Flow

### Starting a New Exam
1. Student clicks "Start" button
2. `startOrContinueExam` is called with `attempt_id = null`
3. API creates new attempt
4. Student redirected to welcome page → exam page

### Continuing an Existing Exam
1. Student clicks "Continue" button
2. `startOrContinueExam` is called with existing `attempt_id`
3. **Direct redirect** to `/attempt/{attemptId}` (no API call)
4. Student resumes exactly where they left off

## Benefits

✅ **Instant Resume** - No API call needed, faster navigation
✅ **No Duplicate Attempts** - Doesn't try to create a new attempt
✅ **Seamless Experience** - Student continues exactly where they left off
✅ **Works Offline** - If student has the page cached, they can continue even with poor connection
✅ **Auto-save Integration** - Works perfectly with existing auto-save functionality

## Technical Details

### Data Flow
1. API `/api/public/exams/by-code` returns exam list with `attempt_id` for in-progress exams
2. Frontend stores this `attempt_id` in the exam item data
3. When "Continue" is clicked, frontend uses this ID to navigate directly
4. Exam page loads the attempt state from the database

### Files Modified
- `src/components/public/MultiExamEntry.tsx`
  - Updated `startOrContinueExam` function signature
  - Added direct navigation logic for existing attempts
  - Updated button click handler to pass attempt_id

## Testing Scenarios

### Scenario 1: Start New Exam
- Click "Start" on an exam you haven't attempted
- Should redirect to welcome page
- ✅ Works as before

### Scenario 2: Continue In-Progress Exam
- Start an exam, answer some questions
- Close the browser/app
- Return to exam list page
- Click "Continue"
- Should go directly to the exam page with your progress saved
- ✅ **New behavior - instant resume**

### Scenario 3: Network Issues
- Start an exam with good connection
- Lose connection mid-exam
- Close browser
- Reconnect and return to exam list
- Click "Continue"
- Should resume the exam (attempt_id is already known)
- ✅ More resilient to network issues

## Related Features
- Auto-save functionality (saves progress continuously)
- Exam button status (shows correct state: Start/Continue/Attempted)
- Student code persistence (remembers student across sessions)

## Date Implemented
February 6, 2026
