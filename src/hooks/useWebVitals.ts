/**
 * Web Vitals Monitoring Hook
 * 
 * This hook sets up Web Vitals monitoring for the application.
 * It tracks CLS, FCP, LCP, TTFB, and INP metrics.
 * Note: INP (Interaction to Next Paint) replaces FID (First Input Delay) in web-vitals v4+
 */

import { useEffect, useState } from 'react';
import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals';
import type { Metric } from 'web-vitals';
import { convertWebVitalMetric, logPerformanceMetric } from '@/lib/performance';

interface WebVitalsMetrics {
  CLS?: number;
  FCP?: number;
  LCP?: number;
  TTFB?: number;
  INP?: number;
  FID?: number; // Keep for backward compatibility
}

/**
 * Hook to monitor Web Vitals metrics and return current values
 */
export function useWebVitals(): WebVitalsMetrics {
  const [metrics, setMetrics] = useState<WebVitalsMetrics>({});

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    const handleMetric = (metric: Metric) => {
      const event = convertWebVitalMetric(metric);
      logPerformanceMetric(event);
      
      // Update state with new metric value
      setMetrics(prev => ({
        ...prev,
        [metric.name]: metric.value
      }));
    };

    // Monitor all Web Vitals
    onCLS(handleMetric);
    onFCP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
    onINP(handleMetric); // INP replaces FID in web-vitals v4+
  }, []);

  return metrics;
}
