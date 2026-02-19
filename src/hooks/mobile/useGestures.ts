import { useEffect, useRef, RefObject } from 'react';

/**
 * Configuration for gesture recognition
 */
export interface GestureConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  threshold?: number;          // Minimum distance for swipe (default: 50px)
  timeThreshold?: number;      // Maximum time for swipe (default: 300ms)
  longPressDelay?: number;     // Delay for long press (default: 500ms)
  enabled?: boolean;           // Enable/disable gestures (default: true)
  preventScroll?: boolean;     // Prevent scroll during gestures (default: false)
}

/**
 * Internal state for tracking touch gestures
 */
interface TouchState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  isActive: boolean;
  longPressTimer: NodeJS.Timeout | null;
}

/**
 * Direction of detected swipe gesture
 */
type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

/**
 * Custom hook for detecting touch gestures (swipe, long-press)
 * 
 * Features:
 * - Swipe detection in all four directions
 * - Long-press detection
 * - Scroll vs swipe disambiguation
 * - Passive event listeners for performance
 * - Configurable thresholds
 * 
 * @param elementRef - Reference to the element to attach gesture listeners
 * @param config - Configuration for gesture callbacks and thresholds
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 13.1
 */
export function useGestures(
  elementRef: RefObject<HTMLElement>,
  config: GestureConfig
): void {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    threshold = 50,
    timeThreshold = 300,
    longPressDelay = 500,
    enabled = true,
    preventScroll = false,
  } = config;

  // Store touch state in ref to avoid recreating handlers
  const touchState = useRef<TouchState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    isActive: false,
    longPressTimer: null,
  });

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    /**
     * Calculate swipe direction and velocity
     */
    const calculateSwipe = (): { direction: SwipeDirection; velocity: number } => {
      const state = touchState.current;
      const deltaX = state.currentX - state.startX;
      const deltaY = state.currentY - state.startY;
      const deltaTime = Date.now() - state.startTime;
      
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      
      // Calculate velocity (pixels per millisecond)
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = distance / deltaTime;

      // Determine if movement is primarily horizontal or vertical
      let direction: SwipeDirection = null;
      
      if (absX > absY && absX > threshold) {
        // Horizontal swipe
        direction = deltaX > 0 ? 'right' : 'left';
      } else if (absY > absX && absY > threshold) {
        // Vertical swipe
        direction = deltaY > 0 ? 'down' : 'up';
      }

      return { direction, velocity };
    };

    /**
     * Check if touch started within a scrollable container or text input
     * to prevent swipe navigation during scroll or text editing
     */
    const isScrollableOrInput = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;

      // Check if target is a text input or textarea
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return true;
      }

      // Check if target or any parent is scrollable
      let element: HTMLElement | null = target;
      while (element && element !== document.body) {
        // Safely check if getComputedStyle is available (for test environments)
        if (typeof window.getComputedStyle === 'function') {
          const style = window.getComputedStyle(element);
          const overflowY = style.overflowY;
          const overflowX = style.overflowX;
          
          if (
            overflowY === 'auto' ||
            overflowY === 'scroll' ||
            overflowX === 'auto' ||
            overflowX === 'scroll'
          ) {
            // Check if element actually has scrollable content
            if (
              element.scrollHeight > element.clientHeight ||
              element.scrollWidth > element.clientWidth
            ) {
              return true;
            }
          }
        }
        
        element = element.parentElement;
      }

      return false;
    };

    /**
     * Handle touch start event
     */
    const handleTouchStart = (e: TouchEvent) => {
      // Check if touch started in scrollable area or input
      if (isScrollableOrInput(e.target)) {
        touchState.current.isActive = false;
        return;
      }

      const touch = e.touches[0];
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        startTime: Date.now(),
        isActive: true,
        longPressTimer: null,
      };

      // Start long-press timer if callback is provided
      if (onLongPress) {
        touchState.current.longPressTimer = setTimeout(() => {
          if (touchState.current.isActive) {
            onLongPress();
            touchState.current.isActive = false; // Prevent swipe after long-press
          }
        }, longPressDelay);
      }
    };

    /**
     * Handle touch move event
     */
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchState.current.isActive) return;

      const touch = e.touches[0];
      touchState.current.currentX = touch.clientX;
      touchState.current.currentY = touch.clientY;

      // Cancel long-press if finger moves significantly
      const deltaX = Math.abs(touch.clientX - touchState.current.startX);
      const deltaY = Math.abs(touch.clientY - touchState.current.startY);
      
      if ((deltaX > 10 || deltaY > 10) && touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
        touchState.current.longPressTimer = null;
      }

      // Prevent scroll if configured
      if (preventScroll) {
        e.preventDefault();
      }
    };

    /**
     * Handle touch end event
     */
    const handleTouchEnd = () => {
      if (!touchState.current.isActive) return;

      // Clear long-press timer
      if (touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
        touchState.current.longPressTimer = null;
      }

      const deltaTime = Date.now() - touchState.current.startTime;
      
      // Only process swipe if within time threshold
      if (deltaTime <= timeThreshold) {
        const { direction } = calculateSwipe();

        // Trigger appropriate callback based on direction
        if (direction === 'left' && onSwipeLeft) {
          onSwipeLeft();
        } else if (direction === 'right' && onSwipeRight) {
          onSwipeRight();
        } else if (direction === 'up' && onSwipeUp) {
          onSwipeUp();
        } else if (direction === 'down' && onSwipeDown) {
          onSwipeDown();
        }
      }

      // Reset state
      touchState.current.isActive = false;
    };

    /**
     * Handle touch cancel event
     */
    const handleTouchCancel = () => {
      if (touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
        touchState.current.longPressTimer = null;
      }
      touchState.current.isActive = false;
    };

    // Add event listeners with passive option for performance (Requirement 13.1)
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventScroll });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    // Cleanup
    return () => {
      if (touchState.current.longPressTimer) {
        clearTimeout(touchState.current.longPressTimer);
      }
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    elementRef,
    enabled,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onLongPress,
    threshold,
    timeThreshold,
    longPressDelay,
    preventScroll,
  ]);
}
