# Cache Layer Module

A comprehensive in-memory caching solution with LRU eviction, TTL support, and metrics tracking for the Advanced Exam Application.

## Features

- **In-memory caching** using JavaScript Map with insertion-order preservation
- **LRU (Least Recently Used) eviction** when cache reaches size or memory limits
- **TTL (Time To Live) support** with automatic expiration
- **Cache statistics** tracking hits, misses, hit rate, and evictions
- **Pattern-based clearing** for selective cache invalidation
- **Memory management** with configurable size and memory limits
- **Automatic cleanup** of expired entries via periodic background task
- **Cache key utilities** for consistent key generation across the application

## Installation

The cache module is located at `src/lib/cache.ts` and can be imported as:

```typescript
import { CacheLayer, CacheKeys, getOrSet, caches } from '@/lib/cache';
```

## Basic Usage

### Creating a Cache Instance

```typescript
import { CacheLayer } from '@/lib/cache';

const cache = new CacheLayer({
  maxSize: 1000,              // Maximum 1000 entries
  maxMemory: 100 * 1024 * 1024, // Maximum 100MB
  defaultTTL: 300000,         // 5 minutes default TTL
});
```

### Setting and Getting Values

```typescript
// Set a value with default TTL
cache.set('user:123', { name: 'John', email: 'john@example.com' });

// Set a value with custom TTL (10 seconds)
cache.set('temp:data', { value: 42 }, 10000);

// Get a value
const user = cache.get('user:123');
if (user) {
  console.log(user.name); // 'John'
}
```

### Deleting and Clearing

```typescript
// Delete a single entry
cache.delete('user:123');

// Clear all entries
cache.clear();

// Clear entries matching a pattern
cache.clear('exam:'); // Clears all keys starting with 'exam:'
```

### Checking Existence

```typescript
if (cache.has('user:123')) {
  console.log('User is cached');
}
```

### Getting Statistics

```typescript
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
console.log(`Cache size: ${stats.size} entries`);
console.log(`Evictions: ${stats.evictions}`);
```

## Cache Key Utilities

The module provides standardized cache key generators:

```typescript
import { CacheKeys } from '@/lib/cache';

// Exam metadata
const key1 = CacheKeys.examMetadata('exam-123');
// => 'exam:meta:exam-123'

// Exam questions
const key2 = CacheKeys.examQuestions('exam-123');
// => 'exam:questions:exam-123'

// Student code validation
const key3 = CacheKeys.studentCode('ABC123');
// => 'student:code:ABC123'

// IP rules
const key4 = CacheKeys.ipRules('exam-123');
// => 'exam:iprules:exam-123'

// App configuration
const key5 = CacheKeys.appConfig('theme');
// => 'config:theme'

// Attempt state
const key6 = CacheKeys.attemptState('attempt-123');
// => 'attempt:state:attempt-123'

// With role isolation (security)
const key7 = CacheKeys.withRole('data:123', 'admin');
// => 'admin:data:123'

// With hashed IP (privacy)
const key8 = CacheKeys.withHashedIP('data:123', '192.168.1.1');
// => 'data:123:ip:abc123' (IP is hashed)
```

## Global Cache Instances

Pre-configured cache instances are available for common use cases:

```typescript
import { caches } from '@/lib/cache';

// Exam cache (5 minute TTL)
caches.exam.set(CacheKeys.examMetadata('exam-123'), examData);

// Questions cache (infinite TTL for published exams)
caches.questions.set(CacheKeys.examQuestions('exam-123'), questions);

// Student cache (10 minute TTL)
caches.student.set(CacheKeys.studentCode('ABC123'), studentData);

// Config cache (30 minute TTL)
caches.config.set(CacheKeys.appConfig('theme'), themeConfig);

// General purpose cache (5 minute TTL)
caches.general.set('custom:key', data);
```

## Helper Function: getOrSet

