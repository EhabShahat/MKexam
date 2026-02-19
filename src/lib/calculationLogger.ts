/**
 * Calculation Logger Module
 * 
 * Provides comprehensive logging and debugging support for score calculations.
 * Tracks calculation inputs, outputs, timing metrics, cache hits/misses, and errors.
 * 
 * @module calculationLogger
 */

import type { CalculationInput, CalculationResult } from './scoreCalculator.types';
import { trackCalculation } from './performanceMonitor';
import { logCalculationError as logCalcError, logValidationError } from './errorLogger';

/**
 * Log levels for calculation logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Calculation log entry structure
 */
export interface CalculationLogEntry {
  timestamp: string;
  level: LogLevel;
  studentCode: string;
  studentId: string;
  operation: string;
  duration?: number;
  cached?: boolean;
  input?: Partial<CalculationInput>;
  result?: Partial<CalculationResult>;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Performance metrics for calculations
 */
export interface CalculationPerformanceMetrics {
  totalCalculations: number;
  averageDuration: number;
  slowCalculations: number; // > 1 second
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  lastReset: string;
}

/**
 * Debug mode configuration
 */
export interface DebugConfig {
  enabled: boolean;
  logInputs: boolean;
  logOutputs: boolean;
  logTiming: boolean;
  logCacheOperations: boolean;
  detailedBreakdown: boolean;
  slowCalculationThreshold: number; // milliseconds
}

/**
 * Calculation Logger class
 */
export class CalculationLogger {
  private logs: CalculationLogEntry[] = [];
  private metrics: CalculationPerformanceMetrics;
  private debugConfig: DebugConfig;
  private maxLogEntries: number = 1000;

  constructor(debugConfig?: Partial<DebugConfig>) {
    this.debugConfig = {
      enabled: process.env.NODE_ENV === 'development' || process.env.CALCULATION_DEBUG === 'true',
      logInputs: true,
      logOutputs: true,
      logTiming: true,
      logCacheOperations: true,
      detailedBreakdown: false,
      slowCalculationThreshold: 1000, // 1 second
      ...debugConfig,
    };

    this.metrics = {
      totalCalculations: 0,
      averageDuration: 0,
      slowCalculations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      lastReset: new Date().toISOString(),
    };
  }

  /**
   * Log calculation start
   */
  logCalculationStart(
    studentCode: string,
    studentId: string,
    input?: Partial<CalculationInput>
  ): string {
    const operationId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.debugConfig.enabled && this.debugConfig.logInputs) {
      this.addLogEntry({
        timestamp: new Date().toISOString(),
        level: 'debug',
        studentCode,
        studentId,
        operation: `calculation_start_${operationId}`,
        input: this.sanitizeInput(input),
        metadata: { operationId },
      });
    }

    return operationId;
  }

  /**
   * Log calculation completion
   */
  logCalculationComplete(
    operationId: string,
    studentCode: string,
    studentId: string,
    result: CalculationResult,
    duration: number,
    cached: boolean = false
  ): void {
    this.updateMetrics(duration, cached, result.success);

    // Track with performance monitor
    trackCalculation(operationId, duration, studentCode, result.success, cached);

    if (this.debugConfig.enabled) {
      const isSlowCalculation = duration > this.debugConfig.slowCalculationThreshold;
      
      this.addLogEntry({
        timestamp: new Date().toISOString(),
        level: isSlowCalculation ? 'warn' : 'info',
        studentCode,
        studentId,
        operation: `calculation_complete_${operationId}`,
        duration,
        cached,
        result: this.debugConfig.logOutputs ? this.sanitizeResult(result) : undefined,
        metadata: {
          operationId,
          isSlowCalculation,
          success: result.success,
        },
      });

      // Log detailed breakdown if enabled
      if (this.debugConfig.detailedBreakdown && result.success) {
        this.logDetailedBreakdown(operationId, studentCode, studentId, result);
      }
    }

    // Always log slow calculations in production
    if (duration > this.debugConfig.slowCalculationThreshold) {
      console.warn(`[CalculationLogger] Slow calculation detected: ${studentCode} (${duration}ms)`);
    }
  }

