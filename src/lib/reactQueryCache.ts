/**
 * React Query Cache Optimization Module
 * 
 * Provides optimized cache configurations and invalidation strategies
 * for different types of data in the score calculation system.
 * 
 * @module reactQueryCache
 */

import { QueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { performanceMonitor } from './performanceMonitor';

/**
 * Cache configuration presets for different data types
 */
export const CACHE_CONFIGS = {
  // Static/rarely changing data
  STATIC: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
  
  // Score calculation results - moderately dynamic
  SCORES: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  
  // Live data that changes frequently
  LIVE: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  },
  
  // User-specific data
  USER: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  
  // Settings and configuration
  CONFIG: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  },
} as const;

/**
 * Query key patterns for different data types
 */
export const QUERY_KEYS = {
  // Admin queries
  ADMIN: {
    EXAMS: ['admin', 'exams'] as const,
    ATTEMPTS: (examId: string) => ['admin', 'attempts', examId] as const,
    ATTEMPTS_ALL: ['admin', 'attempts', 'ALL'] as const,
    SUMMARIES: (codes: string) => ['admin', 'summaries', codes] as const,
    EXTRA_FIELDS: ['admin', 'extra-fields'] as const,
    SETTINGS: ['admin', 'settings'] as const,
    PASS_EXAMS: ['admin', 'extra-exams', 'pass'] as const,
  },
  
  // Public queries
  PUBLIC: {
    EXAM_INFO: (examId: string) => ['public', 'exam', examId] as const,
    RESULTS: (code: string) => ['public', 'results', code] as const,
  },
  
  // Score calculation queries
  SCORES: {
    CALCULATION: (studentCode: string) => ['scores', 'calculation', studentCode] as const,
    BATCH: (codes: string[]) => ['scores', 'batch', codes.sort().join(',')] as const,
  },
} as const;

/**
 * Cache invalidation patterns
 */
export const INVALIDATION_PATTERNS = {
  // When exam data changes
  EXAM_UPDATED: (examId: string) => [
    QUERY_KEYS.ADMIN.EXAMS,
    QUERY_KEYS.ADMIN.ATTEMPTS(examId),
    ['admin', 'attempts'], // Invalidate all attempts queries
    ['scores'], // Invalidate all score calculations
  ],
  
  // When student data changes
  STUDENT_UPDATED: (studentCode: string) => [
    QUERY_KEYS.SCORES.CALCULATION(studentCode),
    ['admin', 'summaries'], // Invalidate summaries that might include this student
    ['scores', 'batch'], // Invalidate batch calculations
  ],
  
  // When settings change
  SETTINGS_UPDATED: () => [
    QUERY_KEYS.ADMIN.SETTINGS,
    ['scores'], // All score calculations need to be recalculated
    ['admin', 'summaries'], // Summaries depend on settings
  ],
  
  // When extra fields change
  EXTRA_FIELDS_UPDATED: () => [
    QUERY_KEYS.ADMIN.EXTRA_FIELDS,
    ['scores'], // Score calculations depend on extra fields
    ['admin', 'summaries'], // Summaries include extra field data
  ],
} as const;

/**
 * Optimized query options factory
 */
export function createQueryOptions<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  cacheType: keyof typeof CACHE_CONFIGS = 'SCORES',
  overrides?: Partial<UseQueryOptions<T>>
): UseQueryOptions<T> {
  const config = CACHE_CONFIGS[cacheType];
  
  return {
    queryKey,
    queryFn: async () => {
      const startTime = performance.now();
      try {
        const result = await queryFn();
        const duration = performance.now() - startTime;
        
        // Track query performance
        performanceMonitor.trackQuery(
          `query_${queryKey.join('_')}`,
          cacheType.toLowerCase(),
          duration,
          true
        );
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Track failed query
        performanceMonitor.trackQuery(
          `query_${queryKey.join('_')}`,
          cacheType.toLowerCase(),
          duration,
          false
        );
        
        throw error;
      }
    },
    ...config,
    ...overrides,
  };
}

/**
 * Optimistic update configuration for mutations
 */
export function createMutationOptions<TData, TError, TVariables, TContext>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
    onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
    onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables, context: TContext | undefined) => void;
    optimisticUpdate?: {
      queryKey: readonly unknown[];
      updater: (oldData: any, variables: TVariables) => any;
    };
    invalidateQueries?: readonly unknown[][];
  }
): UseMutationOptions<TData, TError, TVariables, TContext> {
  return {
    mutationFn: async (variables: TVariables) => {
      const startTime = performance.now();
      try {
        const result = await mutationFn(variables);
        const duration = performance.now() - startTime;
        
        // Track mutation performance
        performanceMonitor.trackQuery(
          'mutation',
          'mutation',
          duration,
          true
        );
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Track failed mutation
        performanceMonitor.trackQuery(
          'mutation',
          'mutation',
          duration,
          false
        );
        
        throw error;
      }
    },
    onMutate: options?.optimisticUpdate ? async (variables: TVariables) => {
      const optimisticUpdate = options.optimisticUpdate;
      if (!optimisticUpdate) return {} as TContext;
      
      const { queryKey, updater } = optimisticUpdate;
      
      // Cancel any outgoing refetches
      await (globalThis as any).queryClient?.cancelQueries({ queryKey });
      
      // Snapshot the previous value
      const previousData = (globalThis as any).queryClient?.getQueryData(queryKey);
      
      // Optimistically update to the new value
      (globalThis as any).queryClient?.setQueryData(queryKey, (old: any) => updater(old, variables));
      
      // Return a context object with the snapshotted value
      return { previousData } as TContext;
    } : undefined,
    onError: (error, variables, context) => {
      // Rollback optimistic update on error
      if (options?.optimisticUpdate && context) {
        const { queryKey } = options.optimisticUpdate;
        (globalThis as any).queryClient?.setQueryData(queryKey, (context as any).previousData);
      }
      
      options?.onError?.(error, variables, context);
    },
    onSuccess: (data, variables, context) => {
      // Invalidate related queries on success
      if (options?.invalidateQueries) {
        options.invalidateQueries.forEach(queryKey => {
          (globalThis as any).queryClient?.invalidateQueries({ queryKey });
        });
      }
      
      options?.onSuccess?.(data, variables, context);
    },
    onSettled: options?.onSettled,
  };
}

