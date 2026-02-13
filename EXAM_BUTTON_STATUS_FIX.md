# Exam Button Status Fix - Complete

## Problem
After submitting an exam, the button on the exam list page still showed "Continue" (المتابعة إلى الاختبار) instead of "Attempted" with a disabled state.

## Root Cause
The `submit_attempt()` database function was updating `exam_attempts.completion_status` to 'submitted', but it wasn't updating the corresponding `student_exam_attempts.status` to 'completed'. The exam list API reads from `student_exam_attempts` table, causing the mismatch.

## Solution Applied

### 1. Frontend Button Logic (MultiExamEntry.tsx)
Updated the exam button rendering logic to properly handle all states:

- **"Start"** (enabled) - No attempt yet, exam is available
- **"Continue"** (enabled) - Exam in progress, not submitted, time hasn't finished
- **"Attempted"** (disabled) - Either submitted OR time has finished

The logic now checks:
```typescript
const timeFinished = ex.end_time ? new Date(ex.end_time) < new Date() : false;
const isCompleted = ex.attempt_status === "completed" || timeFinished;
```

### 2. Database Function Fix
Updated `submit_attempt()` function to sync both tables:

```sql
-- Also update student_exam_attempts status to 'completed'
UPDATE public.student_exam_attempts
  SET status = 'completed', completed_at = now()
  WHERE attempt_id = p_attempt_id;
```

### 3. Historical Data Fix
Updated all existing submitted attempts that were still marked as 'in_progress':

```sql
UPDATE public.student_exam_attempts sea
SET 
  status = 'completed',
  completed_at = ea.submitted_at
FROM public.exam_attempts ea
WHERE 
  sea.attempt_id = ea.id
  AND ea.completion_status = 'submitted'
  AND ea.submitted_at IS NOT NULL
  AND sea.status = 'in_progress';
```

**Result**: Fixed 21,806 historical records

### 4. Automatic Sync Trigger
Created a trigger to keep both tables in sync automatically:

```sql
CREATE TRIGGER sync_student_exam_attempts_on_submit
  AFTER UPDATE ON public.exam_attempts
  FOR EACH ROW
  WHEN (NEW.completion_status = 'submitted' AND OLD.completion_status != 'submitted')
  EXECUTE FUNCTION sync_student_exam_attempts_status();
```

## Verification Results

✅ **All submitted attempts now correctly marked as completed**
- 21,806 completed attempts (status synced)
- 55 in-progress attempts (still active)
- 0 mismatched records

## Files Modified

1. **src/components/public/MultiExamEntry.tsx** - Updated button logic
2. **db/rpc_functions.sql** - Updated submit_attempt function
3. **db/fix_student_exam_attempts_status.sql** - Migration file (applied via Supabase MCP)

## Testing

After the fix:
1. Refresh the exam list page (`/exams`)
2. Previously submitted exams now show "Attempted" (محاولة) with disabled button
3. In-progress exams show "Continue" (المتابعة إلى الاختبار)
4. New exams show "Start" (ابدأ الاختبار)

## Impact

- **Immediate**: All 21,806 historical submitted attempts now display correctly
- **Future**: All new exam submissions will automatically sync both tables
- **User Experience**: Students see accurate exam status without confusion

## Date Applied
February 6, 2026
