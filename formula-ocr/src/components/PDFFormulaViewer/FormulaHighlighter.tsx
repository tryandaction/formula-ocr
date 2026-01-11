/**
 * 公式高亮组件
 * 在 PDF 页面上渲染公式高亮框，支持不同状态的颜色区分
 * 优化：紧贴公式边缘的高亮框
 */

import React, { useCallback } from 'react';
import type { FormulaRegion } from '../../utils/documentParser';

// 高亮颜色方案 - 更醒目的颜色
const HIGHLIGHT_COLORS = {
  default: 'border-purple-500 bg-purple-200/30 hover:bg-purple-300/40 shadow-sm',
  hovered: 'border-blue-500 bg-blue-200/40 shadow-md',
  selected: 'border-green-500 bg-green-200/50 ring-2 ring-green-400 shadow-lg',
  recognized: 'border-emerald-500 bg-emerald-200/30 shadow-sm',
  processing: 'border-yellow-500 bg-yellow-200/40 animate-pulse shadow-md',
  error: 'border-red-500 bg-red-200/30 shadow-sm',
};

export type FormulaStatus = 'pending' | 'processing' | 'done' | 'error';

interface FormulaHighlighterProps {
  formulas: FormulaRegion[];
  pageIndex: number;
  selectedId: string | null;
  hoveredId: string | null;
  formulaStatuses: Map<string, FormulaStatus>;
  onFormulaClick: (formula: FormulaRegion) => void;
  onFormulaHover: (formulaId: string | null) => void;
  zoom: number;
}

export const FormulaHighlighter: React.FC<FormulaHighlighterProps> = ({
  formulas,
  pageIndex,
  selectedId,
  hoveredId,
  formulaStatuses,
  onFormulaClick,
  onFormulaHover,
  zoom,
}) => {
  // 过滤当前页的公式
  const pageFormulas = formulas.filter(f => f.pageNumber === pageIndex + 1);

  // 获取公式的高亮样式
  const getHighlightClass = useCallback((formula: FormulaRegion): string => {
    const status = formulaStatuses.get(formula.id);
    const isSelected = formula.id === selectedId;
    const isHovered = formula.id === hoveredId;

    if (isSelected) {
      return HIGHLIGHT_COLORS.selected;
    }
    if (isHovered) {
      return HIGHLIGHT_COLORS.hovered;
    }
    if (status === 'processing') {
      return HIGHLIGHT_COLORS.processing;
    }
    if (status === 'done') {
      return HIGHLIGHT_COLORS.recognized;
    }
    if (status === 'error') {
      return HIGHLIGHT_COLORS.error;
    }
    return HIGHLIGHT_COLORS.default;
  }, [selectedId, hoveredId, formulaStatuses]);

  // 处理点击事件
  const handleClick = useCallback((e: React.MouseEvent, formula: FormulaRegion) => {
    e.stopPropagation();
    onFormulaClick(formula);
  }, [onFormulaClick]);

  // 处理鼠标进入
  const handleMouseEnter = useCallback((formulaId: string) => {
    onFormulaHover(formulaId);
  }, [onFormulaHover]);

  // 处理鼠标离开
  const handleMouseLeave = useCallback(() => {
    onFormulaHover(null);
  }, [onFormulaHover]);

  if (pageFormulas.length === 0) {
    return null;
  }

  return (
    <>
      {pageFormulas.map((formula, index) => {
        // 使用原始坐标并应用缩放
        const { x, y, width, height } = formula.originalPosition;
        const scaledX = x * zoom;
        const scaledY = y * zoom;
        const scaledWidth = width * zoom;
        const scaledHeight = height * zoom;

        const status = formulaStatuses.get(formula.id);
        const highlightClass = getHighlightClass(formula);
        const isSelected = formula.id === selectedId;

        return (
          <div
            key={formula.id}
            className={`absolute cursor-pointer border-2 rounded-sm transition-all duration-150 ${highlightClass}`}
            style={{
              left: `${scaledX}px`,
              top: `${scaledY}px`,
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
              // 确保高亮框在图片上方
              zIndex: isSelected ? 20 : 10,
            }}
            onClick={(e) => handleClick(e, formula)}
            onMouseEnter={() => handleMouseEnter(formula.id)}
            onMouseLeave={handleMouseLeave}
            title={`公式 ${formula.pageNumber}-${index + 1}${status === 'done' ? ' (已识别 - 点击查看)' : ' (点击识别)'}`}
          >
            {/* 公式序号标签 */}
            <div className="absolute -top-5 left-0 px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded-t font-medium whitespace-nowrap">
              {formula.pageNumber}-{index + 1}
            </div>
            
            {/* 状态指示器 */}
            {status === 'processing' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center shadow-md">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
              </div>
            )}
            {status === 'done' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            )}
            {status === 'error' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            )}
            {(!status || status === 'pending') && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-md opacity-70 hover:opacity-100">
                <span className="text-white text-xs">🔍</span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default FormulaHighlighter;