/**
 * Cache invalidation helper
 */
export class CacheInvalidator {
  constructor(private queryClient: QueryClient) {}

  /**
   * Invalidate queries based on exam update
   */
  async invalidateExamQueries(examId: string): Promise<void> {
    const patterns = INVALIDATION_PATTERNS.EXAM_UPDATED(examId);
    
    await Promise.all(
      patterns.map(pattern => 
        this.queryClient.invalidateQueries({ queryKey: pattern })
      )
    );
  }

  /**
   * Invalidate queries based on student update
   */
  async invalidateStudentQueries(studentCode: string): Promise<void> {
    const patterns = INVALIDATION_PATTERNS.STUDENT_UPDATED(studentCode);
    
    await Promise.all(
      patterns.map(pattern => 
        this.queryClient.invalidateQueries({ queryKey: pattern })
      )
    );
  }

  /**
   * Invalidate queries based on settings update
   */
  async invalidateSettingsQueries(): Promise<void> {
    const patterns = INVALIDATION_PATTERNS.SETTINGS_UPDATED();
    
    await Promise.all(
      patterns.map(pattern => 
        this.queryClient.invalidateQueries({ queryKey: pattern })
      )
    );
  }

  /**
   * Invalidate queries based on extra fields update
   */
  async invalidateExtraFieldsQueries(): Promise<void> {
    const patterns = INVALIDATION_PATTERNS.EXTRA_FIELDS_UPDATED();
    
    await Promise.all(
      patterns.map(pattern => 
        this.queryClient.invalidateQueries({ queryKey: pattern })
      )
    );
  }

  /**
   * Smart cache cleanup - remove stale entries
   */
  async cleanupStaleCache(): Promise<void> {
    // Remove queries that haven't been used in the last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    this.queryClient.getQueryCache().getAll().forEach(query => {
      if (query.state.dataUpdatedAt < oneHourAgo && !query.getObserversCount()) {
        this.queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  }

  /**
   * Prefetch commonly used queries
   */
  async prefetchCommonQueries(): Promise<void> {
    // Prefetch exams list if not already cached
    if (!this.queryClient.getQueryData(QUERY_KEYS.ADMIN.EXAMS)) {
      try {
        await this.queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.ADMIN.EXAMS,
          queryFn: async () => {
            const response = await fetch('/api/admin/exams');
            if (!response.ok) throw new Error('Failed to fetch exams');
            return response.json();
          },
          ...CACHE_CONFIGS.STATIC,
        });
      } catch (error) {
        console.warn('Failed to prefetch exams:', error);
      }
    }

    // Prefetch extra fields if not already cached
    if (!this.queryClient.getQueryData(QUERY_KEYS.ADMIN.EXTRA_FIELDS)) {
      try {
        await this.queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.ADMIN.EXTRA_FIELDS,
          queryFn: async () => {
            const response = await fetch('/api/admin/extra-scores/fields');
            if (!response.ok) throw new Error('Failed to fetch extra fields');
            return response.json();
          },
          ...CACHE_CONFIGS.CONFIG,
        });
      } catch (error) {
        console.warn('Failed to prefetch extra fields:', error);
      }
    }
  }
}

/**
 * Hook to get cache invalidator instance
 */
export function useCacheInvalidator(queryClient: QueryClient): CacheInvalidator {
  return new CacheInvalidator(queryClient);
}

/**
 * Performance-aware query hook factory
 */
export function createPerformanceAwareQuery<T>(
  cacheType: keyof typeof CACHE_CONFIGS = 'SCORES'
) {
  return function usePerformanceQuery(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    options?: Partial<UseQueryOptions<T>>
  ) {
    return createQueryOptions(queryKey, queryFn, cacheType, options);
  };
}

/**
 * Batch query optimization helper
 */
export class BatchQueryOptimizer {
  private pendingQueries = new Map<string, Promise<any>>();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batch delay

  constructor(private queryClient: QueryClient) {}

  /**
   * Batch multiple similar queries together
   */
  async batchQuery<T>(
    queryKey: readonly unknown[],
    queryFn: () => Promise<T>,
    batchKey: string
  ): Promise<T> {
    const keyString = JSON.stringify(queryKey);
    
    // Check if this exact query is already pending
    if (this.pendingQueries.has(keyString)) {
      return this.pendingQueries.get(keyString);
    }

    // Create the query promise
    const queryPromise = this.queryClient.fetchQuery({
      queryKey,
      queryFn,
      ...CACHE_CONFIGS.SCORES,
    });

    // Store the pending query
    this.pendingQueries.set(keyString, queryPromise);

    // Clean up after completion
    queryPromise.finally(() => {
      this.pendingQueries.delete(keyString);
    });

    return queryPromise;
  }

  /**
   * Clear all pending queries
   */
  clearPendingQueries(): void {
    this.pendingQueries.clear();
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}