/**
 * Reordered Flow Performance Monitoring
 * 
 * This module provides specialized performance monitoring for the code-first
 * student experience flow, tracking render times, navigation transitions,
 * and network request optimization.
 */

import React from 'react';
import { performanceMonitor, trackQuery } from './performanceMonitor';
import { logPerformanceMetric, PERFORMANCE_THRESHOLDS } from './performance';
import type { PerformanceMetricEvent } from './performance';

/**
 * Performance metrics specific to the reordered flow
 */
export interface ReorderedFlowMetrics {
  codeInputRenderTime: number;
  navigationTransitionTime: number;
  codeValidationTime: number;
  mainPageRenderTime: number;
  totalFlowTime: number;
  networkRequestCount: number;
  cacheHitRate: number;
}

/**
 * Navigation transition types
 */
export type NavigationTransition = 
  | 'initial_load'
  | 'code_to_main'
  | 'main_to_code'
  | 'code_validation'
  | 'error_recovery';

/**
 * Performance tracking state for the reordered flow
 */
interface FlowPerformanceState {
  startTime: number;
  codeInputStartTime?: number;
  mainPageStartTime?: number;
  transitionStartTime?: number;
  networkRequests: Array<{
    type: string;
    startTime: number;
    endTime?: number;
    cached: boolean;
    success: boolean;
  }>;
  renderTimes: Map<string, number>;
}

/**
 * Global performance state for the current flow session
 */
let flowState: FlowPerformanceState = {
  startTime: performance.now(),
  networkRequests: [],
  renderTimes: new Map(),
};

/**
 * Reset flow performance tracking (call on new session)
 */
export function resetFlowPerformance(): void {
  flowState = {
    startTime: performance.now(),
    networkRequests: [],
    renderTimes: new Map(),
  };
}

/**
 * Track code input interface render time
 */
export function trackCodeInputRender(startTime: number, endTime: number): void {
  const renderTime = endTime - startTime;
  flowState.renderTimes.set('code_input', renderTime);
  
  const metric: PerformanceMetricEvent = {
    name: 'code_input_render_time',
    value: renderTime,
    rating: renderTime <= PERFORMANCE_THRESHOLDS.pageLoadTime ? 'good' : 
            renderTime <= PERFORMANCE_THRESHOLDS.pageLoadTime * 1.5 ? 'needs-improvement' : 'poor',
    delta: renderTime,
    id: `code_input_${Date.now()}`,
    navigationType: 'navigate',
  };
  
  logPerformanceMetric(metric);
  
  // Track with performance monitor
  performanceMonitor.trackCalculation(
    `code_input_render_${Date.now()}`,
    renderTime,
    'code_input_component',
    true,
    false
  );
  
  if (renderTime > PERFORMANCE_THRESHOLDS.pageLoadTime) {
    console.warn(`[ReorderedFlow] Slow code input render: ${renderTime}ms (threshold: ${PERFORMANCE_THRESHOLDS.pageLoadTime}ms)`);
  }
}

/**
 * Track main page render time
 */
export function trackMainPageRender(startTime: number, endTime: number): void {
  const renderTime = endTime - startTime;
  flowState.renderTimes.set('main_page', renderTime);
  
  const metric: PerformanceMetricEvent = {
    name: 'main_page_render_time',
    value: renderTime,
    rating: renderTime <= PERFORMANCE_THRESHOLDS.pageLoadTime ? 'good' : 
            renderTime <= PERFORMANCE_THRESHOLDS.pageLoadTime * 1.5 ? 'needs-improvement' : 'poor',
    delta: renderTime,
    id: `main_page_${Date.now()}`,
    navigationType: 'navigate',
  };
  
  logPerformanceMetric(metric);
  
  // Track with performance monitor
  performanceMonitor.trackCalculation(
    `main_page_render_${Date.now()}`,
    renderTime,
    'main_page_component',
    true,
    false
  );
  
  if (renderTime > PERFORMANCE_THRESHOLDS.pageLoadTime) {
    console.warn(`[ReorderedFlow] Slow main page render: ${renderTime}ms (threshold: ${PERFORMANCE_THRESHOLDS.pageLoadTime}ms)`);
  }
}

