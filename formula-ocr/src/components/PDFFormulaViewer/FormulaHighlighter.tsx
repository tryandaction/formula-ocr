/**
 * 公式高亮组件
 * 在 PDF 页面上渲染公式高亮框，支持不同状态的颜色区分
 */

import React, { useCallback } from 'react';
import type { FormulaRegion } from '../../utils/documentParser';

// 高亮颜色方案
const HIGHLIGHT_COLORS = {
  default: 'border-purple-400 bg-purple-100/20 hover:bg-purple-100/40',
  hovered: 'border-blue-500 bg-blue-100/30',
  selected: 'border-green-500 bg-green-100/40 ring-2 ring-green-300',
  recognized: 'border-emerald-500 bg-emerald-100/20',
  processing: 'border-yellow-500 bg-yellow-100/30 animate-pulse',
  error: 'border-red-400 bg-red-100/20',
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
      {pageFormulas.map(formula => {
        // 使用原始坐标并应用缩放
        const { x, y, width, height } = formula.originalPosition;
        const scaledX = x * zoom;
        const scaledY = y * zoom;
        const scaledWidth = width * zoom;
        const scaledHeight = height * zoom;

        const status = formulaStatuses.get(formula.id);
        const highlightClass = getHighlightClass(formula);

        return (
          <div
            key={formula.id}
            className={`absolute cursor-pointer border-2 rounded transition-all duration-150 ${highlightClass}`}
            style={{
              left: `${scaledX}px`,
              top: `${scaledY}px`,
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
            }}
            onClick={(e) => handleClick(e, formula)}
            onMouseEnter={() => handleMouseEnter(formula.id)}
            onMouseLeave={handleMouseLeave}
            title={`公式 ${formula.pageNumber}-${pageFormulas.indexOf(formula) + 1}${status === 'done' ? ' (已识别)' : ''}`}
          >
            {/* 状态指示器 */}
            {status === 'processing' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-ping" />
              </div>
            )}
            {status === 'done' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
            )}
            {status === 'error' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">!</span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default FormulaHighlighter;
