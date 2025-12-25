# Bug Fix: Students Table Missing Columns

## Issue
When trying to edit student information in `/admin/students`, the application was throwing an error:
```
PATCH https://5odam.netlify.app/api/admin/students/6f66c9ae-aa95-487d-aee6-2a31942de939
HTTP/2 400 376ms

"Could not find the 'updated_at' column of 'students' in the schema cache"
```

## Root Cause
The `students` table in the database was missing three columns that the application code expected:
1. `updated_at` - timestamp for tracking when student records are modified
2. `photo_url` - URL for student profile photos
3. `national_id_photo_url` - URL for national ID photos

The backend code in `src/server/admin/students.ts` (line 208) was trying to set `updated_at`:
```typescript
update.updated_at = new Date().toISOString();
```

However, the database schema in `db/schema.sql` did not include this column in the `students` table definition.

## Solution Applied

### 1. Database Migration
Created and applied migration `fix_students_missing_columns_v2` to:
- Add `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` column
- Add `photo_url TEXT NULL` column  
- Add `national_id_photo_url TEXT NULL` column
- Create trigger function `tg_set_students_updated_at()` to automatically update `updated_at` on modifications
- Create trigger `trg_students_updated_at` that fires on INSERT/UPDATE
- Update `student_exam_summary` view to include the new columns

### 2. Schema File Updates
Updated `db/schema.sql` to reflect the database changes:
- Added `updated_at` to the students table definition
- Added idempotent column additions for `photo_url` and `national_id_photo_url`
- Added trigger function and trigger creation
- Updated the `student_exam_summary` view definition

### 3. Migration File Created
Created `db/fix_students_columns.sql` for future reference and redeployment needs.

## Verification
- ✅ Verified all three columns exist in the database
- ✅ Confirmed trigger `trg_students_updated_at` is active on INSERT and UPDATE operations
- ✅ Validated view `student_exam_summary` includes new columns
- ✅ TypeScript interfaces already had the correct types

## Files Modified
1. `db/schema.sql` - Updated students table definition and view
2. `db/fix_students_columns.sql` - New migration file

## Files Created
1. `db/fix_students_columns.sql` - Migration script
2. `BUGFIX_STUDENTS_UPDATED_AT.md` - This documentation

## Testing Recommendations
1. Test editing a student's information in `/admin/students`
2. Verify that `updated_at` is automatically updated when a student record is modified
3. Test uploading student photos and national ID photos
4. Verify the photos are stored correctly and URLs are saved to the database

## Database Schema After Fix
```sql
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  student_name TEXT NULL,
  mobile_number TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mobile_number2 TEXT NULL,
  address TEXT NULL,
  national_id TEXT NULL,
  photo_url TEXT NULL,
  national_id_photo_url TEXT NULL
);
```

## Notes
- The migration is idempotent and safe to run multiple times
- The trigger automatically maintains the `updated_at` timestamp
- Photo URLs are nullable as not all students may have photos uploaded