/**
 * Track navigation transition performance
 */
export function trackNavigationTransition(
  transitionType: NavigationTransition,
  startTime: number,
  endTime: number,
  metadata?: Record<string, any>
): void {
  const transitionTime = endTime - startTime;
  const transitionThreshold = 300; // 300ms threshold for smooth transitions
  
  const metric: PerformanceMetricEvent = {
    name: `navigation_transition_${transitionType}`,
    value: transitionTime,
    rating: transitionTime <= transitionThreshold ? 'good' : 
            transitionTime <= transitionThreshold * 1.5 ? 'needs-improvement' : 'poor',
    delta: transitionTime,
    id: `transition_${transitionType}_${Date.now()}`,
    navigationType: 'navigate',
  };
  
  logPerformanceMetric(metric);
  
  // Track with performance monitor
  performanceMonitor.trackSyncOperation(
    `navigation_${transitionType}_${Date.now()}`,
    transitionType,
    transitionTime,
    1,
    true,
    0
  );
  
  if (transitionTime > transitionThreshold) {
    console.warn(`[ReorderedFlow] Slow navigation transition (${transitionType}): ${transitionTime}ms (threshold: ${transitionThreshold}ms)`);
  }
  
  // Log additional metadata if provided
  if (metadata && process.env.NODE_ENV === 'development') {
    console.log(`[ReorderedFlow] Navigation ${transitionType}:`, {
      duration: `${transitionTime}ms`,
      ...metadata,
    });
  }
}

/**
 * Track code validation performance
 */
export function trackCodeValidation(
  startTime: number,
  endTime: number,
  success: boolean,
  cached: boolean = false,
  metadata?: Record<string, any>
): void {
  const validationTime = endTime - startTime;
  const validationThreshold = 1000; // 1 second threshold for code validation
  
  const metric: PerformanceMetricEvent = {
    name: 'code_validation_time',
    value: validationTime,
    rating: validationTime <= validationThreshold ? 'good' : 
            validationTime <= validationThreshold * 1.5 ? 'needs-improvement' : 'poor',
    delta: validationTime,
    id: `validation_${Date.now()}`,
    navigationType: 'navigate',
  };
  
  logPerformanceMetric(metric);
  
  // Track with performance monitor
  performanceMonitor.trackCalculation(
    `code_validation_${Date.now()}`,
    validationTime,
    'code_validation',
    success,
    cached
  );
  
  // Track network request
  flowState.networkRequests.push({
    type: 'code_validation',
    startTime,
    endTime,
    cached,
    success,
  });
  
  if (validationTime > validationThreshold) {
    console.warn(`[ReorderedFlow] Slow code validation: ${validationTime}ms (threshold: ${validationThreshold}ms)`);
  }
  
  // Log additional metadata if provided
  if (metadata && process.env.NODE_ENV === 'development') {
    console.log(`[ReorderedFlow] Code validation:`, {
      duration: `${validationTime}ms`,
      success,
      cached,
      ...metadata,
    });
  }
}

/**
 * Track network request performance with optimization detection
 */
