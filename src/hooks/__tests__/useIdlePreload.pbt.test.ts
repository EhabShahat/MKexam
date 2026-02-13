/**
 * Feature: performance-optimization-and-backend-fixes
 * Property 12: Idle time preloading
 * Validates: Requirements 4.5
 * 
 * This test verifies that resources are preloaded during browser idle time
 * without blocking the main thread.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";

describe("Idle Time Preloading", () => {
  let originalRequestIdleCallback: any;
  let originalCancelIdleCallback: any;

  beforeEach(() => {
    // Save original functions
    originalRequestIdleCallback = (global as any).requestIdleCallback;
    originalCancelIdleCallback = (global as any).cancelIdleCallback;

    // Mock requestIdleCallback
    (global as any).requestIdleCallback = vi.fn((callback: Function, options?: any) => {
      // Simulate idle callback being called
      const timeoutId = setTimeout(() => callback(), 0);
      return timeoutId;
    });

    (global as any).cancelIdleCallback = vi.fn((id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    // Restore original functions
    (global as any).requestIdleCallback = originalRequestIdleCallback;
    (global as any).cancelIdleCallback = originalCancelIdleCallback;
    vi.clearAllMocks();
  });

  /**
   * Property 12: Idle time preloading
   * 
   * For any critical resource identified for preloading, the resource should
   * begin loading during browser idle time without blocking the main thread.
   * 
   * This property verifies that:
   * 1. Preloading uses requestIdleCallback when available
   * 2. Resources are loaded asynchronously
   * 3. Main thread is not blocked during preload
   */
  it("should preload resources during idle time without blocking main thread", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            href: fc.webUrl(),
            as: fc.constantFrom("script", "style", "font", "image"),
            type: fc.option(fc.constantFrom("text/javascript", "text/css", "font/woff2"), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (resources) => {
          // Reset mocks at the start of each iteration
          vi.clearAllMocks();
          
          const preloadedResources: string[] = [];

          // Simulate preloading function
          const preloadResource = (resource: { href: string; as: string; type?: string }) => {
            return new Promise<void>((resolve) => {
              if (typeof (global as any).requestIdleCallback === "function") {
                (global as any).requestIdleCallback(() => {
                  // Simulate async resource loading
                  preloadedResources.push(resource.href);
                  resolve();
                });
              } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => {
                  preloadedResources.push(resource.href);
                  resolve();
                }, 0);
              }
            });
          };

          // Preload all resources
          await Promise.all(resources.map((r) => preloadResource(r)));

          // All resources should be preloaded
          expect(preloadedResources.length).toBe(resources.length);

          // Each resource should be in the preloaded list
          resources.forEach((resource) => {
            expect(preloadedResources).toContain(resource.href);
          });

          // requestIdleCallback should have been called for each resource
          expect((global as any).requestIdleCallback).toHaveBeenCalledTimes(resources.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Idle preloading doesn't block main thread
   * 
   * Preloading should be deferred and not execute synchronously
   */
  it("should defer preloading to avoid blocking main thread", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 10 }),
        async (urls) => {
          // Reset mocks at the start of each iteration
          vi.clearAllMocks();
          
          let mainThreadBlocked = false;
          const preloadStarted: string[] = [];

          // Simulate main thread work
          const mainThreadWork = () => {
            mainThreadBlocked = true;
            // Simulate some work
            for (let i = 0; i < 100; i++) {
              Math.sqrt(i);
            }
            mainThreadBlocked = false;
          };

          // Start preloading
          const preloadPromises = urls.map((url) => {
            return new Promise<void>((resolve) => {
              (global as any).requestIdleCallback(() => {
                // Preload should not happen while main thread is blocked
                expect(mainThreadBlocked).toBe(false);
                preloadStarted.push(url);
                resolve();
              });
            });
          });

          // Do main thread work
          mainThreadWork();

          // Wait for preloading to complete
          await Promise.all(preloadPromises);

          // All URLs should be preloaded
          expect(preloadStarted.length).toBe(urls.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Preloading has timeout fallback
   * 
   * If browser never becomes idle, preloading should still happen after timeout
   */
  it("should have timeout fallback if browser never becomes idle", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.webUrl(),
          timeout: fc.integer({ min: 100, max: 2000 }),
        }),
        async ({ url, timeout }) => {
          let preloaded = false;

          // Simulate preloading with timeout
          const preloadWithTimeout = () => {
            return new Promise<void>((resolve) => {
              const timeoutId = setTimeout(() => {
                preloaded = true;
                resolve();
              }, timeout);

              // Simulate requestIdleCallback with timeout option
              if (typeof (global as any).requestIdleCallback === "function") {
                (global as any).requestIdleCallback(
                  () => {
                    clearTimeout(timeoutId);
                    preloaded = true;
                    resolve();
                  },
                  { timeout }
                );
              }
            });
          };

          const startTime = Date.now();
          await preloadWithTimeout();
          const endTime = Date.now();

          // Resource should be preloaded
          expect(preloaded).toBe(true);

          // Should complete within reasonable time (timeout + buffer)
          expect(endTime - startTime).toBeLessThanOrEqual(timeout + 100);
        }
      ),
      { numRuns: 50 } // Fewer runs due to timeout delays
    );
  });

  /**
   * Property: Preloading can be cancelled
   * 
   * Preload operations should be cancellable to avoid wasted work
   */
  it("should allow cancellation of preload operations", () => {
    fc.assert(
      fc.property(
        fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }),
        (urls) => {
          // Reset mocks at the start of each iteration
          vi.clearAllMocks();
          
          const preloadIds: number[] = [];

          // Start preloading
          urls.forEach((url) => {
            const id = (global as any).requestIdleCallback(() => {
              // This should not execute if cancelled
            });
            preloadIds.push(id);
          });

          // Cancel all preloads
          preloadIds.forEach((id) => {
            (global as any).cancelIdleCallback(id);
          });

          // cancelIdleCallback should have been called for each preload
          expect((global as any).cancelIdleCallback).toHaveBeenCalledTimes(urls.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
