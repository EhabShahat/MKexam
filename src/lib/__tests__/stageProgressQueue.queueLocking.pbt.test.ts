/**
 * Property-Based Tests for Queue Processing Locking
 * Feature: staged-attempt-flow-fixes
 * Property 30: Queue processing locking
 * Validates: Requirements 6.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock fetch globally
global.fetch = vi.fn();

describe('Queue Processing Locking - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('Property 30: Queue processing locking', () => {
    it('should prevent concurrent queue processing attempts', async () => {
      // Feature: staged-attempt-flow-fixes, Property 30: Queue processing locking
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // Number of items to queue
          fc.integer({ min: 2, max: 5 }),  // Number of concurrent process attempts
          async (queueSize, concurrentAttempts) => {
            // Dynamically import to get fresh instance
            const { stageProgressQueue } = await import('../stageProgressQueue');
            
            // Clear the queue
            stageProgressQueue.clear();

            let processCallCount = 0;
            let concurrentProcessCount = 0;
            let maxConcurrentProcessCount = 0;

            // Mock fetch to track concurrent processing
            (global.fetch as any).mockImplementation(async (url: string) => {
              if (url.includes('stage-progress')) {
                processCallCount++;
                concurrentProcessCount++;
                maxConcurrentProcessCount = Math.max(maxConcurrentProcessCount, concurrentProcessCount);
                
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 50));
                
                concurrentProcessCount--;
                
                return {
                  ok: true,
                  json: async () => ({}),
                };
              }
              return {
                ok: true,
                json: async () => ({}),
              };
            });

            // Enqueue multiple items
            for (let i = 0; i < queueSize; i++) {
              stageProgressQueue.enqueue(
                `attempt-${i}`,
                `stage-${i}`,
                { progress: i * 10 },
                false
              );
            }

            // Verify items are queued
            expect(stageProgressQueue.getQueueSize()).toBe(queueSize);

            // Attempt to process queue concurrently multiple times
            const processPromises = [];
            for (let i = 0; i < concurrentAttempts; i++) {
              processPromises.push(stageProgressQueue.processQueue());
            }

            // Wait for all attempts to complete
            await Promise.all(processPromises);

            // Property: Only ONE queue processing operation should have executed
            // Even though we called processQueue multiple times concurrently,
            // the lock should ensure only one actually processes
            
            // The queue should be empty after successful processing
            expect(stageProgressQueue.getQueueSize()).toBe(0);

            // All items should have been processed exactly once
            expect(processCallCount).toBe(queueSize);

            // Cleanup
            stageProgressQueue.clear();
          }
        ),
        { numRuns: 10 } // Reduced runs for performance
      );
    }, 30000);

    it('should allow sequential queue processing after lock is released', async () => {
      // Feature: staged-attempt-flow-fixes, Property 30: Queue processing locking
      
      // Dynamically import to get fresh instance
      const { stageProgressQueue } = await import('../stageProgressQueue');
      
      // Clear the queue
      stageProgressQueue.clear();

      let processCallCount = 0;

      // Mock fetch to track processing
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('stage-progress')) {
          processCallCount++;
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 100));
          
          return {
            ok: true,
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          json: async () => ({}),
        };
      });

      // Enqueue first batch
      stageProgressQueue.enqueue('attempt-1', 'stage-1', { progress: 10 }, false);
      stageProgressQueue.enqueue('attempt-2', 'stage-2', { progress: 20 }, false);

      expect(stageProgressQueue.getQueueSize()).toBe(2);

      // Process first batch
      await stageProgressQueue.processQueue();

      // Property: First batch should be processed
      expect(stageProgressQueue.getQueueSize()).toBe(0);
      expect(processCallCount).toBe(2);

      // Enqueue second batch
      stageProgressQueue.enqueue('attempt-3', 'stage-3', { progress: 30 }, false);
      stageProgressQueue.enqueue('attempt-4', 'stage-4', { progress: 40 }, false);

      expect(stageProgressQueue.getQueueSize()).toBe(2);

      // Process second batch - should work since lock was released
      await stageProgressQueue.processQueue();

      // Property: Second batch should be processed after first completes
      expect(stageProgressQueue.getQueueSize()).toBe(0);
      expect(processCallCount).toBe(4);

      // Cleanup
      stageProgressQueue.clear();
    }, 10000);

    it('should not process empty queue even without lock', async () => {
      // Feature: staged-attempt-flow-fixes, Property 30: Queue processing locking
      
      // Dynamically import to get fresh instance
      const { stageProgressQueue } = await import('../stageProgressQueue');
      
      // Clear the queue
      stageProgressQueue.clear();

      let processCallCount = 0;

      // Mock fetch to track processing
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('stage-progress')) {
          processCallCount++;
          return {
            ok: true,
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          json: async () => ({}),
        };
      });

      // Verify queue is empty
      expect(stageProgressQueue.getQueueSize()).toBe(0);

      // Try to process empty queue
      await stageProgressQueue.processQueue();

      // Property: No processing should occur for empty queue
      expect(processCallCount).toBe(0);
      expect(stageProgressQueue.getQueueSize()).toBe(0);

      // Cleanup
      stageProgressQueue.clear();
    }, 5000);

    it('should maintain queue order during locked processing', async () => {
      // Feature: staged-attempt-flow-fixes, Property 30: Queue processing locking
      
      // Dynamically import to get fresh instance
      const { stageProgressQueue } = await import('../stageProgressQueue');
      
      // Clear the queue
      stageProgressQueue.clear();

      const processedOrder: string[] = [];

      // Mock fetch to track processing order
      (global.fetch as any).mockImplementation(async (url: string, options?: any) => {
        if (url.includes('stage-progress')) {
          const body = JSON.parse(options?.body || '{}');
          processedOrder.push(body.stage_id);
          
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 50));
          
          return {
            ok: true,
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          json: async () => ({}),
        };
      });

      // Enqueue items in specific order
      const expectedOrder = ['stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5'];
      for (let i = 0; i < expectedOrder.length; i++) {
        stageProgressQueue.enqueue(
          `attempt-${i}`,
          expectedOrder[i],
          { progress: i * 10 },
          false
        );
      }

      expect(stageProgressQueue.getQueueSize()).toBe(5);

      // Process queue
      await stageProgressQueue.processQueue();

      // Property: Items should be processed in the order they were enqueued
      expect(processedOrder).toEqual(expectedOrder);
      expect(stageProgressQueue.getQueueSize()).toBe(0);

      // Cleanup
      stageProgressQueue.clear();
    }, 10000);
  });
});
