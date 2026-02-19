/**
 * Performance Metrics Collection Service
 * 
 * Tracks and logs performance metrics including:
 * - Supabase egress bandwidth
 * - Netlify function execution time
 * - Cache hit rates
 * - Query execution time
 * - Error rates
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { supabaseServer } from '@/lib/supabase/server';

export type MetricType = 'egress' | 'function_execution' | 'cache_hit' | 'query_time' | 'error';

export interface PerformanceMetric {
  metric_type: MetricType;
  operation: string;
  value: number;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  cache_type: string;
  hits: number;
  misses: number;
  evictions: number;
  size_bytes: number;
}

/**
 * Track Supabase egress bandwidth
 * 
 * @param operation - The operation that generated egress (e.g., 'get_attempt_state', 'admin_list_attempts')
 * @param bytes - Number of bytes transferred
 * @param metadata - Optional metadata (e.g., exam_id, compression_ratio)
 * 
 * Requirement 9.1: Track Supabase egress metrics daily
 */
export async function trackEgress(
  operation: string,
  bytes: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const supabase = supabaseServer();
    
    await supabase.rpc('log_performance_metric', {
      p_metric_type: 'egress',
      p_operation: operation,
      p_value: bytes,
      p_metadata: metadata || {}
    });
  } catch (error) {
    // Log error but don't throw - metrics collection should not break app functionality
    console.error('Failed to track egress:', error);
  }
}

/**
 * Track Netlify function execution time
 * 
 * @param functionName - Name of the function (e.g., 'api/exams/[examId]/route')
 * @param durationMs - Execution time in milliseconds
 * @param metadata - Optional metadata (e.g., status_code, error)
 * 
 * Requirement 9.2: Log execution time for all Netlify functions
 */
export async function trackFunctionExecution(
  functionName: string,
  durationMs: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const supabase = supabaseServer();
    
    await supabase.rpc('log_performance_metric', {
      p_metric_type: 'function_execution',
      p_operation: functionName,
      p_value: durationMs,
      p_metadata: metadata || {}
    });
  } catch (error) {
    console.error('Failed to track function execution:', error);
  }
}

/**
 * Track cache hit or miss
 * 
 * @param cacheType - Type of cache (e.g., 'exam_metadata', 'questions', 'student_codes')
 * @param hit - Whether it was a cache hit (true) or miss (false)
 * @param metadata - Optional metadata (e.g., cache_key, ttl)
 * 
 * Requirement 9.4: Track cache hit rate per cache type
 */
export async function trackCacheHit(
  cacheType: string,
  hit: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const supabase = supabaseServer();
    
    await supabase.rpc('log_performance_metric', {
      p_metric_type: 'cache_hit',
      p_operation: cacheType,
      p_value: hit ? 1 : 0,
      p_metadata: metadata || {}
    });
  } catch (error) {
    console.error('Failed to track cache hit:', error);
  }
}

/**
 * Track database query execution time
 * 
 * @param queryName - Name or identifier of the query
 * @param durationMs - Query execution time in milliseconds
 * @param metadata - Optional metadata (e.g., query_text, row_count)
 * 
 * Requirement 9.3: Log slow queries exceeding 1 second
 */
export async function trackQueryTime(
  queryName: string,
  durationMs: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Only log slow queries (> 1000ms) to reduce noise
    if (durationMs > 1000) {
      const supabase = supabaseServer();
      
      await supabase.rpc('log_performance_metric', {
        p_metric_type: 'query_time',
        p_operation: queryName,
        p_value: durationMs,
        p_metadata: {
          ...metadata,
          slow_query: true
        }
      });
    }
  } catch (error) {
    console.error('Failed to track query time:', error);
  }
}

/**
 * Track error occurrence
 * 
 * @param operation - Operation where error occurred
 * @param errorType - Type of error (e.g., 'compression_failure', 'cache_timeout')
 * @param metadata - Optional metadata (e.g., error_message, stack_trace)
 * 
 * Requirement 9.6: Log error rates and types for monitoring
 */
export async function trackError(
  operation: string,
  errorType: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const supabase = supabaseServer();
    
    await supabase.rpc('log_performance_metric', {
      p_metric_type: 'error',
      p_operation: operation,
      p_value: 1,
      p_metadata: {
        ...metadata,
        error_type: errorType
      }
    });
  } catch (error) {
    console.error('Failed to track error:', error);
  }
}

/**
 * Update cache statistics
 * 
 * @param stats - Cache statistics to record
 */
export async function updateCacheStats(stats: CacheStats): Promise<void> {
  try {
    const supabase = supabaseServer();
    
    await supabase
      .from('cache_statistics')
      .insert({
        cache_type: stats.cache_type,
        hits: stats.hits,
        misses: stats.misses,
        evictions: stats.evictions,
        size_bytes: stats.size_bytes
      });
  } catch (error) {
    console.error('Failed to update cache stats:', error);
  }
}

/**
 * Utility function to measure and track function execution
 * 
 * @param functionName - Name of the function being measured
 * @param fn - Function to execute and measure
 * @returns Result of the function execution
 */
export async function measureAndTrack<T>(
  functionName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    
    await trackFunctionExecution(functionName, duration, {
      success: true
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await trackFunctionExecution(functionName, duration, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    await trackError(functionName, 'execution_error', {
      error_message: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw error;
  }
}

/**
 * Calculate bandwidth saved through caching
 * 
 * @param originalBytes - Original response size in bytes
 * @param cacheHit - Whether the request was served from cache
 * @returns Bandwidth saved in bytes
 */
export function calculateBandwidthSaved(
  originalBytes: number,
  cacheHit: boolean
): number {
  return cacheHit ? originalBytes : 0;
}

/**
 * Calculate compression ratio
 * 
 * @param originalSize - Original size in bytes
 * @param compressedSize - Compressed size in bytes
 * @returns Compression ratio as percentage (0-100)
 */
export function calculateCompressionRatio(
  originalSize: number,
  compressedSize: number
): number {
  if (originalSize === 0) return 0;
  return Math.round((1 - compressedSize / originalSize) * 100);
}