Fetch from cache or compute and cache if missing:

```typescript
import { getOrSet, caches } from '@/lib/cache';

const examData = await getOrSet(
  caches.exam,
  CacheKeys.examMetadata('exam-123'),
  async () => {
    // This function only runs on cache miss
    return await fetchExamFromDatabase('exam-123');
  },
  300000 // Optional custom TTL
);
```

## LRU Eviction

The cache uses a Least Recently Used (LRU) eviction strategy:

1. When a value is accessed via `get()`, it's moved to the end of the cache (most recently used)
2. When the cache reaches `maxSize` or `maxMemory`, the first entry (least recently used) is evicted
3. JavaScript Map maintains insertion order, making LRU implementation efficient

## TTL and Expiration

- Each cached entry has an expiration timestamp
- Expired entries are automatically removed when accessed
- A background cleanup task runs every 60 seconds to remove expired entries
- The cleanup interval doesn't prevent the process from exiting (uses `unref()` in Node.js)

## Memory Management

The cache estimates memory usage by:
1. Stringifying values to JSON
2. Multiplying string length by 2 (rough estimate of UTF-16 encoding)
3. Tracking total memory across all entries
4. Evicting entries when memory limit is reached

## Cleanup and Destruction

When you're done with a cache instance:

```typescript
cache.destroy();
```

This will:
- Stop the cleanup interval
- Clear all cached entries
- Free up memory

## Testing

Run the cache tests:

```bash
# With vitest (requires npm install)
npm test -- src/lib/__tests__/cache.test.ts --run

# With manual test script (no dependencies)
node scripts/test-cache.js
```

## Performance Considerations

- **Memory overhead**: Each entry stores metadata (expiration, size, access count, last accessed)
- **Eviction cost**: O(1) for LRU eviction (removes first entry in Map)
- **Access cost**: O(1) for get/set operations, but get() re-inserts to maintain LRU order
- **Pattern clearing**: O(n) where n is the number of entries (must check all keys)

## Security Features

- **Role isolation**: Use `CacheKeys.withRole()` to prevent cross-role cache access
- **IP hashing**: Use `CacheKeys.withHashedIP()` to hash IP addresses in cache keys for privacy
- **Sensitive field exclusion**: Never cache password hashes, JWT secrets, or other sensitive data
- **Secure deletion**: Entries are fully removed from memory, not just marked as expired

## Requirements Satisfied

This implementation satisfies the following requirements from the optimization spec:

- **Requirement 6.1**: Cache exam metadata for 5 minutes
- **Requirement 6.2**: Cache questions for published exams indefinitely
- **Requirement 6.3**: Cache student codes for 10 minutes
- **Requirement 6.4**: Cache IP rules for 15 minutes
- **Requirement 6.5**: Cache app config for 30 minutes
- **Requirement 6.6**: Cursor-based pagination support (via cache key patterns)

## Example: Caching Exam Data

```typescript
import { caches, CacheKeys, getOrSet } from '@/lib/cache';

async function getExamMetadata(examId: string) {
  return await getOrSet(
    caches.exam,
    CacheKeys.examMetadata(examId),
    async () => {
      const { data } = await supabase
        .from('exams')
        .select('id, title, description, settings')
        .eq('id', examId)
        .single();
      return data;
    },
    300000 // 5 minutes
  );
}

async function getExamQuestions(examId: string) {
  return await getOrSet(
    caches.questions,
    CacheKeys.examQuestions(examId),
    async () => {
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', examId)
        .order('order_index');
      return data;
    }
    // No TTL = uses cache default (infinite for questions cache)
  );
}

// Invalidate cache when exam is updated
function invalidateExamCache(examId: string) {
  caches.exam.delete(CacheKeys.examMetadata(examId));
  caches.questions.delete(CacheKeys.examQuestions(examId));
}
```

## License

Part of the Advanced Exam Application. See project LICENSE for details.