  /**
   * Log calculation error
   */
  logCalculationError(
    operationId: string,
    studentCode: string,
    studentId: string,
    error: string | Error,
    duration?: number,
    input?: Partial<CalculationInput>
  ): void {
    this.metrics.errorCount++;

    const errorMessage = error instanceof Error ? error.message : error;
    
    // Log to error logger with detailed context
    logCalcError(
      `calculation_${operationId}`,
      error,
      {
        studentCode,
        studentId,
        input: input ? this.sanitizeInput(input) : undefined,
        duration,
      }
    );
    
    this.addLogEntry({
      timestamp: new Date().toISOString(),
      level: 'error',
      studentCode,
      studentId,
      operation: `calculation_error_${operationId}`,
      duration,
      error: errorMessage,
      input: this.sanitizeInput(input),
      metadata: {
        operationId,
        errorType: error instanceof Error ? error.constructor.name : 'string',
      },
    });

    // Always log errors to console
    console.error(`[CalculationLogger] Calculation error for ${studentCode}:`, errorMessage);
  }

  /**
   * Log cache operation
   */
  logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'invalidate',
    studentCode: string,
    key?: string,
    metadata?: Record<string, any>
  ): void {
    if (operation === 'hit') {
      this.metrics.cacheHits++;
    } else if (operation === 'miss') {
      this.metrics.cacheMisses++;
    }

    if (this.debugConfig.enabled && this.debugConfig.logCacheOperations) {
      this.addLogEntry({
        timestamp: new Date().toISOString(),
        level: 'debug',
        studentCode,
        studentId: '', // Not always available for cache operations
        operation: `cache_${operation}`,
        cached: operation === 'hit',
        metadata: {
          cacheKey: key,
          ...metadata,
        },
      });
    }
  }

  /**
   * Log detailed calculation breakdown
   */
  private logDetailedBreakdown(
    operationId: string,
    studentCode: string,
    studentId: string,
    result: CalculationResult
  ): void {
    if (!result.success) return;

    // Log exam component details
    if (result.examComponent.details.length > 0) {
      this.addLogEntry({
        timestamp: new Date().toISOString(),
        level: 'debug',
        studentCode,
        studentId,
        operation: `exam_breakdown_${operationId}`,
        metadata: {
          operationId,
          examComponent: {
            score: result.examComponent.score,
            mode: result.examComponent.mode,
            examsIncluded: result.examComponent.examsIncluded,
            examsPassed: result.examComponent.examsPassed,
            details: result.examComponent.details.map(detail => ({
              examId: detail.examId,
              examTitle: detail.examTitle,
              score: detail.score,
              included: detail.included,
              passed: detail.passed,
            })),
          },
        },
      });
    }

    // Log extra component details
    if (result.extraComponent.details.length > 0) {
      this.addLogEntry({
        timestamp: new Date().toISOString(),
        level: 'debug',
        studentCode,
        studentId,
        operation: `extra_breakdown_${operationId}`,
        metadata: {
          operationId,
          extraComponent: {
            score: result.extraComponent.score,
            totalWeight: result.extraComponent.totalWeight,
            details: result.extraComponent.details.map(detail => ({
              fieldKey: detail.fieldKey,
              fieldLabel: detail.fieldLabel,
              rawValue: detail.rawValue,
              normalizedScore: detail.normalizedScore,
              weight: detail.weight,
              weightedContribution: detail.weightedContribution,
            })),
          },
        },
      });
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): CalculationPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): CalculationLogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get logs by student code
   */
  getLogsByStudent(studentCode: string, limit: number = 50): CalculationLogEntry[] {
    return this.logs
      .filter(log => log.studentCode === studentCode)
      .slice(-limit);
  }

  /**
   * Get error logs
   */
  getErrorLogs(limit: number = 50): CalculationLogEntry[] {
    return this.logs
      .filter(log => log.level === 'error')
      .slice(-limit);
  }

  /**
   * Get slow calculation logs
   */
  getSlowCalculationLogs(limit: number = 50): CalculationLogEntry[] {
    return this.logs
      .filter(log => 
        log.duration && 
        log.duration > this.debugConfig.slowCalculationThreshold
      )
      .slice(-limit);
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalCalculations: 0,
      averageDuration: 0,
      slowCalculations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0,
      lastReset: new Date().toISOString(),
    };
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Update debug configuration
   */
  updateDebugConfig(config: Partial<DebugConfig>): void {
    this.debugConfig = { ...this.debugConfig, ...config };
  }

  /**
   * Get debug configuration
   */
  getDebugConfig(): DebugConfig {
    return { ...this.debugConfig };
  }

  /**
   * Add log entry with automatic cleanup
   */
  private addLogEntry(entry: CalculationLogEntry): void {
    this.logs.push(entry);
    
    // Keep only the most recent entries to prevent memory issues
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(duration: number, cached: boolean, success: boolean): void {
    this.metrics.totalCalculations++;
    
    // Update average duration
    const totalDuration = this.metrics.averageDuration * (this.metrics.totalCalculations - 1) + duration;
    this.metrics.averageDuration = totalDuration / this.metrics.totalCalculations;
    
    // Track slow calculations
    if (duration > this.debugConfig.slowCalculationThreshold) {
      this.metrics.slowCalculations++;
    }
    
    // Cache metrics are updated in logCacheOperation
  }

  /**
   * Sanitize input for logging (remove sensitive data)
   */
  private sanitizeInput(input?: Partial<CalculationInput>): Partial<CalculationInput> | undefined {
    if (!input) return undefined;
    
    return {
      studentId: input.studentId,
      studentCode: input.studentCode,
      studentName: input.studentName ? '[REDACTED]' : undefined,
      examAttempts: input.examAttempts ? `[${input.examAttempts.length} attempts]` : undefined,
      extraScores: input.extraScores ? '[EXTRA_SCORES_DATA]' : undefined,
      extraFields: input.extraFields ? `[${input.extraFields?.length || 0} fields]` : undefined,
      settings: input.settings,
    } as any;
  }

  /**
   * Sanitize result for logging (remove sensitive data)
   */
  private sanitizeResult(result: CalculationResult): Partial<CalculationResult> {
    if (!result.success) {
      return {
        success: result.success,
        error: result.error,
      };
    }
    
    return {
      success: result.success,
      examComponent: {
        score: result.examComponent.score,
        mode: result.examComponent.mode,
        examsIncluded: result.examComponent.examsIncluded,
        examsTotal: result.examComponent.examsTotal,
        examsPassed: result.examComponent.examsPassed,
        details: `[${result.examComponent.details.length} exam details]`,
      },
      extraComponent: {
        score: result.extraComponent.score,
        totalWeight: result.extraComponent.totalWeight,
        details: `[${result.extraComponent.details.length} extra details]`,
      },
      finalScore: result.finalScore,
      passed: result.passed,
      passThreshold: result.passThreshold,
      failedDueToExam: result.failedDueToExam,
    } as any;
  }
}

