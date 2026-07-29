import React, { useState, useRef, UIEvent } from 'react'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  gap?: number
  height?: number
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  className?: string
  listClassName?: string
  listTestId?: string
  listAriaLabel?: string
  role?: string
}

export function VirtualList<T>({
  items,
  itemHeight,
  gap = 0,
  height = 400,
  renderItem,
  className,
  listClassName,
  listTestId,
  listAriaLabel,
  role = 'list',
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const totalHeight = items.length > 0 
    ? items.length * itemHeight + (items.length - 1) * gap 
    : 0

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  // Calculate top of viewport and items inside
  const itemSpacing = itemHeight + gap
  const startIndex = Math.max(0, Math.floor(scrollTop / itemSpacing) - 3)
  const endIndex = Math.min(items.length - 1, Math.floor((scrollTop + height) / itemSpacing) + 3)

  const visibleItems: React.ReactNode[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    const style: React.CSSProperties = {
      position: 'absolute',
      top: i * itemSpacing,
      left: 0,
      right: 0,
      height: itemHeight,
    }
    visibleItems.push(renderItem(items[i], i, style))
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height, overflowY: 'auto', position: 'relative' }}
      className={className}
    >
      <ul
        className={listClassName}
        role={role}
        data-testid={listTestId}
        data-transaction-count={items.length}
        aria-label={listAriaLabel}
        aria-live="polite"
        style={{ height: totalHeight, position: 'relative', margin: 0, padding: 0, listStyle: 'none' }}
      >
        {visibleItems}
      </ul>
    </div>
  )
}
