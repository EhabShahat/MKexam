/**
 * Error Logger Module
 * 
 * Provides comprehensive error logging for score calculations, sync operations,
 * and system failures. Tracks error frequency, categorizes errors, and provides
 * detailed context for debugging.
 * 
 * @module errorLogger
 */

import { auditLog } from './audit';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories for classification
 */
export type ErrorCategory = 
  | 'calculation'
  | 'validation'
  | 'database'
  | 'sync'
  | 'network'
  | 'authentication'
  | 'permission'
  | 'system';

/**
 * Error log entry structure
 */
export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  operation: string;
  message: string;
  error?: Error;
  context?: Record<string, any>;
  studentCode?: string;
  studentId?: string;
  userId?: string;
  stackTrace?: string;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
}

/**
 * Error frequency tracking
 */
export interface ErrorFrequency {
  category: ErrorCategory;
  operation: string;
  count: number;
  lastOccurrence: string;
  averageFrequency: number; // errors per hour
}

/**
 * Error summary statistics
 */
export interface ErrorSummary {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: number; // last 24 hours
  topErrors: ErrorFrequency[];
  criticalErrors: number;
  unresolvedErrors: number;
}

/**
 * Error Logger configuration
 */
export interface ErrorLoggerConfig {
  /** Enable error logging (default: true) */
  enabled: boolean;
  /** Maximum number of error entries to keep in memory (default: 5000) */
  maxEntries: number;
  /** Whether to log to console (default: true) */
  logToConsole: boolean;
  /** Whether to send to audit log (default: true) */
  auditLog: boolean;
  /** Whether to include stack traces (default: development mode) */
  includeStackTrace: boolean;
  /** Minimum severity to log (default: 'low') */
  minSeverity: ErrorSeverity;
}

/**
 * Error Logger class
 */
export class ErrorLogger {
  private config: ErrorLoggerConfig;
  private errors: ErrorLogEntry[] = [];
  private errorFrequency: Map<string, ErrorFrequency> = new Map();

  constructor(config?: Partial<ErrorLoggerConfig>) {
    this.config = {
      enabled: true,
      maxEntries: 5000,
      logToConsole: true,
      auditLog: true,
      includeStackTrace: process.env.NODE_ENV === 'development',
      minSeverity: 'low',
      ...config,
    };
  }

  /**
   * Log a calculation error
   */
  logCalculationError(
    operation: string,
    error: Error | string,
    context?: {
      studentCode?: string;
      studentId?: string;
      input?: any;
      duration?: number;
    }
  ): string {
    return this.logError({
      severity: 'medium',
      category: 'calculation',
      operation,
      message: error instanceof Error ? error.message : error,
      error: error instanceof Error ? error : undefined,
      context,
      studentCode: context?.studentCode,
      studentId: context?.studentId,
    });
  }

  /**
   * Log a validation error
   */
  logValidationError(
    operation: string,
    message: string,
    context?: {
      studentCode?: string;
      studentId?: string;
      validationErrors?: string[];
      input?: any;
    }
  ): string {
    return this.logError({
      severity: 'low',
      category: 'validation',
      operation,
      message,
      context,
      studentCode: context?.studentCode,
      studentId: context?.studentId,
    });
  }

  /**
   * Log a database error
   */
  logDatabaseError(
    operation: string,
    error: Error | string,
    context?: {
      query?: string;
      table?: string;
      duration?: number;
      rowCount?: number;
    }
  ): string {
    return this.logError({
      severity: 'high',
      category: 'database',
      operation,
      message: error instanceof Error ? error.message : error,
      error: error instanceof Error ? error : undefined,
      context,
    });
  }

  /**
   * Log a sync operation error
   */
  logSyncError(
    operation: string,
    error: Error | string,
    context?: {
      syncType?: string;
      recordsProcessed?: number;
      recordsFailed?: number;
      duration?: number;
    }
  ): string {
    return this.logError({
      severity: 'medium',
      category: 'sync',
      operation,
      message: error instanceof Error ? error.message : error,
      error: error instanceof Error ? error : undefined,
      context,
    });
  }

  /**
   * Log a network error
   */
  logNetworkError(
    operation: string,
    error: Error | string,
    context?: {
      url?: string;
      method?: string;
      statusCode?: number;
      timeout?: boolean;
    }
  ): string {
    return this.logError({
      severity: 'medium',
      category: 'network',
      operation,
      message: error instanceof Error ? error.message : error,
      error: error instanceof Error ? error : undefined,
      context,
    });
  }

