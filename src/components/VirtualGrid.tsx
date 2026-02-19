import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  gridClassName?: string;
  emptyMessage?: string;
  threshold?: number; // Minimum items to enable virtualization
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
}

export function VirtualGrid<T>({
  items,
  renderItem,
  estimateSize = 400,
  overscan = 3,
  className = '',
  gridClassName = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4',
  emptyMessage = 'No items to display',
  threshold = 50,
  columns = { sm: 2, md: 3, lg: 3, xl: 4, '2xl': 5 },
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Only use virtualization if items exceed threshold
  const shouldVirtualize = items.length > threshold;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    enabled: shouldVirtualize,
  });

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  // If below threshold, render normally without virtualization
  if (!shouldVirtualize) {
    return (
      <div className={gridClassName}>
        {items.map((item, index) => (
          <div key={index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Use virtualization for large lists
  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: '800px' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div className={gridClassName}>
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(items[virtualItem.index], virtualItem.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
