/**
 * Performance Monitor Component
 * 
 * This component sets up performance monitoring for the application.
 * It should be included in the root layout to track metrics across all pages.
 */

'use client';

import { useWebVitals } from '@/hooks/useWebVitals';

export function PerformanceMonitor() {
  useWebVitals();
  
  // This component doesn't render anything
  return null;
}
