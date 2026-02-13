/**
 * Browser compatibility utilities for feature detection and browser identification
 */

/**
 * Detects if localStorage is available and functional
 * @returns true if localStorage is available, false otherwise
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Detects if matchMedia API is available
 * @returns true if matchMedia is available, false otherwise
 */
export function isMatchMediaAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/**
 * Browser type enumeration
 */
export type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';

/**
 * Browser information interface
 */
export interface BrowserInfo {
  type: BrowserType;
  version: string;
  isSupported: boolean;
}

/**
 * Detects the current browser type and version
 * @returns Browser information object
 */
export function getBrowserInfo(): BrowserInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      type: 'unknown',
      version: '',
      isSupported: false,
    };
  }

  const userAgent = navigator.userAgent;
  let type: BrowserType = 'unknown';
  let version = '';

  // Chrome detection (must be before Safari as Chrome includes Safari in UA)
  if (/Chrome\/(\d+)/.test(userAgent) && !/Edg\//.test(userAgent)) {
    type = 'chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : '';
  }
  // Edge detection (Chromium-based Edge)
  else if (/Edg\/(\d+)/.test(userAgent)) {
    type = 'edge';
    const match = userAgent.match(/Edg\/(\d+)/);
    version = match ? match[1] : '';
  }
  // Firefox detection
  else if (/Firefox\/(\d+)/.test(userAgent)) {
    type = 'firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : '';
  }
  // Safari detection
  else if (/Safari\//.test(userAgent) && !/Chrome/.test(userAgent)) {
    type = 'safari';
    const match = userAgent.match(/Version\/(\d+)/);
    version = match ? match[1] : '';
  }

  // Determine if browser is supported (latest stable versions)
  const isSupported = 
    (type === 'chrome' && parseInt(version) >= 90) ||
    (type === 'firefox' && parseInt(version) >= 88) ||
    (type === 'safari' && parseInt(version) >= 14) ||
    (type === 'edge' && parseInt(version) >= 90);

  return {
    type,
    version,
    isSupported,
  };
}

/**
 * Detects if sessionStorage is available and functional
 * @returns true if sessionStorage is available, false otherwise
 */
export function isSessionStorageAvailable(): boolean {
  try {
    const testKey = '__sessionStorage_test__';
    sessionStorage.setItem(testKey, 'test');
    sessionStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Detects if CSS custom properties (CSS variables) are supported
 * @returns true if CSS custom properties are supported, false otherwise
 */
export function isCSSCustomPropertiesSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return !!(window.CSS && window.CSS.supports && window.CSS.supports('--test', '0'));
}

/**
 * Detects if the prefers-color-scheme media query is supported
 * @returns true if prefers-color-scheme is supported, false otherwise
 */
export function isPrefersColorSchemeSupported(): boolean {
  if (!isMatchMediaAvailable()) {
    return false;
  }
  
  return window.matchMedia('(prefers-color-scheme: dark)').media !== 'not all';
}
