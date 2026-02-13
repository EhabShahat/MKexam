/**
 * Performance Measurement Utilities
 * 
 * This module provides comprehensive utilities for measuring and comparing
 * performance metrics across different builds and optimizations.
 */

import { PerformanceMetrics, PERFORMANCE_THRESHOLDS } from './performance';

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  timestamp: number;
  url: string;
  metrics: PerformanceMetrics;
  environment: {
    userAgent: string;
    viewport: { width: number; height: number };
    connection?: string;
  };
}

/**
 * Performance comparison result
 */
export interface PerformanceComparison {
  baseline: PerformanceMeasurement;
  optimized: PerformanceMeasurement;
  improvements: {
    pageLoadTime: { value: number; percentage: number };
    timeToInteractive: { value: number; percentage: number };
    bundleSize: { value: number; percentage: number };
    cumulativeLayoutShift: { value: number; percentage: number };
    queryResponseTime: { value: number; percentage: number };
  };
  meetsThresholds: boolean;
  thresholdResults: Array<{
    metric: string;
    value: number;
    threshold: number;
    passed: boolean;
  }>;
}

/**
 * Collect current performance metrics
 */
export async function collectPerformanceMetrics(): Promise<Partial<PerformanceMetrics>> {
  if (typeof window === 'undefined') {
    throw new Error('Performance metrics can only be collected in browser environment');
  }

  const metrics: Partial<PerformanceMetrics> = {};

  // Get navigation timing
  const perfEntries = window.performance.getEntriesByType('navigation');
  if (perfEntries.length > 0) {
    const navTiming = perfEntries[0] as PerformanceNavigationTiming;
    metrics.pageLoadTime = navTiming.loadEventEnd - navTiming.fetchStart;
    metrics.timeToInteractive = navTiming.domInteractive - navTiming.fetchStart;
    metrics.firstContentfulPaint = 0; // Will be updated by Web Vitals
  }

  // Get CLS from performance observer (if available)
  try {
    const clsEntries = window.performance.getEntriesByType('layout-shift');
    let clsScore = 0;
    clsEntries.forEach((entry: any) => {
      if (!entry.hadRecentInput) {
        clsScore += entry.value;
      }
    });
    metrics.cumulativeLayoutShift = clsScore;
  } catch (e) {
    // CLS not available
  }

  return metrics;
}

/**
 * Measure bundle size from performance entries
 */
export function measureBundleSize(): { initial: number; total: number } {
  if (typeof window === 'undefined') {
    return { initial: 0, total: 0 };
  }

  const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  
  let initialSize = 0;
  let totalSize = 0;

  resources.forEach((resource) => {
    const size = resource.transferSize || resource.encodedBodySize || 0;
    totalSize += size;

    // Consider JS and CSS as initial bundle
    if (
      resource.name.includes('.js') ||
      resource.name.includes('.css') ||
      resource.initiatorType === 'script' ||
      resource.initiatorType === 'link'
    ) {
      initialSize += size;
    }
  });

  return { initial: initialSize, total: totalSize };
}

/**
 * Compare two performance measurements
 */
export function comparePerformance(
  baseline: Partial<PerformanceMetrics>,
  optimized: Partial<PerformanceMetrics>
): Partial<PerformanceComparison['improvements']> {
  const improvements: any = {};

  if (baseline.pageLoadTime && optimized.pageLoadTime) {
    const diff = baseline.pageLoadTime - optimized.pageLoadTime;
    improvements.pageLoadTime = {
      value: diff,
      percentage: (diff / baseline.pageLoadTime) * 100,
    };
  }

  if (baseline.timeToInteractive && optimized.timeToInteractive) {
    const diff = baseline.timeToInteractive - optimized.timeToInteractive;
    improvements.timeToInteractive = {
      value: diff,
      percentage: (diff / baseline.timeToInteractive) * 100,
    };
  }

  if (baseline.bundleSize && optimized.bundleSize) {
    const diff = baseline.bundleSize.total - optimized.bundleSize.total;
    improvements.bundleSize = {
      value: diff,
      percentage: (diff / baseline.bundleSize.total) * 100,
    };
  }

  if (baseline.cumulativeLayoutShift && optimized.cumulativeLayoutShift) {
    const diff = baseline.cumulativeLayoutShift - optimized.cumulativeLayoutShift;
    improvements.cumulativeLayoutShift = {
      value: diff,
      percentage: (diff / baseline.cumulativeLayoutShift) * 100,
    };
  }

  if (baseline.queryMetrics?.p95ResponseTime && optimized.queryMetrics?.p95ResponseTime) {
    const diff = baseline.queryMetrics.p95ResponseTime - optimized.queryMetrics.p95ResponseTime;
    improvements.queryResponseTime = {
      value: diff,
      percentage: (diff / baseline.queryMetrics.p95ResponseTime) * 100,
    };
  }

  return improvements;
}

/**
 * Validate performance against thresholds
 */
