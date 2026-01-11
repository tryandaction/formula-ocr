/**
 * 虚拟滚动容器组件
 * 实现 PDF 连续页面渲染，仅渲染可见页面及相邻页面
 * 包含性能优化：骨架屏、预加载、懒加载
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

export interface PageDimension {
  width: number;
  height: number;
}

interface VirtualScrollContainerProps {
  pageCount: number;
  pageImages: string[];
  pageDimensions: PageDimension[];
  zoom: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onScroll: (scrollTop: number) => void;
  renderOverlay?: (pageIndex: number) => React.ReactNode;
  className?: string;
}

// 预渲染的页面数量（当前页前后各几页）
const BUFFER_PAGES = 2;
// 页面间距
const PAGE_GAP = 16;

// 骨架屏组件
const PageSkeleton: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <div 
    className="bg-white shadow-lg animate-pulse"
    style={{ width: `${width}px`, height: `${height}px` }}
  >
    <div className="h-full flex flex-col p-4 gap-3">
      {/* 模拟文本行 */}
      {Array.from({ length: Math.floor(height / 30) }).map((_, i) => (
        <div 
          key={i} 
          className="h-3 bg-gray-200 rounded"
          style={{ width: `${60 + Math.random() * 35}%` }}
        />
      ))}
    </div>
  </div>
);

export const VirtualScrollContainer: React.FC<VirtualScrollContainerProps> = ({
  pageCount,
  pageImages,
  pageDimensions,
  zoom,
  currentPage,
  onPageChange,
  onScroll,
  renderOverlay,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(BUFFER_PAGES * 2, pageCount - 1) });
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // 计算每页的累积高度（用于定位）
  const pageOffsets = useMemo(() => {
    const offsets: number[] = [0];
    let totalHeight = 0;
    
    for (let i = 0; i < pageCount; i++) {
      const dim = pageDimensions[i] || { width: 595, height: 842 }; // A4 默认尺寸
      const scaledHeight = dim.height * zoom;
      totalHeight += scaledHeight + PAGE_GAP;
      offsets.push(totalHeight);
    }
    
    return offsets;
  }, [pageCount, pageDimensions, zoom]);

  // 总高度
  const totalHeight = pageOffsets[pageCount] || 0;

  // 根据滚动位置计算当前页码
  const getPageFromScrollTop = useCallback((scrollTop: number): number => {
    for (let i = 0; i < pageCount; i++) {
      const pageTop = pageOffsets[i];
      const pageBottom = pageOffsets[i + 1] - PAGE_GAP;
      const pageMid = (pageTop + pageBottom) / 2;
      
      if (scrollTop < pageMid) {
        return i;
      }
    }
    return pageCount - 1;
  }, [pageCount, pageOffsets]);

  // 计算可见页面范围
  const calculateVisibleRange = useCallback((scrollTop: number, containerHeight: number) => {
    let start = 0;
    let end = 0;
    
    // 找到第一个可见页面
    for (let i = 0; i < pageCount; i++) {
      const pageBottom = pageOffsets[i + 1] - PAGE_GAP;
      if (pageBottom > scrollTop) {
        start = Math.max(0, i - BUFFER_PAGES);
        break;
      }
    }
    
    // 找到最后一个可见页面
    const viewBottom = scrollTop + containerHeight;
    for (let i = start; i < pageCount; i++) {
      const pageTop = pageOffsets[i];
      if (pageTop > viewBottom) {
        end = Math.min(pageCount - 1, i + BUFFER_PAGES);
        break;
      }
      end = Math.min(pageCount - 1, i + BUFFER_PAGES);
    }
    
    return { start, end };
  }, [pageCount, pageOffsets]);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    
    // 更新可见范围
    const newRange = calculateVisibleRange(scrollTop, containerHeight);
    setVisibleRange(prev => {
      if (prev.start !== newRange.start || prev.end !== newRange.end) {
        return newRange;
      }
      return prev;
    });
    
    // 更新当前页码（防抖）
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
    }
    
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = window.setTimeout(() => {
      isScrollingRef.current = false;
      const newPage = getPageFromScrollTop(scrollTop);
      if (newPage !== currentPage) {
        onPageChange(newPage);
      }
    }, 100);
    
    onScroll(scrollTop);
  }, [calculateVisibleRange, getPageFromScrollTop, currentPage, onPageChange, onScroll]);

  // 跳转到指定页面
  const scrollToPage = useCallback((pageIndex: number) => {
    const container = containerRef.current;
    if (!container || pageIndex < 0 || pageIndex >= pageCount) return;
    
    const targetScrollTop = pageOffsets[pageIndex];
    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    });
  }, [pageCount, pageOffsets]);

  // 监听 currentPage 变化，自动滚动
  useEffect(() => {
    if (!isScrollingRef.current) {
      scrollToPage(currentPage);
    }
  }, [currentPage, scrollToPage]);

  // 处理键盘事件
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 只在容器获得焦点时响应
      if (document.activeElement !== container && !container.contains(document.activeElement)) {
        return;
      }

      switch (e.key) {
        case 'PageDown':
          e.preventDefault();
          scrollToPage(Math.min(currentPage + 1, pageCount - 1));
          break;
        case 'PageUp':
          e.preventDefault();
          scrollToPage(Math.max(currentPage - 1, 0));
          break;
        case 'Home':
          e.preventDefault();
          scrollToPage(0);
          break;
        case 'End':
          e.preventDefault();
          scrollToPage(pageCount - 1);
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, pageCount, scrollToPage]);

  // 初始化时设置可见范围
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      handleScroll();
    }
  }, [handleScroll]);

  // 渲染页面
  const renderPages = () => {
    const pages: React.ReactNode[] = [];
    
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      const dim = pageDimensions[i] || { width: 595, height: 842 };
      const scaledWidth = dim.width * zoom;
      const scaledHeight = dim.height * zoom;
      const top = pageOffsets[i];
      const hasImage = !!pageImages[i];
      
      pages.push(
        <div
          key={i}
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: `${top}px`,
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
          }}
        >
          {/* 页面图像或骨架屏 */}
          {hasImage ? (
            <div className="relative w-full h-full bg-white shadow-lg">
              <img
                src={pageImages[i]}
                alt={`Page ${i + 1}`}
                className="w-full h-full object-contain"
                draggable={false}
                loading="lazy"
              />
              
              {/* 页面覆盖层（公式高亮等） */}
              {renderOverlay && (
                <div className="absolute inset-0 pointer-events-auto">
                  {renderOverlay(i)}
                </div>
              )}
              
              {/* 页码标签 */}
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
                {i + 1}
              </div>
            </div>
          ) : (
            <PageSkeleton width={scaledWidth} height={scaledHeight} />
          )}
        </div>
      );
    }
    
    return pages;
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto focus:outline-none ${className}`}
      style={{ height: '100%' }}
      onScroll={handleScroll}
      tabIndex={0}
    >
      {/* 占位容器，撑开滚动高度 */}
      <div
        className="relative w-full"
        style={{ height: `${totalHeight}px`, minHeight: '100%' }}
      >
        {renderPages()}
      </div>
    </div>
  );
};

export default VirtualScrollContainer;
