/**
 * Scroll Position Restoration Utilities
 * 
 * Provides functions to save and restore scroll positions using sessionStorage.
 * This allows users to return to their previous scroll position when navigating
 * back to a virtualized list.
 */

/**
 * Save scroll position to sessionStorage
 * @param key - Unique storage key for this list
 * @param scrollTop - Current scroll position in pixels
 */
export function saveScrollPosition(key: string, scrollTop: number): void {
  try {
    sessionStorage.setItem(key, scrollTop.toString());
  } catch (error) {
    // Silently fail if sessionStorage is not available (e.g., private browsing)
    console.warn('Failed to save scroll position:', error);
  }
}

/**
 * Restore scroll position from sessionStorage
 * @param key - Unique storage key for this list
 * @returns Saved scroll position in pixels, or null if not found
 */
export function restoreScrollPosition(key: string): number | null {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const position = parseInt(saved, 10);
      return isNaN(position) ? null : position;
    }
  } catch (error) {
    // Silently fail if sessionStorage is not available
    console.warn('Failed to restore scroll position:', error);
  }
  return null;
}

/**
 * Clear saved scroll position from sessionStorage
 * @param key - Unique storage key for this list
 */
export function clearScrollPosition(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear scroll position:', error);
  }
}

/**
 * Apply scroll position to an element
 * Uses requestAnimationFrame to ensure DOM is ready
 * @param element - The scrollable element
 * @param position - The scroll position to apply
 */
export function applyScrollPosition(
  element: HTMLElement,
  position: number
): void {
  requestAnimationFrame(() => {
    element.scrollTop = position;
  });
}
