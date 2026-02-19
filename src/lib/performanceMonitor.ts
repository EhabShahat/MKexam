/**
 * Performance Monitor Module
 * 
 * Provides comprehensive performance monitoring for score calculations,
 * batch processing, and database operations. Tracks timing metrics,
 * identifies bottlenecks, and logs slow operations.
 * 
 * @module performanceMonitor
 */

import { queryPerformanceTracker } from './performance';

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitorConfig {
  /** Enable performance monitoring (default: true) */
  enabled: boolean;
  /** Threshold for slow calculations in milliseconds (default: 1000) */
  slowCalculationThreshold: number;
  /** Threshold for slow database queries in milliseconds (default: 500) */
  slowQueryThreshold: number;
  /** Threshold for slow batch operations in milliseconds (default: 5000) */
  slowBatchThreshold: number;
  /** Maximum number of performance entries to keep in memory (default: 1000) */
  maxEntries: number;
  /** Whether to log performance metrics to console (default: development mode) */
  logToConsole: boolean;
}

/**
 * Performance metric entry
 */
export interface PerformanceEntry {
  id: string;
  timestamp: string;
  operation: string;
  duration: number;
  metadata?: Record<string, any>;
  isSlow: boolean;
  category: 'calculation' | 'batch' | 'query' | 'sync';
}

/**
 * Batch processing performance metrics
 */
export interface BatchPerformanceMetrics {
  totalBatches: number;
  averageBatchDuration: number;
  slowBatches: number;
  totalStudentsProcessed: number;
  averageStudentsPerSecond: number;
  cacheHitRate: number;
  lastBatchDuration?: number;
  lastBatchSize?: number;
}

/**
 * Database query performance metrics
 */
export interface QueryPerformanceMetrics {
  totalQueries: number;
  averageQueryDuration: number;
  slowQueries: number;
  queryTypes: Record<string, {
    count: number;
    averageDuration: number;
    slowCount: number;
  }>;
}

/**
 * Overall performance summary
 */
export interface PerformanceSummary {
  calculations: {
    total: number;
    averageDuration: number;
    slowCount: number;
  };
  batches: BatchPerformanceMetrics;
  queries: QueryPerformanceMetrics;
  uptime: number;
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * Performance Monitor class
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private entries: PerformanceEntry[] = [];
  private batchMetrics: BatchPerformanceMetrics;
  private queryMetrics: QueryPerformanceMetrics;
  private startTime: number;

  constructor(config?: Partial<PerformanceMonitorConfig>) {
    this.config = {
      enabled: true,
      slowCalculationThreshold: 1000,
      slowQueryThreshold: 500,
      slowBatchThreshold: 5000,
      maxEntries: 1000,
      logToConsole: process.env.NODE_ENV === 'development',
      ...config,
    };

    this.batchMetrics = {
      totalBatches: 0,
      averageBatchDuration: 0,
      slowBatches: 0,
      totalStudentsProcessed: 0,
      averageStudentsPerSecond: 0,
      cacheHitRate: 0,
    };

    this.queryMetrics = {
      totalQueries: 0,
      averageQueryDuration: 0,
      slowQueries: 0,
      queryTypes: {},
    };

    this.startTime = Date.now();
  }

  /**
   * Track a calculation performance
   */
  trackCalculation(
    operationId: string,
    duration: number,
    studentCode: string,
    success: boolean,
    cached: boolean = false
  ): void {
    if (!this.config.enabled) return;

    const isSlow = duration > this.config.slowCalculationThreshold;
    
    const entry: PerformanceEntry = {
      id: operationId,
      timestamp: new Date().toISOString(),
      operation: 'calculation',
      duration,
      isSlow,
      category: 'calculation',
      metadata: {
        studentCode,
        success,
        cached,
      },
    };

    this.addEntry(entry);

    if (isSlow && this.config.logToConsole) {
      console.warn(`[PerformanceMonitor] Slow calculation: ${studentCode} (${duration}ms)`);
    }
  }

