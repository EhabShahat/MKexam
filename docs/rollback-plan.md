# Rollback Plan: Supabase & Netlify Cost Optimization

## Overview

This document provides comprehensive rollback procedures for the Supabase & Netlify cost optimization features. Use this guide if optimization features cause issues in production or if metrics don't meet expectations.

## Quick Reference

| Component | Rollback Method | Estimated Time | Risk Level |
|-----------|----------------|----------------|------------|
| Compression | Environment variable | 5 minutes | Low |
| Caching | Environment variable | 5 minutes | Low |
| Field Selection | Use legacy RPC | 10 minutes | Low |
| JSONB Optimization | Database flag | 15 minutes | Medium |
| Materialized Views | Switch to original tables | 20 minutes | Medium |
| ISR Configuration | Code deployment | 30 minutes | Low |
| Batch Processing | Database flag | 15 minutes | Medium |

## Monitoring Thresholds

Rollback should be considered if any of these thresholds are exceeded:

- **Error Rate**: > 2% increase from baseline
- **Response Time**: > 50% increase in p95 latency
- **Cache Corruption**: > 0.1% of cache operations
- **Data Integrity**: Any data loss or corruption
- **User Complaints**: > 5 reports of issues within 1 hour

## Feature Flags

All optimization features can be controlled via environment variables:

```bash
# .env.local or Netlify environment variables

# Master switch - disables all optimizations
DISABLE_ALL_OPTIMIZATIONS=false

# Individual feature flags
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
ENABLE_FIELD_SELECTION=true
ENABLE_JSONB_OPTIMIZATION=true
ENABLE_MATERIALIZED_VIEWS=true
ENABLE_ISR=true
ENABLE_BATCH_PROCESSING=true
ENABLE_INCREMENTAL_LOADING=true
ENABLE_VIRTUAL_SCROLLING=true

# Cache configuration
CACHE_TTL_EXAM=300        # 5 minutes
CACHE_TTL_QUESTIONS=-1    # Infinite
CACHE_TTL_STUDENT=600     # 10 minutes
CACHE_TTL_CONFIG=1800     # 30 minutes

# Compression settings
COMPRESSION_THRESHOLD=1024  # 1KB
COMPRESSION_ALGORITHM=gzip  # gzip or brotli

# Performance thresholds
MAX_ERROR_RATE=0.02        # 2%
MAX_RESPONSE_TIME_MS=5000  # 5 seconds
```

## Rollback Procedures

### 1. Emergency Full Rollback

**When to use**: Critical production issues, data corruption, or widespread errors

**Steps**:

1. Set master switch in Netlify environment:
   ```bash
   DISABLE_ALL_OPTIMIZATIONS=true
   ```

2. Trigger immediate deployment:
   ```bash
   netlify deploy --prod
   ```

3. Clear all caches:
   ```bash
   curl -X POST https://your-domain.com/api/admin/cache/clear \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

4. Monitor error rates and response times for 15 minutes

5. If issues persist, proceed to database rollback (Section 2)

**Estimated Time**: 10-15 minutes
**Impact**: Returns to pre-optimization performance

---

### 2. Database Rollback

**When to use**: Data integrity issues, materialized view problems, or RPC function errors

**Steps**:

1. Connect to Supabase database:
   ```bash
   psql $DATABASE_URL
   ```

2. Disable materialized views:
   ```sql
   -- Switch admin_list_attempts to use original tables
   CREATE OR REPLACE FUNCTION public.admin_list_attempts_v2(
     p_exam_id uuid,
     p_limit integer DEFAULT 50,
     p_offset integer DEFAULT 0,
     p_fields jsonb DEFAULT NULL
   )
   RETURNS TABLE(...) AS $$
   BEGIN
     -- Use original tables instead of materialized view
     RETURN QUERY
     SELECT ... FROM public.exam_attempts a
     LEFT JOIN public.students s ON s.id = a.student_id
     LEFT JOIN public.exam_results er ON er.attempt_id = a.id
     WHERE a.exam_id = p_exam_id
     ORDER BY a.started_at DESC
     LIMIT p_limit OFFSET p_offset;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. Disable JSONB optimization:
   ```sql
   -- Add flag to disable optimization
   UPDATE public.app_config
   SET value = 'false'
   WHERE key = 'enable_jsonb_optimization';
   ```

4. Revert to original RPC functions:
   ```sql
   -- Use get_attempt_state instead of get_attempt_state_v2
   -- Update application code to call original function
   ```

5. Verify data integrity:
   ```sql
   -- Check for any corrupted data
   SELECT COUNT(*) FROM public.exam_attempts
   WHERE answers IS NULL OR device_info IS NULL;
   ```

**Estimated Time**: 20-30 minutes
**Impact**: Returns to original database performance

---

### 3. Compression Rollback

**When to use**: Compression errors, decompression failures, or increased error rates

**Steps**:

1. Disable compression:
   ```bash
   ENABLE_COMPRESSION=false
   ```

2. Deploy changes:
   ```bash
   netlify deploy --prod
   ```

3. Clear compressed cache entries:
   ```typescript
   // Run via admin API or script
   import { caches } from '@/lib/cache';
   
   caches.exam.clear();
   caches.questions.clear();
   caches.general.clear();
   ```

