-- Test script for device_info indexes
-- This script tests the performance and functionality of the new indexes

-- Test 1: Query attempts by fingerprint
-- This should use idx_device_info_fingerprint
EXPLAIN ANALYZE
SELECT id, student_name, device_info->>'fingerprint' as fingerprint
FROM exam_attempts
WHERE device_info->>'fingerprint' = 'abc123def456';

-- Test 2: Query attempts with specific local IP
-- This should use idx_device_info_local_ips (GIN index)
EXPLAIN ANALYZE
SELECT id, student_name, device_info->'allIPs'->'local' as local_ips
FROM exam_attempts
WHERE device_info->'allIPs'->'local' @> '[{"ip": "192.168.1.100"}]'::jsonb;

-- Test 3: Query attempts with any IP in allIPs structure
-- This should use idx_device_info_all_ips (GIN index)
EXPLAIN ANALYZE
SELECT id, student_name, device_info->'allIPs' as all_ips
FROM exam_attempts
WHERE device_info->'allIPs' @> '{"server": "203.0.113.45"}'::jsonb;

-- Test 4: Find all attempts from the same device (by fingerprint)
-- This should use idx_device_info_fingerprint
EXPLAIN ANALYZE
SELECT 
  id,
  student_name,
  device_info->>'fingerprint' as fingerprint,
  device_info->>'friendlyName' as device_name,
  started_at
FROM exam_attempts
WHERE device_info->>'fingerprint' IS NOT NULL
  AND device_info->>'fingerprint' = (
    SELECT device_info->>'fingerprint'
    FROM exam_attempts
    WHERE id = 'some-attempt-id'
    LIMIT 1
  )
ORDER BY started_at DESC;

-- Test 5: Count attempts per fingerprint (device tracking)
-- This should use idx_device_info_fingerprint
EXPLAIN ANALYZE
SELECT 
  device_info->>'fingerprint' as fingerprint,
  COUNT(*) as attempt_count,
  array_agg(DISTINCT student_name) as students
FROM exam_attempts
WHERE device_info->>'fingerprint' IS NOT NULL
GROUP BY device_info->>'fingerprint'
HAVING COUNT(*) > 1
ORDER BY attempt_count DESC;

-- Test 6: Find attempts with specific public IP
-- This should use idx_device_info_public_ips (GIN index)
EXPLAIN ANALYZE
SELECT id, student_name, device_info->'allIPs'->'public' as public_ips
FROM exam_attempts
WHERE device_info->'allIPs'->'public' @> '[{"ip": "203.0.113.45"}]'::jsonb;

-- Test 7: Check if indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'exam_attempts'
  AND indexname LIKE '%device_info%'
ORDER BY indexname;

-- Test 8: Verify index usage statistics (run after some queries)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'exam_attempts'
  AND indexname LIKE '%device_info%'
ORDER BY indexname;
