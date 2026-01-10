import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ParsedDocument, FormulaRegion } from '../utils/documentParser';

interface DocumentPreviewProps {
  document: ParsedDocument | null;
  selectedFormulaId?: string;
  onFormulaSelect?: (formula: FormulaRegion) => void;
  onFormulaExtract?: (formulas: FormulaRegion[]) => void;
  onClose?: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  selectedFormulaId,
  onFormulaSelect,
  onFormulaExtract,
  onClose,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFormulas, setSelectedFormulas] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // 当选中公式变化时，跳转到对应页面
  useEffect(() => {
    if (selectedFormulaId && document) {
      const formula = document.formulas.find(f => f.id === selectedFormulaId);
      if (formula && formula.pageNumber !== currentPage) {
        setCurrentPage(formula.pageNumber);
      }
    }
  }, [selectedFormulaId, document, currentPage]);

  const handleFormulaClick = useCallback((formula: FormulaRegion) => {
    onFormulaSelect?.(formula);
  }, [onFormulaSelect]);

  const handleFormulaToggle = useCallback((formulaId: string) => {
    setSelectedFormulas(prev => {
      const next = new Set(prev);
      if (next.has(formulaId)) {
        next.delete(formulaId);
      } else {
        next.add(formulaId);
      }
      return next;
    });
  }, []);

  const handleExtractSelected = useCallback(() => {
    if (!document || selectedFormulas.size === 0) return;
    const formulas = document.formulas.filter(f => selectedFormulas.has(f.id));
    onFormulaExtract?.(formulas);
  }, [document, selectedFormulas, onFormulaExtract]);

  const handleExtractAll = useCallback(() => {
    if (!document) return;
    const pageFormulas = document.formulas.filter(f => f.pageNumber === currentPage);
    onFormulaExtract?.(pageFormulas);
  }, [document, currentPage, onFormulaExtract]);

  const handleSelectAllOnPage = useCallback(() => {
    if (!document) return;
    const pageFormulas = document.formulas.filter(f => f.pageNumber === currentPage);
    setSelectedFormulas(prev => {
      const next = new Set(prev);
      const allSelected = pageFormulas.every(f => next.has(f.id));
      if (allSelected) {
        pageFormulas.forEach(f => next.delete(f.id));
      } else {
        pageFormulas.forEach(f => next.add(f.id));
      }
      return next;
    });
  }, [document, currentPage]);

  if (!document) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        请选择一个文档进行预览
      </div>
    );
  }

  const currentPageFormulas = document.formulas.filter(f => f.pageNumber === currentPage);
  const thumbnail = document.thumbnails[currentPage - 1];

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b">
        <div className="flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="font-medium truncate max-w-[200px]">{document.fileName}</span>
          <span className="text-sm text-gray-500">
            ({document.pageCount} 页, {document.formulas.length} 个公式)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 缩放控制 */}
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="缩小"
          >
            ➖
          </button>
          <span className="text-sm text-gray-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.25))}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="放大"
          >
            ➕
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded ml-2"
              title="关闭"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 页面缩略图侧边栏 */}
        <div className="w-24 bg-gray-200 overflow-y-auto border-r">
          {document.thumbnails.map((thumb, idx) => {
            const pageNum = idx + 1;
            const pageFormulaCount = document.formulas.filter(f => f.pageNumber === pageNum).length;
            return (
              <button
                key={idx}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-full p-2 border-b border-gray-300 transition-colors ${
                  currentPage === pageNum ? 'bg-blue-100 border-l-4 border-l-blue-500' : 'hover:bg-gray-100'
                }`}
              >
                <img
                  src={thumb}
                  alt={`第 ${pageNum} 页`}
                  className="w-full rounded shadow-sm"
                />
                <div className="text-xs mt-1 text-gray-600">
                  {pageNum}
                  {pageFormulaCount > 0 && (
                    <span className="ml-1 text-blue-600">({pageFormulaCount})</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 页面预览区 */}
        <div ref={containerRef} className="flex-1 overflow-auto p-4">
          <div
            className="relative mx-auto bg-white shadow-lg"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
            }}
          >
            {thumbnail && (
              <img
                src={thumbnail}
                alt={`第 ${currentPage} 页`}
                className="w-full"
                style={{ minWidth: '400px' }}
              />
            )}
            
            {/* 公式高亮区域 */}
            {currentPageFormulas.map(formula => {
              const isSelected = selectedFormulas.has(formula.id);
              const isHighlighted = formula.id === selectedFormulaId;
              
              // 计算相对位置（基于缩略图尺寸）
              const scale = 200 / (formula.position.width + formula.position.x + 100);
              
              return (
                <div
                  key={formula.id}
                  onClick={() => handleFormulaClick(formula)}
                  className={`absolute cursor-pointer transition-all ${
                    isHighlighted
                      ? 'ring-4 ring-blue-500 bg-blue-200/30'
                      : isSelected
                      ? 'ring-2 ring-green-500 bg-green-200/20'
                      : 'ring-1 ring-orange-400 bg-orange-200/10 hover:bg-orange-200/30'
                  }`}
                  style={{
                    left: `${(formula.position.x * scale)}px`,
                    top: `${(formula.position.y * scale)}px`,
                    width: `${(formula.position.width * scale)}px`,
                    height: `${(formula.position.height * scale)}px`,
                  }}
                  title={`公式 ${formula.id}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleFormulaToggle(formula.id)}
                    onClick={e => e.stopPropagation()}
                    className="absolute top-1 left-1 w-4 h-4"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 公式列表侧边栏 */}
        <div className="w-64 bg-white border-l overflow-y-auto">
          <div className="p-3 border-b bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">当前页公式</span>
              <span className="text-xs text-gray-500">{currentPageFormulas.length} 个</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleSelectAllOnPage}
                className="flex-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                全选
              </button>
              <button
                onClick={handleExtractAll}
                disabled={currentPageFormulas.length === 0}
                className="flex-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded disabled:opacity-50"
              >
                提取全部
              </button>
            </div>
          </div>
          
          <div className="p-2 space-y-2">
            {currentPageFormulas.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">
                此页未检测到公式
              </div>
            ) : (
              currentPageFormulas.map(formula => (
                <FormulaCard
                  key={formula.id}
                  formula={formula}
                  isSelected={selectedFormulas.has(formula.id)}
                  isHighlighted={formula.id === selectedFormulaId}
                  onToggle={() => handleFormulaToggle(formula.id)}
                  onClick={() => handleFormulaClick(formula)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t">
        {/* 页码导航 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            ◀ 上一页
          </button>
          <span className="text-sm">
            第 <input
              type="number"
              value={currentPage}
              onChange={e => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= document.pageCount) {
                  setCurrentPage(page);
                }
              }}
              className="w-12 px-1 py-0.5 border rounded text-center"
              min={1}
              max={document.pageCount}
            /> / {document.pageCount} 页
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(document.pageCount, p + 1))}
            disabled={currentPage >= document.pageCount}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
          >
            下一页 ▶
          </button>
        </div>

        {/* 提取按钮 */}
        <div className="flex items-center gap-2">
          {selectedFormulas.size > 0 && (
            <span className="text-sm text-gray-500">
              已选 {selectedFormulas.size} 个公式
            </span>
          )}
          <button
            onClick={handleExtractSelected}
            disabled={selectedFormulas.size === 0}
            className="px-4 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            提取选中公式
          </button>
        </div>
      </div>
    </div>
  );
};

// 公式卡片组件
interface FormulaCardProps {
  formula: FormulaRegion;
  isSelected: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
  onClick: () => void;
}

const FormulaCard: React.FC<FormulaCardProps> = ({
  formula,
  isSelected,
  isHighlighted,
  onToggle,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-all ${
        isHighlighted
          ? 'border-blue-500 bg-blue-50'
          : isSelected
          ? 'border-green-500 bg-green-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
        className="w-4 h-4 flex-shrink-0"
      />
      <img
        src={formula.imageData}
        alt={formula.id}
        className="w-12 h-12 object-contain border rounded bg-white"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 truncate">
          位置: ({Math.round(formula.position.x)}, {Math.round(formula.position.y)})
        </div>
        <div className="text-xs text-gray-400">
          {Math.round(formula.position.width)} × {Math.round(formula.position.height)}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;
