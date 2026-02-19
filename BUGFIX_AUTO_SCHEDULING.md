# Bug Fix: Auto-Scheduling System - "exam_not_published" Error

## Problem

The auto-scheduling system shows/hides exams correctly based on time, but when students try to access them, they get:
```
POST /api/public/exams/[examId]/access
HTTP 400 - error: "exam_not_published"
```

## Root Cause

The `start_attempt` RPC function checks the **stored `status` column** in the database:
```sql
if v_exam.status <> 'published' then
  raise exception 'exam_not_published';
end if;
```

However, the auto-scheduling system uses a **computed status** based on:
- `scheduling_mode` (Auto/Manual)
- `start_time` and `end_time`
- `is_manually_published` flag
- `is_archived` flag

The stored `status` column is never automatically updated when the scheduled time arrives, causing the mismatch.

## Solution

Update the `start_attempt` and `start_attempt_v2` RPC functions to use the same computed accessibility logic as the `exams_with_computed_status` view.

## How to Apply the Fix

### Option 1: Via Supabase Dashboard SQL Editor

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the contents of `db/fix_start_attempt_computed_status.sql`
4. Paste and run the SQL script
5. Verify success (should show "Success. No rows returned")

### Option 2: Via npm Script

If you have a database setup script:

```bash
# Add to package.json scripts:
"fix:scheduling": "node scripts/run-sql.js db/fix_start_attempt_computed_status.sql"

# Then run:
npm run fix:scheduling
```

### Option 3: Manual SQL Execution

Run the SQL file directly using `psql` or your preferred PostgreSQL client:

```bash
psql -h [your-supabase-host] -U postgres -d postgres < db/fix_start_attempt_computed_status.sql
```

## What Changed

### Before (Old Logic)
```sql
-- Only checked stored status column
if v_exam.status <> 'published' then
  raise exception 'exam_not_published';
end if;
```

### After (New Logic)
```sql
-- Check if exam is archived
if v_exam.is_archived then
  raise exception 'exam_not_published';
end if;

-- Compute accessibility based on scheduling mode
IF v_exam.scheduling_mode = 'Manual' THEN
  -- Admin controls via is_manually_published flag
  v_is_accessible := v_exam.is_manually_published;
ELSIF v_exam.scheduling_mode = 'Auto' THEN
  -- Time-based with optional early publish override
  IF v_exam.is_manually_published AND NOW() < v_exam.end_time THEN
    v_is_accessible := true;  -- Early publish
  ELSIF NOW() >= v_exam.start_time AND NOW() < v_exam.end_time THEN
    v_is_accessible := true;  -- Standard time window
  ELSE
    v_is_accessible := false;  -- Outside time window
  END IF;
ELSE
  -- Fallback
  v_is_accessible := (v_exam.status = 'published');
END IF;

-- Block access if not accessible
IF NOT v_is_accessible THEN
  raise exception 'exam_not_published';
END IF;
```

## Testing After Fix

### Test Auto-Scheduled Exam

1. Create an exam with:
   - `scheduling_mode`: 'Auto'
   - `start_time`: Current time - 5 minutes
   - `end_time`: Current time + 1 hour
   - `status`: 'draft' (stored status doesn't matter anymore)

2. Try to access the exam as a student
3. Should work! ✅

### Test Manual-Scheduled Exam

1. Create an exam with:
   - `scheduling_mode`: 'Manual'
   - `is_manually_published`: true
   - `start_time`: Any future date (doesn't matter)

2. Try to access the exam
3. Should work! ✅

### Test Archived Exam

1. Archive any exam (set `is_archived` = true)
2. Try to access it
3. Should show "exam_not_published" ✅

## Additional Notes

- The fix maintains **backward compatibility** with exams that don't use the auto-scheduling system
- The `start_attempt_v2` function automatically inherits the fix since it delegates to `start_attempt`
- No changes needed to the frontend code
- The `exams_with_computed_status` view remains the source of truth for UI display

## Verification

After applying the fix, check the function was updated:

```sql
-- In Supabase SQL Editor, run:
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname IN ('start_attempt', 'start_attempt_v2')
  AND pronamespace = 'public'::regnamespace;
```

You should see the new logic with `v_is_accessible` variable and computed status checks.

## Rollback (If Needed)

If you need to revert, the original function is in:
- `db/rpc_functions.sql` lines 315-428

Simply re-run that section of the SQL file.

---

**Status**: ✅ Ready to deploy  
**Priority**: High (blocks student exam access)  
**Impact**: Zero breaking changes, pure bug fix