  /**
   * Log an authentication error
   */
  logAuthenticationError(
    operation: string,
    message: string,
    context?: {
      userId?: string;
      email?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): string {
    return this.logError({
      severity: 'high',
      category: 'authentication',
      operation,
      message,
      context,
      userId: context?.userId,
    });
  }

  /**
   * Log a permission error
   */
  logPermissionError(
    operation: string,
    message: string,
    context?: {
      userId?: string;
      resource?: string;
      action?: string;
      requiredRole?: string;
    }
  ): string {
    return this.logError({
      severity: 'medium',
      category: 'permission',
      operation,
      message,
      context,
      userId: context?.userId,
    });
  }

  /**
   * Log a system error
   */
  logSystemError(
    operation: string,
    error: Error | string,
    context?: {
      component?: string;
      version?: string;
      environment?: string;
      memoryUsage?: number;
    }
  ): string {
    return this.logError({
      severity: 'critical',
      category: 'system',
      operation,
      message: error instanceof Error ? error.message : error,
      error: error instanceof Error ? error : undefined,
      context,
    });
  }

  /**
   * Generic error logging method
   */
  private logError(errorData: {
    severity: ErrorSeverity;
    category: ErrorCategory;
    operation: string;
    message: string;
    error?: Error;
    context?: Record<string, any>;
    studentCode?: string;
    studentId?: string;
    userId?: string;
  }): string {
    if (!this.config.enabled) return '';

    // Check minimum severity
    const severityLevels: Record<ErrorSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    if (severityLevels[errorData.severity] < severityLevels[this.config.minSeverity]) {
      return '';
    }

    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    const entry: ErrorLogEntry = {
      id: errorId,
      timestamp,
      severity: errorData.severity,
      category: errorData.category,
      operation: errorData.operation,
      message: errorData.message,
      error: errorData.error,
      context: errorData.context,
      studentCode: errorData.studentCode,
      studentId: errorData.studentId,
      userId: errorData.userId,
      stackTrace: this.config.includeStackTrace && errorData.error?.stack 
        ? errorData.error.stack 
        : undefined,
      resolved: false,
    };

    // Add to errors array
    this.addErrorEntry(entry);

    // Update frequency tracking
    this.updateErrorFrequency(errorData.category, errorData.operation);

    // Log to console if enabled
    if (this.config.logToConsole) {
      this.logToConsole(entry);
    }

    // Send to audit log if enabled
    if (this.config.auditLog) {
      this.sendToAuditLog(entry);
    }

    return errorId;
  }

  /**
   * Mark an error as resolved
   */
  resolveError(errorId: string, resolvedBy?: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (!error) return false;

    error.resolved = true;
    error.resolvedAt = new Date().toISOString();
    error.resolvedBy = resolvedBy;

    return true;
  }

  /**
   * Get error summary statistics
   */
  getErrorSummary(): ErrorSummary {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const errorsByCategory: Record<ErrorCategory, number> = {
      calculation: 0,
      validation: 0,
      database: 0,
      sync: 0,
      network: 0,
      authentication: 0,
      permission: 0,
      system: 0,
    };

    const errorsBySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let recentErrors = 0;
    let criticalErrors = 0;
    let unresolvedErrors = 0;

    for (const error of this.errors) {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;

      if (new Date(error.timestamp) > last24Hours) {
        recentErrors++;
      }

      if (error.severity === 'critical') {
        criticalErrors++;
      }

      if (!error.resolved) {
        unresolvedErrors++;
      }
    }

    // Get top errors by frequency
    const topErrors = Array.from(this.errorFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: this.errors.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors,
      topErrors,
      criticalErrors,
      unresolvedErrors,
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit: number = 100): ErrorLogEntry[] {
    return this.errors.slice(-limit);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory, limit: number = 100): ErrorLogEntry[] {
    return this.errors
      .filter(error => error.category === category)
      .slice(-limit);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity, limit: number = 100): ErrorLogEntry[] {
    return this.errors
      .filter(error => error.severity === severity)
      .slice(-limit);
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(limit: number = 100): ErrorLogEntry[] {
    return this.errors
      .filter(error => !error.resolved)
      .slice(-limit);
  }

  /**
   * Get errors by student
   */
  getErrorsByStudent(studentCode: string, limit: number = 50): ErrorLogEntry[] {
    return this.errors
      .filter(error => error.studentCode === studentCode)
      .slice(-limit);
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = [];
    this.errorFrequency.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorLoggerConfig {
    return { ...this.config };
  }

  /**
   * Add error entry with automatic cleanup
   */
  private addErrorEntry(entry: ErrorLogEntry): void {
    this.errors.push(entry);
    
    // Keep only the most recent entries to prevent memory issues
    if (this.errors.length > this.config.maxEntries) {
      this.errors = this.errors.slice(-this.config.maxEntries);
    }
  }

  /**
   * Update error frequency tracking
   */
  private updateErrorFrequency(category: ErrorCategory, operation: string): void {
    const key = `${category}:${operation}`;
    const existing = this.errorFrequency.get(key);
    const now = new Date().toISOString();

    if (existing) {
      existing.count++;
      existing.lastOccurrence = now;
      
      // Calculate average frequency (errors per hour)
      const firstOccurrence = new Date(existing.lastOccurrence);
      const hoursSinceFirst = (Date.now() - firstOccurrence.getTime()) / (1000 * 60 * 60);
      existing.averageFrequency = existing.count / Math.max(hoursSinceFirst, 1);
    } else {
      this.errorFrequency.set(key, {
        category,
        operation,
        count: 1,
        lastOccurrence: now,
        averageFrequency: 1,
      });
    }
  }

  /**
   * Log error to console with appropriate formatting
   */
  private logToConsole(entry: ErrorLogEntry): void {
    const prefix = `[ErrorLogger:${entry.severity.toUpperCase()}]`;
    const message = `${prefix} ${entry.category}/${entry.operation}: ${entry.message}`;
    
    switch (entry.severity) {
      case 'critical':
      case 'high':
        console.error(message, entry.context);
        if (entry.stackTrace) {
          console.error(entry.stackTrace);
        }
        break;
      case 'medium':
        console.warn(message, entry.context);
        break;
      case 'low':
        console.log(message, entry.context);
        break;
    }
  }

  /**
   * Send error to audit log
   */
  private sendToAuditLog(entry: ErrorLogEntry): void {
    try {
      auditLog(
        entry.userId || entry.studentCode || 'system',
        'error_logged',
        {
          errorId: entry.id,
          severity: entry.severity,
          category: entry.category,
          operation: entry.operation,
          message: entry.message,
          studentCode: entry.studentCode,
          studentId: entry.studentId,
          context: entry.context,
        }
      );
    } catch (auditError) {
      // Don't let audit logging failures prevent error logging
      console.error('[ErrorLogger] Failed to send to audit log:', auditError);
    }
  }
}

/**
 * Global error logger instance
 */
export const errorLogger = new ErrorLogger();

/**
 * Convenience functions for common error logging operations
 */
export const logCalculationError = (
  operation: string,
  error: Error | string,
  context?: {
    studentCode?: string;
    studentId?: string;
    input?: any;
    duration?: number;
  }
): string => errorLogger.logCalculationError(operation, error, context);

export const logValidationError = (
  operation: string,
  message: string,
  context?: {
    studentCode?: string;
    studentId?: string;
    validationErrors?: string[];
    input?: any;
  }
): string => errorLogger.logValidationError(operation, message, context);

export const logDatabaseError = (
  operation: string,
  error: Error | string,
  context?: {
    query?: string;
    table?: string;
    duration?: number;
    rowCount?: number;
  }
): string => errorLogger.logDatabaseError(operation, error, context);

export const logSyncError = (
  operation: string,
  error: Error | string,
  context?: {
    syncType?: string;
    recordsProcessed?: number;
    recordsFailed?: number;
    duration?: number;
  }
): string => errorLogger.logSyncError(operation, error, context);

export const logNetworkError = (
  operation: string,
  error: Error | string,
  context?: {
    url?: string;
    method?: string;
    statusCode?: number;
    timeout?: boolean;
  }
): string => errorLogger.logNetworkError(operation, error, context);

export const logAuthenticationError = (
  operation: string,
  message: string,
  context?: {
    userId?: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): string => errorLogger.logAuthenticationError(operation, message, context);

export const logPermissionError = (
  operation: string,
  message: string,
  context?: {
    userId?: string;
    resource?: string;
    action?: string;
    requiredRole?: string;
  }
): string => errorLogger.logPermissionError(operation, message, context);

export const logSystemError = (
  operation: string,
  error: Error | string,
  context?: {
    component?: string;
    version?: string;
    environment?: string;
    memoryUsage?: number;
  }
): string => errorLogger.logSystemError(operation, error, context);

/**
 * Get error summary
 */
export const getErrorSummary = (): ErrorSummary => errorLogger.getErrorSummary();

/**
 * Get recent errors
 */
export const getRecentErrors = (limit?: number): ErrorLogEntry[] => 
  errorLogger.getRecentErrors(limit);

/**
 * Get unresolved errors
 */
export const getUnresolvedErrors = (limit?: number): ErrorLogEntry[] => 
  errorLogger.getUnresolvedErrors(limit);

/**
 * Resolve an error
 */
export const resolveError = (errorId: string, resolvedBy?: string): boolean => 
  errorLogger.resolveError(errorId, resolvedBy);