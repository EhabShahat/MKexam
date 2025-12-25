# Test Plan: Student Edit Functionality

## Overview
This document provides a comprehensive test plan to verify that the student edit functionality is working correctly after fixing the missing `updated_at`, `photo_url`, and `national_id_photo_url` columns.

## Pre-Requisites
- Supabase database has been migrated with the `fix_students_missing_columns_v2` migration
- Application is deployed and running
- Admin access credentials available

## Test Cases

### Test Case 1: Verify Database Schema
**Objective:** Confirm all required columns exist in the students table

**Steps:**
1. Connect to Supabase database
2. Run query:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'students'
ORDER BY ordinal_position;
```

**Expected Result:**
- Column `updated_at` exists with type `timestamp with time zone`
- Column `photo_url` exists with type `text`
- Column `national_id_photo_url` exists with type `text`

**Status:** ✅ PASSED

---

### Test Case 2: Verify Trigger Exists
**Objective:** Confirm the auto-update trigger is active

**Steps:**
1. Run query:
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'students'
  AND event_object_schema = 'public';
```

**Expected Result:**
- Trigger `trg_students_updated_at` exists for INSERT
- Trigger `trg_students_updated_at` exists for UPDATE

**Status:** ✅ PASSED

---

### Test Case 3: Edit Student Basic Information
**Objective:** Verify that editing student info updates the record without errors

**Steps:**
1. Navigate to `/admin/students`
2. Find any student in the list
3. Click the edit button
4. Modify student name, mobile number, or address
5. Click Save

**Expected Result:**
- No console errors
- Success message appears
- Student record is updated in the list
- `updated_at` timestamp is automatically updated

**Status:** ⏳ TO BE TESTED

---

### Test Case 4: Upload Student Photo
**Objective:** Verify photo upload functionality works

**Steps:**
1. Navigate to `/admin/students`
2. Click edit on a student
3. Upload a photo (< 5MB)
4. Click Save

**Expected Result:**
- Photo uploads successfully
- `photo_url` is saved to database
- Photo preview displays correctly
- No errors in console

**Status:** ⏳ TO BE TESTED

---

### Test Case 5: Upload National ID Photo
**Objective:** Verify national ID photo upload works

**Steps:**
1. Navigate to `/admin/students`
2. Click edit on a student
3. Upload a national ID photo (< 5MB)
4. Click Save

**Expected Result:**
- National ID photo uploads successfully
- `national_id_photo_url` is saved to database
- Photo preview displays correctly
- No errors in console

**Status:** ⏳ TO BE TESTED

---

### Test Case 6: Verify Automatic Timestamp Update
**Objective:** Confirm `updated_at` is automatically updated on changes

**Steps:**
1. Note the current `updated_at` value for a student
2. Edit any field for that student
3. Save the changes
4. Check the new `updated_at` value

**Expected Result:**
- `updated_at` timestamp is newer than the original value
- Timestamp reflects the time of the update

**Status:** ⏳ TO BE TESTED

---

### Test Case 7: Edit Student via API
**Objective:** Verify the PATCH endpoint works correctly

**Steps:**
1. Get a valid student ID
2. Make a PATCH request:
```javascript
fetch('/api/admin/students/[student-id]', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer [token]'
  },
  body: JSON.stringify({
    student_name: 'Updated Name',
    mobile_number: '1234567890'
  })
})
```

**Expected Result:**
- Status 200 response
- Response includes updated student data with new `updated_at` value
- No error about missing columns

**Status:** ⏳ TO BE TESTED

---

### Test Case 8: View Student Summary
**Objective:** Verify the student_exam_summary view includes new columns

**Steps:**
1. Query the view:
```sql
SELECT * FROM public.student_exam_summary LIMIT 1;
```

**Expected Result:**
- View includes `photo_url` column
- View includes `national_id_photo_url` column
- View includes `student_updated_at` column

**Status:** ✅ PASSED (view updated in migration)

---

### Test Case 9: Multipart Form Data Upload
**Objective:** Test file upload via multipart/form-data

**Steps:**
1. Navigate to `/admin/students`
2. Click edit on a student
3. Fill in text fields AND upload both photos
4. Click Save

**Expected Result:**
- All fields save correctly
- Both photos upload successfully
- URLs are stored in database
- No conflicts between text data and file data

**Status:** ⏳ TO BE TESTED

---

### Test Case 10: Error Handling
**Objective:** Verify proper error messages for invalid uploads

**Steps:**
1. Navigate to `/admin/students`
2. Try to upload a file > 5MB
3. Try to upload an invalid file type

**Expected Result:**
- Appropriate error messages displayed
- No server errors
- Form remains functional

**Status:** ⏳ TO BE TESTED

---

## Regression Tests

### Regression Test 1: Create New Student
**Objective:** Ensure new student creation still works

**Steps:**
1. Navigate to `/admin/students`
2. Click "Add Student" or equivalent
3. Fill in required fields
4. Submit

**Expected Result:**
- Student is created successfully
- `updated_at` and `created_at` are set automatically
- No errors

**Status:** ⏳ TO BE TESTED

---

### Regression Test 2: Delete Student
**Objective:** Confirm delete functionality is unaffected

**Steps:**
1. Navigate to `/admin/students`
2. Select a test student
3. Click delete
4. Confirm deletion

**Expected Result:**
- Student is deleted
- Related records cascade correctly
- No errors

**Status:** ⏳ TO BE TESTED

---

## Database Health Check

Run after all tests to verify database integrity:

```sql
-- Check for any NULL updated_at values (should be none)
SELECT COUNT(*) as null_updated_at_count
FROM public.students
WHERE updated_at IS NULL;

-- Verify trigger is working by checking recent updates
SELECT id, code, student_name, created_at, updated_at
FROM public.students
WHERE updated_at > created_at
ORDER BY updated_at DESC
LIMIT 10;

-- Check photo uploads
SELECT COUNT(*) as students_with_photos
FROM public.students
WHERE photo_url IS NOT NULL;

SELECT COUNT(*) as students_with_national_id_photos
FROM public.students
WHERE national_id_photo_url IS NOT NULL;
```

## Summary
- **Critical Tests:** Test Cases 3, 7 (Must pass to confirm bug fix)
- **High Priority:** Test Cases 4, 5, 6, 9 (Photo functionality)
- **Medium Priority:** Test Cases 1, 2, 8 (Database verification)
- **Low Priority:** Test Cases 10, Regression Tests (Quality assurance)

## Notes
- All database structure tests (1, 2, 8) have already passed
- Focus manual testing on Test Cases 3-7 and 9-10
- Monitor browser console for any JavaScript errors
- Monitor Supabase logs for any database errors