export function validatePerformanceThresholds(
  metrics: Partial<PerformanceMetrics>
): Array<{ metric: string; value: number; threshold: number; passed: boolean }> {
  const results: Array<{ metric: string; value: number; threshold: number; passed: boolean }> = [];

  if (metrics.pageLoadTime !== undefined) {
    results.push({
      metric: 'Page Load Time',
      value: metrics.pageLoadTime,
      threshold: PERFORMANCE_THRESHOLDS.pageLoadTime,
      passed: metrics.pageLoadTime < PERFORMANCE_THRESHOLDS.pageLoadTime,
    });
  }

  if (metrics.timeToInteractive !== undefined) {
    results.push({
      metric: 'Time to Interactive',
      value: metrics.timeToInteractive,
      threshold: PERFORMANCE_THRESHOLDS.timeToInteractive,
      passed: metrics.timeToInteractive < PERFORMANCE_THRESHOLDS.timeToInteractive,
    });
  }

  if (metrics.scrollFPS !== undefined) {
    results.push({
      metric: 'Scroll FPS',
      value: metrics.scrollFPS,
      threshold: PERFORMANCE_THRESHOLDS.scrollFPS,
      passed: metrics.scrollFPS >= PERFORMANCE_THRESHOLDS.scrollFPS,
    });
  }

  if (metrics.cumulativeLayoutShift !== undefined) {
    results.push({
      metric: 'Cumulative Layout Shift',
      value: metrics.cumulativeLayoutShift,
      threshold: PERFORMANCE_THRESHOLDS.cumulativeLayoutShift,
      passed: metrics.cumulativeLayoutShift < PERFORMANCE_THRESHOLDS.cumulativeLayoutShift,
    });
  }

  if (metrics.queryMetrics?.p95ResponseTime !== undefined) {
    results.push({
      metric: 'Query P95 Response Time',
      value: metrics.queryMetrics.p95ResponseTime,
      threshold: PERFORMANCE_THRESHOLDS.queryResponseTime,
      passed: metrics.queryMetrics.p95ResponseTime < PERFORMANCE_THRESHOLDS.queryResponseTime,
    });
  }

  return results;
}

/**
 * Generate performance report
 */
export function generatePerformanceReport(
  metrics: Partial<PerformanceMetrics>,
  comparison?: Partial<PerformanceComparison['improvements']>
): string {
  let report = '# Performance Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  report += '## Current Metrics\n\n';
  
  if (metrics.pageLoadTime !== undefined) {
    report += `- **Page Load Time**: ${metrics.pageLoadTime.toFixed(0)}ms\n`;
  }
  
  if (metrics.timeToInteractive !== undefined) {
    report += `- **Time to Interactive**: ${metrics.timeToInteractive.toFixed(0)}ms\n`;
  }
  
  if (metrics.firstContentfulPaint !== undefined) {
    report += `- **First Contentful Paint**: ${metrics.firstContentfulPaint.toFixed(0)}ms\n`;
  }
  
  if (metrics.cumulativeLayoutShift !== undefined) {
    report += `- **Cumulative Layout Shift**: ${metrics.cumulativeLayoutShift.toFixed(3)}\n`;
  }
  
  if (metrics.scrollFPS !== undefined) {
    report += `- **Scroll FPS**: ${metrics.scrollFPS.toFixed(1)}\n`;
  }
  
  if (metrics.bundleSize) {
    report += `- **Bundle Size (Initial)**: ${(metrics.bundleSize.initial / 1024).toFixed(2)} KB\n`;
    report += `- **Bundle Size (Total)**: ${(metrics.bundleSize.total / 1024).toFixed(2)} KB\n`;
  }
  
  if (metrics.queryMetrics) {
    report += `- **Query Avg Response**: ${metrics.queryMetrics.averageResponseTime.toFixed(0)}ms\n`;
    report += `- **Query P95 Response**: ${metrics.queryMetrics.p95ResponseTime.toFixed(0)}ms\n`;
  }

  if (comparison) {
    report += '\n## Improvements\n\n';
    
    Object.entries(comparison).forEach(([key, value]) => {
      if (value) {
        const sign = value.value > 0 ? '+' : '';
        report += `- **${key}**: ${sign}${value.value.toFixed(0)} (${sign}${value.percentage.toFixed(1)}%)\n`;
      }
    });
  }

  const thresholdResults = validatePerformanceThresholds(metrics);
  if (thresholdResults.length > 0) {
    report += '\n## Threshold Validation\n\n';
    
    thresholdResults.forEach((result) => {
      const status = result.passed ? '✅' : '❌';
      report += `${status} **${result.metric}**: ${result.value.toFixed(result.metric.includes('CLS') ? 3 : 0)} (threshold: ${result.threshold})\n`;
    });
  }

  return report;
}

/**
 * Save performance metrics to localStorage
 */
export function savePerformanceMetrics(
  key: string,
  metrics: Partial<PerformanceMetrics>
): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(`perf_${key}`, JSON.stringify({
      timestamp: Date.now(),
      metrics,
    }));
  } catch (e) {
    console.error('Failed to save performance metrics:', e);
  }
}

/**
 * Load performance metrics from localStorage
 */
export function loadPerformanceMetrics(key: string): Partial<PerformanceMetrics> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const data = localStorage.getItem(`perf_${key}`);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    return parsed.metrics;
  } catch (e) {
    console.error('Failed to load performance metrics:', e);
    return null;
  }
}
