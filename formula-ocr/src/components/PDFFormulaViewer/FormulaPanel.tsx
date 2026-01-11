/**
 * 侧边公式面板组件
 * 显示当前页公式列表，支持选择、识别和编辑
 * 优化：更好的视觉反馈和交互体验
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
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
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'current' | 'all'>('current');

  // 过滤公式
  const displayFormulas = viewMode === 'current' 
    ? formulas.filter(f => f.pageNumber === currentPage + 1)
    : formulas;

  // 统计
  const totalCount = formulas.length;
  const currentPageCount = formulas.filter(f => f.pageNumber === currentPage + 1).length;
  const recognizedCount = displayFormulas.filter(f => 
    recognizedFormulas.get(f.id)?.status === 'done'
  ).length;
  const processingCount = displayFormulas.filter(f =>
    recognizedFormulas.get(f.id)?.status === 'processing'
  ).length;
  const pendingCount = displayFormulas.length - recognizedCount - processingCount;

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
  const handleCopyClick = useCallback((e: React.MouseEvent, code: string, formulaId: string) => {
    e.stopPropagation();
    onCopy(code, 'latex');
    setCopyFeedback(formulaId);
    setTimeout(() => setCopyFeedback(null), 1500);
  }, [onCopy]);

  // 获取状态标签
  const getStatusBadge = (status: FormulaStatus | undefined) => {
    switch (status) {
      case 'processing':
        return (
          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
            识别中
          </span>
        );
      case 'done':
        return (
          <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
            <span>✓</span>
            已识别
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full flex items-center gap-1">
            <span>✕</span>
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
      <div className="w-14 h-full bg-white border-l border-gray-200 flex flex-col items-center py-4 shadow-sm">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors mb-3"
          title="展开面板"
        >
          <span className="text-xl">📋</span>
        </button>
        {totalCount > 0 && (
          <>
            <div className="text-xs text-gray-500 font-medium">
              {recognizedCount}/{totalCount}
            </div>
            {processingCount > 0 && (
              <div className="mt-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col shadow-sm">
      {/* 头部 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-lg">📐</span>
            公式列表
          </h3>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="折叠面板"
            >
              <span className="text-gray-400">→</span>
            </button>
          )}
        </div>
        
        {/* 视图切换 */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
          <button
            onClick={() => setViewMode('current')}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
              viewMode === 'current'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            当前页 ({currentPageCount})
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all ${
              viewMode === 'all'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            全部 ({totalCount})
          </button>
        </div>
        
        {/* 统计信息 */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {viewMode === 'current' && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg font-medium text-xs">
              第 {currentPage + 1} 页
            </span>
          )}
          <span className="text-gray-500 text-xs">
            共 <span className="font-medium text-gray-700">{displayFormulas.length}</span> 个
          </span>
          {recognizedCount > 0 && (
            <span className="text-emerald-600 font-medium text-xs">
              {recognizedCount} 已识别
            </span>
          )}
          {processingCount > 0 && (
            <span className="text-yellow-600 font-medium text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
              {processingCount} 识别中
            </span>
          )}
        </div>

        {/* 批量操作按钮 */}
        {pendingCount > 0 && viewMode === 'current' && (
          <button
            onClick={onRecognizeAll}
            disabled={processingCount > 0}
            className={`mt-3 w-full py-2.5 px-4 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
              processingCount > 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-md hover:shadow-lg'
            }`}
          >
            {processingCount > 0 ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                正在识别 ({processingCount})
              </>
            ) : (
              <>
                <span>✨</span>
                一键识别本页 ({pendingCount})
              </>
            )}
          </button>
        )}
        
        {/* 全部完成提示 */}
        {displayFormulas.length > 0 && pendingCount === 0 && processingCount === 0 && (
          <div className="mt-3 py-2 px-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg flex items-center gap-2">
            <span>✓</span>
            {viewMode === 'current' ? '本页' : '全部'}公式已识别完成
          </div>
        )}
      </div>

      {/* 公式列表 */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {displayFormulas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-medium">{viewMode === 'current' ? '此页' : '文档中'}未检测到公式</p>
            <p className="text-sm mt-1">尝试上传包含数学公式的文档</p>
          </div>
        ) : (
          displayFormulas.map((formula) => {
            const recognized = recognizedFormulas.get(formula.id);
            const isSelected = formula.id === selectedId;
            const isHovered = formula.id === hoveredId;
            const isCopied = copyFeedback === formula.id;
            
            // 计算全局序号
            const globalIndex = formulas.indexOf(formula);
            const pageIndex = formulas.filter(f => f.pageNumber === formula.pageNumber).indexOf(formula);

            return (
              <div
                key={formula.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(formula.id, el);
                }}
                className={`
                  p-3 rounded-xl border-2 cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? 'border-green-500 bg-green-50 shadow-lg scale-[1.02]' 
                    : isHovered 
                      ? 'border-blue-400 bg-blue-50 shadow-md' 
                      : 'border-gray-200 hover:border-purple-300 bg-white hover:shadow-md'
                  }
                `}
                onClick={() => handleCardClick(formula)}
                onMouseEnter={() => onFormulaHover(formula.id)}
                onMouseLeave={() => onFormulaHover(null)}
              >
                {/* 公式缩略图 */}
                <div className="mb-2 bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                  <img
                    src={formula.imageData}
                    alt={`公式 ${globalIndex + 1}`}
                    className="w-full h-auto max-h-28 object-contain p-2"
                  />
                </div>

                {/* 公式信息 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded flex items-center justify-center text-xs font-bold">
                      {viewMode === 'all' ? globalIndex + 1 : pageIndex + 1}
                    </span>
                    {viewMode === 'all' ? (
                      <span>P{formula.pageNumber}-{pageIndex + 1}</span>
                    ) : (
                      <span>公式 {formula.pageNumber}-{pageIndex + 1}</span>
                    )}
                  </span>
                  {getStatusBadge(recognized?.status)}
                </div>

                {/* 识别结果 */}
                {recognized?.status === 'done' && recognized.latex && (
                  <div className="mt-2">
                    <div className="bg-gray-900 text-gray-100 p-2.5 rounded-lg text-xs font-mono overflow-x-auto max-h-24 overflow-y-auto">
                      <code>{recognized.latex}</code>
                    </div>
                    <button
                      onClick={(e) => handleCopyClick(e, recognized.latex, formula.id)}
                      className={`mt-2 w-full py-2 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        isCopied
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-700'
                      }`}
                    >
                      <span>{isCopied ? '✓' : '📋'}</span>
                      {isCopied ? '已复制!' : '复制 LaTeX'}
                    </button>
                  </div>
                )}

                {/* 错误信息 */}
                {recognized?.status === 'error' && (
                  <div className="mt-2">
                    <div className="p-2.5 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                      <span className="font-medium">识别失败：</span>
                      {recognized.error || '未知错误'}
                    </div>
                    <button
                      onClick={(e) => handleRecognizeClick(e, formula)}
                      className="mt-2 w-full py-2 px-3 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>🔄</span>
                      重新识别
                    </button>
                  </div>
                )}

                {/* 操作按钮 - 待识别状态 */}
                {(!recognized || recognized.status === 'pending') && (
                  <button
                    onClick={(e) => handleRecognizeClick(e, formula)}
                    className="mt-2 w-full py-2 px-3 bg-gradient-to-r from-purple-100 to-indigo-100 hover:from-purple-200 hover:to-indigo-200 text-purple-700 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>🔍</span>
                    点击识别公式
                  </button>
                )}

                {/* 识别中状态 */}
                {recognized?.status === 'processing' && (
                  <div className="mt-2 flex items-center justify-center gap-2 py-2 bg-yellow-50 rounded-lg">
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-yellow-700 text-xs font-medium">正在识别...</span>
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
