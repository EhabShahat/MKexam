/**
 * React Query Cache Optimization Tests
 * 
 * Tests the cache configuration, invalidation strategies, and performance
 * optimizations for React Query in the score calculation system.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { 
  CACHE_CONFIGS, 
  QUERY_KEYS, 
  INVALIDATION_PATTERNS,
  createQueryOptions,
  createMutationOptions,
  CacheInvalidator,
  BatchQueryOptimizer
} from '../reactQueryCache';

// Mock performance.now for consistent testing
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: { now: mockPerformanceNow },
  writable: true,
});

// Mock performanceMonitor
vi.mock('../performanceMonitor', () => ({
  performanceMonitor: {
    trackQuery: vi.fn(),
  },
}));

describe('React Query Cache Optimization', () => {
  let queryClient: QueryClient;
  let cacheInvalidator: CacheInvalidator;
  let batchOptimizer: BatchQueryOptimizer;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    cacheInvalidator = new CacheInvalidator(queryClient);
    batchOptimizer = new BatchQueryOptimizer(queryClient);
    mockPerformanceNow.mockReturnValue(1000);
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  describe('Cache Configurations', () => {
    test('should have appropriate cache times for different data types', () => {
      // Static data should have long cache times
      expect(CACHE_CONFIGS.STATIC.staleTime).toBe(30 * 60 * 1000); // 30 minutes
      expect(CACHE_CONFIGS.STATIC.gcTime).toBe(60 * 60 * 1000); // 1 hour
      expect(CACHE_CONFIGS.STATIC.refetchOnWindowFocus).toBe(false);

      // Score data should have moderate cache times
      expect(CACHE_CONFIGS.SCORES.staleTime).toBe(5 * 60 * 1000); // 5 minutes
      expect(CACHE_CONFIGS.SCORES.gcTime).toBe(15 * 60 * 1000); // 15 minutes

      // Live data should have short cache times
      expect(CACHE_CONFIGS.LIVE.staleTime).toBe(30 * 1000); // 30 seconds
      expect(CACHE_CONFIGS.LIVE.gcTime).toBe(2 * 60 * 1000); // 2 minutes
      expect(CACHE_CONFIGS.LIVE.refetchOnWindowFocus).toBe(true);
    });

    test('should create optimized query options', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const queryKey = ['test', 'query'];

      const options = createQueryOptions(queryKey, mockQueryFn, 'SCORES');

      expect(options.queryKey).toEqual(queryKey);
      expect(options.staleTime).toBe(CACHE_CONFIGS.SCORES.staleTime);
      expect(options.gcTime).toBe(CACHE_CONFIGS.SCORES.gcTime);
      expect(options.refetchOnWindowFocus).toBe(false);

      // Test query function execution
      const result = await options.queryFn!();
      expect(result).toEqual({ data: 'test' });
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });

    test('should allow overriding default cache config', () => {
      const mockQueryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const queryKey = ['test', 'query'];
      const overrides = { staleTime: 1000, enabled: false };

      const options = createQueryOptions(queryKey, mockQueryFn, 'SCORES', overrides);

      expect(options.staleTime).toBe(1000); // Override applied
      expect(options.enabled).toBe(false); // Override applied
      expect(options.gcTime).toBe(CACHE_CONFIGS.SCORES.gcTime); // Default preserved
    });
  });

  describe('Query Keys', () => {
    test('should generate consistent query keys', () => {
      expect(QUERY_KEYS.ADMIN.EXAMS).toEqual(['admin', 'exams']);
      expect(QUERY_KEYS.ADMIN.ATTEMPTS('exam123')).toEqual(['admin', 'attempts', 'exam123']);
      expect(QUERY_KEYS.ADMIN.SUMMARIES('code1,code2')).toEqual(['admin', 'summaries', 'code1,code2']);
      expect(QUERY_KEYS.SCORES.CALCULATION('STUDENT001')).toEqual(['scores', 'calculation', 'STUDENT001']);
    });

    test('should generate sorted batch keys', () => {
      const codes = ['code3', 'code1', 'code2'];
      const batchKey = QUERY_KEYS.SCORES.BATCH(codes);
      expect(batchKey).toEqual(['scores', 'batch', 'code1,code2,code3']);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate exam-related queries', async () => {
      const examId = 'exam123';
      
      // Set up some cached data
      queryClient.setQueryData(QUERY_KEYS.ADMIN.EXAMS, { exams: [] });
      queryClient.setQueryData(QUERY_KEYS.ADMIN.ATTEMPTS(examId), { attempts: [] });
      queryClient.setQueryData(['scores', 'calculation', 'student1'], { score: 85 });

      // Spy on invalidateQueries
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await cacheInvalidator.invalidateExamQueries(examId);

      // Should invalidate all related patterns
      const expectedPatterns = INVALIDATION_PATTERNS.EXAM_UPDATED(examId);
      expect(invalidateSpy).toHaveBeenCalledTimes(expectedPatterns.length);
      
      expectedPatterns.forEach(pattern => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pattern });
      });
    });

    test('should invalidate student-related queries', async () => {
      const studentCode = 'STUDENT001';
      
      // Set up some cached data
      queryClient.setQueryData(QUERY_KEYS.SCORES.CALCULATION(studentCode), { score: 85 });
      queryClient.setQueryData(['admin', 'summaries', 'batch1'], { summaries: [] });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await cacheInvalidator.invalidateStudentQueries(studentCode);

      const expectedPatterns = INVALIDATION_PATTERNS.STUDENT_UPDATED(studentCode);
      expect(invalidateSpy).toHaveBeenCalledTimes(expectedPatterns.length);
    });

    test('should invalidate settings-related queries', async () => {
      // Set up some cached data
      queryClient.setQueryData(QUERY_KEYS.ADMIN.SETTINGS, { settings: {} });
      queryClient.setQueryData(['scores', 'calculation', 'student1'], { score: 85 });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await cacheInvalidator.invalidateSettingsQueries();

      const expectedPatterns = INVALIDATION_PATTERNS.SETTINGS_UPDATED();
      expect(invalidateSpy).toHaveBeenCalledTimes(expectedPatterns.length);
    });
  });

  describe('Mutation Options', () => {
    test('should create mutation options with performance tracking', async () => {
      const mockMutationFn = vi.fn().mockResolvedValue({ success: true });
      const mockOnSuccess = vi.fn();
      
      const options = createMutationOptions(mockMutationFn, {
        onSuccess: mockOnSuccess,
        invalidateQueries: [QUERY_KEYS.ADMIN.EXAMS],
      });

      expect(options.mutationFn).toBeDefined();
      expect(options.onSuccess).toBeDefined();

      // Test mutation execution
      const result = await options.mutationFn!({ test: 'data' });
      expect(result).toEqual({ success: true });
      expect(mockMutationFn).toHaveBeenCalledWith({ test: 'data' });
    });

    test('should handle optimistic updates', async () => {
      const mockMutationFn = vi.fn().mockResolvedValue({ id: 1, name: 'Updated' });
      const queryKey = ['test', 'data'];
      
      // Set initial data
      queryClient.setQueryData(queryKey, { id: 1, name: 'Original' });

      const options = createMutationOptions(mockMutationFn, {
        optimisticUpdate: {
          queryKey,
          updater: (oldData: any, variables: any) => ({
            ...oldData,
            name: variables.name,
          }),
        },
      });

      // Mock global queryClient for optimistic updates
      (globalThis as any).queryClient = queryClient;

      // Execute optimistic update
      if (options.onMutate) {
        const context = await options.onMutate({ name: 'Optimistic' });
        expect(context).toEqual({ previousData: { id: 1, name: 'Original' } });
        
        // Data should be optimistically updated
        const optimisticData = queryClient.getQueryData(queryKey);
        expect(optimisticData).toEqual({ id: 1, name: 'Optimistic' });
      }

      // Clean up global mock
      delete (globalThis as any).queryClient;
    });
  });

  describe('Cache Cleanup', () => {
    test('should clean up stale cache entries', async () => {
      const oldTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      
      // Set up some old cached data
      queryClient.setQueryData(['old', 'data'], { data: 'old' });
      
      // Mock the query state to appear old
      const query = queryClient.getQueryCache().find({ queryKey: ['old', 'data'] });
      if (query) {
        (query.state as any).dataUpdatedAt = oldTimestamp;
      }

      const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');

      await cacheInvalidator.cleanupStaleCache();

      expect(removeQueriesSpy).toHaveBeenCalled();
    });

    test('should prefetch common queries', async () => {
      // Mock fetch
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ exams: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fields: [] }),
        });

      const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');

      await cacheInvalidator.prefetchCommonQueries();

      expect(prefetchSpy).toHaveBeenCalledTimes(2);
      expect(prefetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: QUERY_KEYS.ADMIN.EXAMS,
        })
      );
      expect(prefetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: QUERY_KEYS.ADMIN.EXTRA_FIELDS,
        })
      );
    });
  });

  describe('Batch Query Optimization', () => {
    test('should batch similar queries', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const queryKey = ['batch', 'test'];
      
      const fetchQuerySpy = vi.spyOn(queryClient, 'fetchQuery');

      // Execute multiple similar queries
      const promise1 = batchOptimizer.batchQuery(queryKey, mockQueryFn, 'batch1');
      const promise2 = batchOptimizer.batchQuery(queryKey, mockQueryFn, 'batch1');

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should return the same result
      expect(result1).toEqual(result2);
      
      // Should only call fetchQuery once due to batching
      expect(fetchQuerySpy).toHaveBeenCalledTimes(1);
    });

    test('should clear pending queries', () => {
      const mockQueryFn = vi.fn().mockResolvedValue({ data: 'test' });
      const queryKey = ['batch', 'test'];
      
      // Start a query
      batchOptimizer.batchQuery(queryKey, mockQueryFn, 'batch1');
      
      // Clear pending queries
      batchOptimizer.clearPendingQueries();
      
      // Should be able to start the same query again
      const promise = batchOptimizer.batchQuery(queryKey, mockQueryFn, 'batch1');
      expect(promise).toBeDefined();
    });
  });

  describe('Performance Integration', () => {
    test('should track query performance', async () => {
      const { performanceMonitor } = await import('../performanceMonitor');
      const mockQueryFn = vi.fn().mockResolvedValue({ data: 'test' });
      
      mockPerformanceNow
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1100); // End time (100ms duration)

      const options = createQueryOptions(['test'], mockQueryFn, 'SCORES');
      await options.queryFn!();

      expect(performanceMonitor.trackQuery).toHaveBeenCalledWith(
        'query_test',
        'scores',
        100,
        true
      );
    });

    test('should track failed query performance', async () => {
      const { performanceMonitor } = await import('../performanceMonitor');
      const mockQueryFn = vi.fn().mockRejectedValue(new Error('Query failed'));
      
      mockPerformanceNow
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1200); // End time (200ms duration)

      const options = createQueryOptions(['test'], mockQueryFn, 'SCORES');
      
      await expect(options.queryFn!()).rejects.toThrow('Query failed');

      expect(performanceMonitor.trackQuery).toHaveBeenCalledWith(
        'query_test',
        'scores',
        200,
        false
      );
    });
  });
});