/**
 * Global calculation logger instance
 */
export const calculationLogger = new CalculationLogger();

/**
 * Convenience functions for common logging operations
 */
export const logCalculationStart = (
  studentCode: string,
  studentId: string,
  input?: Partial<CalculationInput>
): string => calculationLogger.logCalculationStart(studentCode, studentId, input);

export const logCalculationComplete = (
  operationId: string,
  studentCode: string,
  studentId: string,
  result: CalculationResult,
  duration: number,
  cached?: boolean
): void => calculationLogger.logCalculationComplete(operationId, studentCode, studentId, result, duration, cached);

export const logCalculationError = (
  operationId: string,
  studentCode: string,
  studentId: string,
  error: string | Error,
  duration?: number,
  input?: Partial<CalculationInput>
): void => calculationLogger.logCalculationError(operationId, studentCode, studentId, error, duration, input);

export const logCacheOperation = (
  operation: 'hit' | 'miss' | 'set' | 'invalidate',
  studentCode: string,
  key?: string,
  metadata?: Record<string, any>
): void => calculationLogger.logCacheOperation(operation, studentCode, key, metadata);

/**
 * Get calculation performance metrics
 */
export const getCalculationMetrics = (): CalculationPerformanceMetrics => 
  calculationLogger.getMetrics();

/**
 * Get recent calculation logs
 */
export const getRecentCalculationLogs = (limit?: number): CalculationLogEntry[] => 
  calculationLogger.getRecentLogs(limit);

/**
 * Enable debug mode with detailed breakdown
 */
export const enableDebugMode = (detailedBreakdown: boolean = true): void => {
  calculationLogger.updateDebugConfig({
    enabled: true,
    detailedBreakdown,
  });
};

/**
 * Disable debug mode
 */
export const disableDebugMode = (): void => {
  calculationLogger.updateDebugConfig({
    enabled: false,
    detailedBreakdown: false,
  });
};