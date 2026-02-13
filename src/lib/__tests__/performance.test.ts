/**
 * Performance Monitoring Infrastructure Tests
 * 
 * Feature: performance-optimization-and-backend-fixes
 * Tests the performance metrics collection utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getMetricRating,
  formatMetricValue,
  formatBytes,
  QueryPerformanceTracker,
  measureScrollFPS,
  checkPerformanceThresholds,
  PERFORMANCE_THRESHOLDS,
  WEB_VITALS_THRESHOLDS,
  type PerformanceMetrics,
} from '../performance';

describe('Performance Monitoring Infrastructure', () => {
  describe('getMetricRating', () => {
    it('should return "good" for values below good threshold', () => {
      expect(getMetricRating('CLS', 0.05)).toBe('good');
      expect(getMetricRating('FID', 50)).toBe('good');
      expect(getMetricRating('LCP', 2000)).toBe('good');
    });

    it('should return "needs-improvement" for values between good and poor', () => {
      expect(getMetricRating('CLS', 0.15)).toBe('needs-improvement');
      expect(getMetricRating('FID', 200)).toBe('needs-improvement');
      expect(getMetricRating('LCP', 3000)).toBe('needs-improvement');
    });

    it('should return "poor" for values above poor threshold', () => {
      expect(getMetricRating('CLS', 0.3)).toBe('poor');
      expect(getMetricRating('FID', 400)).toBe('poor');
      expect(getMetricRating('LCP', 5000)).toBe('poor');
    });
  });

  describe('formatMetricValue', () => {
    it('should format CLS with 3 decimal places', () => {
      expect(formatMetricValue('CLS', 0.12345)).toBe('0.123');
    });

    it('should format time metrics in milliseconds', () => {
      expect(formatMetricValue('pageLoadTime', 1234.56)).toBe('1235ms');
      expect(formatMetricValue('FCP', 1800)).toBe('1800ms');
      expect(formatMetricValue('LCP', 2500)).toBe('2500ms');
    });

    it('should format FPS metrics', () => {
      expect(formatMetricValue('scrollFPS', 59.8)).toBe('60 FPS');
    });

    it('should format size metrics in bytes', () => {
      expect(formatMetricValue('bundleSize', 1024)).toBe('1 KB');
      expect(formatMetricValue('initialSize', 1048576)).toBe('1 MB');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(2621440)).toBe('2.5 MB');
    });
  });

  describe('QueryPerformanceTracker', () => {
    let tracker: QueryPerformanceTracker;

    beforeEach(() => {
      tracker = new QueryPerformanceTracker();
    });

    it('should track query execution times', () => {
      tracker.trackQuery('query1', 100);
      tracker.trackQuery('query2', 200);
      tracker.trackQuery('query3', 150);

      expect(tracker.getAverageResponseTime()).toBe(150);
    });

    it('should calculate 95th percentile correctly', () => {
      // Add 100 queries with varying times
      for (let i = 1; i <= 100; i++) {
        tracker.trackQuery(`query${i}`, i * 10);
      }

      const p95 = tracker.getP95ResponseTime();
      expect(p95).toBeGreaterThanOrEqual(900);
      expect(p95).toBeLessThanOrEqual(1000);
    });

    it('should identify slow queries', () => {
      tracker.trackQuery('fast-query', 100);
      tracker.trackQuery('slow-query', 500);
      tracker.trackQuery('very-slow-query', 800);

      const slowQueries = tracker.getSlowQueries();
      expect(slowQueries).toHaveLength(2);
      expect(slowQueries[0].query).toBe('slow-query');
      expect(slowQueries[1].query).toBe('very-slow-query');
    });

    it('should return metrics object', () => {
      tracker.trackQuery('query1', 100);
      tracker.trackQuery('query2', 400);

      const metrics = tracker.getMetrics();
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('p95ResponseTime');
      expect(metrics).toHaveProperty('slowQueries');
      expect(metrics.averageResponseTime).toBe(250);
    });

    it('should reset metrics', () => {
      tracker.trackQuery('query1', 100);
      tracker.trackQuery('query2', 200);

      tracker.reset();

      expect(tracker.getAverageResponseTime()).toBe(0);
      expect(tracker.getP95ResponseTime()).toBe(0);
      expect(tracker.getSlowQueries()).toHaveLength(0);
    });

    it('should handle empty tracker', () => {
      expect(tracker.getAverageResponseTime()).toBe(0);
      expect(tracker.getP95ResponseTime()).toBe(0);
      expect(tracker.getSlowQueries()).toHaveLength(0);
    });
  });

  describe('measureScrollFPS', () => {
    it('should measure scroll FPS', async () => {
      // Mock requestAnimationFrame
      let frameCallback: FrameRequestCallback | null = null;
      let frameCount = 0;
      
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frameCallback = callback;
        return ++frameCount;
      });

      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(16.67)
        .mockReturnValueOnce(33.33)
        .mockReturnValueOnce(50)
        .mockReturnValueOnce(1000);

      const fpsPromise = measureScrollFPS(1000);

      // Simulate frames
      if (frameCallback) {
        frameCallback(16.67);
        frameCallback(33.33);
        frameCallback(50);
        frameCallback(1000);
      }

      const fps = await fpsPromise;
      expect(fps).toBeGreaterThan(0);
    });
  });

  describe('checkPerformanceThresholds', () => {
    it('should pass when all metrics meet thresholds', () => {
      const metrics: Partial<PerformanceMetrics> = {
        pageLoadTime: 1500,
        timeToInteractive: 1800,
        scrollFPS: 60,
        cumulativeLayoutShift: 0.05,
        queryMetrics: {
          averageResponseTime: 200,
          p95ResponseTime: 400,
          slowQueries: [],
        },
      };

      const result = checkPerformanceThresholds(metrics);
      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when page load time exceeds threshold', () => {
      const metrics: Partial<PerformanceMetrics> = {
        pageLoadTime: 3000,
      };

      const result = checkPerformanceThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toContain('Page load time');
    });

    it('should fail when TTI exceeds threshold', () => {
      const metrics: Partial<PerformanceMetrics> = {
        timeToInteractive: 3000,
      };

      const result = checkPerformanceThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.failures[0]).toContain('Time to Interactive');
    });

    it('should fail when scroll FPS is below threshold', () => {
      const metrics: Partial<PerformanceMetrics> = {
        scrollFPS: 30,
      };

      const result = checkPerformanceThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.failures[0]).toContain('Scroll FPS');
    });

    it('should fail when CLS exceeds threshold', () => {
      const metrics: Partial<PerformanceMetrics> = {
        cumulativeLayoutShift: 0.3,
      };

      const result = checkPerformanceThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.failures[0]).toContain('CLS');
    });

    it('should fail when query p95 exceeds threshold', () => {
      const metrics: Partial<PerformanceMetrics> = {
        queryMetrics: {
          averageResponseTime: 300,
          p95ResponseTime: 600,
          slowQueries: [],
        },
      };

      const result = checkPerformanceThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.failures[0]).toContain('Query p95');
    });

    it('should report multiple failures', () => {
      const metrics: Partial<PerformanceMetrics> = {
        pageLoadTime: 3000,
        timeToInteractive: 3000,
        scrollFPS: 30,
        cumulativeLayoutShift: 0.3,
      };

      const result = checkPerformanceThresholds(metrics);
      expect(result.passed).toBe(false);
      expect(result.failures).toHaveLength(4);
    });
  });

  describe('Performance Thresholds', () => {
    it('should have correct threshold values', () => {
      expect(PERFORMANCE_THRESHOLDS.pageLoadTime).toBe(2000);
      expect(PERFORMANCE_THRESHOLDS.timeToInteractive).toBe(2000);
      expect(PERFORMANCE_THRESHOLDS.scrollFPS).toBe(60);
      expect(PERFORMANCE_THRESHOLDS.bundleSizeReduction).toBe(0.3);
      expect(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift).toBe(0.1);
      expect(PERFORMANCE_THRESHOLDS.queryResponseTime).toBe(500);
    });

    it('should have correct Web Vitals thresholds', () => {
      expect(WEB_VITALS_THRESHOLDS.CLS).toEqual({ good: 0.1, poor: 0.25 });
      expect(WEB_VITALS_THRESHOLDS.FID).toEqual({ good: 100, poor: 300 });
      expect(WEB_VITALS_THRESHOLDS.FCP).toEqual({ good: 1800, poor: 3000 });
      expect(WEB_VITALS_THRESHOLDS.LCP).toEqual({ good: 2500, poor: 4000 });
      expect(WEB_VITALS_THRESHOLDS.TTFB).toEqual({ good: 800, poor: 1800 });
      expect(WEB_VITALS_THRESHOLDS.INP).toEqual({ good: 200, poor: 500 });
    });
  });
});
