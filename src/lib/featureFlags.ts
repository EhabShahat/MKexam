/**
 * Feature Flags for Optimization Features
 * 
 * Centralized configuration for enabling/disabling optimization features.
 * All flags can be controlled via environment variables for easy rollback.
 * 
 * @module featureFlags
 */

/**
 * Feature flag configuration
 */
export const featureFlags = {
  /**
   * Master switch - disables all optimizations when false
   */
  allOptimizations: process.env.DISABLE_ALL_OPTIMIZATIONS !== 'true',

  /**
   * Enable response compression (gzip/brotli)
   */
  compression: process.env.ENABLE_COMPRESSION !== 'false',

  /**
   * Enable caching layer
   */
  caching: process.env.ENABLE_CACHING !== 'false',

  /**
   * Enable field selection in RPC functions
   */
  fieldSelection: process.env.ENABLE_FIELD_SELECTION !== 'false',

  /**
   * Enable JSONB field optimization
   */
  jsonbOptimization: process.env.ENABLE_JSONB_OPTIMIZATION !== 'false',

  /**
   * Enable materialized views
   */
  materializedViews: process.env.ENABLE_MATERIALIZED_VIEWS !== 'false',

  /**
   * Enable Incremental Static Regeneration
   */
  isr: process.env.ENABLE_ISR !== 'false',

  /**
   * Enable batch processing
   */
  batchProcessing: process.env.ENABLE_BATCH_PROCESSING !== 'false',

  /**
   * Enable incremental question loading
   */
  incrementalLoading: process.env.ENABLE_INCREMENTAL_LOADING !== 'false',

  /**
   * Enable virtual scrolling for large lists
   */
  virtualScrolling: process.env.ENABLE_VIRTUAL_SCROLLING !== 'false',

} as const;

/**
 * Cache TTL configuration (in seconds)
 */
export const cacheTTL = {
  exam: parseInt(process.env.CACHE_TTL_EXAM || '300', 10), // 5 minutes
  questions: parseInt(process.env.CACHE_TTL_QUESTIONS || '-1', 10), // Infinite
  student: parseInt(process.env.CACHE_TTL_STUDENT || '600', 10), // 10 minutes
  config: parseInt(process.env.CACHE_TTL_CONFIG || '1800', 10), // 30 minutes
  ipRules: parseInt(process.env.CACHE_TTL_IP_RULES || '900', 10), // 15 minutes
} as const;

/**
 * Compression configuration
 */
export const compressionConfig = {
  threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024', 10), // 1KB
  algorithm: (process.env.COMPRESSION_ALGORITHM || 'gzip') as 'gzip' | 'brotli',
} as const;

/**
 * Performance thresholds for monitoring
 */
export const performanceThresholds = {
  maxErrorRate: parseFloat(process.env.MAX_ERROR_RATE || '0.02'), // 2%
  maxResponseTimeMs: parseInt(process.env.MAX_RESPONSE_TIME_MS || '5000', 10), // 5s
  minCacheHitRate: parseFloat(process.env.MIN_CACHE_HIT_RATE || '0.7'), // 70%
} as const;

/**
 * Check if a specific optimization is enabled
 * Takes into account the master switch
 */
export function isOptimizationEnabled(feature: keyof typeof featureFlags): boolean {
  if (!featureFlags.allOptimizations) {
    return false;
  }
  return featureFlags[feature] as boolean;
}

/**
 * Get effective cache TTL for a cache type
 */
export function getCacheTTL(cacheType: keyof typeof cacheTTL): number {
  if (!isOptimizationEnabled('caching')) {
    return 0; // No caching
  }
  return cacheTTL[cacheType];
}

/**
 * Check if compression should be applied
 */
export function shouldUseCompression(dataSize: number): boolean {
  if (!isOptimizationEnabled('compression')) {
    return false;
  }
  return dataSize >= compressionConfig.threshold;
}

/**
 * Get feature flags status for monitoring/debugging
 */
export function getFeatureFlagsStatus() {
  return {
    flags: featureFlags,
    cacheTTL,
    compressionConfig,
    performanceThresholds,
    environment: process.env.NODE_ENV,
  };
}
