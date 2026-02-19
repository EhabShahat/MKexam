// Performance Logging Utilities
// Utilities for collecting and logging performance metrics

import { supabaseServer } from '@/lib/supabase/server';
import type {
  LogMetricOptions,
  LogCacheStatsOptions,
  PerformanceSummaryOptions,
  CacheSummaryOptions,
  PerformanceSummary,
  CacheSummary,
  PerformanceMonitorConfig,
  SlowQuery,
} from './types';

/**
 * Default performance monitoring configuration
 */
const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  slowQueryThreshold: 1000, // 1 second
  egressThreshold: 1024 * 1024, // 1 MB
  functionTimeThreshold: 5000, // 5 seconds
  cacheHitRateThreshold: 70, // 70%
};

/**
 * Performance logger class for tracking metrics
 */
export class PerformanceLogger {
  private config: PerformanceMonitorConfig;
  private startTimes: Map<string, number>;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTimes = new Map();
  }

  /**
   * Log a performance metric to the database
   */
  async logMetric(options: LogMetricOptions): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const supabase = supabaseServer();
      const { data, error } = await supabase.rpc('log_performance_metric', {
        p_metric_type: options.metricType,
        p_operation: options.operation,
        p_value: options.value,
        p_metadata: options.metadata || {},
      });

      if (error) {
        console.error('Error logging performance metric:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to log performance metric:', error);
      return null;
    }
  }

  /**
   * Track Supabase egress bandwidth
   */
  async trackEgress(operation: string, bytes: number, metadata?: Record<string, any>): Promise<void> {
    await this.logMetric({
      metricType: 'egress',
      operation,
      value: bytes,
      metadata: {
        ...metadata,
        bytes,
        megabytes: bytes / (1024 * 1024),
      },
    });

    // Log warning if egress exceeds threshold
    if (bytes > this.config.egressThreshold) {
      console.warn(`High egress detected for ${operation}: ${(bytes / (1024 * 1024)).toFixed(2)} MB`);
    }
  }

  /**
   * Track Netlify function execution time
   */
  async trackFunctionExecution(functionName: string, duration: number, metadata?: Record<string, any>): Promise<void> {
    await this.logMetric({
      metricType: 'function_execution',
      operation: functionName,
      value: duration,
      metadata: {
        ...metadata,
        duration_ms: duration,
        duration_seconds: duration / 1000,
      },
    });

    // Log warning if function time exceeds threshold
    if (duration > this.config.functionTimeThreshold) {
      console.warn(`Slow function execution for ${functionName}: ${duration}ms`);
    }
  }

  /**
   * Track cache hit or miss
   */
  async trackCacheHit(cacheType: string, hit: boolean, metadata?: Record<string, any>): Promise<void> {
    await this.logMetric({
      metricType: 'cache_hit',
      operation: cacheType,
      value: hit ? 1 : 0,
      metadata: {
        ...metadata,
        hit,
        miss: !hit,
      },
    });
  }

  /**
   * Track database query execution time
   */
  async trackQueryTime(query: string, duration: number, metadata?: Record<string, any>): Promise<void> {
    await this.logMetric({
      metricType: 'query_time',
      operation: query,
      value: duration,
      metadata: {
        ...metadata,
        duration_ms: duration,
        duration_seconds: duration / 1000,
      },
    });

    // Log slow query if it exceeds threshold
    if (duration > this.config.slowQueryThreshold) {
      console.warn(`Slow query detected: ${query} (${duration}ms)`);
    }
  }

  /**
   * Track error occurrence
   */
  async trackError(operation: string, errorType: string, metadata?: Record<string, any>): Promise<void> {
    await this.logMetric({
      metricType: 'error',
      operation,
      value: 1,
      metadata: {
        ...metadata,
        error_type: errorType,
      },
    });
  }

  /**
   * Log cache statistics
   */
  async logCacheStats(options: LogCacheStatsOptions): Promise<string | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const supabase = supabaseServer();
      const { data, error } = await supabase.rpc('log_cache_statistics', {
        p_cache_type: options.cacheType,
        p_hits: options.hits,
        p_misses: options.misses,
        p_evictions: options.evictions || 0,
        p_size_bytes: options.sizeBytes || 0,
      });

      if (error) {
        console.error('Error logging cache statistics:', error);
        return null;
      }

      // Check cache hit rate
      const hitRate = (options.hits / (options.hits + options.misses)) * 100;
      if (hitRate < this.config.cacheHitRateThreshold) {
        console.warn(`Low cache hit rate for ${options.cacheType}: ${hitRate.toFixed(2)}%`);
      }

      return data;
    } catch (error) {
      console.error('Failed to log cache statistics:', error);
      return null;
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  /**
   * End timing an operation and log the duration
   */
  async endTimer(operationId: string, operation: string, metricType: 'function_execution' | 'query_time' = 'function_execution'): Promise<number> {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operationId);

    if (metricType === 'function_execution') {
      await this.trackFunctionExecution(operation, duration);
    } else {
      await this.trackQueryTime(operation, duration);
    }

    return duration;
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(options: PerformanceSummaryOptions = {}): Promise<PerformanceSummary[]> {
    try {
      const supabase = supabaseServer();
      const { data, error } = await supabase.rpc('get_performance_summary', {
        p_start_date: options.startDate?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        p_end_date: options.endDate?.toISOString() || new Date().toISOString(),
        p_metric_type: options.metricType || null,
      });

      if (error) {
        console.error('Error getting performance summary:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get performance summary:', error);
      return [];
    }
  }

  /**
   * Get cache summary
   */
  async getCacheSummary(options: CacheSummaryOptions = {}): Promise<CacheSummary[]> {
    try {
      const supabase = supabaseServer();
      const { data, error } = await supabase.rpc('get_cache_summary', {
        p_start_date: options.startDate?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        p_end_date: options.endDate?.toISOString() || new Date().toISOString(),
      });

      if (error) {
        console.error('Error getting cache summary:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get cache summary:', error);
      return [];
    }
  }

  /**
   * Get slow queries from the last period
   */
  async getSlowQueries(hours: number = 24, limit: number = 50): Promise<SlowQuery[]> {
    try {
      const supabase = supabaseServer();
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('performance_metrics')
        .select('operation, value, metadata, recorded_at')
        .eq('metric_type', 'query_time')
        .gte('recorded_at', startDate.toISOString())
        .gte('value', this.config.slowQueryThreshold)
        .order('value', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting slow queries:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        query: row.operation,
        duration: row.value,
        timestamp: row.recorded_at,
        metadata: row.metadata,
      }));
    } catch (error) {
      console.error('Failed to get slow queries:', error);
      return [];
    }
  }
}

