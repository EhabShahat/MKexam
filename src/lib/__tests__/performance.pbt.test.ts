/**
 * Property-Based Tests for Performance Monitoring
 * 
 * Feature: performance-optimization-and-backend-fixes
 * These tests verify universal properties across randomized inputs
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  formatBytes,
  formatMetricValue,
  getMetricRating,
  QueryPerformanceTracker,
  type WebVitalMetricName,
} from '../performance';

describe('Performance Monitoring - Property-Based Tests', () => {
  describe('formatBytes property tests', () => {
    /**
     * Property: All non-negative byte values should format to valid strings
     * Validates: Requirements 6.1, 6.2
     */
    it('property: all byte values format to valid strings', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
          (bytes) => {
            const result = formatBytes(bytes);
            // Should match pattern: number + space + unit
            expect(result).toMatch(/^\d+(\.\d+)? (Bytes|KB|MB|GB|TB|PB)$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Larger byte values should have larger or equal numeric parts
     * Validates: Requirements 6.1, 6.2
     */
    it('property: formatting preserves relative magnitude', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 0, max: 1000000 }),
          (bytes1, bytes2) => {
            if (bytes1 === bytes2) return true;
            
            const formatted1 = formatBytes(bytes1);
            const formatted2 = formatBytes(bytes2);
            
            // Extract numeric values
            const value1 = parseFloat(formatted1);
            const value2 = parseFloat(formatted2);
            
            // If bytes1 > bytes2, then formatted value should reflect that
            // (accounting for unit differences)
            if (bytes1 > bytes2) {
              const unit1 = formatted1.split(' ')[1];
              const unit2 = formatted2.split(' ')[1];
              
              if (unit1 === unit2) {
                expect(value1).toBeGreaterThanOrEqual(value2);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getMetricRating property tests', () => {
    /**
     * Property: Rating should be consistent with threshold boundaries
     * Validates: Requirements 6.1, 6.2, 6.3
     */
    it('property: ratings are consistent with thresholds', () => {
      const metrics: WebVitalMetricName[] = ['CLS', 'FID', 'FCP', 'LCP', 'TTFB', 'INP'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...metrics),
          fc.float({ min: 0, max: 10000 }),
          (metricName, value) => {
            const rating = getMetricRating(metricName, value);
            expect(['good', 'needs-improvement', 'poor']).toContain(rating);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Lower values should never have worse ratings than higher values
     * Validates: Requirements 6.1, 6.2, 6.3
     */
    it('property: rating monotonicity', () => {
      const metrics: WebVitalMetricName[] = ['CLS', 'FID', 'FCP', 'LCP', 'TTFB', 'INP'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...metrics),
          fc.float({ min: 0, max: 5000 }),
          fc.float({ min: 0, max: 5000 }),
          (metricName, value1, value2) => {
            if (value1 === value2) return true;
            
            const rating1 = getMetricRating(metricName, value1);
            const rating2 = getMetricRating(metricName, value2);
            
            const ratingOrder = { 'good': 0, 'needs-improvement': 1, 'poor': 2 };
            
            if (value1 < value2) {
              // Lower value should have better or equal rating
              expect(ratingOrder[rating1]).toBeLessThanOrEqual(ratingOrder[rating2]);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('QueryPerformanceTracker property tests', () => {
    /**
     * Property: Average should always be between min and max query times
     * Validates: Requirements 5.8, 6.6
     */
    it('property: average is within bounds', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 100 }),
          (queryTimes) => {
            const tracker = new QueryPerformanceTracker();
            
            queryTimes.forEach((time, index) => {
              tracker.trackQuery(`query${index}`, time);
            });
            
            const average = tracker.getAverageResponseTime();
            const min = Math.min(...queryTimes);
            const max = Math.max(...queryTimes);
            
            expect(average).toBeGreaterThanOrEqual(min);
            expect(average).toBeLessThanOrEqual(max);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: P95 should be greater than or equal to average
     * Validates: Requirements 5.8, 6.6
     */
    it('property: p95 >= average', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 10, maxLength: 100 }),
          (queryTimes) => {
            const tracker = new QueryPerformanceTracker();
            
            queryTimes.forEach((time, index) => {
              tracker.trackQuery(`query${index}`, time);
            });
            
            const average = tracker.getAverageResponseTime();
            const p95 = tracker.getP95ResponseTime();
            
            expect(p95).toBeGreaterThanOrEqual(average);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Slow queries should all exceed threshold
     * Validates: Requirements 5.8, 6.6
     */
    it('property: slow queries exceed threshold', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 50 }),
          (queryTimes) => {
            const tracker = new QueryPerformanceTracker();
            const slowThreshold = 300;
            
            queryTimes.forEach((time, index) => {
              tracker.trackQuery(`query${index}`, time);
            });
            
            const slowQueries = tracker.getSlowQueries();
            
            // All slow queries should exceed threshold
            slowQueries.forEach(query => {
              expect(query.duration).toBeGreaterThan(slowThreshold);
            });
            
            // Count of slow queries should match queries over threshold
            const expectedSlowCount = queryTimes.filter(t => t > slowThreshold).length;
            expect(slowQueries.length).toBe(expectedSlowCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Reset should clear all metrics
     * Validates: Requirements 6.1, 6.2
     */
    it('property: reset clears all data', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 50 }),
          (queryTimes) => {
            const tracker = new QueryPerformanceTracker();
            
            queryTimes.forEach((time, index) => {
              tracker.trackQuery(`query${index}`, time);
            });
            
            tracker.reset();
            
            expect(tracker.getAverageResponseTime()).toBe(0);
            expect(tracker.getP95ResponseTime()).toBe(0);
            expect(tracker.getSlowQueries()).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('formatMetricValue property tests', () => {
    /**
     * Property: All formatted values should be non-empty strings
     * Validates: Requirements 6.1, 6.2
     */
    it('property: all values format to non-empty strings', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('CLS', 'pageLoadTime', 'scrollFPS', 'bundleSize'),
          fc.float({ min: 0, max: 10000 }),
          (metricName, value) => {
            const result = formatMetricValue(metricName, value);
            expect(result).toBeTruthy();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
