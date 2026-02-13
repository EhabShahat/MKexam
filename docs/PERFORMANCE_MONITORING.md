# Performance Monitoring Infrastructure

This document describes the performance monitoring infrastructure set up for the Advanced Exam Application.

## Overview

The performance monitoring infrastructure provides comprehensive tracking of application performance metrics including Web Vitals, custom metrics, and query performance. This enables data-driven optimization decisions and ensures the application meets performance targets.

## Components

### 1. Web Vitals Monitoring

**Location**: `src/hooks/useWebVitals.ts`, `src/components/PerformanceMonitor.tsx`

The application automatically tracks all Core Web Vitals metrics:

- **CLS (Cumulative Layout Shift)**: Measures visual stability
- **FID (First Input Delay)**: Measures interactivity
- **FCP (First Contentful Paint)**: Measures loading performance
- **LCP (Largest Contentful Paint)**: Measures loading performance
- **TTFB (Time to First Byte)**: Measures server response time
- **INP (Interaction to Next Paint)**: Measures responsiveness

**Usage**: The `PerformanceMonitor` component is already integrated in the root layout (`src/app/layout.tsx`) and automatically tracks metrics on all pages.

### 2. Performance Metrics Collection

**Location**: `src/lib/performance.ts`

Provides utilities for:

- **Metric Rating**: Classify metrics as "good", "needs-improvement", or "poor"
- **Metric Formatting**: Format metrics for display (ms, bytes, FPS, etc.)
- **Query Performance Tracking**: Track database query response times
- **Scroll FPS Measurement**: Measure scrolling performance
- **Threshold Checking**: Validate metrics against performance targets

### 3. Query Performance Tracker

**Location**: `src/lib/performance.ts` - `QueryPerformanceTracker` class

Tracks database query performance:

```typescript
import { queryPerformanceTracker } from '@/lib/performance';

// Track a query
const startTime = performance.now();
const result = await supabase.from('exams').select('*');
const duration = performance.now() - startTime;
queryPerformanceTracker.trackQuery('fetch-exams', duration);

// Get metrics
const metrics = queryPerformanceTracker.getMetrics();
console.log('Average response time:', metrics.averageResponseTime);
console.log('P95 response time:', metrics.p95ResponseTime);
console.log('Slow queries:', metrics.slowQueries);
```

### 4. Bundle Analyzer

**Location**: `next.config.ts`

The bundle analyzer is configured to run when the `ANALYZE` environment variable is set to `true`.

**Usage**:

```bash
# Analyze bundle size
npm run build:analyze

# Or manually
ANALYZE=true npm run build
```

The analyzer generates an interactive HTML report at `.next/analyze/nodejs.html` showing:
- Bundle size breakdown by module
- Duplicate dependencies
- Large dependencies that could be optimized

## Performance Thresholds

The following performance targets are defined in `src/lib/performance.ts`:

| Metric | Target | Description |
|--------|--------|-------------|
| Page Load Time | < 2 seconds | Time from navigation to load complete |
| Time to Interactive | < 2 seconds | Time until page is fully interactive |
| Scroll FPS | ≥ 60 FPS | Frames per second during scrolling |
| Bundle Size Reduction | ≥ 30% | Target reduction through optimization |
| Cumulative Layout Shift | < 0.1 | Visual stability score |
| Query Response Time (p95) | < 500ms | 95th percentile query response time |

## Testing

### Unit Tests

Run unit tests for performance utilities:

```bash
npm run test:run
```

Test files:
- `src/lib/__tests__/performance.test.ts` - Performance utilities
- `src/hooks/__tests__/useWebVitals.test.ts` - Web Vitals hook
- `src/components/__tests__/PerformanceMonitor.test.tsx` - Monitor component

### Property-Based Tests

Property-based tests using `fast-check` will be added in subsequent tasks to verify universal correctness properties across randomized inputs.

## Monitoring in Production

### Development Mode

In development, performance metrics are logged to the console:

```
[Performance] {
  name: 'LCP',
  value: '2.1s',
  rating: 'good',
  id: 'v3-1234567890'
}
```

### Production Mode

In production, metrics can be sent to analytics services. To integrate with your analytics provider, update the `logPerformanceMetric` function in `src/lib/performance.ts`:

```typescript
export function logPerformanceMetric(metric: PerformanceMetricEvent): void {
  if (process.env.NODE_ENV === 'production') {
    // Send to your analytics service
    analytics.track('performance_metric', metric);
    
    // Or send to custom endpoint
    fetch('/api/analytics/performance', {
      method: 'POST',
      body: JSON.stringify(metric),
    });
  }
}
```

## Measuring Performance

### Page Load Time

```typescript
import { measurePageLoadTime } from '@/lib/performance';

const loadTime = measurePageLoadTime();
console.log('Page loaded in:', loadTime, 'ms');
```

### Navigation Timings

```typescript
import { getNavigationTimings } from '@/lib/performance';

const timings = getNavigationTimings();
console.log('DNS lookup:', timings.dns, 'ms');
console.log('TCP connection:', timings.tcp, 'ms');
console.log('Request time:', timings.request, 'ms');
console.log('Response time:', timings.response, 'ms');
console.log('DOM processing:', timings.dom, 'ms');
```

### Scroll FPS

```typescript
import { measureScrollFPS } from '@/lib/performance';

const fps = await measureScrollFPS(1000); // Measure for 1 second
console.log('Scroll FPS:', fps);
```

### Check Thresholds

```typescript
import { checkPerformanceThresholds } from '@/lib/performance';

const metrics = {
  pageLoadTime: 1800,
  timeToInteractive: 1900,
  scrollFPS: 60,
  cumulativeLayoutShift: 0.05,
};

const result = checkPerformanceThresholds(metrics);
if (!result.passed) {
  console.error('Performance issues:', result.failures);
}
```

## Next Steps

This infrastructure is the foundation for the following optimization tasks:

1. **List Virtualization** - Optimize rendering of large lists
2. **Image Lazy Loading** - Defer loading of off-screen images
3. **Optimistic UI Updates** - Provide immediate feedback for user actions
4. **Code Splitting** - Reduce initial bundle size
5. **Backend Optimization** - Improve database query performance

Each optimization will be validated against the thresholds defined in this infrastructure.

## References

- [Web Vitals Documentation](https://web.dev/vitals/)
- [Next.js Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [fast-check Documentation](https://fast-check.dev/)
- [Vitest Documentation](https://vitest.dev/)
