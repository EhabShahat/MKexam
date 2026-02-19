# Performance Monitoring Infrastructure

This module provides comprehensive performance monitoring capabilities for tracking Supabase egress, Netlify function execution times, cache performance, and database query times.

## Features

- **Egress Tracking**: Monitor Supabase data transfer bandwidth
- **Function Execution Tracking**: Measure Netlify function execution times
- **Cache Performance**: Track cache hits, misses, and hit rates
- **Query Performance**: Monitor database query execution times
- **Error Tracking**: Log and categorize errors
- **Automated Alerts**: Warn when metrics exceed thresholds

## Database Tables

### performance_metrics
Stores all performance metrics with the following fields:
- `id`: Unique identifier
- `metric_type`: Type of metric (egress, function_execution, cache_hit, query_time, error)
- `operation`: Name of the operation being tracked
- `value`: Numeric value of the metric
- `metadata`: Additional JSON metadata
- `recorded_at`: Timestamp of the metric

### cache_statistics
Stores cache performance statistics:
- `id`: Unique identifier
- `cache_type`: Type of cache being tracked
- `hits`: Number of cache hits
- `misses`: Number of cache misses
- `evictions`: Number of cache evictions
- `size_bytes`: Size of cached data in bytes
- `recorded_at`: Timestamp of the statistic

## Usage

### Basic Usage

```typescript
import { getPerformanceLogger } from '@/lib/performance';

const logger = getPerformanceLogger();

// Track egress
await logger.trackEgress('get_attempt_state', 1024 * 500); // 500 KB

// Track function execution
await logger.trackFunctionExecution('api/attempts/route', 1500); // 1.5 seconds

// Track cache hit
await logger.trackCacheHit('exam_metadata', true);

// Track query time
await logger.trackQueryTime('SELECT * FROM exams', 250); // 250ms
```

### Using Timers

```typescript
import { getPerformanceLogger } from '@/lib/performance';

const logger = getPerformanceLogger();

// Start timer
logger.startTimer('my-operation');

// ... perform operation ...

// End timer and log
const duration = await logger.endTimer('my-operation', 'my-operation-name');
console.log(`Operation took ${duration}ms`);
```

### Convenience Functions

```typescript
import { trackFunction, trackQuery } from '@/lib/performance';

// Track function execution automatically
const result = await trackFunction('processExam', async () => {
  // Your function logic here
  return processExamData();
});

// Track query execution automatically
const data = await trackQuery('fetchExams', async () => {
  return await supabase.from('exams').select('*');
});
```

### Getting Performance Summaries

```typescript
import { getPerformanceLogger } from '@/lib/performance';

const logger = getPerformanceLogger();

// Get performance summary for last 24 hours
const summary = await logger.getPerformanceSummary({
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  endDate: new Date(),
  metricType: 'function_execution',
});

// Get cache summary
const cacheSummary = await logger.getCacheSummary({
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  endDate: new Date(),
});

// Get slow queries
const slowQueries = await logger.getSlowQueries(24, 50);
```

### Configuration

```typescript
import { PerformanceLogger } from '@/lib/performance';

const logger = new PerformanceLogger({
  enabled: true,
  slowQueryThreshold: 1000, // 1 second
  egressThreshold: 1024 * 1024, // 1 MB
  functionTimeThreshold: 5000, // 5 seconds
  cacheHitRateThreshold: 70, // 70%
});
```

## Database Functions

### log_performance_metric
Logs a performance metric to the database.

```sql
SELECT log_performance_metric(
  'egress',
  'get_attempt_state',
  524288,
  '{"bytes": 524288, "megabytes": 0.5}'::jsonb
);
```

### log_cache_statistics
Logs cache statistics to the database.

```sql
SELECT log_cache_statistics(
  'exam_metadata',
  100,  -- hits
  20,   -- misses
  5,    -- evictions
  1024000  -- size_bytes
);
```

### get_performance_summary
Gets aggregated performance metrics with percentiles.

```sql
SELECT * FROM get_performance_summary(
  now() - interval '24 hours',
  now(),
  'function_execution'
);
```

### get_cache_summary
Gets aggregated cache statistics with hit rates.

```sql
SELECT * FROM get_cache_summary(
  now() - interval '24 hours',
  now()
);
```

## Thresholds and Alerts

The logger automatically logs warnings when metrics exceed configured thresholds:

- **Egress**: Warns when a single operation exceeds 1 MB
- **Function Time**: Warns when execution exceeds 5 seconds
- **Query Time**: Warns when query exceeds 1 second (slow query)
- **Cache Hit Rate**: Warns when hit rate falls below 70%

## Best Practices

1. **Use timers for long operations**: Start and end timers for operations that may take significant time
2. **Track all RPC calls**: Monitor egress for all Supabase RPC function calls
3. **Log cache operations**: Track both hits and misses to calculate hit rates
4. **Review slow queries**: Regularly check slow queries and optimize them
5. **Monitor trends**: Use summary functions to identify performance trends over time
6. **Set appropriate thresholds**: Adjust thresholds based on your application's requirements

## Integration with Optimization Tasks

This infrastructure supports the following optimization requirements:

- **Requirement 9.1**: Track Supabase egress metrics daily
- **Requirement 9.2**: Log execution time for all Netlify functions
- **Requirement 9.3**: Log slow queries exceeding 1 second
- **Requirement 9.4**: Track cache hit rate per cache type
- **Requirement 9.5**: Measure and log response time percentiles
- **Requirement 9.6**: Log error rates and types for monitoring
