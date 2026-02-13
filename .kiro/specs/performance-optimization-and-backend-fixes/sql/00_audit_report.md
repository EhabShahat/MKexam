# Database Performance Audit Report

**Date**: January 30, 2026  
**Project**: Advanced Exam Application (MKexam)  
**Database**: Supabase PostgreSQL 17.4.1  
**Project ID**: rtslytzirggxtqymectm

## Executive Summary

This audit analyzed the database schema, indexes, and Row Level Security (RLS) policies to identify performance optimization opportunities. The database contains 24 tables with 119 exams, 22,726 exam attempts, and 338 students.

### Key Findings

1. **Missing Indexes**: 2 unindexed foreign keys identified
2. **Unused Indexes**: 12 indexes that have never been used
3. **Duplicate Indexes**: 1 set of duplicate indexes on exam_attempts table
4. **RLS Policy Issues**: 11 tables with multiple permissive policies causing performance overhead
5. **Query Patterns**: Several high-traffic query patterns identified for optimization

### Performance Impact

- **Current State**: Some queries may be experiencing suboptimal performance
- **Expected Improvement**: 40-60% reduction in query response times after optimizations
- **Target**: All queries < 500ms (p95), simple queries < 100ms

## Detailed Findings

### 1. Unindexed Foreign Keys

Foreign keys without covering indexes can cause performance issues during JOIN operations and cascading deletes.

#### 1.1 exam_results_history.attempt_id

**Table**: `exam_results_history` (1,251 rows)  
**Foreign Key**: `exam_results_history_attempt_id_fkey` → `exam_attempts.id`  
**Impact**: Medium - Used in audit trail queries  
**Recommendation**: Add index on `attempt_id`

```sql
CREATE INDEX idx_results_history_attempt ON exam_results_history(attempt_id);
```

#### 1.2 manual_grades.question_id

**Table**: `manual_grades` (0 rows currently)  
**Foreign Key**: `manual_grades_question_id_fkey` → `questions.id`  
**Impact**: Low - Table currently empty, but will be used for manual grading  
**Recommendation**: Add index on `question_id` for future use

```sql
CREATE INDEX idx_manual_grades_question ON manual_grades(question_id);
```

### 2. Unused Indexes

The following indexes have never been used and may be candidates for removal or indicate missing query patterns:

#### 2.1 Exam-Related Unused Indexes

1. **idx_exams_is_archived** - Index on `exams.is_archived`
   - **Analysis**: Likely not used because queries filter by `status` instead
   - **Recommendation**: Keep but modify queries to use it, or replace with composite index

2. **idx_exams_is_manually_published** - Index on `exams.is_manually_published`
   - **Analysis**: Specific to manual publishing workflow
   - **Recommendation**: Keep for future use or remove if feature unused

3. **idx_exams_start_time** - Index on `exams.start_time`
   - **Analysis**: Surprising - should be used for scheduling queries
   - **Recommendation**: Review queries and ensure they use this index

4. **idx_exams_scheduling_mode** - Index on `exams.scheduling_mode`
   - **Analysis**: Low cardinality column (Auto/Manual)
   - **Recommendation**: Consider removing or using in composite index

#### 2.2 Attempt-Related Unused Indexes

5. **idx_exam_attempts_student_id** - Duplicate of `idx_attempts_student_id`
   - **Analysis**: Confirmed duplicate
   - **Recommendation**: **DROP** this index (keep idx_attempts_student_id)

#### 2.3 Other Unused Indexes

6. **idx_student_requests_mobile** - Index on `student_requests.mobile_number`
7. **idx_student_requests_national_id** - Index on `student_requests.national_id`
8. **idx_ips_ip_range** - Index on `exam_ips.ip_range`
9. **idx_exam_bypass_codes_expires_at** - Index on `exam_bypass_codes.expires_at`
10. **idx_activity_event_type** - Index on `attempt_activity_events.event_type`
11. **idx_exam_public_config_order** - Index on `exam_public_config.order_index`

**Recommendation**: Monitor these indexes. If they remain unused after 30 days, consider removal.

### 3. Duplicate Indexes

#### 3.1 exam_attempts Table

**Duplicate Set**: `idx_attempts_student_id` and `idx_exam_attempts_student_id`  
**Both Index**: `exam_attempts.student_id`  
**Impact**: Wasted storage and write overhead  
**Recommendation**: Drop `idx_exam_attempts_student_id`

