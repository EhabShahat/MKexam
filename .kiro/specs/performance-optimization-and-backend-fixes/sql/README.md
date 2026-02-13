# SQL Migrations for Performance Optimization

This directory contains SQL migration scripts for optimizing database performance in the Advanced Exam Application.

## Naming Convention

All migration files follow the naming pattern: `YYYYMMDD_description.sql`

Example: `20260130_exam_indexes.sql`

## Migration Files

The migrations are numbered and should be applied in order:

1. `00_audit_report.md` - Audit findings and analysis
2. `01_exam_indexes.sql` - Indexes for exam queries
3. `02_attempt_indexes.sql` - Indexes for attempt queries
4. `03_results_audit_indexes.sql` - Indexes for results and audit logs
5. `04_student_indexes.sql` - Indexes for student queries
6. `05_rls_optimizations.sql` - RLS policy optimizations
7. `06_subscription_guide.md` - Real-time subscription patterns
8. `07_query_optimizations.sql` - API endpoint query optimizations
9. `apply_all.sql` - **Master script to apply all migrations**
10. `rollback_all.sql` - **Master script to rollback all migrations**

## How to Apply Migrations

### Using Supabase MCP (Recommended)

If you have the Supabase MCP power installed in Kiro:

1. Activate the Supabase power:
   ```
   Ask Kiro: "Activate the supabase power"
   ```

2. Apply all migrations at once (recommended):
   ```
   Ask Kiro: "Use Supabase to execute the SQL in sql/apply_all.sql"
   ```

3. Or apply individual migrations:
   ```
   Ask Kiro: "Use Supabase to execute the SQL in sql/01_exam_indexes.sql"
   ```

4. Rollback if needed:
   ```
   Ask Kiro: "Use Supabase to execute the SQL in sql/rollback_all.sql"
   ```

### Using Supabase Dashboard

1. Log in to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of each migration file
4. Paste and execute in order
5. Verify each migration completes successfully before proceeding

### Using Supabase CLI

```bash
# Apply a single migration
supabase db execute --file sql/01_exam_indexes.sql

# Or use psql directly
psql $DATABASE_URL -f sql/01_exam_indexes.sql
```

### Using Node.js Script

You can use the existing `scripts/apply-sql.js` utility:

```bash
node scripts/apply-sql.js sql/01_exam_indexes.sql
```

## Rollback Scripts

Each migration file has a corresponding rollback script with the suffix `_rollback.sql`.

To rollback a migration:

```sql
-- Example: Rollback exam indexes
DROP INDEX IF EXISTS idx_exams_status;
DROP INDEX IF EXISTS idx_exams_created_at;
DROP INDEX IF EXISTS idx_exams_start_end;
```

## Verification

After applying migrations, verify their effectiveness:

### Check Index Usage

```sql
-- View all indexes on a table
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'exams';

-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Monitor Query Performance

```sql
-- Enable query timing
\timing on

-- Run your queries and observe execution time
SELECT * FROM exams WHERE status = 'published' AND NOT is_archived;

-- View query execution plan
EXPLAIN ANALYZE
SELECT * FROM exams WHERE status = 'published' AND NOT is_archived;
```

### Check RLS Policy Performance

```sql
-- View RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public';
```

## Performance Targets

After applying all migrations, the system should meet these targets:

- **Page load time**: < 2 seconds
- **Time to Interactive**: < 2 seconds
- **Database query response time (p95)**: < 500ms
- **Simple queries**: < 100ms
- **Complex aggregations**: < 300ms

## Monitoring

Use the Supabase dashboard to monitor:

1. **Query Performance**: Database → Query Performance
2. **Index Usage**: Database → Indexes
3. **Connection Pool**: Database → Connection Pooling
4. **Slow Queries**: Database → Logs (filter by slow queries)

## Using in Other Projects

These migration patterns can be adapted for other Next.js + Supabase projects:

1. Review the audit report to understand the optimization approach
2. Adapt index definitions to your schema
3. Modify RLS policies to match your security requirements
4. Update query optimizations for your API endpoints
5. Follow the same naming convention for consistency

## Troubleshooting

### Index Creation Fails

If index creation fails due to existing index:
```sql
-- Use IF NOT EXISTS clause (already included in migrations)
CREATE INDEX IF NOT EXISTS idx_name ON table(column);
```

### RLS Policy Conflicts

If RLS policy updates fail:
```sql
-- Drop existing policy first
DROP POLICY IF EXISTS policy_name ON table_name;

-- Then create the new optimized policy
CREATE POLICY policy_name ON table_name ...;
```

### Performance Not Improved

1. Verify indexes are being used: `EXPLAIN ANALYZE your_query`
2. Check for table bloat: `SELECT * FROM pg_stat_user_tables;`
3. Run `VACUUM ANALYZE` on affected tables
4. Review connection pool settings
5. Check for N+1 query patterns in application code

## Notes

- Always backup your database before applying migrations
- Test migrations in a development environment first
- Monitor query performance before and after migrations
- Keep the audit report updated with new findings
- Document any custom optimizations specific to your use case
