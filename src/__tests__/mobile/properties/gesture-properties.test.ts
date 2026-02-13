/**
 * Property-based tests for gesture recognition
 * Feature: mobile-touch-optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as fc from 'fast-check';
import { useGestures, GestureConfig } from '@/hooks/mobile/useGestures';
import { createTouchEvent, resetMobileMocks } from '../setup';
import { useRef } from 'react';

describe('Gesture Recognition Properties', () => {
  beforeEach(() => {
    resetMobileMocks();
  });

  afterEach(() => {
    resetMobileMocks();
    vi.clearAllMocks();
  });

  // Feature: mobile-touch-optimization, Property 5: Bidirectional Swipe Navigation
  // Validates: Requirements 2.1, 2.2, 2.3
  describe('Property 5: Bidirectional Swipe Navigation', () => {
    it('should detect swipe-left gesture for any horizontal movement > threshold to the left', () => {
      fc.assert(
        fc.property(
          // Generate random start positions
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 100, max: 500 }),
          // Generate swipe distances greater than threshold (50px)
          fc.integer({ min: 51, max: 300 }),
          // Generate small vertical movement (to ensure horizontal swipe)
          fc.integer({ min: -20, max: 20 }),
          (startX, startY, swipeDistance, verticalDelta) => {
            // Setup: Create element and callbacks
            const element = document.createElement('div');
            document.body.appendChild(element);
            const onSwipeLeft = vi.fn();
            const onSwipeRight = vi.fn();

            const config: GestureConfig = {
              onSwipeLeft,
              onSwipeRight,
              threshold: 50,
              timeThreshold: 300,
              enabled: true,
            };

            // Create ref wrapper
            const { result } = renderHook(() => {
              const ref = useRef<HTMLDivElement>(element);
              useGestures(ref, config);
              return ref;
            });

            // Execute: Simulate swipe-left gesture
            const touchStart = createTouchEvent('touchstart', [
              { clientX: startX, clientY: startY, identifier: 0 },
            ]);
            element.dispatchEvent(touchStart);

            // Move left (negative X direction)
            const endX = startX - swipeDistance;
            const endY = startY + verticalDelta;
            
            const touchMove = createTouchEvent('touchmove', [
              { clientX: endX, clientY: endY, identifier: 0 },
            ]);
            element.dispatchEvent(touchMove);

            const touchEnd = createTouchEvent('touchend', []);
            element.dispatchEvent(touchEnd);

            // Verify: Swipe left should be detected
            expect(onSwipeLeft).toHaveBeenCalledTimes(1);
            expect(onSwipeRight).not.toHaveBeenCalled();

            // Cleanup
            document.body.removeChild(element);

            return onSwipeLeft.mock.calls.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect swipe-right gesture for any horizontal movement > threshold to the right', () => {
      fc.assert(
        fc.property(
          // Generate random start positions
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 100, max: 500 }),
          // Generate swipe distances greater than threshold (50px)
          fc.integer({ min: 51, max: 300 }),
          // Generate small vertical movement (to ensure horizontal swipe)
          fc.integer({ min: -20, max: 20 }),
          (startX, startY, swipeDistance, verticalDelta) => {
            // Setup: Create element and callbacks
            const element = document.createElement('div');
            document.body.appendChild(element);
            const onSwipeLeft = vi.fn();
            const onSwipeRight = vi.fn();

            const config: GestureConfig = {
              onSwipeLeft,
              onSwipeRight,
              threshold: 50,
              timeThreshold: 300,
              enabled: true,
            };

            // Create ref wrapper
            const { result } = renderHook(() => {
              const ref = useRef<HTMLDivElement>(element);
              useGestures(ref, config);
              return ref;
            });

            // Execute: Simulate swipe-right gesture
            const touchStart = createTouchEvent('touchstart', [
              { clientX: startX, clientY: startY, identifier: 0 },
            ]);
            element.dispatchEvent(touchStart);

            // Move right (positive X direction)
            const endX = startX + swipeDistance;
            const endY = startY + verticalDelta;
            
            const touchMove = createTouchEvent('touchmove', [
              { clientX: endX, clientY: endY, identifier: 0 },
            ]);
            element.dispatchEvent(touchMove);

            const touchEnd = createTouchEvent('touchend', []);
            element.dispatchEvent(touchEnd);

            // Verify: Swipe right should be detected
            expect(onSwipeRight).toHaveBeenCalledTimes(1);
            expect(onSwipeLeft).not.toHaveBeenCalled();

            // Cleanup
            document.body.removeChild(element);

            return onSwipeRight.mock.calls.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT detect swipe for any movement below threshold', () => {
      fc.assert(
        fc.property(
          // Generate random start positions
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 100, max: 500 }),
          // Generate swipe distances BELOW threshold (50px)
          fc.integer({ min: 5, max: 49 }),
          // Random direction
          fc.constantFrom(-1, 1),
          (startX, startY, swipeDistance, direction) => {
            // Setup: Create element and callbacks
            const element = document.createElement('div');
            document.body.appendChild(element);
            const onSwipeLeft = vi.fn();
            const onSwipeRight = vi.fn();

            const config: GestureConfig = {
              onSwipeLeft,
              onSwipeRight,
              threshold: 50,
              timeThreshold: 300,
              enabled: true,
            };

            // Create ref wrapper
            const { result } = renderHook(() => {
              const ref = useRef<HTMLDivElement>(element);
              useGestures(ref, config);
              return ref;
            });

            // Execute: Simulate small movement (below threshold)
            const touchStart = createTouchEvent('touchstart', [
              { clientX: startX, clientY: startY, identifier: 0 },
            ]);
            element.dispatchEvent(touchStart);

            const endX = startX + (swipeDistance * direction);
            const endY = startY;
            
            const touchMove = createTouchEvent('touchmove', [
              { clientX: endX, clientY: endY, identifier: 0 },
            ]);
            element.dispatchEvent(touchMove);

            const touchEnd = createTouchEvent('touchend', []);
            element.dispatchEvent(touchEnd);

            // Verify: No swipe should be detected
            expect(onSwipeLeft).not.toHaveBeenCalled();
            expect(onSwipeRight).not.toHaveBeenCalled();

            // Cleanup
            document.body.removeChild(element);

            return onSwipeLeft.mock.calls.length === 0 && onSwipeRight.mock.calls.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide visual feedback during swipe (touchmove events are tracked)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 51, max: 300 }),
          (startX, startY, swipeDistance) => {
            // Setup: Create element
            const element = document.createElement('div');
            document.body.appendChild(element);
            const onSwipeLeft = vi.fn();

            const config: GestureConfig = {
              onSwipeLeft,
              threshold: 50,
              timeThreshold: 300,
              enabled: true,
            };

            // Create ref wrapper
            const { result } = renderHook(() => {
              const ref = useRef<HTMLDivElement>(element);
              useGestures(ref, config);
              return ref;
            });

            // Execute: Simulate swipe with multiple move events
            const touchStart = createTouchEvent('touchstart', [
              { clientX: startX, clientY: startY, identifier: 0 },
            ]);
            element.dispatchEvent(touchStart);

            // Simulate progressive movement (visual feedback opportunity)
            const steps = 5;
            for (let i = 1; i <= steps; i++) {
              const currentX = startX - (swipeDistance * i / steps);
              const touchMove = createTouchEvent('touchmove', [
                { clientX: currentX, clientY: startY, identifier: 0 },
              ]);
              element.dispatchEvent(touchMove);
            }

            const touchEnd = createTouchEvent('touchend', []);
            element.dispatchEvent(touchEnd);

            // Verify: Swipe should be detected after progressive movement
            expect(onSwipeLeft).toHaveBeenCalledTimes(1);

            // Cleanup
            document.body.removeChild(element);

            return onSwipeLeft.mock.calls.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: mobile-touch-optimization, Property 7: Contextual Swipe Prevention
  // Validates: Requirements 2.5
  describe('Property 7: Contextual Swipe Prevention', () => {
    it('should NOT trigger swipe when touch starts within a text input', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 51, max: 300 }),
          (startX, startY, swipeDistance) => {
            // Setup: Create container with input
            const container = document.createElement('div');
            const input = document.createElement('input');
            input.type = 'text';
            container.appendChild(input);
            document.body.appendChild(container);

            const onSwipeLeft = vi.fn();

            const config: GestureConfig = {
              onSwipeLeft,
              threshold: 50,
              timeThreshold: 300,
              enabled: true,
            };

            // Create ref wrapper
            const { result } = renderHook(() => {
              const ref = useRef<HTMLDivElement>(container);
              useGestures(ref, config);
              return ref;
            });

            // Execute: Simulate swipe starting from input element
            const touchStart = new TouchEvent('touchstart', {
              touches: [
                {
                  clientX: startX,
                  clientY: startY,
                  identifier: 0,
                  target: input,
                } as any,
              ],
              bubbles: true,
              cancelable: true,
            });
            input.dispatchEvent(touchStart);

            const endX = startX - swipeDistance;
            const touchMove = new TouchEvent('touchmove', {
              touches: [
                {
                  clientX: endX,
                  clientY: startY,
                  identifier: 0,
                  target: input,
                } as any,
              ],
              bubbles: true,
              cancelable: true,
            });
            input.dispatchEvent(touchMove);

            const touchEnd = new TouchEvent('touchend', {
              changedTouches: [
                {
                  clientX: endX,
                  clientY: startY,
                  identifier: 0,
                  target: input,
                } as any,
              ],
              bubbles: true,
              cancelable: true,
            });
            input.dispatchEvent(touchEnd);

            // Verify: Swipe should NOT be triggered
            expect(onSwipeLeft).not.toHaveBeenCalled();

            // Cleanup
            document.body.removeChild(container);

            return onSwipeLeft.mock.calls.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT trigger swipe when touch starts within a textarea', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 51, max: 300 }),
          (startX, startY, swipeDistance) => {
            // Setup: Create container with textarea
            const container = document.createElement('div');
            const textarea = document.createElement('textarea');
            container.appendChild(textarea);
            document.body.appendChild(container);

            const onSwipeLeft = vi.fn();

            const config: GestureConfig = {
              onSwipeLeft,
              threshold: 50,
              timeThreshold: 300,
              enabled: true,
            };

            // Create ref wrapper
            const { result } = renderHook(() => {
              const ref = useRef<HTMLDivElement>(container);
              useGestures(ref, config);
              return ref;
            });

            // Execute: Simulate swipe starting from textarea element
            const touchStart = new TouchEvent('touchstart', {
              touches: [
                {
                  clientX: startX,
                  clientY: startY,
                  identifier: 0,
                  target: textarea,
                } as any,
              ],
              bubbles: true,
              cancelable: true,
            });
            textarea.dispatchEvent(touchStart);

            const endX = startX - swipeDistance;
            const touchMove = new TouchEvent('touchmove', {
              touches: [
                {
                  clientX: endX,
                  clientY: startY,
                  identifier: 0,
                  target: textarea,
                } as any,
              ],
              bubbles: true,
              cancelable: true,
            });
            textarea.dispatchEvent(touchMove);

            const touchEnd = new TouchEvent('touchend', {
              changedTouches: [
                {
                  clientX: endX,
                  clientY: startY,
                  identifier: 0,
                  target: textarea,
                } as any,
              ],
              bubbles: true,
              cancelable: true,
            });
            textarea.dispatchEvent(touchEnd);

            // Verify: Swipe should NOT be triggered
            expect(onSwipeLeft).not.toHaveBeenCalled();

            // Cleanup
            document.body.removeChild(container);

            return onSwipeLeft.mock.calls.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NOT trigger swipe when touch starts within a scrollable container', () => {
      // Setup: Create scrollable container
      const container = document.createElement('div');
      container.style.overflowY = 'auto';
      container.style.height = '200px';
      
      const content = document.createElement('div');
      content.style.height = '500px'; // Make content scrollable
      container.appendChild(content);
      document.body.appendChild(container);

      // Mock getComputedStyle to return scrollable overflow
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = vi.fn((element: Element) => {
        if (element === container) {
          return {
            overflowY: 'auto',
            overflowX: 'visible',
            getPropertyValue: (prop: string) => {
              if (prop === 'overflow-y') return 'auto';
              if (prop === 'overflow-x') return 'visible';
              return '';
            },
          } as unknown as CSSStyleDeclaration;
        }
        return originalGetComputedStyle(element);
      }) as any;

      // Mock scrollHeight to make it scrollable
      Object.defineProperty(container, 'scrollHeight', {
        configurable: true,
        value: 500,
      });
      Object.defineProperty(container, 'clientHeight', {
        configurable: true,
        value: 200,
      });

      const onSwipeLeft = vi.fn();

      const config: GestureConfig = {
        onSwipeLeft,
        threshold: 50,
        timeThreshold: 300,
        enabled: true,
      };

      // Create ref wrapper
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(container);
        useGestures(ref, config);
        return ref;
      });

      // Execute: Simulate swipe starting from scrollable content
      const startX = 200;
      const startY = 200;
      const swipeDistance = 100;

      const touchStart = new TouchEvent('touchstart', {
        touches: [
          {
            clientX: startX,
            clientY: startY,
            identifier: 0,
            target: content,
          } as any,
        ],
        bubbles: true,
        cancelable: true,
      });
      content.dispatchEvent(touchStart);

      const endX = startX - swipeDistance;
      const touchMove = new TouchEvent('touchmove', {
        touches: [
          {
            clientX: endX,
            clientY: startY,
            identifier: 0,
            target: content,
          } as any,
        ],
        bubbles: true,
        cancelable: true,
      });
      content.dispatchEvent(touchMove);

      const touchEnd = new TouchEvent('touchend', {
        changedTouches: [
          {
            clientX: endX,
            clientY: startY,
            identifier: 0,
            target: content,
          } as any,
        ],
        bubbles: true,
        cancelable: true,
      });
      content.dispatchEvent(touchEnd);

      // Verify: Swipe should NOT be triggered
      expect(onSwipeLeft).not.toHaveBeenCalled();

      // Cleanup
      window.getComputedStyle = originalGetComputedStyle;
      document.body.removeChild(container);
    });
  });

  // Feature: mobile-touch-optimization, Property 38: Passive Touch Event Listeners
  // Validates: Requirements 13.1
  describe('Property 38: Passive Touch Event Listeners', () => {
    it('should use passive event listeners for touchstart and touchend', () => {
      // Setup: Spy on addEventListener
      const element = document.createElement('div');
      document.body.appendChild(element);
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      const config: GestureConfig = {
        onSwipeLeft: vi.fn(),
        threshold: 50,
        enabled: true,
      };

      // Execute: Render hook
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        useGestures(ref, config);
        return ref;
      });

      // Verify: touchstart and touchend should use passive listeners
      const touchstartCall = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'touchstart'
      );
      const touchendCall = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'touchend'
      );

      expect(touchstartCall).toBeDefined();
      expect(touchstartCall?.[2]).toEqual({ passive: true });
      
      expect(touchendCall).toBeDefined();
      expect(touchendCall?.[2]).toEqual({ passive: true });

      // Cleanup
      document.body.removeChild(element);
      addEventListenerSpy.mockRestore();
    });

    it('should use passive listener for touchmove when preventScroll is false', () => {
      // Setup: Spy on addEventListener
      const element = document.createElement('div');
      document.body.appendChild(element);
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      const config: GestureConfig = {
        onSwipeLeft: vi.fn(),
        threshold: 50,
        enabled: true,
        preventScroll: false, // Passive should be true
      };

      // Execute: Render hook
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        useGestures(ref, config);
        return ref;
      });

      // Verify: touchmove should use passive listener
      const touchmoveCall = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'touchmove'
      );

      expect(touchmoveCall).toBeDefined();
      expect(touchmoveCall?.[2]).toEqual({ passive: true });

      // Cleanup
      document.body.removeChild(element);
      addEventListenerSpy.mockRestore();
    });

    it('should NOT use passive listener for touchmove when preventScroll is true', () => {
      // Setup: Spy on addEventListener
      const element = document.createElement('div');
      document.body.appendChild(element);
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      const config: GestureConfig = {
        onSwipeLeft: vi.fn(),
        threshold: 50,
        enabled: true,
        preventScroll: true, // Passive should be false
      };

      // Execute: Render hook
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement>(element);
        useGestures(ref, config);
        return ref;
      });

      // Verify: touchmove should NOT use passive listener
      const touchmoveCall = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'touchmove'
      );

      expect(touchmoveCall).toBeDefined();
      expect(touchmoveCall?.[2]).toEqual({ passive: false });

      // Cleanup
      document.body.removeChild(element);
      addEventListenerSpy.mockRestore();
    });
  });
});
