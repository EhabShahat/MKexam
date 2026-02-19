# API Route Caching Documentation

## Overview

This document describes the API route caching implementation for the Advanced Exam Application. The caching system reduces Netlify function execution time and Supabase egress bandwidth by caching API responses with appropriate TTLs and cache invalidation strategies.

**Requirements:** 3.2

## Architecture

The caching system consists of three main components:

1. **Cache Headers Utility** (`src/lib/cacheHeaders.ts`)
   - Provides cache header management
   - Generates ETags for conditional requests
   - Supports multiple cache configurations

2. **Response Cache Middleware** (`src/lib/responseCacheMiddleware.ts`)
   - Wraps API route handlers with caching logic
   - Integrates with existing cache layer
   - Provides cache invalidation utilities

3. **Cache Layer** (`src/lib/cache.ts`)
   - In-memory LRU cache with TTL support
   - Multiple cache instances for different resource types
   - Automatic cleanup of expired entries

## Cache Configurations

The system provides predefined cache configurations:

| Configuration | TTL | Use Case | Cache-Control Header |
|--------------|-----|----------|---------------------|
| `NO_CACHE` | 0 | Dynamic/sensitive data | `no-cache, no-store, must-revalidate` |
| `SHORT` | 5 min | Exam metadata | `public, max-age=300, s-maxage=300, stale-while-revalidate=60` |
| `MEDIUM` | 15 min | IP rules, student codes | `public, max-age=900, s-maxage=900, stale-while-revalidate=120` |
| `LONG` | 30 min | App config | `public, max-age=1800, s-maxage=1800, stale-while-revalidate=300` |
| `IMMUTABLE` | 1 hour | Published exam questions | `public, max-age=3600, s-maxage=3600, immutable` |

## Usage

### Basic Usage

```typescript
import { withResponseCache } from '@/lib/responseCacheMiddleware';

export async function GET(req: NextRequest) {
  return withResponseCache(
    req,
    { cacheConfig: 'SHORT' },
    async () => {
      const data = await fetchData();
      return data;
    }
  );
}
```

### Using Helper Function

```typescript
import { createCachedHandler } from '@/lib/responseCacheMiddleware';

export const GET = createCachedHandler(
  { cacheConfig: 'MEDIUM', cacheInstance: 'exam' },
  async (req) => {
    const data = await fetchExamData();
    return data;
  }
);
```

### Custom Cache Key

```typescript
export async function GET(req: NextRequest) {
  return withResponseCache(
    req,
    {
      cacheConfig: 'LONG',
      keyGenerator: (req) => {
        const url = new URL(req.url);
        const examId = url.searchParams.get('examId');
        return `custom:exam:${examId}`;
      }
    },
    async () => {
      const data = await fetchCustomData();
      return data;
    }
  );
}
```

### Role-Based Cache Isolation

```typescript
export async function GET(req: NextRequest) {
  const userRole = await getUserRole(req);
  
  return withResponseCache(
    req,
    {
      cacheConfig: 'SHORT',
      userRole: userRole, // Isolates cache by role
    },
    async () => {
      const data = await fetchRoleSpecificData(userRole);
      return data;
    }
  );
}
```

### Cache Invalidation on Mutations

```typescript
import { invalidateOnMutation } from '@/lib/responseCacheMiddleware';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { examId, ...data } = body;
  
  // Perform mutation
  const result = await updateExam(examId, data);
  
  // Invalidate related caches
  await invalidateOnMutation('exam', examId);
  
  return NextResponse.json({ success: true, data: result });
}
```

## ETag Support

The system automatically generates ETags for responses and supports conditional requests:

1. **First Request:** Client receives response with ETag header
2. **Subsequent Requests:** Client sends `If-None-Match` header with ETag
3. **304 Not Modified:** If ETag matches, server returns 304 with no body
4. **200 OK:** If ETag doesn't match, server returns full response with new ETag

This reduces bandwidth consumption for unchanged resources.

## Cache Bypass

Administrators can bypass cache in two ways:

1. **Query Parameter:** Add `?nocache=true` to the URL
2. **Cache-Control Header:** Send `Cache-Control: no-cache` header

Example:
```
GET /api/public/settings?nocache=true
```

