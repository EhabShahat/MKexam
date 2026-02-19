# RPC Functions Reference

## Overview
Your live Supabase database contains approximately 30 RPC (Remote Procedure Call) functions. These are stored procedures that provide server-side logic for your application.

## Why RPC Functions Weren't Fully Updated
The RPC functions are extensive (many are 50-200+ lines each) and are already defined in your `rpc_functions.sql` file. The live database functions match your local definitions closely, so a full export wasn't necessary for this update.

## Key RPC Functions in Your Database

### Admin Management Functions
| Function | Purpose |
|----------|---------|
| `admin_add_admin_by_email` | Add a new admin by email |
| `admin_create_user` | Create a new user account |
| `admin_delete_student_and_attempts` | Delete student and all attempts |
| `admin_extra_scores_remove_key` | Remove an extra score field |
| `admin_list_admins` | List all admin users |
| `admin_list_attempts` | List attempts for an exam |
| `admin_remove_admin` | Remove admin privileges |
| `admin_reset_student_attempts` | Reset student attempts for exam |

### Exam & Attempt Functions
| Function | Purpose |
|----------|---------|
| `start_attempt` | Begin a new exam attempt |
| `start_attempt_v2` | Alternative attempt starter |
| `submit_attempt` | Submit completed attempt |
| `get_attempt_state` | Get current attempt state |
| `can_student_access_exam` | Check exam access permissions |
| `start_student_exam_attempt` | Start attempt for code-based exam |

### Scoring & Results Functions  
| Function | Purpose |
|----------|---------|
| `calculate_result_for_attempt` | Calculate attempt results |
| `get_pass_fail_stats` | Get pass/fail statistics |
| `calculate_student_global_result` | Calculate overall student result |

### System Functions
| Function | Purpose |
|----------|---------|
| `mark_done_exams` | Auto-archive completed exams |
| `cleanup_expired_attempts` | Remove expired attempts |
| `touch_project` | Keep project alive |
| `log_attempt_activity` | Batch log activity events |

### Utility Functions
| Function | Purpose |
|----------|---------|
| `is_admin` | Check if user is admin (used in RLS) |
| `tg_set_updated_at` | Trigger for updated_at columns |
| `tg_refresh_result_on_manual_grade` | Recalculate results on manual grade |
| `update_updated_at_column` | Generic updated_at trigger |

## Function Characteristics

### Security Definer Functions
Most admin functions use `SECURITY DEFINER` which means they run with elevated privileges. They include:
- Admin validation via `is_admin()`
- Input sanitization
- Error handling

### Search Path
All functions are configured with:
```sql
SET search_path TO 'public', 'extensions', 'pg_temp'
```
This prevents search path manipulation attacks.

## How to Export Full Function Definitions

### Option 1: Using Supabase Dashboard
1. Go to SQL Editor in Supabase Dashboard
2. Run: 
```sql
SELECT pg_get_functiondef(p.oid) 
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY p.proname;
```

### Option 2: Using pg_dump
```bash
pg_dump -h db.rtslytzirggxtqymectm.supabase.co \
  -U postgres \
  -d postgres \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  -t 'pg_proc'
```

### Option 3: Using Supabase CLI
```bash
supabase db dump -f rpc_functions_export.sql
```

## Current Status
✅ Your `rpc_functions.sql` file contains the core functions needed by your application.

⚠️ If you've made changes to functions in the live database (via migrations), you may want to export them to sync your local files.

## Recommended Approach
For ongoing development:
1. Make all function changes via Supabase migrations
2. Keep migrations in version control
3. Use `supabase db pull` to sync local state
4. Apply migrations to production via `supabase db push`

This ensures consistency between local and remote databases.
