# Performance Benchmarking Guide

## Overview

This document describes the performance benchmarking process for the Results Page Rebuild. The benchmarking compares the old monolithic implementation against the new modular architecture across key performance metrics.

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Initial Page Load Time | < 2 seconds | 60% improvement over baseline |
| Time to Interactive (TTI) | < 3 seconds | Ensures responsive user experience |
| Memory Usage (1000 rows) | < 100MB | 60% reduction from baseline |
| Scroll Performance | 60 FPS | Smooth scrolling with virtual scrolling |

## Benchmarking Setup

### Prerequisites

1. **Install Puppeteer** (if not already installed):
   ```bash
   npm install --save-dev puppeteer
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Configure Environment Variables** (optional):
   ```bash
   export BASE_URL="http://localhost:3000"
   export ADMIN_EMAIL="your-admin@example.com"
   export ADMIN_PASSWORD="your-password"
   ```

### Running the Benchmark

Execute the benchmark script:

```bash
node .kiro/specs/results-page-rebuild/performance-benchmark.js
```

The script will:
1. Launch a headless browser
2. Login to the admin panel
3. Run 3 iterations for each implementation (old and new)
4. Measure all performance metrics
5. Generate a comparison report

## Metrics Measured

### 1. Page Load Time

**What it measures**: Time from navigation start to DOM content loaded

**How it's measured**: 
- Uses `performance.timing` API
- Measures `domContentLoaded - navigationStart`

**Target**: < 2000ms

### 2. Time to Interactive (TTI)

**What it measures**: Time until the page is fully interactive

**How it's measured**:
- Uses `performance.timing` API
- Measures `domInteractive - navigationStart`
- Waits for network idle (no requests for 500ms)

**Target**: < 3000ms

### 3. Memory Usage

**What it measures**: JavaScript heap size with large datasets

**How it's measured**:
- Uses Chrome DevTools Protocol `page.metrics()`
- Measures `JSHeapUsedSize` after data load
- Converts to MB for readability

**Target**: < 100MB (with 1000 rows)

### 4. Scroll Performance

**What it measures**: Frames per second during scrolling

**How it's measured**:
- Injects FPS counter using `requestAnimationFrame`
- Scrolls through entire page at ~60fps target
- Records FPS every second
- Calculates average, min, and max FPS

**Target**: ≥ 60 FPS average

## Understanding the Report

The benchmark generates a JSON report (`performance-report.json`) with the following structure:

```json
{
  "timestamp": "2024-02-19T10:30:00.000Z",
  "iterations": 3,
  "targets": {
    "pageLoadTime": 2000,
    "timeToInteractive": 3000,
    "memoryUsage": 100,
    "scrollFPS": 60
  },
  "results": {
    "old": {
      "pageLoad": { "avg": 3200, "median": 3150, "min": 3100, "max": 3350 },
      "tti": { "avg": 4500, "median": 4450, "min": 4300, "max": 4700 },
      "memory": { "avg": 145.5, "median": 144.2, "min": 142.1, "max": 150.3 },
      "scrollFPS": { "avg": 45, "median": 46, "min": 38, "max": 52 }
    },
    "new": {
      "pageLoad": { "avg": 1800, "median": 1750, "min": 1700, "max": 1950 },
      "tti": { "avg": 2600, "median": 2550, "min": 2500, "max": 2750 },
      "memory": { "avg": 58.3, "median": 57.8, "min": 56.2, "max": 61.5 },
      "scrollFPS": { "avg": 59, "median": 60, "min": 57, "max": 60 }
    }
  },
  "improvements": {
    "pageLoad": "43.8",
    "tti": "42.2",
    "memory": "59.9"
  },
  "targetsMet": {
    "pageLoad": true,
    "tti": true,
    "memory": true,
    "scrollFPS": true
  }
}
```

### Key Sections

- **results.old**: Metrics for the old implementation
- **results.new**: Metrics for the new implementation
- **improvements**: Percentage improvement (positive = better)
- **targetsMet**: Boolean flags indicating if targets were achieved

## Manual Performance Testing

In addition to automated benchmarking, perform manual testing:

### 1. Chrome DevTools Performance Profiling

1. Open Chrome DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Navigate to Results page
5. Interact with filters, sorting, export
6. Stop recording
7. Analyze:
   - Long tasks (> 50ms)
   - Layout shifts
   - Paint operations
   - JavaScript execution time

### 2. Lighthouse Audit

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Performance" category
4. Run audit
5. Review scores and recommendations

Target Lighthouse scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90

### 3. Network Throttling Test

Test with simulated slow connections:

1. Open Chrome DevTools
2. Go to Network tab
3. Select throttling profile:
   - Fast 3G
   - Slow 3G
4. Reload page and test functionality
5. Verify acceptable performance

### 4. Memory Leak Detection

1. Open Chrome DevTools
2. Go to Memory tab
3. Take heap snapshot before loading data
4. Load large dataset (1000+ rows)
5. Take another heap snapshot
6. Filter and sort data multiple times
7. Take final heap snapshot
8. Compare snapshots for memory leaks

## Interpreting Results

### Success Criteria

✅ **All targets met**: Ready for production rollout

⚠️ **Some targets missed**: 
- Identify bottlenecks
- Optimize specific areas
- Re-run benchmark

❌ **Multiple targets missed**:
- Review implementation
- Consider architectural changes
- Consult with team

### Common Performance Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Slow initial load | High page load time | Code splitting, lazy loading |
| High memory usage | Memory > 100MB | Virtual scrolling, data pagination |
| Janky scrolling | FPS < 60 | Optimize render cycles, use memo |
| Slow filtering | Delayed UI updates | Debouncing, web workers |

## Optimization Strategies

### If Page Load Time is High

1. **Code Splitting**: Lazy load export libraries
2. **Bundle Analysis**: Use `next/bundle-analyzer`
3. **Image Optimization**: Compress and lazy load images
4. **Critical CSS**: Inline critical styles

### If Memory Usage is High

1. **Virtual Scrolling**: Ensure it's working correctly
2. **Data Cleanup**: Clear unused data from memory
3. **Memoization**: Use React.memo for expensive components
4. **Pagination**: Consider server-side pagination

### If Scroll Performance is Poor

1. **Reduce Re-renders**: Use React.memo and useMemo
2. **Simplify DOM**: Reduce complexity of table cells
3. **CSS Optimization**: Avoid expensive CSS properties
4. **Throttle Events**: Throttle scroll event handlers

## Continuous Monitoring

After deployment, monitor performance in production:

### 1. Real User Monitoring (RUM)

Track actual user metrics:
- Page load times
- Time to interactive
- First contentful paint
- Largest contentful paint

### 2. Error Tracking

Monitor for:
- JavaScript errors
- Failed API requests
- Timeout errors
- Memory issues

### 3. Performance Budgets

Set and enforce budgets:
- Bundle size: < 500KB (gzipped)
- API response time: < 500ms
- Page load time: < 2s
- Memory usage: < 100MB

## Reporting Performance Improvements

When documenting performance improvements:

1. **Baseline Metrics**: Document old implementation performance
2. **New Metrics**: Document new implementation performance
3. **Percentage Improvement**: Calculate and highlight gains
4. **Visual Comparison**: Create charts showing before/after
5. **User Impact**: Translate metrics to user experience improvements

Example:
```
Performance Improvements:
- Page load time: 3.2s → 1.8s (44% faster)
- Memory usage: 145MB → 58MB (60% reduction)
- Scroll FPS: 45 → 59 (31% smoother)

User Impact:
- Results page loads in under 2 seconds
- Smooth 60fps scrolling with 1000+ rows
- Reduced memory footprint enables longer sessions
```

## Troubleshooting

### Benchmark Script Fails

**Issue**: Script crashes or hangs

**Solutions**:
1. Ensure dev server is running
2. Check admin credentials are correct
3. Verify Puppeteer is installed
4. Try running with `headless: false` for debugging

### Inconsistent Results

**Issue**: Large variance between iterations

**Solutions**:
1. Close other applications
2. Increase iteration count
3. Run on dedicated test machine
4. Clear browser cache between runs

### No Data in Results Page

**Issue**: Scroll test skipped due to empty table

**Solutions**:
1. Seed database with test data
2. Create sample exams and attempts
3. Use production data snapshot (anonymized)

## Next Steps

After completing benchmarking:

1. ✅ Document results in `performance-report.json`
2. ✅ Compare against targets
3. ✅ Identify areas for optimization
4. ✅ Create performance improvement plan if needed
5. ✅ Share results with team
6. ✅ Update documentation with findings
7. ✅ Proceed to user acceptance testing (Task 9.3)
