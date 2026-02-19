/**
 * Property-based tests for virtual keyboard handling
 * Feature: mobile-touch-optimization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { useVirtualKeyboard } from '@/hooks/mobile/useVirtualKeyboard';
import {
  mockWindowDimensions,
  resetMobileMocks,
} from '../setup';

// Helper to create a proper visualViewport mock before hook renders
function setupVisualViewportMock(initialHeight: number) {
  const listeners: Map<string, Set<Function>> = new Map();
  let currentHeight = initialHeight;
  
  const mockViewport = {
    get height() {
      return currentHeight;
    },
    offsetTop: 0,
    addEventListener(type: string, listener: Function) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type)?.add(listener);
    },
    removeEventListener(type: string, listener: Function) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: Event) {
      const typeListeners = listeners.get(event.type);
      if (typeListeners) {
        typeListeners.forEach(listener => listener(event));
      }
      return true;
    },
    triggerResize(newHeight: number) {
      currentHeight = newHeight;
      this.dispatchEvent(new Event('resize'));
    },
  };
  
  Object.defineProperty(window, 'visualViewport', {
    writable: true,
    configurable: true,
    value: mockViewport,
  });
  
  return mockViewport;
}

describe('Virtual Keyboard Properties', () => {
  beforeEach(() => {
    resetMobileMocks();
  });

  afterEach(() => {
    resetMobileMocks();
    vi.clearAllMocks();
  });

  // Feature: mobile-touch-optimization, Property 8: Virtual Keyboard Input Visibility
  // Validates: Requirements 3.1, 3.3
  describe('Property 8: Virtual Keyboard Input Visibility', () => {
    it('should detect keyboard visibility for any significant viewport height reduction', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 600, max: 900 }),
          fc.integer({ min: 200, max: 400 }),
          async (initialHeight, keyboardHeight) => {
            // Setup: Mock viewport and visualViewport BEFORE rendering hook
            mockWindowDimensions(375, initialHeight);
            const mockViewport = setupVisualViewportMock(initialHeight);

            // Execute: Render hook
            const { result } = renderHook(() => useVirtualKeyboard());

            // Initial state should be keyboard hidden
            expect(result.current.isVisible).toBe(false);

            // Simulate keyboard appearance
            const visualHeight = initialHeight - keyboardHeight;
            await act(async () => {
              mockViewport.triggerResize(visualHeight);
              // Give time for state update
              await new Promise(resolve => setTimeout(resolve, 50));
            });

            // Verify: Keyboard should be detected
            expect(result.current.isVisible).toBe(true);
            expect(result.current.height).toBeGreaterThan(0);

            return result.current.isVisible === true;
          }
        ),
        { numRuns: 20 } // Reduced for faster execution
      );
    });

    it('should calculate correct overlay height when keyboard appears', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 600, max: 900 }),
          fc.integer({ min: 200, max: 400 }),
          async (viewportHeight, keyboardHeight) => {
            // Setup
            mockWindowDimensions(375, viewportHeight);
            const mockViewport = setupVisualViewportMock(viewportHeight);

            // Execute
            const { result } = renderHook(() => useVirtualKeyboard());

            // Simulate keyboard
            const visualHeight = viewportHeight - keyboardHeight;
            await act(async () => {
              mockViewport.triggerResize(visualHeight);
              await new Promise(resolve => setTimeout(resolve, 50));
            });

            // Verify: overlayHeight should be positive
            expect(result.current.overlayHeight).toBeGreaterThan(0);

            return result.current.overlayHeight > 0;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should scroll input into view when maintainScroll is enabled', async () => {
      const viewportHeight = 667;
      mockWindowDimensions(375, viewportHeight);
      const mockViewport = setupVisualViewportMock(viewportHeight);

      // Create mock input
      const mockInput = document.createElement('input');
      const scrollIntoViewMock = vi.fn();
      mockInput.scrollIntoView = scrollIntoViewMock;
      document.body.appendChild(mockInput);

      // Render hook
      const { result } = renderHook(() =>
        useVirtualKeyboard({ maintainScroll: true })
      );

      // Focus input and trigger keyboard
      await act(async () => {
        mockInput.focus();
        mockViewport.triggerResize(viewportHeight - 300);
        await new Promise(resolve => setTimeout(resolve, 150)); // Wait for scroll delay
      });

      // Verify scrollIntoView was called
      expect(scrollIntoViewMock).toHaveBeenCalled();

      document.body.removeChild(mockInput);
    });
  });

  // Feature: mobile-touch-optimization, Property 9: Virtual Keyboard Button Accessibility
  // Validates: Requirements 3.2
  describe('Property 9: Virtual Keyboard Button Accessibility', () => {
    it('should add body padding when keyboard appears with adjustLayout enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 600, max: 900 }),
          fc.integer({ min: 200, max: 400 }),
          async (viewportHeight, keyboardHeight) => {
            // Setup
            mockWindowDimensions(375, viewportHeight);
            const mockViewport = setupVisualViewportMock(viewportHeight);

            // Initial body padding should be empty
            document.body.style.paddingBottom = '';

            // Execute
            const { result } = renderHook(() =>
              useVirtualKeyboard({ adjustLayout: true })
            );

            // Simulate keyboard
            await act(async () => {
              mockViewport.triggerResize(viewportHeight - keyboardHeight);
              await new Promise(resolve => setTimeout(resolve, 50));
            });

            // Verify: Body should have padding
            const bodyPadding = document.body.style.paddingBottom;
            expect(bodyPadding).not.toBe('');
            expect(parseInt(bodyPadding) || 0).toBeGreaterThan(0);

            return parseInt(bodyPadding) > 0;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should adjust fixed elements with data-keyboard-adjust attribute', async () => {
      const viewportHeight = 667;
      mockWindowDimensions(375, viewportHeight);
      const mockViewport = setupVisualViewportMock(viewportHeight);

      // Create mock button
      const mockButton = document.createElement('button');
      mockButton.setAttribute('data-keyboard-adjust', 'true');
      mockButton.style.position = 'fixed';
      mockButton.style.bottom = '0px';
      document.body.appendChild(mockButton);

      // Render hook
      const { result } = renderHook(() =>
        useVirtualKeyboard({ adjustLayout: true })
      );

      // Simulate keyboard
      await act(async () => {
        mockViewport.triggerResize(viewportHeight - 300);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Verify: Button should be repositioned
      const buttonBottom = mockButton.style.bottom;
      expect(buttonBottom).not.toBe('0px');
      expect(parseInt(buttonBottom)).toBeGreaterThan(0);

      document.body.removeChild(mockButton);
    });
  });

  // Feature: mobile-touch-optimization, Property 10: Virtual Keyboard Layout Restoration
  // Validates: Requirements 3.5
  describe('Property 10: Virtual Keyboard Layout Restoration', () => {
    it('should restore layout within 300ms when keyboard is dismissed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 150, max: 400 }),
          async (keyboardHeight) => {
            const viewportHeight = 667;
            mockWindowDimensions(375, viewportHeight);
            const mockViewport = setupVisualViewportMock(viewportHeight);

            // Clear body padding
            document.body.style.paddingBottom = '';

            // Render hook
            const { result } = renderHook(() =>
              useVirtualKeyboard({ adjustLayout: true })
            );

            // Show keyboard
            await act(async () => {
              mockViewport.triggerResize(viewportHeight - keyboardHeight);
              await new Promise(resolve => setTimeout(resolve, 50));
            });

            // Verify keyboard is visible
            expect(result.current.isVisible).toBe(true);
            const paddingAfterShow = document.body.style.paddingBottom;
            expect(paddingAfterShow).not.toBe('');

            // Hide keyboard
            await act(async () => {
              mockViewport.triggerResize(viewportHeight);
              await new Promise(resolve => setTimeout(resolve, 50));
            });

            // Verify keyboard is hidden
            expect(result.current.isVisible).toBe(false);

            // Wait for layout restoration (300ms as per requirement + small buffer)
            await new Promise(resolve => setTimeout(resolve, 350));

            // Verify layout restored
            const paddingAfterHide = document.body.style.paddingBottom;
            expect(paddingAfterHide).toBe('');

            return paddingAfterHide === '';
          }
        ),
        { numRuns: 10, timeout: 10000 } // Increased timeout for this test
      );
    });
  });

  describe('Callback Invocation', () => {
    it('should invoke onShow callback when keyboard appears', async () => {
      const viewportHeight = 667;
      mockWindowDimensions(375, viewportHeight);
      const mockViewport = setupVisualViewportMock(viewportHeight);

      const onShowMock = vi.fn();

      const { result } = renderHook(() =>
        useVirtualKeyboard({ onShow: onShowMock })
      );

      // Show keyboard
      await act(async () => {
        mockViewport.triggerResize(viewportHeight - 300);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Wait for state to update
      expect(result.current.isVisible).toBe(true);

      // Verify callback was called
      expect(onShowMock).toHaveBeenCalled();
      expect(onShowMock).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should invoke onHide callback when keyboard is dismissed', async () => {
      const viewportHeight = 667;
      mockWindowDimensions(375, viewportHeight);
      const mockViewport = setupVisualViewportMock(viewportHeight);

      const onHideMock = vi.fn();

      const { result } = renderHook(() =>
        useVirtualKeyboard({ onHide: onHideMock })
      );

      // Show keyboard first
      await act(async () => {
        mockViewport.triggerResize(viewportHeight - 300);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(result.current.isVisible).toBe(true);

      // Hide keyboard
      await act(async () => {
        mockViewport.triggerResize(viewportHeight);
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Wait for state to update
      expect(result.current.isVisible).toBe(false);

      // Verify callback was called
      expect(onHideMock).toHaveBeenCalled();
    });
  });
});
