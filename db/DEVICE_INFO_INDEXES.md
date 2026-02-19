# Device Info Indexes

This document describes the database indexes added for enhanced device tracking performance.

## Overview

The enhanced device tracking feature stores comprehensive device information in the `device_info` JSONB column of the `exam_attempts` table. To enable efficient querying of this data, we've added specialized indexes.

## Indexes

### 1. All IPs GIN Index
```sql
create index if not exists idx_device_info_all_ips 
on public.exam_attempts using gin ((device_info->'allIPs'));
```

**Purpose**: Enables fast queries on the entire `allIPs` structure.

**Use Cases**:
- Find attempts with a specific server IP
- Query attempts by any IP address (local, public, or server)
- Filter attempts by IP structure

**Example Query**:
```sql
SELECT id, student_name, device_info->'allIPs' as all_ips
FROM exam_attempts
WHERE device_info->'allIPs' @> '{"server": "203.0.113.45"}'::jsonb;
```

### 2. Fingerprint Index
```sql
create index if not exists idx_device_info_fingerprint 
on public.exam_attempts ((device_info->>'fingerprint'));
```

**Purpose**: Enables fast exact-match queries on device fingerprints.

**Use Cases**:
- Link multiple attempts from the same device
- Detect device sharing across students
- Track device usage patterns
- Security analysis

**Example Query**:
```sql
-- Find all attempts from the same device
SELECT id, student_name, device_info->>'fingerprint' as fingerprint
FROM exam_attempts
WHERE device_info->>'fingerprint' = 'abc123def456'
ORDER BY started_at DESC;

-- Count attempts per device
SELECT 
  device_info->>'fingerprint' as fingerprint,
  COUNT(*) as attempt_count,
  array_agg(DISTINCT student_name) as students
FROM exam_attempts
WHERE device_info->>'fingerprint' IS NOT NULL
GROUP BY device_info->>'fingerprint'
HAVING COUNT(*) > 1;
```

### 3. Local IPs GIN Index (Optional)
```sql
create index if not exists idx_device_info_local_ips 
on public.exam_attempts using gin ((device_info->'allIPs'->'local'));
```

**Purpose**: Enables fast queries specifically on local IP addresses.

**Use Cases**:
- Find attempts from a specific local network
- Detect multiple students on the same local network
- Network-based security analysis

**Example Query**:
```sql
SELECT id, student_name, device_info->'allIPs'->'local' as local_ips
FROM exam_attempts
WHERE device_info->'allIPs'->'local' @> '[{"ip": "192.168.1.100"}]'::jsonb;
```

### 4. Public IPs GIN Index (Optional)
```sql
create index if not exists idx_device_info_public_ips 
on public.exam_attempts using gin ((device_info->'allIPs'->'public'));
```

**Purpose**: Enables fast queries specifically on public IP addresses.

**Use Cases**:
- Find attempts from a specific public IP
- Geographic analysis
- ISP-based filtering

**Example Query**:
```sql
SELECT id, student_name, device_info->'allIPs'->'public' as public_ips
FROM exam_attempts
WHERE device_info->'allIPs'->'public' @> '[{"ip": "203.0.113.45"}]'::jsonb;
```

## Index Types

### GIN (Generalized Inverted Index)
Used for JSONB columns to enable efficient containment queries (`@>` operator).

**Advantages**:
- Fast for complex JSONB queries
- Supports containment operations
- Efficient for nested structures

**Trade-offs**:
- Larger index size
- Slower writes (index updates)
- Best for read-heavy workloads

### B-tree Index
Used for the fingerprint field (text extraction from JSONB).

**Advantages**:
- Fast exact-match queries
- Efficient for equality and range queries
- Smaller index size

**Trade-offs**:
- Only works for exact matches
- Requires text extraction from JSONB

## Performance Considerations

### Query Performance
With these indexes:
- Fingerprint queries: O(log n) instead of O(n)
- IP containment queries: O(log n) instead of O(n)
- Grouped fingerprint queries: Significantly faster

### Storage Impact
- Each GIN index: ~2-3x the size of the indexed data
- B-tree index: ~1-2x the size of the indexed data
- Total additional storage: Estimated 5-10% of table size

### Write Performance
- GIN indexes add overhead to INSERT/UPDATE operations
- Estimated 10-20% slower writes
- Acceptable trade-off for read-heavy exam application

## Testing

### Apply Indexes
```bash
# Via psql
psql -h your-host -U your-user -d your-db -f db/indexes.sql

# Via Supabase Dashboard
# SQL Editor > New Query > Paste contents of indexes.sql > Run
```

### Test Performance
```bash
# Run test queries
psql -h your-host -U your-user -d your-db -f db/test_device_info_indexes.sql

# Run programmatic tests
node db/test_indexes.js
```

### Verify Indexes
```sql
-- Check if indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'exam_attempts'
  AND indexname LIKE '%device_info%';

-- Check index usage
SELECT 
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'exam_attempts'
  AND indexname LIKE '%device_info%';
```

## Maintenance

### Reindex (if needed)
```sql
-- Reindex all device_info indexes
REINDEX INDEX CONCURRENTLY idx_device_info_all_ips;
REINDEX INDEX CONCURRENTLY idx_device_info_fingerprint;
REINDEX INDEX CONCURRENTLY idx_device_info_local_ips;
REINDEX INDEX CONCURRENTLY idx_device_info_public_ips;
```

### Monitor Performance
```sql
-- Check index bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename = 'exam_attempts'
  AND indexname LIKE '%device_info%';
```

## Migration Notes

### Backward Compatibility
- Indexes are created with `IF NOT EXISTS`
- Safe to run multiple times
- No impact on existing queries
- Old device_info records without new fields still work

### Rollback
If indexes cause issues, they can be dropped:
```sql
DROP INDEX IF EXISTS idx_device_info_all_ips;
DROP INDEX IF EXISTS idx_device_info_fingerprint;
DROP INDEX IF EXISTS idx_device_info_local_ips;
DROP INDEX IF EXISTS idx_device_info_public_ips;
```

## References

- PostgreSQL JSONB Indexing: https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING
- GIN Indexes: https://www.postgresql.org/docs/current/gin.html
- Supabase Performance: https://supabase.com/docs/guides/database/performance
