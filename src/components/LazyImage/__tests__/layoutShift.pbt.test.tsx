/**
 * Property-Based Test: Layout Shift Prevention
 * Feature: performance-optimization-and-backend-fixes
 * Property 7: Layout shift prevention
 * Validates: Requirements 2.6
 * 
 * For any image that loads after initial render, the Cumulative Layout Shift (CLS)
 * contribution should be zero due to reserved space based on aspect ratio.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import fc from 'fast-check';
import LazyImage from '../index';

describe('Property 7: Layout shift prevention', () => {
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

  it('should reserve space using aspect ratio to prevent layout shift', () => {
    fc.assert(
      fc.property(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
          aspectRatio: fc.constantFrom('16/9', '4/3', '1/1', '21/9'),
        }),
        ({ src, alt, aspectRatio }) => {
          const { container } = render(
            <LazyImage src={src} alt={alt} aspectRatio={aspectRatio} />
          );

          const wrapper = container.firstChild as HTMLElement;
          expect(wrapper).toBeTruthy();

          // Check that padding-bottom is set for aspect ratio
          const style = wrapper.style;
          expect(style.paddingBottom).toBeTruthy();
          expect(style.paddingBottom).not.toBe('');

          // Verify padding-bottom matches aspect ratio calculation
          const [w, h] = aspectRatio.split('/').map(Number);
          const expectedPadding = (h / w) * 100;
          expect(style.paddingBottom).toBe(`${expectedPadding}%`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reserve space using width and height to prevent layout shift', () => {
    fc.assert(
      fc.property(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
          width: fc.integer({ min: 100, max: 1000 }),
          height: fc.integer({ min: 100, max: 1000 }),
        }),
        ({ src, alt, width, height }) => {
          const { container } = render(
            <LazyImage src={src} alt={alt} width={width} height={height} />
          );

          const wrapper = container.firstChild as HTMLElement;
          expect(wrapper).toBeTruthy();

          // Check that space is reserved
          const style = wrapper.style;
          
          // Should have either padding-bottom or explicit height
          const hasPaddingBottom = style.paddingBottom && style.paddingBottom !== '';
          const hasHeight = style.height && style.height !== '';
          
          expect(hasPaddingBottom || hasHeight).toBe(true);

          // If using padding-bottom, verify calculation
          if (hasPaddingBottom) {
            const expectedPadding = (height / width) * 100;
            expect(style.paddingBottom).toBe(`${expectedPadding}%`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain container dimensions before and after image load', () => {
    fc.assert(
      fc.property(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
          width: fc.integer({ min: 200, max: 800 }),
          height: fc.integer({ min: 200, max: 800 }),
        }),
        ({ src, alt, width, height }) => {
          const { container } = render(
            <LazyImage src={src} alt={alt} width={width} height={height} />
          );

          const wrapper = container.firstChild as HTMLElement;
          
          // Get dimensions before load
          const beforeLoad = {
            paddingBottom: wrapper.style.paddingBottom,
            width: wrapper.style.width,
            height: wrapper.style.height,
          };

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

              // Simulate image load
              const loadEvent = new Event('load');
              img.dispatchEvent(loadEvent);
            }
          }

          // Get dimensions after load
          const afterLoad = {
            paddingBottom: wrapper.style.paddingBottom,
            width: wrapper.style.width,
            height: wrapper.style.height,
          };

          // Dimensions should remain the same (no layout shift)
          expect(afterLoad.paddingBottom).toBe(beforeLoad.paddingBottom);
          expect(afterLoad.width).toBe(beforeLoad.width);
          expect(afterLoad.height).toBe(beforeLoad.height);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use absolute positioning for image when aspect ratio is set', { timeout: 10000 }, () => {
    fc.assert(
      fc.property(
        fc.record({
          src: fc.webUrl(),
          alt: fc.string({ minLength: 1, maxLength: 50 }),
          aspectRatio: fc.constantFrom('16/9', '4/3', '1/1'),
        }),
        ({ src, alt, aspectRatio }) => {
          const { container } = render(
            <LazyImage src={src} alt={alt} aspectRatio={aspectRatio} />
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

              // Check image positioning
              const imgStyle = window.getComputedStyle(img);
              expect(imgStyle.position).toBe('absolute');
              expect(imgStyle.top).toBe('0px');
              expect(imgStyle.left).toBe('0px');
              expect(imgStyle.width).toBe('100%');
              expect(imgStyle.height).toBe('100%');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
