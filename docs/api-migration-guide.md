# API Migration Guide: Legacy to V2 Endpoints

## Overview

As part of our Supabase & Netlify Cost Optimization initiative, we've introduced optimized V2 endpoints that provide better performance, reduced bandwidth usage, and enhanced features like field selection and pagination.

**Legacy endpoints will be removed on February 15, 2025 (30 days from deployment).**

## Migration Timeline

- **Day 0 (January 16, 2025)**: V2 endpoints deployed, legacy endpoints marked as deprecated
- **Day 1-30**: Both legacy and V2 endpoints available, deprecation warnings logged
- **Day 30 (February 15, 2025)**: Legacy endpoints removed, returns 410 Gone status

## Deprecated Endpoints

### 1. Get Attempt State

**Legacy Endpoint (DEPRECATED):**
```
GET /api/legacy/attempts/[attemptId]/state
```

**New Endpoint:**
```
GET /api/attempts/[attemptId]/state-v2
GET /api/attempts/[attemptId]/state?v2=true
```

**Migration Steps:**

1. **Basic Migration** - Replace the endpoint URL:
   ```typescript
   // Before
   const response = await fetch(`/api/legacy/attempts/${attemptId}/state`);
   
   // After
   const response = await fetch(`/api/attempts/${attemptId}/state-v2`);
   ```

2. **With Field Selection** (Optional) - Request only needed fields:
   ```typescript
   // Request only specific fields to reduce bandwidth
   const fields = ['exam', 'questions', 'answers'];
   const response = await fetch(
     `/api/attempts/${attemptId}/state-v2?fields=${fields.join(',')}`
   );
   ```

3. **Advanced Field Selection** - Use JSON format for complex selections:
   ```typescript
   // Include specific fields
   const fields = { include: ['exam', 'questions', 'answers'] };
   const response = await fetch(
     `/api/attempts/${attemptId}/state-v2?fields=${encodeURIComponent(JSON.stringify(fields))}`
   );
   
   // Exclude specific fields
   const fields = { exclude: ['device_info', 'ip_address'] };
   const response = await fetch(
     `/api/attempts/${attemptId}/state-v2?fields=${encodeURIComponent(JSON.stringify(fields))}`
   );
   ```

**Benefits:**
- Automatic response compression (60% bandwidth reduction)
- Field selection to request only needed data
- Faster response times
- Better caching support

---

### 2. Admin List Attempts

**Legacy Endpoint (DEPRECATED):**
```
GET /api/legacy/admin/exams/[examId]/attempts
```

**New Endpoint:**
```
GET /api/admin/exams/[examId]/attempts?v2=true
```

**Migration Steps:**

1. **Basic Migration** - Add v2 query parameter:
   ```typescript
   // Before
   const response = await fetch(`/api/legacy/admin/exams/${examId}/attempts`);
   
   // After
   const response = await fetch(`/api/admin/exams/${examId}/attempts?v2=true`);
   ```

2. **With Pagination** (Recommended) - Reduce initial load time:
   ```typescript
   // Load first 50 attempts
   const response = await fetch(
     `/api/admin/exams/${examId}/attempts?v2=true&limit=50&offset=0`
   );
   
   // Load next 50 attempts
   const response = await fetch(
     `/api/admin/exams/${examId}/attempts?v2=true&limit=50&offset=50`
   );
   ```

3. **With Field Selection** - Request only needed fields:
   ```typescript
   // Request only essential fields
   const fields = ['id', 'student_name', 'started_at', 'completion_status'];
   const response = await fetch(
     `/api/admin/exams/${examId}/attempts?v2=true&fields=${fields.join(',')}`
   );
   ```

4. **Combined Optimization** - Pagination + Field Selection:
   ```typescript
   const fields = ['id', 'student_name', 'started_at', 'completion_status'];
   const response = await fetch(
     `/api/admin/exams/${examId}/attempts?v2=true&limit=50&offset=0&fields=${fields.join(',')}`
   );
   ```

**Benefits:**
- Pagination support for large datasets
- Field selection to reduce bandwidth
- Uses optimized materialized views
- Automatic response compression
- 50% faster query execution

---

## Detecting Deprecation Warnings

### Server-Side Logs

Legacy endpoint usage is logged to the console:
```
[DEPRECATION WARNING] Endpoint "get_attempt_state" is deprecated and will be removed in 25 days (2025-02-15).
```

### Response Headers

Legacy endpoints include deprecation headers:
```http
X-API-Deprecated: true
X-API-Deprecation-Date: 2025-02-15T00:00:00.000Z
X-API-Deprecation-Days: 25
X-API-Deprecation-Info: This endpoint is deprecated and will be removed on 2025-02-15...
Link: </api/docs/migration>; rel="deprecation"
```

### Client-Side Detection

Check for deprecation headers in your API client:
```typescript
const response = await fetch('/api/legacy/attempts/123/state');

if (response.headers.get('X-API-Deprecated') === 'true') {
  const daysRemaining = response.headers.get('X-API-Deprecation-Days');
  console.warn(`Using deprecated endpoint. ${daysRemaining} days until removal.`);
  
  // Optionally notify your monitoring system
  trackDeprecationUsage('get_attempt_state', daysRemaining);
}
```

---

## Backward Compatibility Features

### Automatic Field Selection

