'use client';

/**
 * VirtualizedList Component
 * 
 * A high-performance list component that renders only visible items plus a buffer zone.
 * Supports both fixed and dynamic item heights, scroll position restoration, and smooth scrolling.
 * 
 * Features:
 * - Renders only visible items + overscan buffer
 * - Supports dynamic item heights with measurement caching
 * - Scroll position restoration via sessionStorage
 * - Maintains 60 FPS performance during scrolling
 * 
 * @example
 * ```tsx
 * <VirtualizedList
 *   items={students}
 *   itemHeight={60}
 *   renderItem={(student) => <StudentRow student={student} />}
 *   overscan={5}
 *   scrollRestoration
 *   storageKey="student-list-scroll"
 * />
 * ```
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect } from 'react';
import type { VirtualizedListProps } from './types';

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  onScroll,
  className = '',
  estimatedItemHeight = 50,
  scrollRestoration = false,
  storageKey,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRestorationApplied = useRef(false);

  // Initialize virtualizer with @tanstack/react-virtual
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: typeof itemHeight === 'number' 
      ? () => itemHeight 
      : (index) => {
          // For dynamic heights, use estimatedItemHeight as fallback
          return estimatedItemHeight;
        },
    overscan,
    // Enable dynamic measurement for variable heights
    measureElement:
      typeof itemHeight === 'function'
        ? (element) => element?.getBoundingClientRect().height ?? estimatedItemHeight
        : undefined,
  });

  // Handle scroll events
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const handleScroll = () => {
      const scrollTop = parent.scrollTop;
      
      // Save scroll position if restoration is enabled
      if (scrollRestoration && storageKey) {
        sessionStorage.setItem(storageKey, scrollTop.toString());
      }
      
      // Fire callback
      onScroll?.(scrollTop);
    };

    parent.addEventListener('scroll', handleScroll, { passive: true });
    return () => parent.removeEventListener('scroll', handleScroll);
  }, [scrollRestoration, storageKey, onScroll]);

  // Restore scroll position on mount
  useEffect(() => {
    if (!scrollRestoration || !storageKey || scrollRestorationApplied.current) return;
    
    const savedPosition = sessionStorage.getItem(storageKey);
    if (savedPosition && parentRef.current) {
      const position = parseInt(savedPosition, 10);
      if (!isNaN(position)) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          if (parentRef.current) {
            parentRef.current.scrollTop = position;
            scrollRestorationApplied.current = true;
          }
        });
      }
    }
  }, [scrollRestoration, storageKey]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{
        height: '100%',
        width: '100%',
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

export type { VirtualizedListProps } from './types';
