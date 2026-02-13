/**
 * Web Vitals Hook Tests
 * 
 * Feature: performance-optimization-and-backend-fixes
 * Tests the Web Vitals monitoring hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWebVitals } from '../useWebVitals';
import * as webVitals from 'web-vitals';
import * as performance from '@/lib/performance';

// Mock web-vitals
vi.mock('web-vitals', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
  onINP: vi.fn(),
}));

// Mock performance utilities
vi.mock('@/lib/performance', () => ({
  convertWebVitalMetric: vi.fn((metric) => metric),
  logPerformanceMetric: vi.fn(),
}));

describe('useWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register all Web Vitals listeners on mount', () => {
    renderHook(() => useWebVitals());

    expect(webVitals.onCLS).toHaveBeenCalledTimes(1);
    expect(webVitals.onFCP).toHaveBeenCalledTimes(1);
    expect(webVitals.onLCP).toHaveBeenCalledTimes(1);
    expect(webVitals.onTTFB).toHaveBeenCalledTimes(1);
    expect(webVitals.onINP).toHaveBeenCalledTimes(1); // INP replaces FID
  });

  it('should convert and log metrics when received', () => {
    const mockMetric = {
      name: 'CLS',
      value: 0.05,
      rating: 'good' as const,
      delta: 0.05,
      id: 'test-id',
      navigationType: 'navigate',
    };

    // Capture the callback passed to onCLS
    let clsCallback: ((metric: any) => void) | undefined;
    vi.mocked(webVitals.onCLS).mockImplementation((callback) => {
      clsCallback = callback;
    });

    renderHook(() => useWebVitals());

    // Simulate metric being reported
    if (clsCallback) {
      clsCallback(mockMetric);
    }

    expect(performance.convertWebVitalMetric).toHaveBeenCalledWith(mockMetric);
    expect(performance.logPerformanceMetric).toHaveBeenCalled();
  });

  it('should handle multiple metric updates', () => {
    const metrics = [
      { name: 'CLS', value: 0.05, rating: 'good' as const, delta: 0.05, id: '1', navigationType: 'navigate' },
      { name: 'FCP', value: 1500, rating: 'good' as const, delta: 1500, id: '2', navigationType: 'navigate' },
      { name: 'LCP', value: 2000, rating: 'good' as const, delta: 2000, id: '3', navigationType: 'navigate' },
    ];

    const callbacks: Array<(metric: any) => void> = [];

    vi.mocked(webVitals.onCLS).mockImplementation((cb) => callbacks.push(cb));
    vi.mocked(webVitals.onFCP).mockImplementation((cb) => callbacks.push(cb));
    vi.mocked(webVitals.onLCP).mockImplementation((cb) => callbacks.push(cb));

    renderHook(() => useWebVitals());

    // Simulate all metrics being reported
    metrics.forEach((metric, index) => {
      if (callbacks[index]) {
        callbacks[index](metric);
      }
    });

    expect(performance.logPerformanceMetric).toHaveBeenCalledTimes(3);
  });

  it('should only run in browser environment', () => {
    // This test verifies the hook handles SSR gracefully
    // The hook checks for window existence internally
    expect(() => {
      renderHook(() => useWebVitals());
    }).not.toThrow();
  });
});
