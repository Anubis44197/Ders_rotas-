import React, { useMemo, useState } from 'react';

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  overscan?: number;
  getKey: (item: T, index: number) => React.Key;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

const VirtualScroll = <T,>({
  items,
  itemHeight,
  height,
  overscan = 4,
  getKey,
  renderItem,
  className = '',
}: VirtualScrollProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(height / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [endIndex, items, startIndex],
  );

  return (
    <div
      className={className}
      style={{ height, overflowY: 'auto', position: 'relative' }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role="list"
      aria-label="Sanal kaydirma listesi"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, offset) => {
          const index = startIndex + offset;
          return (
            <div
              key={getKey(item, index)}
              style={{
                left: 0,
                position: 'absolute',
                right: 0,
                top: index * itemHeight,
              }}
              role="listitem"
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualScroll;
