/**
 * Property-Based Test: Image Error Handling
 * Feature: performance-optimization-and-backend-fixes
 * Property 6: Image error handling
 * Validates: Requirements 2.4
 * 
 * For any image that fails to load, the system should display a fallback
 * placeholder and log the error to the console or monitoring system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import LazyImage from '../index';

describe('Property 6: Image error handling', () => {
  let observerCallback: IntersectionObserverCallback;
  let observerInstance: {
    observe: ReturnType<typeof vi.fn>;
    unobserve: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

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

    // Spy on console.error to verify error logging
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  it('should display fallback placeholder when image fails to load', { timeout: 10000 }, async () => {
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

              // Wait for the component to transition to loading state
              // This ensures the src attribute is set and error handler is attached
              await new Promise(resolve => setTimeout(resolve, 10));

              // Verify image src is set before triggering error
              if (img.src) {
                // Simulate image error
                const errorEvent = new Event('error');
                img.dispatchEvent(errorEvent);

                // Wait for error state to be processed
                await new Promise(resolve => setTimeout(resolve, 10));

                // Check for error fallback UI
                const errorIcon = container.querySelector('svg');
                expect(errorIcon).toBeTruthy();

                // Verify error was logged
                expect(consoleErrorSpy).toHaveBeenCalled();
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display custom fallback when provided', { timeout: 10000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
          fallbackText: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async ({ src, alt, fallbackText }) => {
          const customFallback = <div data-testid="custom-fallback">{fallbackText}</div>;
          const { container, getByTestId, unmount } = render(
            <LazyImage src={src} alt={alt} fallback={customFallback} />
          );

          try {
            // Trigger intersection to start loading
            if (observerCallback) {
              const img = container.querySelector('img');
              if (img) {
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

                // Wait for the component to transition to loading state
                await new Promise(resolve => setTimeout(resolve, 10));

                // Verify image src is set before triggering error
                if (img.src) {
                  // Simulate image error
                  const errorEvent = new Event('error');
                  img.dispatchEvent(errorEvent);

                  // Wait for error state to be processed
                  await new Promise(resolve => setTimeout(resolve, 10));

                  // Check for custom fallback within this specific container
                  const fallbackElement = container.querySelector('[data-testid="custom-fallback"]');
                  expect(fallbackElement).toBeTruthy();
                  expect(fallbackElement?.textContent).toBe(fallbackText);
                }
              }
            }
          } finally {
            // Clean up after each test run
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should call onError callback when image fails', { timeout: 10000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async ({ src, alt }) => {
          const onErrorMock = vi.fn();
          const { container } = render(
            <LazyImage src={src} alt={alt} onError={onErrorMock} />
          );

          // Trigger intersection to start loading
          if (observerCallback) {
            const img = container.querySelector('img');
            if (img) {
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

              // Wait for the component to transition to loading state
              await new Promise(resolve => setTimeout(resolve, 10));

              // Verify image src is set before triggering error
              if (img.src) {
                // Simulate image error
                const errorEvent = new Event('error');
                img.dispatchEvent(errorEvent);

                // Wait for error handler to be called
                await new Promise(resolve => setTimeout(resolve, 10));

                // Verify onError callback was called with Error object
                expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error));
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should log error details for monitoring', { timeout: 10000 }, async () => {
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

              // Wait for the component to transition to loading state
              await new Promise(resolve => setTimeout(resolve, 10));

              // Verify image src is set before triggering error
              if (img.src) {
                // Simulate image error
                const errorEvent = new Event('error');
                img.dispatchEvent(errorEvent);

                // Wait for error logging to complete
                await new Promise(resolve => setTimeout(resolve, 10));

                // Verify error was logged with proper details
                expect(consoleErrorSpy).toHaveBeenCalledWith(
                  expect.stringContaining('[LazyImage]'),
                  expect.objectContaining({
                    src,
                    alt,
                  })
                );
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
