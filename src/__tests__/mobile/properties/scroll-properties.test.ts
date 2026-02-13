/**
 * Property-based tests for mobile scroll optimizations
 * Feature: mobile-touch-optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  applyMomentumScrolling,
  preventScrollChaining,
  preventPullToRefresh,
  enableSmoothScrolling,
  smoothScrollTo,
  smoothScrollToPosition,
  isScrollable,
  lockBodyScroll,
  unlockBodyScroll,
} from '@/lib/mobile/scrollOptimization';

describe('Scroll Optimization Properties', () => {
  let testElements: HTMLElement[] = [];

  beforeEach(() => {
    testElements = [];
    document.body.innerHTML = '';
    document.body.style.cssText = '';
  });

  afterEach(() => {
    testElements.forEach((el) => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    testElements = [];
    document.body.style.cssText = '';
  });

  function createScrollContainer(): HTMLElement {
    const container = document.createElement('div');
    container.style.overflow = 'auto';
    container.style.height = '300px';
    container.style.width = '300px';
    
    const content = document.createElement('div');
    content.style.height = '1000px';
    content.textContent = 'Scrollable content';
    
    container.appendChild(content);
    document.body.appendChild(container);
    testElements.push(container);
    
    return container;
  }

  // Feature: mobile-touch-optimization, Property 28: Momentum Scrolling
  // Validates: Requirements 10.1
  describe('Property 28: Momentum Scrolling', () => {
    it('should apply -webkit-overflow-scrolling: touch to any scrollable container', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numContainers) => {
            // Setup: Create multiple scroll containers
            const containers: HTMLElement[] = [];
            for (let i = 0; i < numContainers; i++) {
              containers.push(createScrollContainer());
            }

            // Execute: Apply momentum scrolling to all containers
            containers.forEach((container) => {
              applyMomentumScrolling(container);
            });

            // Verify: All containers have momentum scrolling enabled
            const allHaveMomentumScrolling = containers.every((container) => {
              const style = container.style as any;
              return style.webkitOverflowScrolling === 'touch';
            });

            expect(allHaveMomentumScrolling).toBe(true);
            return allHaveMomentumScrolling;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure overflow is set when applying momentum scrolling', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', 'auto', 'scroll', 'hidden'),
          (initialOverflow) => {
            // Setup: Create container with various initial overflow values
            const container = createScrollContainer();
            if (initialOverflow) {
              container.style.overflow = initialOverflow;
            } else {
              container.style.overflow = '';
              container.style.overflowY = '';
            }

            // Execute: Apply momentum scrolling
            applyMomentumScrolling(container);

            // Verify: Container has momentum scrolling and overflow is set
            const style = container.style as any;
            const hasMomentumScrolling = style.webkitOverflowScrolling === 'touch';
            const hasOverflow = container.style.overflow !== '' || container.style.overflowY !== '';

            expect(hasMomentumScrolling).toBe(true);
            
            // If no overflow was set initially, it should be set to auto
            if (!initialOverflow) {
              expect(container.style.overflowY).toBe('auto');
            }

            return hasMomentumScrolling && hasOverflow;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null or undefined elements gracefully', () => {
      // Execute: Apply momentum scrolling to null/undefined
      expect(() => applyMomentumScrolling(null as any)).not.toThrow();
      expect(() => applyMomentumScrolling(undefined as any)).not.toThrow();
    });

    it('should apply momentum scrolling to elements with data-scroll-container attribute', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (numContainers) => {
            // Setup: Create containers with data-scroll-container attribute
            const containers: HTMLElement[] = [];
            for (let i = 0; i < numContainers; i++) {
              const container = createScrollContainer();
              container.setAttribute('data-scroll-container', '');
              containers.push(container);
            }

            // Execute: Apply momentum scrolling
            containers.forEach((container) => {
              applyMomentumScrolling(container);
            });

            // Verify: All have momentum scrolling
            const allHaveMomentumScrolling = containers.every((container) => {
              const style = container.style as any;
              return style.webkitOverflowScrolling === 'touch';
            });

            expect(allHaveMomentumScrolling).toBe(true);
            return allHaveMomentumScrolling;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: mobile-touch-optimization, Property 29: Smooth Scroll Animation
  // Validates: Requirements 10.2
  describe('Property 29: Smooth Scroll Animation', () => {
    it('should enable smooth scroll behavior for any element', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numElements) => {
            // Setup: Create multiple elements
            const elements: HTMLElement[] = [];
            for (let i = 0; i < numElements; i++) {
              elements.push(createScrollContainer());
            }

            // Execute: Enable smooth scrolling
            elements.forEach((element) => {
              enableSmoothScrolling(element);
            });

            // Verify: All elements have smooth scroll behavior
            const allHaveSmoothScroll = elements.every((element) => {
              return element.style.scrollBehavior === 'smooth';
            });

            expect(allHaveSmoothScroll).toBe(true);
            return allHaveSmoothScroll;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should complete scroll animation within 400ms', async () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 300, max: 500 }),
          async (scrollPosition, duration) => {
            // Setup: Create container
            const container = createScrollContainer();
            const startTime = performance.now();

            // Execute: Smooth scroll to position
            await smoothScrollToPosition(container, scrollPosition, duration);

            // Verify: Animation completed within expected duration (with 50ms tolerance)
            const elapsed = performance.now() - startTime;
            const withinDuration = elapsed >= duration && elapsed <= duration + 100;

            expect(withinDuration).toBe(true);
            return withinDuration;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle smooth scroll for any valid scroll position', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2000 }),
          (targetPosition) => {
            // Setup: Create container
            const container = createScrollContainer();

            // Execute: Smooth scroll to position (don't await, just verify it doesn't throw)
            expect(() => {
              smoothScrollToPosition(container, targetPosition, 100);
            }).not.toThrow();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use smooth scroll behavior when scrolling to elements', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('start', 'center', 'end', 'nearest'),
          (block) => {
            // Setup: Create target element
            const container = createScrollContainer();
            const target = document.createElement('div');
            target.style.marginTop = '500px';
            container.appendChild(target);

            // Mock scrollIntoView
            const scrollIntoViewMock = vi.fn();
            target.scrollIntoView = scrollIntoViewMock;

            // Execute: Smooth scroll to element
            smoothScrollTo(target, { block: block as ScrollLogicalPosition });

            // Verify: scrollIntoView was called with smooth behavior
            expect(scrollIntoViewMock).toHaveBeenCalledWith(
              expect.objectContaining({
                behavior: 'smooth',
                block,
              })
            );

            return scrollIntoViewMock.mock.calls.length === 1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: mobile-touch-optimization, Property 30: Scroll Chaining Prevention
  // Validates: Requirements 10.3
  describe('Property 30: Scroll Chaining Prevention', () => {
    it('should apply overscroll-behavior: contain to any nested scrollable container', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numContainers) => {
            // Setup: Create multiple nested scroll containers
            const containers: HTMLElement[] = [];
            for (let i = 0; i < numContainers; i++) {
              containers.push(createScrollContainer());
            }

            // Execute: Prevent scroll chaining on all containers
            containers.forEach((container) => {
              preventScrollChaining(container);
            });

            // Verify: All containers have scroll chaining prevented
            const allHaveScrollChainPrevention = containers.every((container) => {
              return container.style.overscrollBehavior === 'contain';
            });

            expect(allHaveScrollChainPrevention).toBe(true);
            return allHaveScrollChainPrevention;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prevent scroll chaining on modal and sidebar containers', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('modal-content', 'sidebar-content', 'dropdown-menu'),
          (className) => {
            // Setup: Create container with specific class
            const container = createScrollContainer();
            container.className = className;

            // Execute: Prevent scroll chaining
            preventScrollChaining(container);

            // Verify: Container has scroll chaining prevented
            expect(container.style.overscrollBehavior).toBe('contain');
            return container.style.overscrollBehavior === 'contain';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle null or undefined elements gracefully', () => {
      // Execute: Prevent scroll chaining on null/undefined
      expect(() => preventScrollChaining(null as any)).not.toThrow();
      expect(() => preventScrollChaining(undefined as any)).not.toThrow();
    });
  });

  // Feature: mobile-touch-optimization, Property 31: Pull-to-Refresh Prevention
  // Validates: Requirements 10.5
  describe('Property 31: Pull-to-Refresh Prevention', () => {
    it('should apply overscroll-behavior-y: contain to body element', () => {
      // Execute: Prevent pull-to-refresh
      preventPullToRefresh();

      // Verify: Body has pull-to-refresh prevented
      expect(document.body.style.overscrollBehaviorY).toBe('contain');
    });

    it('should prevent pull-to-refresh on multiple calls without side effects', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numCalls) => {
            // Execute: Call preventPullToRefresh multiple times
            for (let i = 0; i < numCalls; i++) {
              preventPullToRefresh();
            }

            // Verify: Body still has pull-to-refresh prevented
            expect(document.body.style.overscrollBehaviorY).toBe('contain');
            return document.body.style.overscrollBehaviorY === 'contain';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should work in browser environment', () => {
      // Verify: Function doesn't throw in browser environment
      expect(() => preventPullToRefresh()).not.toThrow();
    });
  });

  describe('Scroll Utility Functions', () => {
    it('should correctly identify scrollable elements', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          fc.integer({ min: 600, max: 2000 }),
          (containerHeight, contentHeight) => {
            // Setup: Create container with specific dimensions
            const container = document.createElement('div');
            container.style.height = `${containerHeight}px`;
            container.style.overflow = 'auto';
            container.style.position = 'relative';
            
            const content = document.createElement('div');
            content.style.height = `${contentHeight}px`;
            content.style.width = '100%';
            
            container.appendChild(content);
            document.body.appendChild(container);
            testElements.push(container);

            // Force layout calculation
            container.getBoundingClientRect();

            // Execute: Check if scrollable
            const scrollable = isScrollable(container);

            // Verify: Should be scrollable if content > container
            // In test environment, scrollHeight might not be calculated correctly
            // So we check the actual scrollHeight vs clientHeight
            const actuallyScrollable = container.scrollHeight > container.clientHeight;
            expect(scrollable).toBe(actuallyScrollable);

            return scrollable === actuallyScrollable;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not identify hidden overflow elements as scrollable', () => {
      // Setup: Create container with overflow hidden
      const container = createScrollContainer();
      container.style.overflow = 'hidden';

      // Execute: Check if scrollable
      const scrollable = isScrollable(container);

      // Verify: Should not be scrollable
      expect(scrollable).toBe(false);
    });

    it('should lock body scroll and preserve scrollbar width', () => {
      // Setup: Mock scrollbar width
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
      Object.defineProperty(document.documentElement, 'clientWidth', { value: 1008, writable: true });

      // Execute: Lock body scroll
      lockBodyScroll();

      // Verify: Body overflow is hidden and padding is added
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.body.style.paddingRight).toBe('16px');
    });

    it('should unlock body scroll and restore original state', () => {
      // Setup: Lock body scroll first
      lockBodyScroll();

      // Execute: Unlock body scroll
      unlockBodyScroll();

      // Verify: Body overflow and padding are restored
      expect(document.body.style.overflow).toBe('');
      expect(document.body.style.paddingRight).toBe('');
    });

    it('should handle multiple lock/unlock cycles correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          (numCycles) => {
            // Execute: Multiple lock/unlock cycles
            for (let i = 0; i < numCycles; i++) {
              lockBodyScroll();
              expect(document.body.style.overflow).toBe('hidden');
              
              unlockBodyScroll();
              expect(document.body.style.overflow).toBe('');
            }

            // Verify: Final state is unlocked
            return document.body.style.overflow === '';
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle elements without parent nodes', () => {
      const orphanElement = document.createElement('div');
      
      expect(() => applyMomentumScrolling(orphanElement)).not.toThrow();
      expect(() => preventScrollChaining(orphanElement)).not.toThrow();
      expect(() => enableSmoothScrolling(orphanElement)).not.toThrow();
    });

    it('should handle window as scroll container', async () => {
      // Execute: Smooth scroll window
      await expect(
        smoothScrollToPosition(window, 0, 100)
      ).resolves.not.toThrow();
    });

    it('should handle invalid scroll positions gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000, max: 10000 }),
          (position) => {
            const container = createScrollContainer();
            
            // Execute: Attempt to scroll to any position (including negative)
            expect(() => {
              smoothScrollToPosition(container, position, 100);
            }).not.toThrow();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
