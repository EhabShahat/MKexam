'use client';

import React, { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Props for the VirtualizedList component
 * @template T - The type of items in the list
 */
export interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  
  /** 
   * Height of each item in pixels, or a function to calculate dynamic heights
   * For fixed heights: provide a number
   * For dynamic heights: provide a function that returns the height for each item
   */
  itemHeight: number | ((item: T, index: number) => number);
  
  /** 
   * Render function for each item
   * @param item - The item to render
   * @param index - The index of the item in the array
   * @returns React node to render
   */
  renderItem: (item: T, index: number) => React.ReactNode;
  
  /** 
   * Number of buffer items to render above and below the viewport
   * @default 5
   */
  overscan?: number;
  
  /** 
   * Callback fired when the list is scrolled
   * @param scrollTop - The current scroll position in pixels
   */
  onScroll?: (scrollTop: number) => void;
  
  /** 
   * CSS class name for the container element
   */
  className?: string;
  
  /** 
   * Estimated item height for dynamic heights (used for initial render)
   * Required when itemHeight is a function
   */
  estimatedItemHeight?: number;
  
  /** 
   * Enable scroll position restoration using sessionStorage
   * When enabled, the scroll position will be saved and restored when returning to the list
   * @default false
   */
  scrollRestoration?: boolean;
  
  /**
   * Unique key for scroll restoration storage
   * Required when scrollRestoration is true
   */
  scrollRestorationKey?: string;
}

/**
 * VirtualizedList Component
 * 
 * A high-performance list component that only renders visible items plus a buffer zone.
 * Supports both fixed and dynamic item heights, scroll position restoration, and maintains
 * 60 FPS performance through efficient rendering.
 * 
 * @example
 * ```tsx
 * // Fixed height example
 * <VirtualizedList
 *   items={students}
 *   itemHeight={60}
 *   renderItem={(student) => <StudentRow student={student} />}
 *   overscan={5}
 * />
 * 
 * // Dynamic height example
 * <VirtualizedList
 *   items={questions}
 *   itemHeight={(question) => question.type === 'paragraph' ? 200 : 100}
 *   estimatedItemHeight={150}
 *   renderItem={(question) => <QuestionCard question={question} />}
 *   scrollRestoration
 *   scrollRestorationKey="exam-questions"
 * />
 * ```
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  onScroll,
  className = '',
  estimatedItemHeight,
  scrollRestoration = false,
  scrollRestorationKey,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRestorationApplied = useRef(false);

  // Validate props
  if (typeof itemHeight === 'function' && !estimatedItemHeight) {
    console.warn(
      'VirtualizedList: estimatedItemHeight is recommended when using dynamic itemHeight function'
    );
  }

  if (scrollRestoration && !scrollRestorationKey) {
    console.warn(
      'VirtualizedList: scrollRestorationKey is required when scrollRestoration is enabled'
    );
  }

  // Create virtualizer instance
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (typeof itemHeight === 'number') {
        return itemHeight;
      }
      return estimatedItemHeight || 50; // Default fallback
    },
    overscan,
    // For dynamic heights, we need to measure each item
    measureElement:
      typeof itemHeight === 'function'
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  // Handle scroll events
  useEffect(() => {
    const element = parentRef.current;
    if (!element || !onScroll) return;

    const handleScroll = () => {
      onScroll(element.scrollTop);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [onScroll]);

  // Scroll position restoration
  useEffect(() => {
    if (!scrollRestoration || !scrollRestorationKey || scrollRestorationApplied.current) {
      return;
    }

    const element = parentRef.current;
    if (!element) return;

    // Restore scroll position from sessionStorage
    const savedPosition = sessionStorage.getItem(
      `virtualized-list-scroll-${scrollRestorationKey}`
    );

    if (savedPosition) {
      const position = parseInt(savedPosition, 10);
      if (!isNaN(position)) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          element.scrollTop = position;
          scrollRestorationApplied.current = true;
        });
      }
    }
  }, [scrollRestoration, scrollRestorationKey]);

  // Save scroll position on unmount
  useEffect(() => {
    if (!scrollRestoration || !scrollRestorationKey) return;

    return () => {
      const element = parentRef.current;
      if (element) {
        sessionStorage.setItem(
          `virtualized-list-scroll-${scrollRestorationKey}`,
          element.scrollTop.toString()
        );
      }
    };
  }, [scrollRestoration, scrollRestorationKey]);

  // Get virtual items to render
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`virtualized-list-container ${className}`}
      style={{
        height: '100%',
        overflow: 'auto',
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook to get virtualization statistics for debugging and monitoring
 * @param items - Array of items being virtualized
 * @param virtualizer - The virtualizer instance
 * @returns Statistics about the virtualization state
 */
export function useVirtualizationStats<T>(items: T[], parentRef: React.RefObject<HTMLDivElement>) {
  const [stats, setStats] = React.useState({
    totalItems: 0,
    renderedItems: 0,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
  });

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    const updateStats = () => {
      const renderedItems = element.querySelectorAll('[data-index]').length;
      
      setStats({
        totalItems: items.length,
        renderedItems,
        scrollTop: element.scrollTop,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      });
    };

    // Update stats on scroll
    element.addEventListener('scroll', updateStats, { passive: true });
    
    // Initial update
    updateStats();

    return () => element.removeEventListener('scroll', updateStats);
  }, [items, parentRef]);

  return stats;
}
