import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: number;
  overscan?: number;
  className?: string;
  emptyMessage?: string;
  threshold?: number; // Minimum items to enable virtualization
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = 100,
  overscan = 5,
  className = '',
  emptyMessage = 'No items to display',
  threshold = 50,
}: VirtualListProps<T>) {
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
      <div className={className}>
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
      style={{ height: '600px' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
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
  );
}
