/**
 * Performance Metrics Collection Utility
 * 
 * This module provides utilities for collecting and reporting performance metrics
 * including Web Vitals, custom metrics, and performance monitoring.
 */

import type { Metric } from 'web-vitals';

/**
 * Performance metrics data structure
 */
export interface PerformanceMetrics {
  pageLoadTime: number; // milliseconds
  timeToInteractive: number; // milliseconds
  firstContentfulPaint: number; // milliseconds
  cumulativeLayoutShift: number; // score
  scrollFPS: number; // frames per second
  bundleSize: {
    initial: number; // bytes
    total: number; // bytes
  };
  queryMetrics: {
    averageResponseTime: number; // milliseconds
    p95ResponseTime: number; // milliseconds
    slowQueries: Array<{
      query: string;
      duration: number;
    }>;
  };
}

/**
 * Web Vitals metric names
 * Note: FID is deprecated in favor of INP in web-vitals v4+, but kept for backward compatibility
 */
export type WebVitalMetricName = 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB' | 'INP';

/**
 * Performance metric event
 */
export interface PerformanceMetricEvent {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

/**
 * Performance thresholds based on requirements
 */
export const PERFORMANCE_THRESHOLDS = {
  pageLoadTime: 2000, // 2 seconds
  timeToInteractive: 2000, // 2 seconds
  scrollFPS: 60, // 60 FPS
  bundleSizeReduction: 0.3, // 30% reduction
  cumulativeLayoutShift: 0.1, // CLS score
  queryResponseTime: 500, // 500ms for p95
} as const;

/**
 * Web Vitals thresholds
 * Note: FID thresholds kept for backward compatibility, INP is the preferred metric
 */
export const WEB_VITALS_THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 }, // Deprecated, use INP instead
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 }, // Replaces FID
} as const;

/**
 * Get rating for a Web Vital metric
 */
export function getMetricRating(
  name: WebVitalMetricName,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[name];
  if (!thresholds) return 'good';
  
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Format metric value for display
 */
export function formatMetricValue(name: string, value: number): string {
  if (name === 'CLS') {
    return value.toFixed(3);
  }
  if (name.includes('Time') || name.includes('FCP') || name.includes('LCP') || name.includes('TTFB') || name.includes('INP')) {
    return `${Math.round(value)}ms`;
  }
  if (name.includes('FPS')) {
    return `${Math.round(value)} FPS`;
  }
  if (name.includes('Size')) {
    return formatBytes(value);
  }
  return value.toString();
}

/**
 * Format bytes to human-readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Log performance metric to console (development) or analytics (production)
 */
export function logPerformanceMetric(metric: PerformanceMetricEvent): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Performance]', {
      name: metric.name,
      value: formatMetricValue(metric.name, metric.value),
      rating: metric.rating,
      id: metric.id,
    });
  }
  
  // In production, send to analytics service
  // This can be extended to send to services like Google Analytics, Datadog, etc.
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to analytics
    // analytics.track('performance_metric', metric);
  }
}

/**
 * Convert Web Vitals Metric to PerformanceMetricEvent
 */
export function convertWebVitalMetric(metric: Metric): PerformanceMetricEvent {
  return {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  };
}

/**
 * Measure scroll FPS
 */
export function measureScrollFPS(
  duration: number = 1000
): Promise<number> {
  return new Promise((resolve) => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;
    
    const measureFrame = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= duration) {
        const fps = (frameCount / (currentTime - lastTime)) * 1000;
        cancelAnimationFrame(rafId);
        resolve(fps);
      } else {
        rafId = requestAnimationFrame(measureFrame);
      }
    };
    
    rafId = requestAnimationFrame(measureFrame);
  });
}

/**
 * Measure query response time
 */
export class QueryPerformanceTracker {
  private queryTimes: number[] = [];
  private slowQueries: Array<{ query: string; duration: number }> = [];
  private readonly slowQueryThreshold = 300; // 300ms
  