If you don't specify fields, V2 endpoints return all fields (same as legacy):
```typescript
// Returns all fields (backward compatible)
const response = await fetch(`/api/attempts/${attemptId}/state-v2`);
```

### Compression Detection

V2 endpoints automatically detect client compression support:
```typescript
// Automatically compressed if client supports it
const response = await fetch(`/api/attempts/${attemptId}/state-v2`, {
  headers: {
    'Accept-Encoding': 'gzip, deflate, br'
  }
});
```

### Uncompressed Legacy Data Handling

V2 endpoints automatically detect and handle both compressed and uncompressed data:

**How it works:**
1. **Detection**: System checks for compression magic bytes (gzip: 0x1f 0x8b)
2. **Automatic Decompression**: Compressed data is decompressed transparently
3. **Legacy Support**: Uncompressed data is read as-is without errors
4. **No Migration Required**: Existing uncompressed data works without changes

**Data Format Support:**
- ✅ New compressed data (gzip/brotli)
- ✅ Legacy uncompressed JSON
- ✅ Mixed environments (some compressed, some not)

**Example:**
```typescript
// Works with both compressed and uncompressed data
const response = await fetch(`/api/attempts/${attemptId}/state-v2`);
const data = await response.json();

// System automatically handles the format
console.log(data.answers); // Works regardless of compression
```

**Monitoring:**
The system logs when legacy uncompressed data is detected:
```
[LEGACY DATA] {
  timestamp: "2025-01-16T10:30:00.000Z",
  table: "exam_attempts",
  field: "answers",
  format: "uncompressed",
  message: "Detected legacy uncompressed data"
}
```

**Gradual Migration:**
- New data is automatically compressed
- Old data remains uncompressed until updated
- No downtime or data migration required
- System handles both formats seamlessly

---

## Testing Your Migration

### 1. Test in Development

```bash
# Test legacy endpoint (should show deprecation warning)
curl -i http://localhost:3000/api/legacy/attempts/123/state

# Test V2 endpoint
curl -i http://localhost:3000/api/attempts/123/state-v2
```

### 2. Compare Responses

```typescript
// Verify responses are equivalent
const legacyResponse = await fetch(`/api/legacy/attempts/${attemptId}/state`);
const v2Response = await fetch(`/api/attempts/${attemptId}/state-v2`);

const legacyData = await legacyResponse.json();
const v2Data = await v2Response.json();

// Should be deeply equal
console.assert(JSON.stringify(legacyData) === JSON.stringify(v2Data));
```

### 3. Monitor Performance

```typescript
// Measure response time improvement
const start = performance.now();
const response = await fetch(`/api/attempts/${attemptId}/state-v2`);
const duration = performance.now() - start;

console.log(`V2 endpoint responded in ${duration}ms`);
```

---

## Common Migration Issues

### Issue 1: Missing v2 Query Parameter

**Problem:** Calling `/api/admin/exams/[examId]/attempts` without `?v2=true` uses the old RPC function.

**Solution:** Always add `?v2=true` to use the optimized version:
```typescript
// Wrong
fetch(`/api/admin/exams/${examId}/attempts`)

// Correct
fetch(`/api/admin/exams/${examId}/attempts?v2=true`)
```

### Issue 2: Invalid Field Selection

**Problem:** Requesting non-existent fields returns an error.

**Solution:** Only request valid fields. See API documentation for available fields.

### Issue 3: Pagination Offset Too Large

**Problem:** Requesting offset beyond available data returns empty results.

**Solution:** Check total count and adjust pagination accordingly:
```typescript
const response = await fetch(
  `/api/admin/exams/${examId}/attempts?v2=true&limit=50&offset=0`
);
const data = await response.json();

// Check if more data is available
if (data.items.length === 50) {
  // Fetch next page
}
```

---

## Cache Bypass for Debugging

V2 endpoints support cache bypass for debugging (admin only):

```typescript
// Bypass cache to get fresh data
const response = await fetch(
  `/api/attempts/${attemptId}/state-v2?nocache=true`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
```

**Note:** Cache bypass is only available for authenticated admin users.

---

## Support

If you encounter issues during migration:

1. Check this migration guide
2. Review server logs for deprecation warnings
3. Test in development environment first
4. Contact support: support@example.com

---

## Rollback Plan

If you encounter critical issues with V2 endpoints:

1. Legacy endpoints remain available for 30 days
2. Report issues immediately to support
3. We can extend the deprecation period if needed
4. Feature flags allow disabling optimizations if necessary

---

## Performance Improvements

Expected improvements after migration:

- **Bandwidth Reduction**: 60% reduction in data transfer
- **Response Time**: 40% faster API responses
- **Initial Load**: 50% faster page loads with pagination
- **Cache Hit Rate**: 80%+ for frequently accessed data

---

## Checklist

- [ ] Identify all code using legacy endpoints
- [ ] Update API calls to use V2 endpoints
- [ ] Add field selection where appropriate
- [ ] Implement pagination for large datasets
- [ ] Test in development environment
- [ ] Monitor deprecation headers in production
- [ ] Update API documentation
- [ ] Remove legacy endpoint references
- [ ] Verify performance improvements

---

**Last Updated:** January 16, 2025  
**Deprecation Date:** February 15, 2025  
**Questions?** Contact support@example.com
