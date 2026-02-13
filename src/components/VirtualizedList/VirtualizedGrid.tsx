/**
 * VirtualizedGrid Component
 * 
 * A virtualized grid layout that renders only visible items for optimal performance.
 * Useful for card-based layouts with many items (500+ students, products, etc.)
 */

'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect } from 'react';

interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Number of columns in the grid */
  columns: number;
  /** Height of each row in pixels */
  rowHeight: number;
  /** Gap between items in pixels */
  gap?: number;
  /** Number of rows to render outside viewport (buffer) */
  overscan?: number;
  /** Enable scroll position restoration */
  scrollRestoration?: boolean;
  /** Storage key for scroll restoration */
  storageKey?: string;
  /** Additional CSS classes */
  className?: string;
}

export function VirtualizedGrid<T>({
  items,
  renderItem,
  columns,
  rowHeight,
  gap = 16,
  overscan = 2,
  scrollRestoration = false,
  storageKey,
  className = '',
}: VirtualizedGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollRestorationApplied = useRef(false);

  // Calculate number of rows needed
  const rowCount = Math.ceil(items.length / columns);

  // Initialize virtualizer for rows
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + gap,
    overscan,
  });

  // Handle scroll events for restoration
  useEffect(() => {
    const parent = parentRef.current;
    if (!parent || !scrollRestoration || !storageKey) return;

    const handleScroll = () => {
      sessionStorage.setItem(storageKey, parent.scrollTop.toString());
    };

    parent.addEventListener('scroll', handleScroll, { passive: true });
    return () => parent.removeEventListener('scroll', handleScroll);
  }, [scrollRestoration, storageKey]);

  // Restore scroll position on mount
  useEffect(() => {
    if (!scrollRestoration || !storageKey || scrollRestorationApplied.current) return;

    const savedPosition = sessionStorage.getItem(storageKey);
    if (savedPosition && parentRef.current) {
      const position = parseInt(savedPosition, 10);
      if (!isNaN(position)) {
        requestAnimationFrame(() => {
          if (parentRef.current) {
            parentRef.current.scrollTop = position;
            scrollRestorationApplied.current = true;
          }
        });
      }
    }
  }, [scrollRestoration, storageKey]);

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: '100%', width: '100%' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {rowItems.map((item, colIndex) => (
                  <div key={startIndex + colIndex}>
                    {renderItem(item, startIndex + colIndex)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
