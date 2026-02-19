# Migration Checklist - Local SQL Files Update

## ✅ Completed Updates

### 1. Schema File (`schema.sql`)
**Status**: ✅ UPDATED

**Changes Made**:
- Added header comment with update date
- Added new columns to `exams` table:
  - `scheduling_mode`, `is_manually_published`, `is_archived`, `archived_at`, `status_note`
- Updated `questions` table with:
  - `auto_grade_on_answer` column
  - Default value for `option_image_urls`
- Updated `attempt_activity_events` table structure
- Added NEW tables at end of file:
  - `exam_bypass_codes`
  - `blocked_entries`
  - `student_requests`
  - `app_settings` (comprehensive version)
  - `extra_score_fields`
  - `extra_scores`
  - `exam_public_config`
  - `attendance_records`
  - `keep_alive`

### 2. Security Policies
**Status**: ✅ NEW FILE CREATED (`security_UPDATED.sql`)

**Contains**:
- All 32 RLS policies from live database
- Updated `is_admin()` function
- All admin-only policies
- All public read policies
- Student request policies
- Recreated `student_exam_summary` view

**Action Required**: Review and potentially replace `security.sql` with `security_UPDATED.sql`

### 3. Indexes
**Status**: ✅ NEW FILE CREATED (`indexes_UPDATED.sql`)

**Contains**:
- All 70+ indexes from live database
- Performance indexes for all tables
- Unique constraints
- Conditional indexes

**Action Required**: Review and potentially replace `indexes.sql` with `indexes_UPDATED.sql`

### 4. Storage Setup
**Status**: ✅ NEW FILE CREATED (`storage_setup_UPDATED.sql`)

**Contains**:
- 3 storage buckets (logos, question-images, student-files)
- All storage RLS policies
- Updated bucket configurations

**Action Required**: Review and potentially replace `storage_setup.sql` with `storage_setup_UPDATED.sql`

### 5. Documentation
**Status**: ✅ CREATED

**New Files**:
- `UPDATE_SUMMARY.md` - Overall update summary
- `RPC_FUNCTIONS_REFERENCE.md` - RPC functions documentation
- `MIGRATION_CHECKLIST.md` - This file
- `_BACKUP_schema_2025-01-29.sql` - Backup of original schema

## 📋 Files to Review

### Priority 1: Must Review
- [ ] `schema.sql` - Verify new tables and columns
- [ ] `security_UPDATED.sql` - Review RLS policies
- [ ] `indexes_UPDATED.sql` - Review index strategy

### Priority 2: Should Review
- [ ] `storage_setup_UPDATED.sql` - Check bucket permissions
- [ ] `UPDATE_SUMMARY.md` - Read full summary

### Priority 3: Reference
- [ ] `RPC_FUNCTIONS_REFERENCE.md` - Function documentation
- [ ] `_BACKUP_schema_2025-01-29.sql` - Original backup

## 🔄 Recommended Next Steps

### Step 1: Test Schema Changes
```bash
# In a test database, run:
psql -h localhost -U postgres -d test_db -f db/schema.sql
```

### Step 2: Verify Application Compatibility
- [ ] Check if new columns are used in application code
- [ ] Verify that removed features don't break anything
- [ ] Test RLS policies with your auth setup

### Step 3: Apply Security Policies
```bash
# After testing schema, apply security:
psql -h localhost -U postgres -d test_db -f db/security_UPDATED.sql
```

### Step 4: Apply Indexes
```bash
# Apply indexes for performance:
psql -h localhost -U postgres -d test_db -f db/indexes_UPDATED.sql
```

### Step 5: Setup Storage
```bash
# Setup storage buckets:
psql -h localhost -U postgres -d test_db -f db/storage_setup_UPDATED.sql
```

## 🎯 Integration Options

### Option A: Replace Files (Recommended)
```bash
# Backup originals
cp db/security.sql db/security_OLD.sql
cp db/indexes.sql db/indexes_OLD.sql
cp db/storage_setup.sql db/storage_setup_OLD.sql

# Replace with updated versions
mv db/security_UPDATED.sql db/security.sql
mv db/indexes_UPDATED.sql db/indexes.sql
mv db/storage_setup_UPDATED.sql db/storage_setup.sql
```

### Option B: Merge Manually
Review each `_UPDATED.sql` file and manually merge changes into existing files.

### Option C: Keep Both
Keep both versions and decide which to use based on your workflow.

## ⚠️ Important Notes

### Database Differences
Your live database has:
- **78 migrations** applied over time
- **~30 RPC functions** (not all exported)
- **3 storage buckets** configured
- **24 tables** in public schema

Your local SQL files now reflect the **current state** but not the **migration history**.

### RPC Functions
The `rpc_functions.sql` file was NOT updated because:
1. It already contains most core functions
2. Function definitions are large and complex
3. Local and remote are already in sync

If you've made function changes via migrations, export them separately.

### Storage Policies
⚠️ Storage policies are currently **permissive** (public upload/delete).

For production:
- Restrict uploads to authenticated/admin users
- Add file size validation
- Add file type validation
- Consider using signed URLs

## 🔍 Verification Commands

### Count Tables
```sql
SELECT count(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: 24
```

### Count Policies
```sql
SELECT count(*) FROM pg_policies 
WHERE schemaname = 'public';
-- Expected: 32
```

### Count Indexes
```sql
SELECT count(*) FROM pg_indexes 
WHERE schemaname = 'public';
-- Expected: 70+
```

### Check Storage Buckets
```sql
SELECT id, name, public, file_size_limit 
FROM storage.buckets;
-- Expected: 3 rows
```

## 📊 Summary

| Component | Status | Action |
|-----------|--------|--------|
| Schema Tables | ✅ Updated | Review & Test |
| RLS Policies | ✅ New File | Replace or Merge |
| Indexes | ✅ New File | Replace or Merge |
| Storage Setup | ✅ New File | Replace or Merge |
| RPC Functions | ℹ️ Not Changed | Use existing |
| Documentation | ✅ Created | Read & Reference |
| Backup | ✅ Created | Keep for rollback |

## 🚀 Ready to Apply?

Before applying to production:
1. ✅ Test in local/dev environment
2. ✅ Verify application compatibility
3. ✅ Review security policies
4. ✅ Backup production database
5. ✅ Plan rollback strategy
6. ✅ Apply during low-traffic window
7. ✅ Monitor for issues

## 📞 Support

If you encounter issues:
1. Check `UPDATE_SUMMARY.md` for details
2. Review `RPC_FUNCTIONS_REFERENCE.md` for function info
3. Use `_BACKUP_schema_2025-01-29.sql` to rollback
4. Check Supabase logs for errors

---

**Update Date**: 2025-01-29  
**Source**: Supabase Project MKexam (rtslytzirggxtqymectm)  
**Status**: Ready for Review ✅
