// Performance Monitoring Types
// TypeScript types for performance metrics and cache statistics

/**
 * Metric types for performance monitoring
 */
export type MetricType = 'egress' | 'function_execution' | 'cache_hit' | 'query_time' | 'error';

/**
 * Performance metric record
 */
export interface PerformanceMetric {
  id: string;
  metric_type: MetricType;
  operation: string;
  value: number;
  metadata?: Record<string, any>;
  recorded_at: string;
}

/**
 * Cache statistics record
 */
export interface CacheStatistics {
  id: string;
  cache_type: string;
  hits: number;
  misses: number;
  evictions: number;
  size_bytes: number;
  recorded_at: string;
}

/**
 * Performance summary with percentiles
 */
export interface PerformanceSummary {
  metric_type: MetricType;
  operation: string;
  total_count: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  p50_value: number;
  p95_value: number;
  p99_value: number;
}

/**
 * Cache summary with hit rates
 */
export interface CacheSummary {
  cache_type: string;
  total_hits: number;
  total_misses: number;
  hit_rate: number;
  total_evictions: number;
  avg_size_bytes: number;
}

/**
 * Performance metrics collection
 */
export interface PerformanceMetrics {
  totalEgress: number;
  egressByOperation: Record<string, number>;
  functionExecutionTime: Record<string, number>;
  cacheHitRate: Record<string, number>;
  slowQueries: SlowQuery[];
  costEstimate: CostEstimate;
}

/**
 * Slow query record
 */
export interface SlowQuery {
  query: string;
  duration: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Cost estimate breakdown
 */
export interface CostEstimate {
  supabaseEgress: number;
  netlifyFunctions: number;
  total: number;
  savings: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
}

/**
 * Options for logging performance metrics
 */
export interface LogMetricOptions {
  metricType: MetricType;
  operation: string;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Options for logging cache statistics
 */
export interface LogCacheStatsOptions {
  cacheType: string;
  hits: number;
  misses: number;
  evictions?: number;
  sizeBytes?: number;
}

/**
 * Options for querying performance summary
 */
export interface PerformanceSummaryOptions {
  startDate?: Date;
  endDate?: Date;
  metricType?: MetricType;
}

/**
 * Options for querying cache summary
 */
export interface CacheSummaryOptions {
  startDate?: Date;
  endDate?: Date;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitorConfig {
  enabled: boolean;
  slowQueryThreshold: number; // milliseconds
  egressThreshold: number; // bytes
  functionTimeThreshold: number; // milliseconds
  cacheHitRateThreshold: number; // percentage
}

/**
 * Alert thresholds for performance monitoring
 */
export interface PerformanceThresholds {
  egressPercentage: number; // Alert when egress exceeds this % of budget
  functionTimePercentage: number; // Alert when function time exceeds this % of budget
  cacheHitRate: number; // Alert when cache hit rate falls below this %
  slowQueryTime: number; // Alert when query time exceeds this (ms)
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  type: 'egress' | 'function_time' | 'cache_hit_rate' | 'slow_query';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}
