/**
 * 侧边公式面板组件
 * 显示当前页公式列表，支持选择、识别和编辑
 */

import React, { useCallback, useRef, useEffect } from 'react';
import type { FormulaRegion } from '../../utils/documentParser';
import type { FormulaStatus } from './FormulaHighlighter';

interface RecognizedFormula {
  id: string;
  latex: string;
  markdown?: string;
  status: FormulaStatus;
  error?: string;
}

interface FormulaPanelProps {
  formulas: FormulaRegion[];
  currentPage: number;
  selectedId: string | null;
  hoveredId: string | null;
  recognizedFormulas: Map<string, RecognizedFormula>;
  onFormulaSelect: (formula: FormulaRegion) => void;
  onFormulaHover: (formulaId: string | null) => void;
  onRecognize: (formula: FormulaRegion) => void;
  onRecognizeAll: () => void;
  onCopy: (code: string, format: 'latex' | 'markdown') => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const FormulaPanel: React.FC<FormulaPanelProps> = ({
  formulas,
  currentPage,
  selectedId,
  hoveredId,
  recognizedFormulas,
  onFormulaSelect,
  onFormulaHover,
  onRecognize,
  onRecognizeAll,
  onCopy,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 过滤当前页的公式
  const pageFormulas = formulas.filter(f => f.pageNumber === currentPage + 1);

  // 统计
  const totalCount = pageFormulas.length;
  const recognizedCount = pageFormulas.filter(f => 
    recognizedFormulas.get(f.id)?.status === 'done'
  ).length;
  const pendingCount = totalCount - recognizedCount;

  // 当选中公式变化时，滚动到对应卡片
  useEffect(() => {
    if (selectedId && listRef.current) {
      const cardEl = cardRefs.current.get(selectedId);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedId]);

  // 处理公式卡片点击
  const handleCardClick = useCallback((formula: FormulaRegion) => {
    onFormulaSelect(formula);
  }, [onFormulaSelect]);

  // 处理识别按钮点击
  const handleRecognizeClick = useCallback((e: React.MouseEvent, formula: FormulaRegion) => {
    e.stopPropagation();
    onRecognize(formula);
  }, [onRecognize]);

  // 处理复制按钮点击
  const handleCopyClick = useCallback((e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    onCopy(code, 'latex');
  }, [onCopy]);

  // 获取状态标签
  const getStatusBadge = (status: FormulaStatus | undefined) => {
    switch (status) {
      case 'processing':
        return (
          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
            识别中...
          </span>
        );
      case 'done':
        return (
          <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
            已识别
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
            失败
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
            待识别
          </span>
        );
    }
  };

  // 折叠状态
  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-white border-l border-gray-200 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="展开面板"
        >
          <span className="text-lg">📋</span>
        </button>
        {totalCount > 0 && (
          <div className="mt-2 text-xs text-gray-500 writing-vertical">
            {recognizedCount}/{totalCount}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span>📐</span>
            公式列表
          </h3>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="折叠面板"
            >
              <span className="text-gray-400">→</span>
            </button>
          )}
        </div>
        
        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>第 {currentPage + 1} 页</span>
          <span className="text-gray-300">|</span>
          <span>{totalCount} 个公式</span>
          {recognizedCount > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-emerald-600">{recognizedCount} 已识别</span>
            </>
          )}
        </div>

        {/* 批量操作按钮 */}
        {pendingCount > 0 && (
          <button
            onClick={onRecognizeAll}
            className="mt-3 w-full py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>✨</span>
            提取全部 ({pendingCount})
          </button>
        )}
      </div>

      {/* 公式列表 */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {pageFormulas.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p>此页未检测到公式</p>
          </div>
        ) : (
          pageFormulas.map((formula, index) => {
            const recognized = recognizedFormulas.get(formula.id);
            const isSelected = formula.id === selectedId;
            const isHovered = formula.id === hoveredId;

            return (
              <div
                key={formula.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(formula.id, el);
                }}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${isSelected 
                    ? 'border-green-500 bg-green-50 shadow-md' 
                    : isHovered 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }
                `}
                onClick={() => handleCardClick(formula)}
                onMouseEnter={() => onFormulaHover(formula.id)}
                onMouseLeave={() => onFormulaHover(null)}
              >
                {/* 公式缩略图 */}
                <div className="mb-2 bg-gray-50 rounded overflow-hidden">
                  <img
                    src={formula.imageData}
                    alt={`公式 ${index + 1}`}
                    className="w-full h-auto max-h-24 object-contain"
                  />
                </div>

                {/* 公式信息 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    公式 {currentPage + 1}-{index + 1}
                  </span>
                  {getStatusBadge(recognized?.status)}
                </div>

                {/* 识别结果 */}
                {recognized?.status === 'done' && recognized.latex && (
                  <div className="mt-2">
                    <div className="bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono overflow-x-auto max-h-20 overflow-y-auto">
                      {recognized.latex}
                    </div>
                    <button
                      onClick={(e) => handleCopyClick(e, recognized.latex)}
                      className="mt-2 w-full py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <span>📋</span>
                      复制 LaTeX
                    </button>
                  </div>
                )}

                {/* 错误信息 */}
                {recognized?.status === 'error' && (
                  <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded">
                    {recognized.error || '识别失败'}
                  </div>
                )}

                {/* 操作按钮 */}
                {(!recognized || recognized.status === 'error' || recognized.status === 'pending') && (
                  <button
                    onClick={(e) => handleRecognizeClick(e, formula)}
                    className="mt-2 w-full py-1.5 px-3 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <span>🔍</span>
                    识别公式
                  </button>
                )}

                {/* 识别中状态 */}
                {recognized?.status === 'processing' && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-yellow-600 text-xs">
                    <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    正在识别...
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FormulaPanel;
