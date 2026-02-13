# Score Calculation Fix Instructions

## Problem Summary

The current score calculation has three issues:

### 1. Attendance Calculation
- **Current**: Shows 8% for student 3422 (1 session attended)
- **Expected**: Should show 20% (1 out of 5 total sessions)
- **Issue**: Calculation is incorrect

### 2. Homework Score Calculation
- **Current**: Shows 100% for student 3422 (2 exams attempted, both 100%)
- **Expected**: Should show 14% (200 points / 14 total exams)
- **Issue**: Only averaging attempted exams, not counting non-attempted as 0%

### 3. Quiz Score Calculation
- **Current**: Shows 39% for student 3422 (3 exams attempted)
- **Expected**: Should show ~1% (118 points / 101 total exams)
- **Issue**: Only averaging attempted exams, not counting non-attempted as 0%

## Investigation Results

From `scripts/investigate-scores.js`:
- Total attendance sessions in database: **5 sessions**
- Total homework exams: **14 exams**
- Total quiz exams: **101 exams**

Student 3422 (ehab):
- Attended: 1 session (2025-10-21)
- Homework attempts: 2/14 (both 100%)
- Quiz attempts: 3/101 (18.18%, 100%, 0% = avg 39%)

## Solution

Change the calculation method from:
```
Average of attempted exams only
```

To:
```
(Sum of all attempted exam scores) / (Total number of exams)
```

This way, non-attempted exams count as 0%.

## How to Apply the Fix

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `db/fix_score_calc_migration.sql`
6. Paste into the SQL Editor
7. Click **Run** or press `Ctrl+Enter`
8. Wait for the query to complete

### Option 2: Using psql Command Line

If you have PostgreSQL client installed:

```bash
# Replace YOUR_PASSWORD with your database password
psql "postgresql://postgres:YOUR_PASSWORD@rtslytzirggxtqymectm.supabase.co:5432/postgres" < db/fix_score_calc_migration.sql
```

### Option 3: Using Supabase CLI

If you have Supabase CLI installed and linked:

```bash
supabase db push --db-url "postgresql://postgres:YOUR_PASSWORD@rtslytzirggxtqymectm.supabase.co:5432/postgres"
```

## After Applying the Fix

### Step 1: Verify the Functions Were Created

Run this query in SQL Editor:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('sync_all_extra_scores', 'sync_homework_and_quiz_scores', 'sync_student_extra_scores');
```

You should see all 3 functions listed.

### Step 2: Run the Sync Function

Execute this in SQL Editor:

```sql
SELECT * FROM sync_all_extra_scores();
```

This will update all 338 students' scores.

### Step 3: Verify Student 3422

Check the updated scores:

```sql
SELECT 
  s.code,
  s.student_name,
  es.data->>'attendance_percentage' as attendance,
  es.data->>'exam_type_homework' as homework,
  es.data->>'exam_type_quiz' as quiz
FROM students s
JOIN extra_scores es ON es.student_id = s.id
WHERE s.code = '3422';
```

Expected results:
- **Attendance**: 20% (1/5 sessions)
- **Homework**: 14% (200/14 exams)
- **Quiz**: 1% (118/101 exams)

### Step 4: Test with the Admin Interface

1. Go to `/admin/results`
2. Click "Refresh" button
3. Check student 3422's scores
4. Verify they match the expected values

## What Changed

### Before (Incorrect)
```sql
-- Only averaged attempted exams
ROUND(AVG(score_percentage)) 
-- Example: (100 + 100) / 2 = 100%
```

### After (Correct)
```sql
-- Sum all scores, divide by total exams
ROUND(SUM(score_percentage) / total_exam_count)
-- Example: (100 + 100 + 0 + 0 + ... + 0) / 14 = 14%
```

## Future Attendance Sessions

When you record a new attendance session:
- The total session count will automatically increase (e.g., from 5 to 6)
- All students' attendance percentages will be recalculated
- Student 3422 would show: 1/6 = 17% (rounded)

The `sync_all_extra_scores()` function is automatically called when:
- You sync attendance via `/admin/extra-scores/sync-attendance`
- You sync exam tags via `/admin/extra-scores/sync-exam-tags`

## Troubleshooting

### If the fix doesn't apply:
1. Check for syntax errors in the SQL Editor
2. Ensure you have the correct permissions (service_role)
3. Try applying each function separately

### If scores don't update:
1. Manually run: `SELECT * FROM sync_all_extra_scores();`
2. Check the browser console for errors
3. Clear the React Query cache by clicking "Refresh"

### If you see old scores:
1. Hard refresh the page (Ctrl+Shift+R)
2. Check if the extra_scores table was actually updated:
   ```sql
   SELECT updated_at FROM extra_scores WHERE student_id = (SELECT id FROM students WHERE code = '3422');
   ```

## Files Created

- `db/fix_score_calc_migration.sql` - The migration to apply
- `scripts/investigate-scores.js` - Investigation script (already run)
- `scripts/check-attendance-sessions.js` - Check attendance data
- `scripts/apply-migration-fix.js` - Attempted automated fix (didn't work due to exec_sql limitations)

## Next Steps

After applying the fix:
1. Update `db/score_calculation_views.sql` with the corrected functions
2. Test with a few more students to ensure accuracy
3. Monitor the results page for any anomalies
4. Consider adding a UI indicator showing the calculation method

## Contact

If you encounter any issues applying this fix, please let me know and I can help troubleshoot.
