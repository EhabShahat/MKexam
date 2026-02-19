# Database Migrations Log

This document tracks all database changes applied to the Supabase instance.

## Migration Files Order

Run these files in order for a fresh database setup:

1. `schema.sql` - Main database schema
2. `indexes.sql` - Database indexes for performance
3. `security.sql` - RLS policies and security
4. `rpc_functions.sql` - RPC functions
5. `app_settings.sql` - Application settings table
6. `attendance.sql` - Attendance system tables
7. `extra_scores.sql` - Extra scoring fields system
8. `exam_public_config.sql` - Public exam configuration
9. `student_requests_table.sql` - Student registration requests
10. `blocked_entries.sql` - Blocked students/IPs system
11. `exam_auto_status_system.sql` - Automatic exam status management
12. `storage_setup.sql` - Supabase storage buckets
13. `auto_grade_column.sql` - Auto-grading columns
14. `migration_auto_grade.sql` - Auto-grade migration
15. `fix_*.sql` - Various fixes (run in any order after above)
16. `attendance_auto_tuesday_merge.sql` - **NEW: Auto-merge attendance to Tuesdays**

## Recent Changes (Oct 23, 2025)

### Automatic Tuesday Attendance Merging

**File**: `attendance_auto_tuesday_merge.sql`

**Purpose**: Automatically merge all attendance records taken during a week (Tue-Mon) to that week's Tuesday date.

**Changes**:
- Created `get_last_tuesday(DATE)` function - calculates the most recent Tuesday
- Created `auto_set_session_date_to_last_tuesday()` trigger function - auto-adjusts session_date
- Created `set_attended_at_utc()` trigger function - ensures UTC timestamps
- Added trigger `set_session_date_to_tuesday` on `attendance_records` table
- Added trigger `ensure_attended_at_utc` on `attendance_records` table

**Impact**:
- All attendance scans are automatically grouped by week
- Consistent weekly attendance tracking
- Timezone-safe date handling
- No manual intervention needed

**Example**:
```sql
-- Scan taken on Thursday Oct 23, 2025
INSERT INTO attendance_records (student_id, session_date) 
VALUES (student_id, '2025-10-23');

-- Automatically stored as:
-- session_date: 2025-10-21 (Tuesday)
```

### Data Updates Applied Directly

The following updates were applied directly via Supabase MCP (not in migration files):

1. **Updated completion_status** (909 records)
   - Changed from `'completed'` to `'submitted'`
   - Reason: Sync function only looks for submitted status

2. **Recalculated all extra scores** (309 students)
   - Quiz scores: Based on all quiz exams (avg percentage)
   - Homework scores: Based on all homework exams (avg percentage)
   - Attendance: Based on unique session dates

3. **Merged attendance session dates**
   - Merged 2025-10-15 and 2025-10-16 into 2025-10-14
   - Result: 2 total sessions (Oct 14 and Oct 21)

## Verification Queries

### Check Tuesday Merging is Active
```sql
-- Should show both triggers exist
SELECT 
  tgname as trigger_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'attendance_records'::regclass
  AND tgname IN ('set_session_date_to_tuesday', 'ensure_attended_at_utc');
```

### Test Tuesday Calculation
```sql
-- Test various dates
SELECT 
  test_date,
  TO_CHAR(test_date, 'Dy') as day_name,
  get_last_tuesday(test_date) as last_tuesday,
  TO_CHAR(get_last_tuesday(test_date), 'Dy') as should_be_tuesday
FROM (
  VALUES 
    (CURRENT_DATE),
    (CURRENT_DATE + 1),
    (CURRENT_DATE + 2),
    (CURRENT_DATE - 1)
) AS t(test_date);
```

### Check Attendance Sessions
```sql
-- Should only show Tuesdays
SELECT 
  session_date,
  TO_CHAR(session_date, 'Dy YYYY-MM-DD') as formatted,
  COUNT(DISTINCT student_id) as students
FROM attendance_records
GROUP BY session_date
ORDER BY session_date DESC;
```

## Rollback Instructions

### To disable Tuesday auto-merging:
```sql
DROP TRIGGER IF EXISTS set_session_date_to_tuesday ON attendance_records;
DROP TRIGGER IF EXISTS ensure_attended_at_utc ON attendance_records;
```

### To completely remove:
```sql
DROP TRIGGER IF EXISTS set_session_date_to_tuesday ON attendance_records;
DROP TRIGGER IF EXISTS ensure_attended_at_utc ON attendance_records;
DROP FUNCTION IF EXISTS auto_set_session_date_to_last_tuesday();
DROP FUNCTION IF EXISTS set_attended_at_utc();
DROP FUNCTION IF EXISTS get_last_tuesday(DATE);
```

## Notes

- All date handling is timezone-independent using PostgreSQL DATE type
- Triggers run BEFORE INSERT/UPDATE, so no existing data is modified
- The system uses UTC for all timestamps to prevent timezone issues
- Attendance percentage calculation is based on total unique session dates
