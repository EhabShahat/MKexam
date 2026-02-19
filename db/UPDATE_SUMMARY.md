# Database Update Summary - 2025-01-29

## Overview
Updated local SQL files from live Supabase database (Project: MKexam, ID: rtslytzirggxtqymectm)

## Files Created/Updated

### 1. `schema.sql` ✅ UPDATED
- Added missing tables to base schema:
  - `exam_bypass_codes` - Bypass codes for exam access
  - `blocked_entries` - Blocked mobile/national IDs
  - `student_requests` - Student registration requests
  - `app_settings` - Application settings (new comprehensive structure)
  - `extra_score_fields` - Configurable extra score fields
  - `extra_scores` - Student extra scores data
  - `exam_public_config` - Public exam configuration
  - `attendance_records` - Student attendance tracking
  - `keep_alive` - Project wake-up table
- Updated `exams` table with new columns:
  - `scheduling_mode`, `is_manually_published`, `is_archived`, `archived_at`, `status_note`
- Updated `questions` table with:
  - `auto_grade_on_answer` boolean column
- Updated `attempt_activity_events` table:
  - Changed `event_data` to `event_time` + `payload`

### 2. `security_UPDATED.sql` ✅ NEW FILE
Complete RLS policies from live database including:
- Admin-only policies for all management tables
- Public read policies for published content
- Student request policies (authenticated + public insert)
- Updated `is_admin()` function
- Recreated `student_exam_summary` view with all fields

### 3. `indexes_UPDATED.sql` ✅ NEW FILE
All indexes from live database including:
- Core table indexes (exams, questions, attempts)
- Performance indexes for student lookups
- Activity event indexes
- Attendance and blocked entries indexes
- Extra scores indexes

### 4. `storage_setup_UPDATED.sql` ✅ NEW FILE
Current storage buckets:
- **logos** - 5MB, images only
- **question-images** - 5MB, images only  
- **student-files** - 10MB, images + PDFs

### 5. `_BACKUP_schema_2025-01-29.sql` ✅ BACKUP
Backup of original schema.sql before updates

## Database Statistics (Live)
- **Total Tables**: 24 (public schema)
- **Total Migrations**: 78
- **Total RPC Functions**: ~30
- **Storage Buckets**: 3

## Key Tables Summary

### Core Exam Tables
- `exams` - Exam definitions with scheduling
- `questions` - Exam questions with image support
- `exam_attempts` - Student attempt records
- `exam_results` - Calculated results
- `exam_results_history` - Audit trail for results

### Student Tables
- `students` - Global student registry
- `student_exam_attempts` - Per-exam attempt tracking
- `student_requests` - Registration requests
- `attendance_records` - Attendance tracking

### Configuration Tables
- `app_settings` - Application settings
- `app_config` - System configuration  
- `exam_public_config` - Public exam display config
- `extra_score_fields` - Custom score field definitions
- `extra_scores` - Student extra scores

### Access Control Tables
- `exam_ips` - IP-based access rules
- `exam_bypass_codes` - Bypass codes
- `blocked_entries` - Blocked identifiers

### Admin Tables
- `users` - User accounts
- `admin_users` - Admin privileges
- `audit_logs` - System audit trail

### Grading Tables
- `manual_grades` - Manual grading records

### Activity Tables
- `attempt_activity_events` - Activity tracking

## Major RPC Functions (Not exported to SQL)
The database contains approximately 30 RPC functions. Key ones include:
- `admin_*` functions - Admin management operations
- `start_attempt` - Begin exam attempt
- `submit_attempt` - Submit exam
- `calculate_result_for_attempt` - Result calculation
- `can_student_access_exam` - Access validation
- `mark_done_exams` - Auto-archival
- `cleanup_expired_attempts` - Cleanup job
- `get_pass_fail_stats` - Statistics

## Next Steps

### To Apply Updates Locally:
1. Review the new files: `security_UPDATED.sql`, `indexes_UPDATED.sql`, `storage_setup_UPDATED.sql`
2. Replace old files or run the updated versions
3. Test that schema changes are compatible with your application

### To Export RPC Functions:
If you need the full RPC function definitions, you can:
1. Use Supabase MCP `mcp2_execute_sql` to export specific functions
2. Use `pg_dump` with `--schema-only` option
3. Copy from Supabase dashboard SQL editor

### To Keep In Sync:
Consider setting up a migration workflow:
1. Use Supabase CLI for local development
2. Create migrations for schema changes
3. Apply migrations to production via CI/CD

## Database Connection Info
- **Project**: MKexam
- **Project ID**: rtslytzirggxtqymectm
- **Region**: eu-central-2
- **Status**: ACTIVE_HEALTHY
- **Postgres Version**: 17.4.1.069

## Important Notes
⚠️ The live database has 78 migrations. Your local SQL files are now synchronized with the current state but do not include the individual migration history.

⚠️ Storage policies are currently permissive (public upload/delete). Consider restricting to admin-only in production.

⚠️ Some RPC functions use `SECURITY DEFINER` - ensure proper input validation.