  /**
   * Track a query execution
   */
  trackQuery(queryName: string, duration: number): void {
    this.queryTimes.push(duration);
    
    if (duration > this.slowQueryThreshold) {
      this.slowQueries.push({ query: queryName, duration });
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Performance] Slow query detected: ${queryName} (${duration}ms)`);
      }
    }
  }
  
  /**
   * Get average response time
   */
  getAverageResponseTime(): number {
    if (this.queryTimes.length === 0) return 0;
    const sum = this.queryTimes.reduce((a, b) => a + b, 0);
    return sum / this.queryTimes.length;
  }
  
  /**
   * Get 95th percentile response time
   */
  getP95ResponseTime(): number {
    if (this.queryTimes.length === 0) return 0;
    
    const sorted = [...this.queryTimes].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }
  
  /**
   * Get slow queries
   */
  getSlowQueries(): Array<{ query: string; duration: number }> {
    return [...this.slowQueries];
  }
  
  /**
   * Get query metrics
   */
  getMetrics(): PerformanceMetrics['queryMetrics'] {
    return {
      averageResponseTime: this.getAverageResponseTime(),
      p95ResponseTime: this.getP95ResponseTime(),
      slowQueries: this.getSlowQueries(),
    };
  }
  
  /**
   * Reset metrics
   */
  reset(): void {
    this.queryTimes = [];
    this.slowQueries = [];
  }
}

/**
 * Global query performance tracker instance
 */
export const queryPerformanceTracker = new QueryPerformanceTracker();

/**
 * Measure page load time using Navigation Timing API Level 2
 */
export function measurePageLoadTime(): number {
  if (typeof window === 'undefined') return 0;
  
  const perfEntries = window.performance.getEntriesByType('navigation');
  if (perfEntries.length === 0) return 0;
  
  const navTiming = perfEntries[0] as PerformanceNavigationTiming;
  return navTiming.loadEventEnd - navTiming.fetchStart;
}

/**
 * Get navigation timing metrics using Navigation Timing API Level 2
 */
export function getNavigationTimings(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  
  const perfEntries = window.performance.getEntriesByType('navigation');
  if (perfEntries.length === 0) return {};
  
  const navTiming = perfEntries[0] as PerformanceNavigationTiming;
  
  return {
    dns: navTiming.domainLookupEnd - navTiming.domainLookupStart,
    tcp: navTiming.connectEnd - navTiming.connectStart,
    request: navTiming.responseStart - navTiming.requestStart,
    response: navTiming.responseEnd - navTiming.responseStart,
    dom: navTiming.domComplete - navTiming.domContentLoadedEventStart,
    load: navTiming.loadEventEnd - navTiming.loadEventStart,
  };
}

/**
 * Check if performance meets thresholds
 */
export function checkPerformanceThresholds(metrics: Partial<PerformanceMetrics>): {
  passed: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  
  if (metrics.pageLoadTime && metrics.pageLoadTime > PERFORMANCE_THRESHOLDS.pageLoadTime) {
    failures.push(`Page load time: ${metrics.pageLoadTime}ms (threshold: ${PERFORMANCE_THRESHOLDS.pageLoadTime}ms)`);
  }
  
  if (metrics.timeToInteractive && metrics.timeToInteractive > PERFORMANCE_THRESHOLDS.timeToInteractive) {
    failures.push(`Time to Interactive: ${metrics.timeToInteractive}ms (threshold: ${PERFORMANCE_THRESHOLDS.timeToInteractive}ms)`);
  }
  
  if (metrics.scrollFPS && metrics.scrollFPS < PERFORMANCE_THRESHOLDS.scrollFPS) {
    failures.push(`Scroll FPS: ${metrics.scrollFPS} (threshold: ${PERFORMANCE_THRESHOLDS.scrollFPS})`);
  }
  
  if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > PERFORMANCE_THRESHOLDS.cumulativeLayoutShift) {
    failures.push(`CLS: ${metrics.cumulativeLayoutShift} (threshold: ${PERFORMANCE_THRESHOLDS.cumulativeLayoutShift})`);
  }
  
  if (metrics.queryMetrics?.p95ResponseTime && metrics.queryMetrics.p95ResponseTime > PERFORMANCE_THRESHOLDS.queryResponseTime) {
    failures.push(`Query p95: ${metrics.queryMetrics.p95ResponseTime}ms (threshold: ${PERFORMANCE_THRESHOLDS.queryResponseTime}ms)`);
  }
  
  return {
    passed: failures.length === 0,
    failures,
  };
}
