/**
 * Test setup and utilities for mobile optimization tests
 */

import { vi } from 'vitest';

/**
 * Mock window dimensions for testing
 */
export function mockWindowDimensions(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
}

/**
 * Mock touch capability
 */
export function mockTouchCapability(hasTouch: boolean) {
  if (hasTouch) {
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      configurable: true,
      value: {},
    });
  } else {
    // @ts-ignore - deleting property for test
    delete window.ontouchstart;
  }
  
  Object.defineProperty(navigator, 'maxTouchPoints', {
    writable: true,
    configurable: true,
    value: hasTouch ? 5 : 0,
  });
}

/**
 * Mock safe area insets
 */
export function mockSafeAreaInsets(top: number, right: number, bottom: number, left: number) {
  // Mock getComputedStyle to return safe area inset values
  const mockGetComputedStyle = vi.fn((element: Element) => {
    const style = {
      top: `${top}px`,
      right: `${right}px`,
      bottom: `${bottom}px`,
      left: `${left}px`,
      overflowY: 'visible',
      overflowX: 'visible',
      getPropertyValue: (prop: string) => {
        // Handle CSS environment variables for safe area insets
        if (prop === 'env(safe-area-inset-top)') return `${top}px`;
        if (prop === 'env(safe-area-inset-right)') return `${right}px`;
        if (prop === 'env(safe-area-inset-bottom)') return `${bottom}px`;
        if (prop === 'env(safe-area-inset-left)') return `${left}px`;
        // Handle regular properties
        if (prop === 'top') return `${top}px`;
        if (prop === 'right') return `${right}px`;
        if (prop === 'bottom') return `${bottom}px`;
        if (prop === 'left') return `${left}px`;
        if (prop === 'overflow-y') return 'visible';
        if (prop === 'overflow-x') return 'visible';
        return '';
      },
    } as unknown as CSSStyleDeclaration;
    
    return style;
  }) as any;
  
  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    configurable: true,
    value: mockGetComputedStyle,
  });
}

/**
 * Mock Visual Viewport API
 */
export function mockVisualViewport(height: number, offsetTop: number = 0) {
  const listeners: Map<string, Set<EventListener>> = new Map();
  
  Object.defineProperty(window, 'visualViewport', {
    writable: true,
    configurable: true,
    value: {
      height,
      offsetTop,
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (!listeners.has(type)) {
          listeners.set(type, new Set());
        }
        listeners.get(type)?.add(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        listeners.get(type)?.delete(listener);
      }),
      dispatchEvent: vi.fn((event: Event) => {
        const typeListeners = listeners.get(event.type);
        if (typeListeners) {
          typeListeners.forEach(listener => listener(event));
        }
        return true;
      }),
    },
  });
}

/**
 * Mock vibration API
 */
export function mockVibrationAPI(supported: boolean = true) {
  if (supported) {
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      configurable: true,
      value: vi.fn(() => true),
    });
  } else {
    // @ts-ignore - deleting property for test
    delete navigator.vibrate;
  }
}

/**
 * Trigger resize event
 */
export function triggerResize(width: number, height: number) {
  mockWindowDimensions(width, height);
  window.dispatchEvent(new Event('resize'));
}

/**
 * Trigger orientation change event
 */
export function triggerOrientationChange() {
  window.dispatchEvent(new Event('orientationchange'));
}

/**
 * Create mock touch event
 */
export function createTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number; identifier: number }>
) {
  const touchList = touches.map(touch => ({
    ...touch,
    target: document.body,
    pageX: touch.clientX,
    pageY: touch.clientY,
  }));
  
  return new TouchEvent(type, {
    touches: touchList as any,
    changedTouches: touchList as any,
    targetTouches: touchList as any,
    bubbles: true,
    cancelable: true,
  });
}

/**
 * Reset all mocks to default state
 */
export function resetMobileMocks() {
  mockWindowDimensions(1024, 768);
  mockTouchCapability(false);
  
  // Reset getComputedStyle to a working mock
  const mockGetComputedStyle = vi.fn((element: Element) => {
    return {
      overflowY: 'visible',
      overflowX: 'visible',
      getPropertyValue: (prop: string) => {
        if (prop === 'overflow-y') return 'visible';
        if (prop === 'overflow-x') return 'visible';
        return '';
      },
    } as unknown as CSSStyleDeclaration;
  }) as any;
  
  Object.defineProperty(window, 'getComputedStyle', {
    writable: true,
    configurable: true,
    value: mockGetComputedStyle,
  });
  
  // Reset visualViewport
  // @ts-ignore - resetting to original
  delete window.visualViewport;
  
  // Reset vibrate
  // @ts-ignore - resetting to original
  delete navigator.vibrate;
}
