import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Virtual keyboard state information
 */
export interface VirtualKeyboardState {
  isVisible: boolean;
  height: number;
  overlayHeight: number;
}

/**
 * Configuration options for virtual keyboard handling
 */
export interface VirtualKeyboardConfig {
  onShow?: (height: number) => void;
  onHide?: () => void;
  adjustLayout?: boolean;
  maintainScroll?: boolean;
}

/**
 * Hook for managing virtual keyboard appearance and layout adjustments
 * 
 * Uses Visual Viewport API to detect keyboard visibility and height.
 * Falls back to window resize detection for browsers without Visual Viewport API.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * 
 * @param config - Configuration options
 * @returns Virtual keyboard state
 */
export function useVirtualKeyboard(
  config: VirtualKeyboardConfig = {}
): VirtualKeyboardState {
  const {
    onShow,
    onHide,
    adjustLayout = true,
    maintainScroll = true,
  } = config;

  const [state, setState] = useState<VirtualKeyboardState>({
    isVisible: false,
    height: 0,
    overlayHeight: 0,
  });

  const previousHeightRef = useRef<number>(0);
  const restoreTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  /**
   * Calculate keyboard height from viewport changes
   */
  const calculateKeyboardHeight = useCallback((): number => {
    if (typeof window === 'undefined') return 0;

    // Try Visual Viewport API first (modern browsers)
    if ('visualViewport' in window && window.visualViewport) {
      const visualViewport = window.visualViewport;
      const windowHeight = window.innerHeight;
      const visualHeight = visualViewport.height;
      const keyboardHeight = windowHeight - visualHeight;
      
      return keyboardHeight > 0 ? keyboardHeight : 0;
    }

    // Fallback: Use window.innerHeight changes
    // This is less reliable but works on older browsers
    const currentHeight = window.innerHeight;
    const heightDiff = previousHeightRef.current - currentHeight;
    
    // Only consider it keyboard if height decreased significantly (>150px)
    return heightDiff > 150 ? heightDiff : 0;
  }, []);

  /**
   * Scroll active input into view with padding
   */
  const scrollInputIntoView = useCallback(() => {
    if (!maintainScroll) return;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA')
    ) {
      // Wait for keyboard animation to complete
      setTimeout(() => {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [maintainScroll]);

  /**
   * Adjust layout for keyboard visibility
   */
  const adjustLayoutForKeyboard = useCallback(
    (keyboardHeight: number) => {
      if (!adjustLayout) return;

      // Add padding to body to prevent content from being hidden
      document.body.style.paddingBottom = `${keyboardHeight}px`;
      
      // Adjust fixed elements if needed
      const fixedElements = document.querySelectorAll(
        '[data-keyboard-adjust="true"]'
      );
      fixedElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.style.bottom = `${keyboardHeight}px`;
        }
      });
    },
    [adjustLayout]
  );

  /**
   * Restore original layout
   */
  const restoreLayout = useCallback(() => {
    if (!adjustLayout) return;

    // Clear any pending restore timeout
    if (restoreTimeoutRef.current) {
      clearTimeout(restoreTimeoutRef.current);
    }

    // Restore layout after a short delay (300ms as per requirement 3.5)
    restoreTimeoutRef.current = setTimeout(() => {
      document.body.style.paddingBottom = '';
      
      const fixedElements = document.querySelectorAll(
        '[data-keyboard-adjust="true"]'
      );
      fixedElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.style.bottom = '';
        }
      });
    }, 300);
  }, [adjustLayout]);

  /**
   * Handle viewport resize (keyboard show/hide)
   */
  const handleViewportResize = useCallback(() => {
    const keyboardHeight = calculateKeyboardHeight();
    const windowHeight = window.innerHeight;
    const overlayHeight = keyboardHeight;

    const isKeyboardVisible = keyboardHeight > 0;

    setState((prev) => {
      // Only update if state actually changed
      if (prev.isVisible === isKeyboardVisible && prev.height === keyboardHeight) {
        return prev;
      }

      return {
        isVisible: isKeyboardVisible,
        height: keyboardHeight,
        overlayHeight,
      };
    });

    if (isKeyboardVisible) {
      adjustLayoutForKeyboard(keyboardHeight);
      scrollInputIntoView();
      onShow?.(keyboardHeight);
    } else {
      restoreLayout();
      onHide?.();
    }

    // Update previous height for fallback detection
    previousHeightRef.current = windowHeight;
  }, [
    calculateKeyboardHeight,
    adjustLayoutForKeyboard,
    scrollInputIntoView,
    restoreLayout,
    onShow,
    onHide,
  ]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store initial height
    previousHeightRef.current = window.innerHeight;

    // Use Visual Viewport API if available
    if ('visualViewport' in window && window.visualViewport) {
      const visualViewport = window.visualViewport;
      
      // Create wrapper to ensure proper event handling
      const resizeHandler = () => handleViewportResize();
      const scrollHandler = () => handleViewportResize();
      
      visualViewport.addEventListener('resize', resizeHandler);
      visualViewport.addEventListener('scroll', scrollHandler);

      return () => {
        visualViewport.removeEventListener('resize', resizeHandler);
        visualViewport.removeEventListener('scroll', scrollHandler);
        
        // Clear any pending timeouts
        if (restoreTimeoutRef.current) {
          clearTimeout(restoreTimeoutRef.current);
        }
      };
    }

    // Fallback: Use window resize
    const resizeHandler = () => handleViewportResize();
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      
      // Clear any pending timeouts
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
      }
    };
  }, [handleViewportResize]);

  /**
   * Handle focus events to detect keyboard
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        // Trigger viewport check after a short delay
        // to allow keyboard animation to start
        setTimeout(() => handleViewportResize(), 100);
      }
    };

    const handleFocusOut = () => {
      // Trigger viewport check after a short delay
      // to allow keyboard animation to complete
      setTimeout(() => handleViewportResize(), 100);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [handleViewportResize]);

  return state;
}
