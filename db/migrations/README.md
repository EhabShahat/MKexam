# Database Migrations

This folder contains database migration scripts for the staged exam system and other features.

## How to Apply Migrations

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and execute in the SQL Editor

## Migration Files

### 001_staged_exam_system.sql
- **Date**: 2026-02-09
- **Feature**: Staged Exam System
- **Description**: Creates `exam_stages` and `attempt_stage_progress` tables, updates RPC functions
- **Status**: ✅ Applied

### 002_fix_calculate_result_scalar_handling.sql
- **Date**: 2026-02-09
- **Feature**: Results Calculation Fix
- **Description**: Fixes `calculate_result_for_attempt` RPC to handle both array and scalar `correct_answers` values
- **Status**: ⚠️ Needs to be applied manually
- **Why**: This fixes a pre-existing bug where the function would fail with "cannot extract elements from a scalar" error

## Applying Migration 002

To apply migration 002, run the following command or execute the SQL manually:

```bash
# Option 1: Use the Supabase SQL Editor (Recommended)
# 1. Open https://supabase.com/dashboard/project/YOUR_PROJECT/sql
# 2. Copy contents of db/migrations/002_fix_calculate_result_scalar_handling.sql
# 3. Paste and execute

# Option 2: If you have psql access
psql $DATABASE_URL < db/migrations/002_fix_calculate_result_scalar_handling.sql
```

## Verification

After applying migration 002, verify it works by running the tests:

```bash
npm test -- --run src/__tests__/integration/stagedExamSystem.pbt.test.ts
```

All tests should pass, including the results calculation tests.
