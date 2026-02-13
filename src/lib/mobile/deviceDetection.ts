/**
 * Device detection utilities for mobile optimization
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
  orientation: 'portrait' | 'landscape';
  viewportWidth: number;
  viewportHeight: number;
}

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Detect if the device is mobile based on viewport width
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * Detect if the device is a tablet based on viewport width
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= 768 && width < 1024;
}

/**
 * Detect if the device is desktop based on viewport width
 */
export function isDesktopDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

/**
 * Detect if the device has touch capability
 */
export function hasTouchCapability(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - legacy property
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Get current device orientation
 */
export function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'portrait';
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

/**
 * Get safe area insets from CSS environment variables
 */
export function getSafeAreaInsets(): SafeAreaInsets {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseSafeAreaValue(style.getPropertyValue('env(safe-area-inset-top)')),
    right: parseSafeAreaValue(style.getPropertyValue('env(safe-area-inset-right)')),
    bottom: parseSafeAreaValue(style.getPropertyValue('env(safe-area-inset-bottom)')),
    left: parseSafeAreaValue(style.getPropertyValue('env(safe-area-inset-left)')),
  };
}

/**
 * Parse safe area CSS value to number (in pixels)
 */
function parseSafeAreaValue(value: string): number {
  if (!value || value === '') return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Get complete device information
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    isMobile: isMobileDevice(),
    isTablet: isTabletDevice(),
    isDesktop: isDesktopDevice(),
    hasTouch: hasTouchCapability(),
    orientation: getOrientation(),
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  };
}
