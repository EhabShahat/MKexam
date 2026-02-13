/**
 * VirtualizedList Component Types
 * 
 * Provides type definitions for the virtualization system that renders
 * only visible items plus a buffer zone for optimal performance.
 */

export interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  
  /** 
   * Height of each item in pixels, or a function to calculate dynamic heights
   * For fixed heights: itemHeight={50}
   * For dynamic heights: itemHeight={(item, index) => calculateHeight(item)}
   */
  itemHeight: number | ((item: T, index: number) => number);
  
  /** 
   * Render function for each item
   * @param item - The item to render
   * @param index - The index of the item in the items array
   * @returns React node to render
   */
  renderItem: (item: T, index: number) => React.ReactNode;
  
  /** 
   * Number of items to render outside the visible viewport (buffer zone)
   * Default: 5
   */
  overscan?: number;
  
  /** 
   * Callback fired when the list is scrolled
   * @param scrollTop - Current scroll position in pixels
   */
  onScroll?: (scrollTop: number) => void;
  
  /** Additional CSS class names for the container */
  className?: string;
  
  /** 
   * Estimated item height for dynamic height calculations
   * Used as initial estimate before actual measurement
   * Default: 50
   */
  estimatedItemHeight?: number;
  
  /** 
   * Enable scroll position restoration using sessionStorage
   * When enabled, scroll position is saved and restored on remount
   * Default: false
   */
  scrollRestoration?: boolean;
  
  /**
   * Unique key for storing scroll position in sessionStorage
   * Required when scrollRestoration is true
   */
  storageKey?: string;
}

export interface VirtualizationState {
  /** Current scroll position in pixels */
  scrollTop: number;
  
  /** Index of the first visible item */
  visibleStartIndex: number;
  
  /** Index of the last visible item */
  visibleEndIndex: number;
  
  /** Total height of all items combined */
  totalHeight: number;
  
  /** Cache of measured item heights for dynamic sizing */
  itemHeights: Map<number, number>;
}
