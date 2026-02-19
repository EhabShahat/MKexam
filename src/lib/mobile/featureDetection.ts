/**
 * Feature detection utilities for mobile capabilities
 */

/**
 * Detect if the browser supports haptic feedback (vibration API)
 */
export function supportsHaptics(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'vibrate' in navigator;
}

/**
 * Detect if the browser supports Visual Viewport API
 */
export function supportsVisualViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return 'visualViewport' in window;
}

/**
 * Detect if the browser supports passive event listeners
 */
export function supportsPassiveEvents(): boolean {
  if (typeof window === 'undefined') return false;
  
  let supportsPassive = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get() {
        supportsPassive = true;
        return true;
      },
    });
    // @ts-ignore - testing passive support
    window.addEventListener('test', null, opts);
    // @ts-ignore - testing passive support
    window.removeEventListener('test', null, opts);
  } catch (e) {
    supportsPassive = false;
  }
  
  return supportsPassive;
}

/**
 * Detect if the browser supports CSS safe area insets
 */
export function supportsSafeAreaInsets(): boolean {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false;
  
  try {
    // @ts-ignore - checking CSS.supports
    return CSS.supports('padding-top: env(safe-area-inset-top)');
  } catch (e) {
    return false;
  }
}

/**
 * Detect if the browser supports Network Information API
 */
export function supportsNetworkInformation(): boolean {
  if (typeof navigator === 'undefined') return false;
  // @ts-ignore - checking for connection property
  return 'connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator;
}

/**
 * Detect if the browser supports IntersectionObserver
 */
export function supportsIntersectionObserver(): boolean {
  if (typeof window === 'undefined') return false;
  return 'IntersectionObserver' in window;
}

/**
 * Detect if the browser supports ResizeObserver
 */
export function supportsResizeObserver(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ResizeObserver' in window;
}

/**
 * Detect if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches;
}

/**
 * Get all feature support information
 */
export interface FeatureSupport {
  haptics: boolean;
  visualViewport: boolean;
  passiveEvents: boolean;
  safeAreaInsets: boolean;
  networkInformation: boolean;
  intersectionObserver: boolean;
  resizeObserver: boolean;
  reducedMotion: boolean;
}

export function getFeatureSupport(): FeatureSupport {
  return {
    haptics: supportsHaptics(),
    visualViewport: supportsVisualViewport(),
    passiveEvents: supportsPassiveEvents(),
    safeAreaInsets: supportsSafeAreaInsets(),
    networkInformation: supportsNetworkInformation(),
    intersectionObserver: supportsIntersectionObserver(),
    resizeObserver: supportsResizeObserver(),
    reducedMotion: prefersReducedMotion(),
  };
}
