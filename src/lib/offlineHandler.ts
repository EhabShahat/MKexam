/**
 * Offline Handling and Recovery System
 * 
 * This module provides enhanced offline detection, user feedback, and recovery
 * mechanisms for the reordered student experience flow.
 */

import { trackNetworkRequest } from './reorderedFlowPerformance';
import { logSystemError } from './errorLogger';

/**
 * Network status types
 */
export type NetworkStatus = 'online' | 'offline' | 'slow' | 'unstable';

/**
 * Offline operation types
 */
export type OfflineOperation = 
  | 'code_validation'
  | 'code_storage'
  | 'settings_fetch'
  | 'exam_access';

/**
 * Recovery strategy types
 */
export type RecoveryStrategy = 
  | 'retry_immediate'
  | 'retry_exponential'
  | 'cache_fallback'
  | 'offline_mode'
  | 'user_notification';

/**
 * Offline operation queue item
 */
interface OfflineQueueItem {
  id: string;
  operation: OfflineOperation;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  strategy: RecoveryStrategy;
}

/**
 * Network quality metrics
 */
interface NetworkQuality {
  status: NetworkStatus;
  latency: number;
  bandwidth: number;
  reliability: number;
  lastCheck: number;
}

/**
 * Offline handler configuration
 */
interface OfflineHandlerConfig {
  /** Enable offline detection (default: true) */
  enabled: boolean;
  /** Network check interval in milliseconds (default: 5000) */
  checkInterval: number;
  /** Slow network threshold in milliseconds (default: 2000) */
  slowNetworkThreshold: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries: number;
  /** Exponential backoff base delay in milliseconds (default: 1000) */
  baseRetryDelay: number;
  /** Maximum queue size for offline operations (default: 50) */
  maxQueueSize: number;
  /** Enable user notifications (default: true) */
  enableNotifications: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OfflineHandlerConfig = {
  enabled: true,
  checkInterval: 5000,
  slowNetworkThreshold: 2000,
  maxRetries: 3,
  baseRetryDelay: 1000,
  maxQueueSize: 50,
  enableNotifications: true,
};

/**
 * Offline Handler class
 */
export class OfflineHandler {
  private config: OfflineHandlerConfig;
  private networkQuality: NetworkQuality;
  private operationQueue: OfflineQueueItem[] = [];
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private checkInterval?: NodeJS.Timeout;
  private isProcessingQueue = false;

  constructor(config?: Partial<OfflineHandlerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.networkQuality = {
      status: 'online',
      latency: 0,
      bandwidth: 0,
      reliability: 1.0,
      lastCheck: Date.now(),
    };

    if (typeof window !== 'undefined' && this.config.enabled) {
      this.initializeOfflineDetection();
    }
  }

  /**
   * Initialize offline detection and monitoring
   */
  private initializeOfflineDetection(): void {
    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Set initial status
    this.networkQuality.status = navigator.onLine ? 'online' : 'offline';

    // Start periodic network quality checks
    this.startNetworkMonitoring();

    // Process queued operations when coming back online
    if (navigator.onLine) {
      this.processOperationQueue();
    }
  }