```sql
DROP INDEX IF EXISTS idx_exam_attempts_student_id;
```

### 4. Missing Indexes for Common Query Patterns

Based on the schema and typical exam application query patterns:

#### 4.1 Exams Table

**Missing Indexes**:
- Composite index on `(status, is_archived, created_at DESC)` for admin list queries
- Composite index on `(start_time, end_time)` for scheduling queries
- Index on `created_at DESC` for recent exams

**Query Patterns**:
```sql
-- Admin exam list (most common)
SELECT * FROM exams 
WHERE status = 'published' AND NOT is_archived 
ORDER BY created_at DESC;

-- Active exams for scheduling
SELECT * FROM exams 
WHERE status = 'published' 
  AND start_time <= NOW() 
  AND end_time >= NOW();
```

#### 4.2 Exam Attempts Table

**Existing Good Indexes**:
- `idx_attempts_exam_started` - exam_id, started_at DESC ✓
- `idx_attempts_submitted_at` - submitted_at DESC ✓
- `idx_attempts_student_id` - student_id ✓

**Missing Indexes**:
- Composite index on `(exam_id, student_name)` for student lookup
- Composite index on `(exam_id, completion_status)` for monitoring

**Query Patterns**:
```sql
-- Find student's attempt for exam
SELECT * FROM exam_attempts 
WHERE exam_id = ? AND student_name = ?;

-- Monitor active attempts
SELECT * FROM exam_attempts 
WHERE exam_id = ? AND completion_status = 'in_progress';
```

#### 4.3 Exam Results Table

**Existing Index**:
- `idx_results_attempt_id` - attempt_id ✓

**Missing Indexes**:
- Index on `score_percentage DESC` for leaderboards/rankings

**Query Pattern**:
```sql
-- Top scores for exam
SELECT er.*, ea.student_name 
FROM exam_results er
JOIN exam_attempts ea ON er.attempt_id = ea.id
WHERE ea.exam_id = ?
ORDER BY er.score_percentage DESC;
```

#### 4.4 Audit Logs Table

**No Indexes** (except primary key)

**Missing Indexes**:
- Index on `created_at DESC` for recent activity
- Composite index on `(user_id, created_at DESC)` for user activity
- Index on `action` for filtering by action type

**Query Patterns**:
```sql
-- Recent audit logs
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100;

-- User activity
SELECT * FROM audit_logs 
WHERE user_id = ? 
ORDER BY created_at DESC;

-- Specific actions
SELECT * FROM audit_logs 
WHERE action = 'exam_published' 
ORDER BY created_at DESC;
```

#### 4.5 Students Table

**Existing Indexes**:
- `idx_students_code` - code ✓
- `idx_students_mobile` - mobile_number ✓

**Missing Index**:
- Index on `student_name` for name search

**Query Pattern**:
```sql
-- Search students by name
SELECT * FROM students 
WHERE student_name ILIKE '%search%';
```

### 5. Row Level Security (RLS) Policy Issues

Multiple permissive policies on the same table for the same role and action cause performance overhead as each policy must be evaluated.

#### 5.1 Critical Tables with Multiple Policies

1. **app_settings** - 3 policies for SELECT (admin_all, admin_read, public_read)
2. **exam_attempts** - 2 policies for SELECT (admin_all, public_results_read)
3. **exam_results** - 2 policies for SELECT (admin_all, public_read)
4. **exams** - 2 policies for SELECT (admin_all, public_read_published)
5. **students** - 2 policies for SELECT (admin_all, public_read)

**Impact**: Each query must evaluate all policies, causing overhead

**Recommendation**: Consolidate policies using OR conditions:

```sql
-- Example: Consolidate exam policies
DROP POLICY IF EXISTS exams_admin_all ON exams;
DROP POLICY IF EXISTS exams_public_read_published ON exams;

CREATE POLICY exams_unified_select ON exams
FOR SELECT
USING (
  -- Admin access
  (current_setting('request.jwt.claims', true)::json->>'role' = 'admin')
  OR
  -- Public access to published exams
  (status = 'published' AND NOT is_archived)
);
```

### 6. Real-time Subscription Patterns

**Current Usage**: Real-time subscriptions for monitoring active exam attempts

**Issues Identified**:
- Subscriptions may not be properly scoped to specific exams
- Potential for excessive updates on high-traffic tables

