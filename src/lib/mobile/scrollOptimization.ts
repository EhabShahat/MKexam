/**
 * Mobile Scroll Optimization Utilities
 * 
 * Provides utilities for optimizing scroll behavior on mobile devices
 * including momentum scrolling, scroll chaining prevention, and smooth scrolling.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */

/**
 * Apply momentum scrolling to an element
 * Enables native momentum scrolling on iOS devices
 * 
 * @param element - The element to apply momentum scrolling to
 */
export function applyMomentumScrolling(element: HTMLElement): void {
  if (!element) return;
  
  // Apply webkit momentum scrolling for iOS
  // Using type assertion for vendor-specific property
  (element.style as any).webkitOverflowScrolling = 'touch';
  
  // Ensure overflow is set
  if (!element.style.overflow && !element.style.overflowY) {
    element.style.overflowY = 'auto';
  }
}

/**
 * Prevent scroll chaining on an element
 * Stops scroll events from propagating to parent containers
 * 
 * @param element - The element to prevent scroll chaining on
 */
export function preventScrollChaining(element: HTMLElement): void {
  if (!element) return;
  
  element.style.overscrollBehavior = 'contain';
}

/**
 * Prevent pull-to-refresh on body element
 * Stops the browser's default pull-to-refresh behavior
 */
export function preventPullToRefresh(): void {
  if (typeof document === 'undefined') return;
  
  document.body.style.overscrollBehaviorY = 'contain';
}

/**
 * Enable smooth scrolling for an element
 * 
 * @param element - The element to enable smooth scrolling on
 */
export function enableSmoothScrolling(element: HTMLElement): void {
  if (!element) return;
  
  element.style.scrollBehavior = 'smooth';
}

/**
 * Scroll to an element with smooth animation
 * 
 * @param element - The element to scroll to
 * @param options - Scroll options
 */
export function smoothScrollTo(
  element: HTMLElement,
  options: {
    block?: ScrollLogicalPosition;
    inline?: ScrollLogicalPosition;
    behavior?: ScrollBehavior;
  } = {}
): void {
  if (!element) return;
  
  element.scrollIntoView({
    behavior: options.behavior || 'smooth',
    block: options.block || 'start',
    inline: options.inline || 'nearest',
  });
}

/**
 * Scroll to a specific position with smooth animation
 * 
 * @param container - The container to scroll
 * @param top - The top position to scroll to
 * @param duration - Animation duration in milliseconds (default: 400ms)
 */
export function smoothScrollToPosition(
  container: HTMLElement | Window,
  top: number,
  duration: number = 400
): Promise<void> {
  return new Promise((resolve) => {
    const startPosition = 
      container instanceof Window 
        ? window.pageYOffset 
        : container.scrollTop;
    
    const distance = top - startPosition;
    const startTime = performance.now();
    
    function easeInOutCubic(t: number): number {
      return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    function animation(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = easeInOutCubic(progress);
      const newPosition = startPosition + distance * easeProgress;
      
      if (container instanceof Window) {
        window.scrollTo(0, newPosition);
      } else {
        container.scrollTop = newPosition;
      }
      
      if (progress < 1) {
        requestAnimationFrame(animation);
      } else {
        resolve();
      }
    }
    
    requestAnimationFrame(animation);
  });
}

/**
 * Initialize scroll optimizations for mobile
 * Applies all necessary scroll optimizations to the document
 */
export function initializeScrollOptimizations(): void {
  if (typeof document === 'undefined') return;
  
  // Prevent pull-to-refresh on body
  preventPullToRefresh();
  
  // Apply momentum scrolling to all scroll containers
  const scrollContainers = document.querySelectorAll<HTMLElement>(
    '[data-scroll-container], .scroll-container'
  );
  
  scrollContainers.forEach((container) => {
    applyMomentumScrolling(container);
    preventScrollChaining(container);
  });
}

/**
 * Check if an element is scrollable
 * 
 * @param element - The element to check
 * @returns True if the element is scrollable
 */
export function isScrollable(element: HTMLElement): boolean {
  if (!element) return false;
  
  const hasScrollableContent = element.scrollHeight > element.clientHeight;
  const overflowY = window.getComputedStyle(element).overflowY;
  const isOverflowHidden = overflowY === 'hidden';
  
  return hasScrollableContent && !isOverflowHidden;
}

/**
 * Lock body scroll (useful for modals and overlays)
 */
export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  
  document.body.style.overflow = 'hidden';
  document.body.style.paddingRight = `${scrollbarWidth}px`;
}

/**
 * Unlock body scroll
 */
export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}
