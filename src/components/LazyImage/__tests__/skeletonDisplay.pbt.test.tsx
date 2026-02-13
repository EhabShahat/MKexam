/**
 * Property-Based Test: Image Loading Skeleton Display
 * Feature: performance-optimization-and-backend-fixes
 * Property 5: Image loading skeleton display
 * Validates: Requirements 2.3
 * 
 * For any image in the loading state, a skeleton placeholder should be visible
 * in the UI until the image completes loading or fails.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import fc from 'fast-check';
import LazyImage from '../index';

describe('Property 5: Image loading skeleton display', () => {
  let observerCallback: IntersectionObserverCallback;
  let observerInstance: {
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock IntersectionObserver
    observerInstance = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };

    global.IntersectionObserver = class IntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = observerInstance.observe;
      unobserve = observerInstance.unobserve;
      disconnect = observerInstance.disconnect;
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [];
      takeRecords = () => [];
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display skeleton while image is loading', { timeout: 10000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
          skeleton: fc.boolean(),
        }),
        async ({ src, alt, skeleton }) => {
          const { container } = render(
            <LazyImage src={src} alt={alt} skeleton={skeleton} />
          );

          // Trigger intersection to start loading
          if (observerCallback) {
            const img = container.querySelector('img');
            if (img) {
              await act(async () => {
                observerCallback(
                  [
                    {
                      isIntersecting: true,
                      target: img,
                      boundingClientRect: {} as DOMRectReadOnly,
                      intersectionRatio: 1,
                      intersectionRect: {} as DOMRectReadOnly,
                      rootBounds: null,
                      time: Date.now(),
                    },
                  ],
                  observerInstance as any
                );
              });
            }
          }

          // Wait for state updates to complete
          await waitFor(() => {
            const skeletonElement = container.querySelector('.animate-pulse');
            
            if (skeleton) {
              // Skeleton should be visible when skeleton prop is true
              expect(skeletonElement).toBeTruthy();
            } else {
              // Skeleton should not be visible when skeleton prop is false
              expect(skeletonElement).toBeFalsy();
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show skeleton by default when skeleton prop is not specified', { timeout: 10000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ src, alt }) => {
          const { container } = render(<LazyImage src={src} alt={alt} />);

          // Trigger intersection to start loading
          if (observerCallback) {
            const img = container.querySelector('img');
            if (img) {
              await act(async () => {
                observerCallback(
                  [
                    {
                      isIntersecting: true,
                      target: img,
                      boundingClientRect: {} as DOMRectReadOnly,
                      intersectionRatio: 1,
                      intersectionRect: {} as DOMRectReadOnly,
                      rootBounds: null,
                      time: Date.now(),
                    },
                  ],
                  observerInstance as any
                );
              });
            }
          }

          // Wait for state updates to complete
          await waitFor(() => {
            // Skeleton should be visible by default (skeleton defaults to true)
            const skeletonElement = container.querySelector('.animate-pulse');
            expect(skeletonElement).toBeTruthy();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should hide skeleton after image loads successfully', { timeout: 10000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ src, alt }) => {
          const { container } = render(<LazyImage src={src} alt={alt} />);

          // Trigger intersection to start loading
          if (observerCallback) {
            const img = container.querySelector('img');
            if (img) {
              await act(async () => {
                observerCallback(
                  [
                    {
                      isIntersecting: true,
                      target: img,
                      boundingClientRect: {} as DOMRectReadOnly,
                      intersectionRatio: 1,
                      intersectionRect: {} as DOMRectReadOnly,
                      rootBounds: null,
                      time: Date.now(),
                    },
                  ],
                  observerInstance as any
                );
              });

              // Simulate image load
              await act(async () => {
                const loadEvent = new Event('load');
                img.dispatchEvent(loadEvent);
              });
            }
          }

          // Wait for state updates to complete
          await waitFor(() => {
            // After load, skeleton should be hidden
            const skeletonElement = container.querySelector('.animate-pulse');
            expect(skeletonElement).toBeFalsy();
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