## Cache Invalidation

### Manual Invalidation

Use the admin API endpoint:

```bash
# Clear all caches
POST /api/admin/cache/clear
{ "cacheType": "all" }

# Clear specific cache type
POST /api/admin/cache/clear
{ "cacheType": "exam" }

# Clear specific resource
POST /api/admin/cache/clear
{ "cacheType": "exam", "resourceId": "exam-uuid" }
```

### Programmatic Invalidation

```typescript
import { 
  invalidateExamCache,
  invalidateStudentCache,
  invalidateConfigCache,
  invalidateCache
} from '@/lib/responseCacheMiddleware';

// Invalidate specific exam
invalidateExamCache(examId);

// Invalidate student code
invalidateStudentCache(studentCode);

// Invalidate config
invalidateConfigCache('key');

// Invalidate by pattern
invalidateCache('exam:.*');
```

## Cache Statistics

Get cache statistics via the admin API:

```bash
GET /api/admin/cache/clear
```

Response:
```json
{
  "exam": {
    "hits": 150,
    "misses": 50,
    "hitRate": 0.75,
    "size": 45,
    "evictions": 5
  },
  "questions": { ... },
  "student": { ... },
  "config": { ... },
  "general": { ... }
}
```

## Cache Instances

The system provides separate cache instances for different resource types:

| Instance | Max Size | Default TTL | Use Case |
|----------|----------|-------------|----------|
| `exam` | 500 | 5 min | Exam metadata |
| `questions` | 200 | Infinite | Published questions |
| `student` | 1000 | 10 min | Student codes |
| `config` | 100 | 30 min | App configuration |
| `general` | 1000 | 5 min | General purpose |

## Security Considerations

1. **Role Isolation:** Always use `userRole` parameter for role-specific data
2. **Sensitive Fields:** Never cache password hashes, JWT secrets, or PII
3. **Cache Keys:** IP addresses are hashed in cache keys for privacy
4. **TTL Limits:** Audit logs have maximum 1-minute cache TTL
5. **Encryption:** Sensitive cached data should be encrypted at rest

## Performance Impact

Expected performance improvements:

- **Cache Hit Rate:** Target 80%+ for frequently accessed resources
- **Response Time:** 50-90% reduction for cached responses
- **Bandwidth Savings:** 60%+ reduction in Supabase egress
- **Function Execution:** 50%+ reduction in Netlify function time

## Monitoring

Monitor cache effectiveness through:

1. **Cache Statistics API:** `/api/admin/cache/clear` (GET)
2. **Cache Hit Rate:** Track hits vs misses
3. **Response Times:** Compare cached vs uncached response times
4. **Bandwidth Usage:** Monitor Supabase egress reduction

## Best Practices

1. **Choose Appropriate TTL:** Balance freshness vs performance
2. **Use ETag:** Enable for resources that change infrequently
3. **Invalidate on Mutations:** Always invalidate related caches after updates
4. **Role Isolation:** Use `userRole` for user-specific data
5. **Cache Instance:** Use appropriate cache instance for resource type
6. **Monitor Performance:** Track cache hit rates and adjust TTLs
7. **Test Invalidation:** Verify cache invalidation works correctly

## Examples

See `src/app/api/examples/cached-route.example.ts` for comprehensive examples of:

- Simple cached endpoints
- Custom cache key generation
- Role-based caching
- Immutable content caching
- Cache invalidation on mutations
- No-cache for sensitive data
- Custom TTL overrides

## Troubleshooting

### Cache Not Working

1. Check if `shouldBypassCache()` is returning true
2. Verify cache configuration is not `NO_CACHE`
3. Check cache statistics for hits/misses
4. Verify cache instance has capacity

### Stale Data

1. Check TTL configuration
2. Verify cache invalidation is triggered on mutations
3. Use cache bypass for debugging
4. Check if cache cleanup is running

### High Memory Usage

1. Review cache instance max sizes
2. Check for cache key leaks
3. Monitor eviction rates
4. Adjust TTLs to reduce cache duration

## Related Documentation

- [Cache Layer](../src/lib/cache.ts)
- [Compression Middleware](./COMPRESSION.md)
- [Performance Optimization](./PERFORMANCE_MONITORING.md)
