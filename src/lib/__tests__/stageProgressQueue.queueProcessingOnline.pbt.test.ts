/**
 * Property-Based Tests for Queue Processing When Online
 * Feature: staged-attempt-flow-fixes
 * Property 8: Queue processing when online
 * Validates: Requirements 2.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { stageProgressQueue, setupOnlineListener } from '../stageProgressQueue';

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

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('Queue Processing When Online - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    stageProgressQueue.clear();
    
    // Set up default mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    
    // Set online by default
    Object.defineProperty(global.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    // Setup online event listener for tests
    setupOnlineListener();
  });

  afterEach(() => {
    localStorageMock.clear();
    stageProgressQueue.clear();
  });

  describe('Property 8: Queue processing when online', () => {
    it('should process queued items when online event is triggered', async () => {
      // Feature: staged-attempt-flow-fixes, Property 8: Queue processing when online
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of items to queue
          async (queueSize) => {
            let processedCount = 0;

            // Mock fetch to count processed items
            (global.fetch as any).mockImplementation(async (url: string) => {
              if (url.includes('stage-progress')) {
                processedCount++;
                await new Promise(resolve => setTimeout(resolve, 5));
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

            // Clear the queue
            stageProgressQueue.clear();

            // Enqueue items while offline
            Object.defineProperty(global.navigator, 'onLine', {
              writable: true,
              value: false,
            });

            for (let i = 0; i < queueSize; i++) {
              stageProgressQueue.enqueue(
                `attempt-1`,
                `stage-${i}`,
                { progress: i * 10 },
                false
              );
            }

            // Verify items are queued
            expect(stageProgressQueue.getQueueSize()).toBe(queueSize);

            // Simulate coming back online
            Object.defineProperty(global.navigator, 'onLine', {
              writable: true,
              value: true,
            });

            // Trigger online event
            const onlineEvent = new Event('online');
            window.dispatchEvent(onlineEvent);

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify all items were processed
            expect(processedCount).toBe(queueSize);
            expect(stageProgressQueue.getQueueSize()).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);

    it('should only process queue when online', async () => {
      // Feature: staged-attempt-flow-fixes, Property 8: Queue processing when online
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of items to queue
          async (queueSize) => {
            let processedCount = 0;

            // Mock fetch to count processed items
            (global.fetch as any).mockImplementation(async (url: string) => {
              if (url.includes('stage-progress')) {
                processedCount++;
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

            // Clear the queue and reset mocks
            stageProgressQueue.clear();
            vi.clearAllMocks();

            // Set offline
            Object.defineProperty(global.navigator, 'onLine', {
              writable: true,
              value: false,
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

            // Verify items are queued
            expect(stageProgressQueue.getQueueSize()).toBe(queueSize);

            // Simulate the periodic check (which checks navigator.onLine)
            // This is what setupQueueProcessing does periodically
            if (navigator.onLine && stageProgressQueue.hasPendingSaves()) {
              await stageProgressQueue.processQueue();
            }

            // Verify items were NOT processed because we're offline
            expect(processedCount).toBe(0);
            expect(stageProgressQueue.getQueueSize()).toBe(queueSize);

            // Now go online
            Object.defineProperty(global.navigator, 'onLine', {
              writable: true,
              value: true,
            });

            // Simulate the periodic check again (now online)
            if (navigator.onLine && stageProgressQueue.hasPendingSaves()) {
              await stageProgressQueue.processQueue();
            }

            // Verify items WERE processed because we're online
            expect(processedCount).toBe(queueSize);
            expect(stageProgressQueue.getQueueSize()).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);

    it('should process queue periodically when online and has pending saves', async () => {
      // Feature: staged-attempt-flow-fixes, Property 8: Queue processing when online
      
      // This test verifies the periodic processing behavior
      // We can't easily test the actual interval, but we can verify the logic
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }), // Number of items to queue
          async (queueSize) => {
            let processedCount = 0;

            // Mock fetch to count processed items
            (global.fetch as any).mockImplementation(async (url: string) => {
              if (url.includes('stage-progress')) {
                processedCount++;
                await new Promise(resolve => setTimeout(resolve, 5));
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

            // Clear the queue
            stageProgressQueue.clear();

            // Set online
            Object.defineProperty(global.navigator, 'onLine', {
              writable: true,
              value: true,
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

            // Verify queue has pending saves
            expect(stageProgressQueue.hasPendingSaves()).toBe(true);
            expect(stageProgressQueue.getQueueSize()).toBe(queueSize);

            // Manually trigger processing (simulating periodic trigger)
            if (navigator.onLine && stageProgressQueue.hasPendingSaves()) {
              await stageProgressQueue.processQueue();
            }

            // Wait for processing to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify all items were processed
            expect(processedCount).toBe(queueSize);
            expect(stageProgressQueue.getQueueSize()).toBe(0);
            expect(stageProgressQueue.hasPendingSaves()).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    }, 10000);

    it('should not process empty queue even when online', async () => {
      // Feature: staged-attempt-flow-fixes, Property 8: Queue processing when online
      
      let processedCount = 0;

      // Mock fetch to count processed items
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('stage-progress')) {
          processedCount++;
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

      // Clear the queue
      stageProgressQueue.clear();

      // Set online
      Object.defineProperty(global.navigator, 'onLine', {
        writable: true,
        value: true,
      });

      // Verify queue is empty
      expect(stageProgressQueue.hasPendingSaves()).toBe(false);
      expect(stageProgressQueue.getQueueSize()).toBe(0);

      // Try to process empty queue
      await stageProgressQueue.processQueue();

      // Verify no items were processed
      expect(processedCount).toBe(0);
      expect(stageProgressQueue.getQueueSize()).toBe(0);
    });

    it('should handle multiple online events without duplicate processing', async () => {
      // Feature: staged-attempt-flow-fixes, Property 8: Queue processing when online
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // Number of items to queue
          fc.integer({ min: 2, max: 4 }), // Number of online events
          async (queueSize, onlineEvents) => {
            let processedCount = 0;

            // Mock fetch to count processed items
            (global.fetch as any).mockImplementation(async (url: string) => {
              if (url.includes('stage-progress')) {
                processedCount++;
                await new Promise(resolve => setTimeout(resolve, 10));
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

            // Clear the queue
            stageProgressQueue.clear();

            // Enqueue items
            for (let i = 0; i < queueSize; i++) {
              stageProgressQueue.enqueue(
                `attempt-1`,
                `stage-${i}`,
                { progress: i * 10 },
                false
              );
            }

            // Set online
            Object.defineProperty(global.navigator, 'onLine', {
              writable: true,
              value: true,
            });

            // Trigger multiple online events rapidly
            for (let i = 0; i < onlineEvents; i++) {
              const onlineEvent = new Event('online');
              window.dispatchEvent(onlineEvent);
            }

            // Wait for all processing to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify items were processed exactly once (not duplicated)
            expect(processedCount).toBe(queueSize);
            expect(stageProgressQueue.getQueueSize()).toBe(0);
          }
        ),
        { numRuns: 30 }
      );
    }, 15000);
  });
});