  /**
   * Start network quality monitoring
   */
  private startNetworkMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkNetworkQuality();
    }, this.config.checkInterval);
  }

  /**
   * Check network quality and update status
   */
  private async checkNetworkQuality(): Promise<void> {
    if (!navigator.onLine) {
      this.updateNetworkStatus('offline');
      return;
    }

    try {
      const startTime = performance.now();
      
      // Use a small image or endpoint for network check
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const endTime = performance.now();
      const latency = endTime - startTime;

      if (response.ok) {
        this.networkQuality.latency = latency;
        this.networkQuality.lastCheck = Date.now();
        this.networkQuality.reliability = Math.min(this.networkQuality.reliability + 0.1, 1.0);

        // Determine network status based on latency
        if (latency > this.config.slowNetworkThreshold) {
          this.updateNetworkStatus('slow');
        } else if (this.networkQuality.reliability < 0.7) {
          this.updateNetworkStatus('unstable');
        } else {
          this.updateNetworkStatus('online');
        }
      } else {
        this.networkQuality.reliability = Math.max(this.networkQuality.reliability - 0.2, 0);
        this.updateNetworkStatus('unstable');
      }
    } catch (error) {
      this.networkQuality.reliability = Math.max(this.networkQuality.reliability - 0.3, 0);
      
      if (this.networkQuality.reliability < 0.3) {
        this.updateNetworkStatus('offline');
      } else {
        this.updateNetworkStatus('unstable');
      }

      console.warn('Network quality check failed:', error);
    }
  }

  /**
   * Update network status and notify listeners
   */
  private updateNetworkStatus(status: NetworkStatus): void {
    if (this.networkQuality.status !== status) {
      const previousStatus = this.networkQuality.status;
      this.networkQuality.status = status;

      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(status);
        } catch (error) {
          console.error('Error in network status listener:', error);
        }
      });

      // Log status change
      console.log(`[OfflineHandler] Network status changed: ${previousStatus} → ${status}`);

      // Process queue if coming back online
      if (status === 'online' && previousStatus !== 'online') {
        this.processOperationQueue();
      }
    }
  }

  /**
   * Handle browser online event
   */
  private handleOnline(): void {
    console.log('[OfflineHandler] Browser reports online');
    this.checkNetworkQuality();
  }

  /**
   * Handle browser offline event
   */
  private handleOffline(): void {
    console.log('[OfflineHandler] Browser reports offline');
    this.updateNetworkStatus('offline');
  }

  /**
   * Add network status listener
   */
  public addStatusListener(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): NetworkStatus {
    return this.networkQuality.status;
  }

  /**
   * Get network quality metrics
   */
  public getNetworkQuality(): NetworkQuality {
    return { ...this.networkQuality };
  }

  /**
   * Check if network is available
   */
  public isOnline(): boolean {
    return this.networkQuality.status === 'online' || this.networkQuality.status === 'slow';
  }

  /**
   * Queue operation for offline execution
   */
  public queueOperation(
    operation: OfflineOperation,
    data: any,
    strategy: RecoveryStrategy = 'retry_exponential'
  ): string {
    const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: OfflineQueueItem = {
      id,
      operation,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      strategy,
    };

    // Remove oldest items if queue is full
    if (this.operationQueue.length >= this.config.maxQueueSize) {
      this.operationQueue.shift();
    }

    this.operationQueue.push(queueItem);
    
    console.log(`[OfflineHandler] Queued operation: ${operation} (${id})`);
    
    return id;
  }

  /**
   * Process queued operations
   */
  private async processOperationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`[OfflineHandler] Processing ${this.operationQueue.length} queued operations`);

    const processedItems: string[] = [];

    for (const item of this.operationQueue) {
      try {
        const success = await this.executeQueuedOperation(item);
        
        if (success) {
          processedItems.push(item.id);
          console.log(`[OfflineHandler] Successfully processed: ${item.operation} (${item.id})`);
        } else {
          item.retryCount++;
          
          if (item.retryCount >= item.maxRetries) {
            processedItems.push(item.id);
            console.warn(`[OfflineHandler] Max retries reached for: ${item.operation} (${item.id})`);
            
            // Log failed operation
            logSystemError(
              'offline_operation_failed',
              `Operation ${item.operation} failed after ${item.maxRetries} retries`,
              {
                component: 'OfflineHandler',
              }
            );
          }
        }
      } catch (error) {
        console.error(`[OfflineHandler] Error processing operation ${item.operation}:`, error);
        item.retryCount++;
        
        if (item.retryCount >= item.maxRetries) {
          processedItems.push(item.id);
        }
      }

      // Don't overwhelm the network
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Remove processed items from queue
    this.operationQueue = this.operationQueue.filter(item => !processedItems.includes(item.id));
    
    this.isProcessingQueue = false;
    
    if (this.operationQueue.length > 0) {
      console.log(`[OfflineHandler] ${this.operationQueue.length} operations remaining in queue`);
    }
  }

  /**
   * Execute a queued operation
   */
  private async executeQueuedOperation(item: OfflineQueueItem): Promise<boolean> {
    const startTime = performance.now();
    
    try {
      let success = false;
      
      switch (item.operation) {
        case 'code_validation':
          success = await this.executeCodeValidation(item.data);
          break;
        case 'code_storage':
          success = await this.executeCodeStorage(item.data);
          break;
        case 'settings_fetch':
          success = await this.executeSettingsFetch(item.data);
          break;
        case 'exam_access':
          success = await this.executeExamAccess(item.data);
          break;
        default:
          console.warn(`[OfflineHandler] Unknown operation type: ${item.operation}`);
          return false;
      }

      const endTime = performance.now();
      
      // Track network request performance
      trackNetworkRequest(
        `offline_${item.operation}`,
        startTime,
        endTime,
        success,
        false,
        {
          retry_count: item.retryCount,
          strategy: item.strategy,
          queue_age: Date.now() - item.timestamp,
        }
      );

      return success;
    } catch (error) {
      const endTime = performance.now();
      
      trackNetworkRequest(
        `offline_${item.operation}`,
        startTime,
        endTime,
        false,
        false,
        {
          retry_count: item.retryCount,
          strategy: item.strategy,
          error: error instanceof Error ? error.message : 'unknown error',
        }
      );

      return false;
    }
  }

  /**
   * Execute code validation operation
   */
  private async executeCodeValidation(data: { code: string }): Promise<boolean> {
    const response = await fetch('/api/student/validate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: data.code }),
    });

    return response.ok;
  }

  /**
   * Execute code storage operation
   */
  private async executeCodeStorage(data: { code: string; studentId?: string }): Promise<boolean> {
    // Code storage is typically local, so this would be for syncing to server
    try {
      const response = await fetch('/api/student/sync-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      return response.ok;
    } catch {
      // If sync fails, local storage still works
      return true;
    }
  }

  /**
   * Execute settings fetch operation
   */
  private async executeSettingsFetch(data: { type: string }): Promise<boolean> {
    const response = await fetch(`/api/public/${data.type}`, {
      cache: 'no-cache',
    });

    return response.ok;
  }

  /**
   * Execute exam access operation
   */
  private async executeExamAccess(data: { examId: string; code: string }): Promise<boolean> {
    const response = await fetch(`/api/public/exam/${data.examId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: data.code }),
    });

    return response.ok;
  }

  /**
   * Retry operation with exponential backoff
   */
  public async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries,
    baseDelay: number = this.config.baseRetryDelay
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`[OfflineHandler] Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Get cached data for offline fallback
   */
  public getCachedData(key: string): any {
    try {
      const cached = localStorage.getItem(`offline_cache_${key}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (Date.now() - timestamp < maxAge) {
          return data;
        } else {
          localStorage.removeItem(`offline_cache_${key}`);
        }
      }
    } catch (error) {
      console.warn('Failed to get cached data:', error);
    }
    
    return null;
  }

  /**
   * Set cached data for offline fallback
   */
  public setCachedData(key: string, data: any): void {
    try {
      const cacheItem = {
        data,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(`offline_cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('offline_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get operation queue status
   */
  public getQueueStatus(): {
    size: number;
    operations: Array<{ operation: OfflineOperation; retryCount: number; timestamp: number }>;
  } {
    return {
      size: this.operationQueue.length,
      operations: this.operationQueue.map(item => ({
        operation: item.operation,
        retryCount: item.retryCount,
        timestamp: item.timestamp,
      })),
    };
  }

  /**
   * Cleanup and destroy handler
   */
  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }

    this.listeners.clear();
    this.operationQueue = [];
  }
}

/**
 * Global offline handler instance
 */
export const offlineHandler = new OfflineHandler();

/**
 * Hook for using offline status in React components
 */
export function useOfflineStatus(): {
  isOnline: boolean;
  networkStatus: NetworkStatus;
  networkQuality: NetworkQuality;
  queueStatus: ReturnType<OfflineHandler['getQueueStatus']>;
} {
  const [isOnline, setIsOnline] = React.useState(offlineHandler.isOnline());
  const [networkStatus, setNetworkStatus] = React.useState(offlineHandler.getNetworkStatus());
  const [networkQuality, setNetworkQuality] = React.useState(offlineHandler.getNetworkQuality());
  const [queueStatus, setQueueStatus] = React.useState(offlineHandler.getQueueStatus());

  React.useEffect(() => {
    const unsubscribe = offlineHandler.addStatusListener((status) => {
      setNetworkStatus(status);
      setIsOnline(offlineHandler.isOnline());
      setNetworkQuality(offlineHandler.getNetworkQuality());
      setQueueStatus(offlineHandler.getQueueStatus());
    });

    return unsubscribe;
  }, []);

  return {
    isOnline,
    networkStatus,
    networkQuality,
    queueStatus,
  };
}

/**
 * Convenience functions
 */
export const queueOfflineOperation = (
  operation: OfflineOperation,
  data: any,
  strategy?: RecoveryStrategy
): string => offlineHandler.queueOperation(operation, data, strategy);

export const retryWithBackoff = <T>(
  operation: () => Promise<T>,
  maxRetries?: number,
  baseDelay?: number
): Promise<T> => offlineHandler.retryWithBackoff(operation, maxRetries, baseDelay);

export const getCachedData = (key: string): any => offlineHandler.getCachedData(key);

export const setCachedData = (key: string, data: any): void => offlineHandler.setCachedData(key, data);

// Add React import for the hook
import React from 'react';