/**
 * Create a singleton instance of the performance logger
 */
let performanceLogger: PerformanceLogger | null = null;

export function getPerformanceLogger(config?: Partial<PerformanceMonitorConfig>): PerformanceLogger {
  if (!performanceLogger) {
    performanceLogger = new PerformanceLogger(config);
  }
  return performanceLogger;
}

/**
 * Convenience function to track function execution time
 */
export async function trackFunction<T>(
  functionName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const logger = getPerformanceLogger();
  const operationId = `${functionName}-${Date.now()}`;
  
  logger.startTimer(operationId);
  try {
    const result = await fn();
    await logger.endTimer(operationId, functionName, 'function_execution');
    return result;
  } catch (error) {
    await logger.endTimer(operationId, functionName, 'function_execution');
    await logger.trackError(functionName, error instanceof Error ? error.name : 'Unknown', {
      ...metadata,
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Convenience function to track query execution time
 */
export async function trackQuery<T>(
  queryName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const logger = getPerformanceLogger();
  const operationId = `${queryName}-${Date.now()}`;
  
  logger.startTimer(operationId);
  try {
    const result = await fn();
    await logger.endTimer(operationId, queryName, 'query_time');
    return result;
  } catch (error) {
    await logger.endTimer(operationId, queryName, 'query_time');
    await logger.trackError(queryName, error instanceof Error ? error.name : 'Unknown', {
      ...metadata,
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
