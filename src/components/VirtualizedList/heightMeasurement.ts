/**
 * Height Measurement and Caching Utilities
 * 
 * Provides utilities for measuring and caching item heights in virtualized lists.
 * This is essential for supporting variable-content items with dynamic heights.
 */

/**
 * Measure the height of a DOM element
 * @param element - The element to measure
 * @returns Height in pixels, or 0 if element is null
 */
export function measureElementHeight(element: HTMLElement | null): number {
  if (!element) return 0;
  return element.getBoundingClientRect().height;
}

/**
 * Height cache for storing measured item heights
 * Improves performance by avoiding repeated measurements
 */
export class HeightCache {
  private cache: Map<number, number>;
  private defaultHeight: number;

  constructor(defaultHeight: number = 50) {
    this.cache = new Map();
    this.defaultHeight = defaultHeight;
  }

  /**
   * Get cached height for an item
   * @param index - Item index
   * @returns Cached height or default height if not cached
   */
  get(index: number): number {
    return this.cache.get(index) ?? this.defaultHeight;
  }

  /**
   * Set height for an item
   * @param index - Item index
   * @param height - Measured height in pixels
   */
  set(index: number, height: number): void {
    this.cache.set(index, height);
  }

  /**
   * Check if height is cached for an item
   * @param index - Item index
   * @returns True if height is cached
   */
  has(index: number): boolean {
    return this.cache.has(index);
  }

  /**
   * Clear all cached heights
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached items
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Calculate total height of all cached items
   * @returns Sum of all cached heights
   */
  getTotalHeight(): number {
    let total = 0;
    for (const height of this.cache.values()) {
      total += height;
    }
    return total;
  }
}

/**
 * Calculate estimated total height for a list
 * @param itemCount - Total number of items
 * @param heightCache - Cache of measured heights
 * @param defaultHeight - Default height for unmeasured items
 * @returns Estimated total height in pixels
 */
export function calculateTotalHeight(
  itemCount: number,
  heightCache: HeightCache,
  defaultHeight: number
): number {
  let total = 0;
  for (let i = 0; i < itemCount; i++) {
    total += heightCache.has(i) ? heightCache.get(i) : defaultHeight;
  }
  return total;
}

/**
 * Dynamic height calculator function type
 * Used to calculate item heights based on content
 */
export type HeightCalculator<T> = (item: T, index: number) => number;

/**
 * Create a height calculator that uses content length as a heuristic
 * Useful for text-based items where height correlates with content length
 * 
 * @param baseHeight - Minimum height per item
 * @param heightPerChar - Additional height per character
 * @param maxHeight - Maximum height cap
 * @returns Height calculator function
 */
export function createContentBasedHeightCalculator<T>(
  baseHeight: number = 50,
  heightPerChar: number = 0.5,
  maxHeight: number = 500
): HeightCalculator<T> {
  return (item: T): number => {
    // Convert item to string to estimate content length
    const content = JSON.stringify(item);
    const estimatedHeight = baseHeight + content.length * heightPerChar;
    return Math.min(estimatedHeight, maxHeight);
  };
}
