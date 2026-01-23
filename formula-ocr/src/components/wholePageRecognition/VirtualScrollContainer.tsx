/**
 * 虚拟滚动容器
 * 用于大量公式的高效渲染
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface VirtualScrollContainerProps {
  /** 容器高度 */
  height: number;
  /** 容器宽度 */
  width: number;
  /** 内容总高度 */
  contentHeight: number;
  /** 内容总宽度 */
  contentWidth: number;
  /** 子组件 */
  children: (viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => React.ReactNode;
  /** 滚动回调 */
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
}

/**
 * 虚拟滚动容器组件
 * 只渲染视口内的内容，提升大量元素的渲染性能
 */
export const VirtualScrollContainer: React.FC<VirtualScrollContainerProps> = ({
  height,
  width,
  contentHeight,
  contentWidth,
  children,
  onScroll,
}) => {
  const [viewport, setViewport] = useState({
    x: 0,
    y: 0,
    width,
    height,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // 处理滚动事件（使用requestAnimationFrame优化）
  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;

      setViewport({
        x: scrollLeft,
        y: scrollTop,
        width,
        height,
      });

      onScroll?.(scrollTop, scrollLeft);
    });
  }, [width, height, onScroll]);

  // 清理requestAnimationFrame
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: `${contentWidth}px`,
          height: `${contentHeight}px`,
          position: 'relative',
        }}
      >
        {children(viewport)}
      </div>
    </div>
  );
};