export function trackNetworkRequest(
  requestType: string,
  startTime: number,
  endTime: number,
  success: boolean,
  cached: boolean = false,
  metadata?: Record<string, any>
): void {
  const requestTime = endTime - startTime;
  const requestThreshold = 500; // 500ms threshold for network requests
  
  // Add to flow state
  flowState.networkRequests.push({
    type: requestType,
    startTime,
    endTime,
    cached,
    success,
  });
  
  const metric: PerformanceMetricEvent = {
    name: `network_request_${requestType}`,
    value: requestTime,
    rating: requestTime <= requestThreshold ? 'good' : 
            requestTime <= requestThreshold * 1.5 ? 'needs-improvement' : 'poor',
    delta: requestTime,
    id: `request_${requestType}_${Date.now()}`,
    navigationType: 'navigate',
  };
  
  logPerformanceMetric(metric);
  
  // Track with performance monitor
  trackQuery(
    `${requestType}_${Date.now()}`,
    requestType,
    requestTime,
    success
  );
  
  if (requestTime > requestThreshold && !cached) {
    console.warn(`[ReorderedFlow] Slow network request (${requestType}): ${requestTime}ms (threshold: ${requestThreshold}ms)`);
  }
  
  // Log cache hit for optimization tracking
  if (cached && process.env.NODE_ENV === 'development') {
    console.log(`[ReorderedFlow] Cache hit for ${requestType}: ${requestTime}ms`);
  }
  
  // Log additional metadata if provided
  if (metadata && process.env.NODE_ENV === 'development') {
    console.log(`[ReorderedFlow] Network request ${requestType}:`, {
      duration: `${requestTime}ms`,
      success,
      cached,
      ...metadata,
    });
  }
}

/**
 * Get comprehensive flow performance metrics
 */
export function getFlowPerformanceMetrics(): ReorderedFlowMetrics {
  const currentTime = performance.now();
  const totalFlowTime = currentTime - flowState.startTime;
  
  // Calculate cache hit rate
  const totalRequests = flowState.networkRequests.length;
  const cachedRequests = flowState.networkRequests.filter(req => req.cached).length;
  const cacheHitRate = totalRequests > 0 ? (cachedRequests / totalRequests) * 100 : 0;
  
  return {
    codeInputRenderTime: flowState.renderTimes.get('code_input') || 0,
    mainPageRenderTime: flowState.renderTimes.get('main_page') || 0,
    navigationTransitionTime: getAverageTransitionTime(),
    codeValidationTime: getAverageValidationTime(),
    totalFlowTime,
    networkRequestCount: totalRequests,
    cacheHitRate,
  };
}

/**
 * Get average navigation transition time
 */
function getAverageTransitionTime(): number {
  const transitionTimes = Array.from(flowState.renderTimes.values());
  if (transitionTimes.length === 0) return 0;
  
  const sum = transitionTimes.reduce((acc, time) => acc + time, 0);
  return sum / transitionTimes.length;
}

/**
 * Get average code validation time
 */
function getAverageValidationTime(): number {
  const validationRequests = flowState.networkRequests.filter(req => req.type === 'code_validation');
  if (validationRequests.length === 0) return 0;
  
  const totalTime = validationRequests.reduce((acc, req) => {
    return acc + (req.endTime ? req.endTime - req.startTime : 0);
  }, 0);
  
  return totalTime / validationRequests.length;
}

/**
 * Check if flow performance meets requirements
 */
export function checkFlowPerformanceThresholds(): {
  passed: boolean;
  failures: string[];
  metrics: ReorderedFlowMetrics;
} {
  const metrics = getFlowPerformanceMetrics();
  const failures: string[] = [];
  
  // Check render time thresholds (Requirements 7.1)
  if (metrics.codeInputRenderTime > PERFORMANCE_THRESHOLDS.pageLoadTime) {
    failures.push(`Code input render time: ${metrics.codeInputRenderTime}ms (threshold: ${PERFORMANCE_THRESHOLDS.pageLoadTime}ms)`);
  }
  
  if (metrics.mainPageRenderTime > PERFORMANCE_THRESHOLDS.pageLoadTime) {
    failures.push(`Main page render time: ${metrics.mainPageRenderTime}ms (threshold: ${PERFORMANCE_THRESHOLDS.pageLoadTime}ms)`);
  }
  
  // Check navigation transition threshold (Requirements 7.2)
  if (metrics.navigationTransitionTime > 300) {
    failures.push(`Navigation transition time: ${metrics.navigationTransitionTime}ms (threshold: 300ms)`);
  }
  
  // Check code validation threshold (Requirements 7.3)
  if (metrics.codeValidationTime > 1000) {
    failures.push(`Code validation time: ${metrics.codeValidationTime}ms (threshold: 1000ms)`);
  }
  
  // Check network request optimization (Requirements 7.5)
  if (metrics.networkRequestCount > 5) {
    failures.push(`Too many network requests: ${metrics.networkRequestCount} (threshold: 5)`);
  }
  
  return {
    passed: failures.length === 0,
    failures,
    metrics,
  };
}