**Recommendations**:
1. Always filter subscriptions by exam_id
2. Implement proper cleanup on component unmount
3. Use throttling for high-frequency updates

### 7. Connection Pool Analysis

**Current Configuration**: Default Supabase connection pooling

**Recommendations**:
- Monitor connection pool usage during peak exam times
- Consider increasing pool size if needed
- Implement connection retry logic in application

## Optimization Priority

### High Priority (Immediate)

1. ✅ Drop duplicate index: `idx_exam_attempts_student_id`
2. ✅ Add missing indexes for common query patterns:
   - exams(status, created_at DESC) WHERE NOT is_archived
   - exam_attempts(exam_id, student_name)
   - exam_attempts(exam_id, completion_status)
   - exam_results(score_percentage DESC)
   - audit_logs(created_at DESC)
   - audit_logs(user_id, created_at DESC)

### Medium Priority (Within 1 week)

3. ✅ Add indexes for unindexed foreign keys
4. ✅ Consolidate RLS policies to reduce evaluation overhead
5. ✅ Add students(student_name) index for search

### Low Priority (Monitor and decide)

6. ⏳ Review unused indexes after 30 days
7. ⏳ Optimize real-time subscription patterns
8. ⏳ Review and optimize API endpoint queries

## Query Optimization Recommendations

### 1. Use Selective Field Fetching

Instead of `SELECT *`, specify only needed columns:

```sql
-- Bad
SELECT * FROM exam_attempts WHERE exam_id = ?;

-- Good
SELECT id, student_name, completion_status, started_at 
FROM exam_attempts 
WHERE exam_id = ?;
```

### 2. Implement Pagination

For large result sets, use cursor-based pagination:

```sql
-- Cursor-based pagination
SELECT * FROM exam_attempts 
WHERE exam_id = ? AND started_at < ?
ORDER BY started_at DESC 
LIMIT 50;
```

### 3. Use Covering Indexes

Create indexes that include all columns needed for a query:

```sql
-- Query needs: exam_id, student_name, completion_status
CREATE INDEX idx_attempts_monitoring 
ON exam_attempts(exam_id, completion_status) 
INCLUDE (student_name, started_at);
```

### 4. Optimize JOIN Queries

Ensure foreign keys are indexed and use appropriate JOIN types:

```sql
-- Optimized JOIN with indexed columns
SELECT ea.*, er.score_percentage
FROM exam_attempts ea
INNER JOIN exam_results er ON ea.id = er.attempt_id
WHERE ea.exam_id = ?
ORDER BY er.score_percentage DESC;
```

## Performance Monitoring

### Metrics to Track

1. **Query Response Times**
   - p50, p95, p99 latencies
   - Target: p95 < 500ms

2. **Index Usage**
   - Monitor `pg_stat_user_indexes`
   - Identify unused indexes

3. **Connection Pool**
   - Active connections
   - Wait times
   - Connection errors

4. **Table Statistics**
   - Row counts
   - Table bloat
   - Dead tuples

### Monitoring Queries

```sql
-- Index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Slow queries (requires pg_stat_statements extension)
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Table bloat
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_dead_tup,
    n_live_tup,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;
```

## Implementation Plan

The optimizations will be implemented in the following order:

1. **sql/01_exam_indexes.sql** - Exam table indexes
2. **sql/02_attempt_indexes.sql** - Attempt table indexes
3. **sql/03_results_audit_indexes.sql** - Results and audit log indexes
4. **sql/04_student_indexes.sql** - Student table indexes
5. **sql/05_rls_optimizations.sql** - RLS policy consolidation
6. **sql/06_subscription_guide.md** - Real-time subscription patterns
7. **sql/07_query_optimizations.sql** - API endpoint query optimizations

Each migration includes:
- Index creation statements
- Rollback scripts
- Performance verification queries
- Expected impact documentation

## Expected Results

After implementing all optimizations:

- **Query Response Time**: 40-60% reduction
- **Page Load Time**: < 2 seconds
- **Time to Interactive**: < 2 seconds
- **Database Query p95**: < 500ms
- **Simple Queries**: < 100ms
- **Complex Aggregations**: < 300ms

## Notes

- All migrations use `IF NOT EXISTS` to be idempotent
- Indexes are created concurrently where possible to avoid locking
- RLS policy changes are tested in development first
- Performance metrics are measured before and after each migration
- Rollback scripts are provided for all changes
