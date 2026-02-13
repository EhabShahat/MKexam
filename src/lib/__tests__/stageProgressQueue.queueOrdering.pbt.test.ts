/**
 * Property-Based Tests for Queue Ordering
 * Feature: staged-attempt-flow-fixes
 * Property 9: Queue ordering preserved
 * Validates: Requirements 2.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { stageProgressQueue } from '../stageProgressQueue';

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

describe('Queue Ordering - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    stageProgressQueue.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
    stageProgressQueue.clear();
  });

  describe('Property 9: Queue ordering preserved', () => {
    it('should process queue entries in insertion order', async () => {
      // Feature: staged-attempt-flow-fixes, Property 9: Queue ordering preserved
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }), // Number of items to queue
          async (queueSize) => {
            const processedOrder: string[] = [];

            // Clear the queue and reset mocks
            stageProgressQueue.clear();
            vi.clearAllMocks();

            // Mock fetch to track processing order
            (global.fetch as any).mockImplementation(async (url: string, options: any) => {
              if (url.includes('stage-progress')) {
                const body = JSON.parse(options.body);
                processedOrder.push(body.stage_id);
                
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

            // Enqueue items in a specific order
            const expectedOrder: string[] = [];
            for (let i = 0; i < queueSize; i++) {
              const stageId = `stage-${i}`;
              expectedOrder.push(stageId);
              stageProgressQueue.enqueue(
                `attempt-1`,
                stageId,
                { progress: i * 10 },
                false
              );
            }

            // Verify queue has items before processing
            expect(stageProgressQueue.getQueueSize()).toBe(queueSize);

            // Process the queue
            await stageProgressQueue.processQueue();

            // Verify order is preserved
            expect(processedOrder).toEqual(expectedOrder);
          }
        ),
        { numRuns: 50 }
      );
    }, 20000);

    it('should not process new entries added during current batch', async () => {
      // Feature: staged-attempt-flow-fixes, Property 9: Queue ordering preserved
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // Initial queue size
          fc.integer({ min: 1, max: 3 }), // Items to add during processing
          async (initialSize, itemsToAdd) => {
            const processedInFirstBatch: string[] = [];
            let processingStarted = false;

            // Clear the queue and reset mocks
            stageProgressQueue.clear();
            vi.clearAllMocks();

            // Mock fetch to track processing and add items mid-batch
            (global.fetch as any).mockImplementation(async (url: string, options: any) => {
              if (url.includes('stage-progress')) {
                const body = JSON.parse(options.body);
                processedInFirstBatch.push(body.stage_id);
                
                // On first call, mark processing as started and add new items
                if (!processingStarted) {
                  processingStarted = true;
                  
                  // Add new items while processing is in progress
                  for (let i = 0; i < itemsToAdd; i++) {
                    stageProgressQueue.enqueue(
                      `attempt-2`,
                      `new-stage-${i}`,
                      { progress: i * 10 },
                      false
                    );
                  }
                }
                
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

            // Enqueue initial items
            const initialStageIds: string[] = [];
            for (let i = 0; i < initialSize; i++) {
              const stageId = `initial-stage-${i}`;
              initialStageIds.push(stageId);
              stageProgressQueue.enqueue(
                `attempt-1`,
                stageId,
                { progress: i * 10 },
                false
              );
            }

            // Verify queue has initial items
            expect(stageProgressQueue.getQueueSize()).toBe(initialSize);

            // Process the queue (first batch)
            await stageProgressQueue.processQueue();

            // Verify only initial items were processed in first batch
            expect(processedInFirstBatch).toEqual(initialStageIds);
            
            // Verify new items are still in queue
            expect(stageProgressQueue.getQueueSize()).toBe(itemsToAdd);
          }
        ),
        { numRuns: 50 }
      );
    }, 15000);

    it('should maintain order across multiple processing cycles', async () => {
      // Feature: staged-attempt-flow-fixes, Property 9: Queue ordering preserved
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // Items per batch
          fc.integer({ min: 2, max: 4 }), // Number of batches
          async (itemsPerBatch, numBatches) => {
            const allProcessedOrder: string[] = [];
            const allExpectedOrder: string[] = [];

            // Clear the queue and reset mocks
            stageProgressQueue.clear();
            vi.clearAllMocks();

            // Mock fetch to track processing order
            (global.fetch as any).mockImplementation(async (url: string, options: any) => {
              if (url.includes('stage-progress')) {
                const body = JSON.parse(options.body);
                allProcessedOrder.push(body.stage_id);
                
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

            // Process multiple batches
            for (let batch = 0; batch < numBatches; batch++) {
              // Enqueue items for this batch
              for (let i = 0; i < itemsPerBatch; i++) {
                const stageId = `batch-${batch}-stage-${i}`;
                allExpectedOrder.push(stageId);
                stageProgressQueue.enqueue(
                  `attempt-${batch}`,
                  stageId,
                  { progress: i * 10 },
                  false
                );
              }

              // Process this batch
              await stageProgressQueue.processQueue();
            }

            // Verify overall order is preserved across all batches
            expect(allProcessedOrder).toEqual(allExpectedOrder);
          }
        ),
        { numRuns: 30 }
      );
    }, 15000);

    it('should preserve order when some items fail and retry', async () => {
      // Feature: staged-attempt-flow-fixes, Property 9: Queue ordering preserved
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 8 }), // Number of items
          fc.integer({ min: 0, max: 2 }), // Index of item to fail initially
          async (queueSize, failIndex) => {
            // Skip if failIndex is out of bounds
            if (failIndex >= queueSize) return;

            const processedOrder: string[] = [];
            let attemptCount = 0;

            // Clear the queue and reset mocks
            stageProgressQueue.clear();
            vi.clearAllMocks();

            // Mock fetch to fail one item on first attempt
            (global.fetch as any).mockImplementation(async (url: string, options: any) => {
              if (url.includes('stage-progress')) {
                const body = JSON.parse(options.body);
                const stageId = body.stage_id;
                
                // Fail the specified item on first attempt only
                if (stageId === `stage-${failIndex}` && attemptCount === 0) {
                  attemptCount++;
                  return {
                    ok: false,
                    status: 500,
                    json: async () => ({ error: 'Server error' }),
                  };
                }
                
                processedOrder.push(stageId);
                
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

            // Enqueue items
            for (let i = 0; i < queueSize; i++) {
              stageProgressQueue.enqueue(
                `attempt-1`,
                `stage-${i}`,
                { progress: i * 10 },
                false
              );
            }

            // Verify queue has items
            expect(stageProgressQueue.getQueueSize()).toBe(queueSize);

            // First processing - one item will fail
            await stageProgressQueue.processQueue();

            // Second processing - failed item should retry
            await stageProgressQueue.processQueue();

            // Build expected order: all items except the failed one, then the failed one
            const expectedOrder: string[] = [];
            for (let i = 0; i < queueSize; i++) {
              if (i !== failIndex) {
                expectedOrder.push(`stage-${i}`);
              }
            }
            expectedOrder.push(`stage-${failIndex}`);

            // Verify order is maintained with failed item processed last
            expect(processedOrder).toEqual(expectedOrder);
          }
        ),
        { numRuns: 30 }
      );
    }, 15000);
  });
});