  /**
   * Track batch processing performance
   */
  trackBatchProcessing(
    batchId: string,
    duration: number,
    studentCount: number,
    cacheHits: number,
    cacheMisses: number,
    errors: number = 0
  ): void {
    if (!this.config.enabled) return;

    const isSlow = duration > this.config.slowBatchThreshold;
    const studentsPerSecond = studentCount / (duration / 1000);
    const cacheHitRate = cacheHits / (cacheHits + cacheMisses);

    // Update batch metrics
    this.batchMetrics.totalBatches++;
    this.batchMetrics.totalStudentsProcessed += studentCount;
    this.batchMetrics.lastBatchDuration = duration;
    this.batchMetrics.lastBatchSize = studentCount;

    // Update average batch duration
    const totalDuration = this.batchMetrics.averageBatchDuration * (this.batchMetrics.totalBatches - 1) + duration;
    this.batchMetrics.averageBatchDuration = totalDuration / this.batchMetrics.totalBatches;

    // Update average students per second
    const totalStudentsPerSecond = this.batchMetrics.averageStudentsPerSecond * (this.batchMetrics.totalBatches - 1) + studentsPerSecond;
    this.batchMetrics.averageStudentsPerSecond = totalStudentsPerSecond / this.batchMetrics.totalBatches;

    // Update cache hit rate
    const totalCacheRate = this.batchMetrics.cacheHitRate * (this.batchMetrics.totalBatches - 1) + cacheHitRate;
    this.batchMetrics.cacheHitRate = totalCacheRate / this.batchMetrics.totalBatches;

    if (isSlow) {
      this.batchMetrics.slowBatches++;
    }

    const entry: PerformanceEntry = {
      id: batchId,
      timestamp: new Date().toISOString(),
      operation: 'batch_processing',
      duration,
      isSlow,
      category: 'batch',
      metadata: {
        studentCount,
        studentsPerSecond: Math.round(studentsPerSecond * 100) / 100,
        cacheHits,
        cacheMisses,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        errors,
      },
    };

    this.addEntry(entry);

    if (this.config.logToConsole) {
      const message = isSlow 
        ? `[PerformanceMonitor] Slow batch processing: ${studentCount} students in ${duration}ms (${studentsPerSecond.toFixed(1)} students/sec)`
        : `[PerformanceMonitor] Batch processed: ${studentCount} students in ${duration}ms (${studentsPerSecond.toFixed(1)} students/sec)`;
      
      if (isSlow) {
        console.warn(message);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Track database query performance
   */
  trackQuery(
    queryId: string,
    queryType: string,
    duration: number,
    success: boolean = true,
    rowCount?: number
  ): void {
    if (!this.config.enabled) return;

    const isSlow = duration > this.config.slowQueryThreshold;

    // Update query metrics
    this.queryMetrics.totalQueries++;
    
    // Update average query duration
    const totalDuration = this.queryMetrics.averageQueryDuration * (this.queryMetrics.totalQueries - 1) + duration;
    this.queryMetrics.averageQueryDuration = totalDuration / this.queryMetrics.totalQueries;

    if (isSlow) {
      this.queryMetrics.slowQueries++;
    }

    // Update query type metrics
    if (!this.queryMetrics.queryTypes[queryType]) {
      this.queryMetrics.queryTypes[queryType] = {
        count: 0,
        averageDuration: 0,
        slowCount: 0,
      };
    }

    const typeMetrics = this.queryMetrics.queryTypes[queryType];
    typeMetrics.count++;
    
    const typeTotalDuration = typeMetrics.averageDuration * (typeMetrics.count - 1) + duration;
    typeMetrics.averageDuration = typeTotalDuration / typeMetrics.count;
    
    if (isSlow) {
      typeMetrics.slowCount++;
    }

    // Track with global query performance tracker
    queryPerformanceTracker.trackQuery(queryType, duration);

    const entry: PerformanceEntry = {
      id: queryId,
      timestamp: new Date().toISOString(),
      operation: `query_${queryType}`,
      duration,
      isSlow,
      category: 'query',
      metadata: {
        queryType,
        success,
        rowCount,
      },
    };

    this.addEntry(entry);

    if (isSlow && this.config.logToConsole) {
      console.warn(`[PerformanceMonitor] Slow query: ${queryType} (${duration}ms)${rowCount ? ` - ${rowCount} rows` : ''}`);
    }
  }

  /**
   * Track sync operation performance
   */
  trackSyncOperation(
    syncId: string,
    syncType: string,
    duration: number,
    recordsProcessed: number,
    success: boolean = true,
    errors: number = 0
  ): void {
    if (!this.config.enabled) return;

    const isSlow = duration > this.config.slowCalculationThreshold; // Use calculation threshold for sync
    const recordsPerSecond = recordsProcessed / (duration / 1000);

    const entry: PerformanceEntry = {
      id: syncId,
      timestamp: new Date().toISOString(),
      operation: `sync_${syncType}`,
      duration,
      isSlow,
      category: 'sync',
      metadata: {
        syncType,
        recordsProcessed,
        recordsPerSecond: Math.round(recordsPerSecond * 100) / 100,
        success,
        errors,
      },
    };

    this.addEntry(entry);

    if (this.config.logToConsole) {
      const message = `[PerformanceMonitor] Sync ${syncType}: ${recordsProcessed} records in ${duration}ms (${recordsPerSecond.toFixed(1)} records/sec)`;
      
      if (isSlow) {
        console.warn(message);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): PerformanceSummary {
    const calculationEntries = this.entries.filter(e => e.category === 'calculation');
    const uptime = Date.now() - this.startTime;

    const summary: PerformanceSummary = {
      calculations: {
        total: calculationEntries.length,
        averageDuration: calculationEntries.length > 0 
          ? calculationEntries.reduce((sum, e) => sum + e.duration, 0) / calculationEntries.length
          : 0,
        slowCount: calculationEntries.filter(e => e.isSlow).length,
      },
      batches: { ...this.batchMetrics },
      queries: { ...this.queryMetrics },
      uptime,
    };

    // Add memory usage if available (Node.js environment only, not Edge Runtime or browser)
    // Check for Edge Runtime by looking for global scope
    const isEdgeRuntime = typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis;
    const isNodeRuntime = typeof process !== 'undefined' && 
                          typeof window === 'undefined' && 
                          !isEdgeRuntime;
    
    if (isNodeRuntime) {
      try {
        // Only access process.memoryUsage if we're certain we're in Node.js runtime
        if (typeof process.memoryUsage === 'function') {
          const memUsage = process.memoryUsage();
          summary.memoryUsage = {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
          };
        }
      } catch (error) {
        // Silently handle Edge Runtime or other environments where process.memoryUsage is not available
      }
    }

    return summary;
  }

  /**
   * Get recent performance entries
   */
  getRecentEntries(limit: number = 100): PerformanceEntry[] {
    return this.entries.slice(-limit);
  }

  /**
   * Get slow operations
   */
  getSlowOperations(limit: number = 50): PerformanceEntry[] {
    return this.entries
      .filter(entry => entry.isSlow)
      .slice(-limit);
  }

  /**
   * Get entries by category
   */
  getEntriesByCategory(category: PerformanceEntry['category'], limit: number = 100): PerformanceEntry[] {
    return this.entries
      .filter(entry => entry.category === category)
      .slice(-limit);
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.entries = [];
    this.batchMetrics = {
      totalBatches: 0,
      averageBatchDuration: 0,
      slowBatches: 0,
      totalStudentsProcessed: 0,
      averageStudentsPerSecond: 0,
      cacheHitRate: 0,
    };
    this.queryMetrics = {
      totalQueries: 0,
      averageQueryDuration: 0,
      slowQueries: 0,
      queryTypes: {},
    };
    this.startTime = Date.now();
    queryPerformanceTracker.reset();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  /**
   * Add performance entry with automatic cleanup
   */
  private addEntry(entry: PerformanceEntry): void {
    this.entries.push(entry);
    
    // Keep only the most recent entries to prevent memory issues
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries);
    }
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Convenience functions for performance tracking
 */
export const trackCalculation = (
  operationId: string,
  duration: number,
  studentCode: string,
  success: boolean,
  cached?: boolean
): void => performanceMonitor.trackCalculation(operationId, duration, studentCode, success, cached);

export const trackBatchProcessing = (
  batchId: string,
  duration: number,
  studentCount: number,
  cacheHits: number,
  cacheMisses: number,
  errors?: number
): void => performanceMonitor.trackBatchProcessing(batchId, duration, studentCount, cacheHits, cacheMisses, errors);

export const trackQuery = (
  queryId: string,
  queryType: string,
  duration: number,
  success?: boolean,
  rowCount?: number
): void => performanceMonitor.trackQuery(queryId, queryType, duration, success, rowCount);

export const trackSyncOperation = (
  syncId: string,
  syncType: string,
  duration: number,
  recordsProcessed: number,
  success?: boolean,
  errors?: number
): void => performanceMonitor.trackSyncOperation(syncId, syncType, duration, recordsProcessed, success, errors);

/**
 * Get performance summary
 */
export const getPerformanceSummary = (): PerformanceSummary => 
  performanceMonitor.getPerformanceSummary();

/**
 * Get slow operations
 */
export const getSlowOperations = (limit?: number): PerformanceEntry[] => 
  performanceMonitor.getSlowOperations(limit);

/**
 * Database query wrapper with performance tracking
 */
export function withQueryTracking<T>(
  queryType: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = performance.now();

  try {
    const result = queryFn();
    
    // Ensure we always work with a Promise
    return Promise.resolve(result)
      .then(resolvedResult => {
        const duration = performance.now() - startTime;
        trackQuery(queryId, queryType, duration, true);
        return resolvedResult;
      })
      .catch(error => {
        const duration = performance.now() - startTime;
        trackQuery(queryId, queryType, duration, false);
        throw error;
      });
  } catch (error) {
    // Handle synchronous errors
    const duration = performance.now() - startTime;
    trackQuery(queryId, queryType, duration, false);
    return Promise.reject(error);
  }
}

/**
 * Batch operation wrapper with performance tracking
 */
export async function withBatchTracking<T>(
  batchId: string,
  studentCount: number,
  batchFn: () => Promise<{ result: T; cacheHits: number; cacheMisses: number; errors?: number }>
): Promise<T> {
  const startTime = performance.now();

  try {
    const { result, cacheHits, cacheMisses, errors = 0 } = await batchFn();
    const duration = performance.now() - startTime;
    
    trackBatchProcessing(batchId, duration, studentCount, cacheHits, cacheMisses, errors);
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackBatchProcessing(batchId, duration, studentCount, 0, studentCount, 1);
    throw error;
  }
}