4. Monitor for 10 minutes to ensure errors stop

**Estimated Time**: 10 minutes
**Impact**: Increased bandwidth usage, no data loss

---

### 4. Caching Rollback

**When to use**: Cache corruption, stale data issues, or cache-related errors

**Steps**:

1. Disable caching:
   ```bash
   ENABLE_CACHING=false
   ```

2. Clear all caches immediately:
   ```bash
   curl -X POST https://your-domain.com/api/admin/cache/clear-all \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. Deploy changes:
   ```bash
   netlify deploy --prod
   ```

4. Monitor database load (expect increase)

5. If database load is too high, re-enable caching with shorter TTLs:
   ```bash
   ENABLE_CACHING=true
   CACHE_TTL_EXAM=60      # 1 minute instead of 5
   CACHE_TTL_QUESTIONS=300 # 5 minutes instead of infinite
   ```

**Estimated Time**: 10-15 minutes
**Impact**: Increased database queries, slower response times

---

### 5. Field Selection Rollback

**When to use**: Missing data in responses, field selection errors

**Steps**:

1. Update API routes to use original RPC functions:
   ```typescript
   // Before (optimized)
   const { data } = await supabase.rpc('get_attempt_state_v2', {
     p_attempt_id: attemptId,
     p_fields: ['exam', 'questions', 'answers']
   });

   // After (rollback)
   const { data } = await supabase.rpc('get_attempt_state', {
     p_attempt_id: attemptId
   });
   ```

2. Deploy code changes:
   ```bash
   git commit -am "Rollback: Use original RPC functions"
   git push origin main
   ```

3. Verify all data is returned correctly

**Estimated Time**: 15-20 minutes
**Impact**: Increased bandwidth, no functionality loss

---

### 6. ISR Rollback

**When to use**: Stale page content, ISR revalidation issues

**Steps**:

1. Disable ISR in exam pages:
   ```typescript
   // app/exam/[examId]/page.tsx
   // Remove or comment out:
   // export const revalidate = 60;
   
   // Add:
   export const dynamic = 'force-dynamic';
   ```

2. Deploy changes:
   ```bash
   git commit -am "Rollback: Disable ISR for exam pages"
   git push origin main
   ```

3. Clear CDN cache:
   ```bash
   netlify api clearCache
   ```

**Estimated Time**: 15 minutes
**Impact**: Increased function execution time

---

### 7. Incremental Loading Rollback

**When to use**: Question loading issues, incomplete exam data

**Steps**:

1. Disable incremental loading:
   ```bash
   ENABLE_INCREMENTAL_LOADING=false
   ```

2. Update exam attempt page to load all questions at once:
   ```typescript
   // Before (optimized)
   const { data: initialQuestions } = await loadInitialQuestions(examId, 5);
   
   // After (rollback)
   const { data: allQuestions } = await loadAllQuestions(examId);
   ```

3. Deploy changes

**Estimated Time**: 15 minutes
**Impact**: Slower initial load, all questions loaded upfront

---

## Verification Checklist

After any rollback, verify the following:

- [ ] Error rate returns to baseline (< 1%)
- [ ] Response times are acceptable (p95 < 2s)
- [ ] No data corruption or loss
- [ ] All exam features work correctly
- [ ] Student can take exams without issues
- [ ] Admin can view results and monitor exams
- [ ] Cache operations are stable
- [ ] Database queries complete successfully
- [ ] No increase in user complaints

## Post-Rollback Actions

1. **Document the Issue**:
   - Record what went wrong
   - Capture error logs and metrics
   - Note which rollback procedure was used

2. **Notify Stakeholders**:
   - Inform team of rollback
   - Provide status update to users if needed
   - Schedule post-mortem meeting

3. **Investigate Root Cause**:
   - Analyze logs and metrics
   - Identify what triggered the rollback
   - Determine if issue was code, config, or data

4. **Plan Fix**:
   - Create fix for identified issue
   - Test thoroughly in staging
   - Plan gradual re-deployment

5. **Update Documentation**:
   - Add issue to known issues list
   - Update rollback procedures if needed
   - Document lessons learned

## Gradual Re-deployment

After fixing issues, re-deploy optimizations gradually:

1. **Week 1**: Enable compression only
2. **Week 2**: Add caching with short TTLs
3. **Week 3**: Enable field selection
4. **Week 4**: Enable JSONB optimization
5. **Week 5**: Enable materialized views
6. **Week 6**: Enable remaining features

Monitor metrics closely at each stage.

## Support Contacts

- **Technical Lead**: [Contact Info]
- **Database Admin**: [Contact Info]
- **DevOps**: [Contact Info]
- **On-Call Engineer**: [Contact Info]

## Related Documentation

- [Performance Monitoring Dashboard](./performance-monitoring.md)
- [Cache Security Implementation](./cache-security-implementation.md)
- [Backward Compatibility Guide](./backward-compatibility-implementation.md)
- [API Migration Guide](./api-migration-guide.md)

---

**Last Updated**: 2024-02-19
**Version**: 1.0
**Owner**: Development Team
