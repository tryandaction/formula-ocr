/**
 * PDF 缩略图导航组件
 * 显示所有页面的缩略图，支持快速跳转和公式数量显示
 */

import React, { useRef, useEffect, useCallback } from 'react';
import type { FormulaRegion } from '../../utils/documentParser';

interface ThumbnailNavProps {
  thumbnails: string[];
  currentPage: number;
  formulas: FormulaRegion[];
  onPageSelect: (page: number) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const ThumbnailNav: React.FC<ThumbnailNavProps> = ({
  thumbnails,
  currentPage,
  formulas,
  onPageSelect,
  isCollapsed,
  onToggleCollapse,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // 当前页变化时滚动到对应缩略图
  useEffect(() => {
    const itemEl = itemRefs.current.get(currentPage);
    if (itemEl && listRef.current) {
      itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPage]);

  // 获取每页的公式数量
  const getFormulaCount = useCallback((pageIndex: number) => {
    return formulas.filter(f => f.pageNumber === pageIndex + 1).length;
  }, [formulas]);

  // 折叠状态
  if (isCollapsed) {
    return (
      <div className="w-10 h-full bg-gray-800 flex flex-col items-center py-2 border-r border-gray-700">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors mb-2"
          title="展开缩略图"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="text-xs text-gray-500 writing-vertical-lr rotate-180">
          {thumbnails.length} 页
        </div>
      </div>
    );
  }

  return (
    <div className="w-36 h-full bg-gray-800 flex flex-col border-r border-gray-700">
      {/* 头部 */}
      <div className="flex-shrink-0 px-2 py-2 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">页面导航</span>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          title="隐藏缩略图"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* 缩略图列表 */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {thumbnails.map((thumbnail, index) => {
          const isActive = index === currentPage;
          const formulaCount = getFormulaCount(index);

          return (
            <div
              key={index}
              ref={(el) => {
                if (el) itemRefs.current.set(index, el);
              }}
              className={`
                relative cursor-pointer rounded-lg overflow-hidden transition-all
                ${isActive 
                  ? 'ring-2 ring-purple-500 shadow-lg scale-105' 
                  : 'hover:ring-2 hover:ring-gray-500 opacity-70 hover:opacity-100'
                }
              `}
              onClick={() => onPageSelect(index)}
            >
              {/* 缩略图 */}
              <img
                src={thumbnail}
                alt={`第 ${index + 1} 页`}
                className="w-full h-auto bg-white"
                loading="lazy"
              />

              {/* 页码标签 */}
              <div className={`
                absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs font-medium
                ${isActive ? 'bg-purple-500 text-white' : 'bg-black/60 text-white'}
              `}>
                {index + 1}
              </div>

              {/* 公式数量标签 */}
              {formulaCount > 0 && (
                <div className={`
                  absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                  ${isActive ? 'bg-purple-500 text-white' : 'bg-orange-500 text-white'}
                `}>
                  {formulaCount}
                </div>
              )}

              {/* 当前页指示器 */}
              {isActive && (
                <div className="absolute inset-0 bg-purple-500/10 pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>

      {/* 底部统计 */}
      <div className="flex-shrink-0 px-2 py-2 border-t border-gray-700 text-center">
        <div className="text-xs text-gray-500">
          共 {thumbnails.length} 页
        </div>
        <div className="text-xs text-orange-400 mt-0.5">
          {formulas.length} 个公式
        </div>
      </div>
    </div>
  );
};

export default ThumbnailNav;
