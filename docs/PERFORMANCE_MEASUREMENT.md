# Performance Measurement Guide

This guide explains how to use the performance measurement utilities to validate optimizations and track performance metrics.

## Overview

The performance measurement system provides three main tools:

1. **Web Vitals Monitoring** - Real-time tracking of Core Web Vitals
2. **Lighthouse CI** - Automated performance testing
3. **Performance Comparison Script** - Compare baseline vs optimized metrics

## Web Vitals Monitoring

### Setup

The `PerformanceMonitor` component is already integrated into the root layout and automatically tracks:

- **CLS** (Cumulative Layout Shift)
- **FID** (First Input Delay)
- **FCP** (First Contentful Paint)
- **LCP** (Largest Contentful Paint)
- **TTFB** (Time to First Byte)
- **INP** (Interaction to Next Paint)

### Usage

Metrics are automatically logged to the console in development mode:

```typescript
import { useWebVitals } from '@/hooks/useWebVitals';

function MyComponent() {
  useWebVitals(); // Automatically tracks metrics
  return <div>...</div>;
}
```

### Collecting Metrics Programmatically

```typescript
import { collectPerformanceMetrics, measureBundleSize } from '@/lib/performanceMeasurement';

// Collect current metrics
const metrics = await collectPerformanceMetrics();

// Measure bundle size
const bundleSize = measureBundleSize();

console.log('Metrics:', metrics);
console.log('Bundle Size:', bundleSize);
```

## Lighthouse CI

### Installation

```bash
npm install --save-dev @lhci/cli
```

### Running Lighthouse Tests

```bash
# Run Lighthouse CI with default configuration
npm run perf:lighthouse

# Or run manually
npx lhci autorun
```

### Configuration

The `lighthouserc.json` file configures:

- **URLs to test**: Home, admin login, exams, results pages
- **Performance thresholds**: Based on requirements (FCP < 2s, LCP < 2.5s, CLS < 0.1)
- **Number of runs**: 3 runs per URL for consistency
- **Network conditions**: Desktop preset with realistic throttling

### Interpreting Results

Lighthouse CI will:
- ✅ Pass if all assertions meet thresholds
- ❌ Fail if any metric exceeds threshold
- Generate detailed HTML reports
- Upload results to temporary public storage

## Performance Comparison Script

### Measuring Baseline Metrics

1. **Before optimizations**, collect metrics:

```bash
# Start the application
npm run build
npm run start

# In browser console:
const metrics = await collectPerformanceMetrics();
const bundleSize = measureBundleSize();
const fullMetrics = { ...metrics, bundleSize };
console.log(JSON.stringify(fullMetrics, null, 2));
```

2. Save the output to `baseline.json`

### Measuring Optimized Metrics

1. **After optimizations**, collect metrics again:

```bash
# Rebuild with optimizations
npm run build
npm run start

# In browser console (same as above)
```

2. Save the output to `optimized.json`

### Comparing Metrics

```bash
# Compare baseline vs optimized
npm run perf:compare -- --baseline baseline.json --optimized optimized.json

# Save report to file
npm run perf:compare -- --baseline baseline.json --optimized optimized.json --output report.txt
```

### Example Metrics File

```json
{
  "pageLoadTime": 1500,
  "timeToInteractive": 1800,
  "firstContentfulPaint": 900,
  "cumulativeLayoutShift": 0.05,
  "scrollFPS": 60,
  "bundleSize": {
    "initial": 500000,
    "total": 1200000
  },
  "queryMetrics": {
    "averageResponseTime": 150,
    "p95ResponseTime": 350,
    "slowQueries": []
  }
}
```

## Performance Thresholds

Based on requirements, the following thresholds must be met:

| Metric | Threshold | Requirement |
|--------|-----------|-------------|
| Page Load Time | < 2000ms | 6.1 |
| Time to Interactive | < 2000ms | 6.2 |
| Scroll FPS | ≥ 60 FPS | 6.3 |
| Bundle Size Reduction | ≥ 30% | 6.4 |
| Cumulative Layout Shift | < 0.1 | 6.5 |
| Query P95 Response Time | < 500ms | 6.6 |

## Automated Testing

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci --legacy-peer-deps
      - run: npm run build
      - run: npm run perf:lighthouse
```

## Query Performance Tracking

### Tracking Database Queries

```typescript
import { queryPerformanceTracker } from '@/lib/performance';

// Track a query
const startTime = performance.now();
const result = await supabase.from('exams').select('*');
const duration = performance.now() - startTime;

queryPerformanceTracker.trackQuery('fetch_exams', duration);

// Get metrics
const metrics = queryPerformanceTracker.getMetrics();
console.log('Query Metrics:', metrics);
```

### Viewing Slow Queries

```typescript
const slowQueries = queryPerformanceTracker.getSlowQueries();
console.log('Slow Queries:', slowQueries);
```

## Scroll FPS Measurement

```typescript
import { measureScrollFPS } from '@/lib/performance';

// Measure FPS during scroll
const fps = await measureScrollFPS(1000); // Measure for 1 second
console.log('Scroll FPS:', fps);
```

## Generating Reports

```typescript
import { generatePerformanceReport, comparePerformance } from '@/lib/performanceMeasurement';

// Generate report for current metrics
const report = generatePerformanceReport(metrics);
console.log(report);

// Generate comparison report
const improvements = comparePerformance(baseline, optimized);
const comparisonReport = generatePerformanceReport(optimized, improvements);
console.log(comparisonReport);
```

## Saving and Loading Metrics

```typescript
import { savePerformanceMetrics, loadPerformanceMetrics } from '@/lib/performanceMeasurement';

// Save metrics to localStorage
savePerformanceMetrics('baseline', metrics);

// Load metrics from localStorage
const savedMetrics = loadPerformanceMetrics('baseline');
```

## Best Practices

1. **Measure Multiple Times**: Run tests 3-5 times and average results
2. **Consistent Environment**: Use same network conditions and device
3. **Clear Cache**: Test with both cold and warm cache
4. **Real Data**: Test with realistic data volumes
5. **Monitor Continuously**: Track metrics over time, not just once

## Troubleshooting

### Lighthouse CI Fails to Start

- Ensure port 3000 is available
- Check that build completes successfully
- Verify `startServerReadyPattern` matches your server output

### Metrics Not Collected

- Ensure you're in a browser environment (not SSR)
- Check browser console for errors
- Verify Web Vitals library is loaded

### Comparison Script Errors

- Validate JSON file format
- Ensure all required metrics are present
- Check file paths are correct

## Additional Resources

- [Web Vitals Documentation](https://web.dev/vitals/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Next.js Performance Optimization](https://nextjs.org/docs/app/building-your-application/optimizing)