/**
 * Log flow performance summary
 */
export function logFlowPerformanceSummary(): void {
  const metrics = getFlowPerformanceMetrics();
  const thresholdCheck = checkFlowPerformanceThresholds();
  
  console.log('[ReorderedFlow] Performance Summary:', {
    codeInputRender: `${metrics.codeInputRenderTime}ms`,
    mainPageRender: `${metrics.mainPageRenderTime}ms`,
    navigationTransition: `${metrics.navigationTransitionTime}ms`,
    codeValidation: `${metrics.codeValidationTime}ms`,
    totalFlowTime: `${metrics.totalFlowTime}ms`,
    networkRequests: metrics.networkRequestCount,
    cacheHitRate: `${metrics.cacheHitRate.toFixed(1)}%`,
    thresholdsPassed: thresholdCheck.passed,
  });
  
  if (!thresholdCheck.passed) {
    console.warn('[ReorderedFlow] Performance threshold failures:', thresholdCheck.failures);
  }
}

/**
 * Performance measurement wrapper for React components
 */
export function withRenderTimeTracking<T extends Record<string, any>>(
  componentName: string,
  Component: React.ComponentType<T>
): React.ComponentType<T> {
  return function PerformanceTrackedComponent(props: T) {
    const startTime = performance.now();
    
    React.useEffect(() => {
      const endTime = performance.now();
      
      if (componentName === 'CodeInputForm' || componentName === 'MultiExamEntry') {
        trackCodeInputRender(startTime, endTime);
      } else if (componentName === 'PublicHome') {
        trackMainPageRender(startTime, endTime);
      }
    }, []);
    
    return React.createElement(Component, props);
  };
}

/**
 * Hook for tracking component render performance
 */
export function useRenderPerformance(componentName: string): void {
  const startTime = React.useRef(performance.now());
  
  React.useEffect(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;
    
    if (componentName === 'CodeInputForm' || componentName === 'MultiExamEntry') {
      trackCodeInputRender(startTime.current, endTime);
    } else if (componentName === 'PublicHome') {
      trackMainPageRender(startTime.current, endTime);
    }
  }, [componentName]);
}

/**
 * Network request optimization utilities
 */
export const networkOptimization = {
  /**
   * Debounce function for reducing API calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  },

  /**
   * Cache wrapper for API responses
   */
  withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<T> {
    const cached = sessionStorage.getItem(`cache_${key}`);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < ttl) {
          return Promise.resolve(data);
        }
      } catch {
        // Invalid cache, continue to fetch
      }
    }

    return fetcher().then(data => {
      try {
        sessionStorage.setItem(`cache_${key}`, JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
      } catch {
        // Storage failed, but return data anyway
      }
      return data;
    });
  },

  /**
   * Batch multiple requests together
   */
  batchRequests<T>(
    requests: Array<() => Promise<T>>,
    batchSize: number = 3
  ): Promise<T[]> {
    const batches: Array<Array<() => Promise<T>>> = [];
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    return batches.reduce(async (acc, batch) => {
      const results = await acc;
      const batchResults = await Promise.all(batch.map(req => req()));
      return [...results, ...batchResults];
    }, Promise.resolve([] as T[]));
  },
};