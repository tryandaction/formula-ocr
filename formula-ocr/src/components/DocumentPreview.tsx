import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [hoveredFormulaId, setHoveredFormulaId] = useState<string | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const formulaListRef = useRef<HTMLDivElement>(null);

  // 当前页的公式
  const currentPageFormulas = useMemo(() => {
    if (!document) return [];
    return document.formulas.filter(f => f.pageNumber === currentPage);
  }, [document, currentPage]);

  // 当选中公式变化时，跳转到对应页面并滚动到公式位置
  useEffect(() => {
    if (selectedFormulaId && document) {
      const formula = document.formulas.find(f => f.id === selectedFormulaId);
      if (formula) {
        if (formula.pageNumber !== currentPage) {
          setCurrentPage(formula.pageNumber);
        }
        // 滚动到公式位置
        scrollToFormula(formula);
      }
    }
  }, [selectedFormulaId, document]);

  // 滚动到指定公式
  const scrollToFormula = useCallback((formula: FormulaRegion) => {
    if (!pageContainerRef.current || !document) return;
    
    const pageDim = document.pageDimensions[formula.pageNumber - 1];
    if (!pageDim) return;

    // 计算公式在视口中的位置
    const containerRect = pageContainerRef.current.getBoundingClientRect();
    const formulaY = formula.originalPosition.y;
    const pageHeight = pageDim.height;
    
    // 计算需要滚动的位置，使公式居中显示
    const targetScrollTop = (formulaY / pageHeight) * pageContainerRef.current.scrollHeight - containerRect.height / 2;
    
    pageContainerRef.current.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });
  }, [document]);

  // 滚动侧边栏到指定公式
  const scrollFormulaListToFormula = useCallback((formulaId: string) => {
    if (!formulaListRef.current) return;
    const formulaElement = formulaListRef.current.querySelector(`[data-formula-id="${formulaId}"]`);
    if (formulaElement) {
      formulaElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleFormulaClick = useCallback((formula: FormulaRegion) => {
    onFormulaSelect?.(formula);
    scrollFormulaListToFormula(formula.id);
  }, [onFormulaSelect, scrollFormulaListToFormula]);

  const handleFormulaToggle = useCallback((formulaId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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
    setSelectedFormulas(new Set());
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

  // 鼠标拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // 中键或 Alt+左键
      e.preventDefault();
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastPanPoint.x;
    const dy = e.clientY - lastPanPoint.y;
    setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPanPoint({ x: e.clientX, y: e.clientY });
  }, [isPanning, lastPanPoint]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.max(0.25, Math.min(3, z + delta)));
    }
  }, []);

  // 重置视图
  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentPage(p => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (document) {
          setCurrentPage(p => Math.min(document.pageCount, p + 1));
        }
      } else if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(3, z + 0.25));
      } else if (e.key === '-') {
        setZoom(z => Math.max(0.25, z - 0.25));
      } else if (e.key === '0') {
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [document, resetView]);

  if (!document) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        请选择一个文档进行预览
      </div>
    );
  }

  const pageImage = document.pageImages[currentPage - 1];
  const pageDimension = document.pageDimensions[currentPage - 1];

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg overflow-hidden">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="font-medium truncate max-w-[200px]" title={document.fileName}>
            {document.fileName}
          </span>
          <span className="text-sm text-gray-500">
            ({document.pageCount} 页, {document.formulas.length} 个公式)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 缩放控制 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
              className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
              title="缩小 (-)"
            >
              <span className="text-lg">−</span>
            </button>
            <button
              onClick={resetView}
              className="px-2 h-7 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors min-w-[50px]"
              title="重置视图 (0)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
              title="放大 (+)"
            >
              <span className="text-lg">+</span>
            </button>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
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
        <div className="w-28 bg-gray-200/50 overflow-y-auto border-r flex-shrink-0">
          <div className="p-2 space-y-2">
            {document.thumbnails.map((thumb, idx) => {
              const pageNum = idx + 1;
              const pageFormulaCount = document.formulas.filter(f => f.pageNumber === pageNum).length;
              const isCurrentPage = currentPage === pageNum;
              
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentPage(pageNum);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className={`w-full p-1.5 rounded-lg transition-all ${
                    isCurrentPage 
                      ? 'bg-blue-500 shadow-md ring-2 ring-blue-300' 
                      : 'bg-white hover:bg-gray-50 hover:shadow'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={thumb}
                      alt={`第 ${pageNum} 页`}
                      className="w-full rounded shadow-sm"
                    />
                    {pageFormulaCount > 0 && (
                      <div className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-xs font-medium flex items-center justify-center ${
                        isCurrentPage ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
                      }`}>
                        {pageFormulaCount}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs mt-1 font-medium ${isCurrentPage ? 'text-white' : 'text-gray-600'}`}>
                    {pageNum}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 页面预览区 */}
        <div 
          ref={pageContainerRef}
          className="flex-1 overflow-auto bg-gray-300/50 relative"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        >
          <div className="min-h-full flex items-start justify-center p-4">
            <div
              className="relative bg-white shadow-2xl"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                transformOrigin: 'top center',
                width: pageDimension ? `${pageDimension.width}px` : 'auto',
              }}
            >
              {pageImage && (
                <img
                  src={pageImage}
                  alt={`第 ${currentPage} 页`}
                  className="w-full h-auto select-none"
                  draggable={false}
                />
              )}
              
              {/* 公式高亮区域 */}
              {currentPageFormulas.map(formula => {
                const isSelected = selectedFormulas.has(formula.id);
                const isHighlighted = formula.id === selectedFormulaId;
                const isHovered = formula.id === hoveredFormulaId;
                
                return (
                  <div
                    key={formula.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFormulaClick(formula);
                    }}
                    onMouseEnter={() => setHoveredFormulaId(formula.id)}
                    onMouseLeave={() => setHoveredFormulaId(null)}
                    className={`absolute cursor-pointer transition-all duration-200 ${
                      isHighlighted
                        ? 'ring-4 ring-blue-500 bg-blue-400/30 shadow-lg z-20'
                        : isHovered
                        ? 'ring-3 ring-blue-400 bg-blue-300/25 shadow-md z-10'
                        : isSelected
                        ? 'ring-2 ring-green-500 bg-green-400/20 z-10'
                        : 'ring-2 ring-orange-400/70 bg-orange-300/15 hover:ring-orange-500 hover:bg-orange-300/25'
                    }`}
                    style={{
                      left: `${formula.originalPosition.x}px`,
                      top: `${formula.originalPosition.y}px`,
                      width: `${formula.originalPosition.width}px`,
                      height: `${formula.originalPosition.height}px`,
                    }}
                    title={`点击选择公式 · 双击提取`}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onFormulaExtract?.([formula]);
                    }}
                  >
                    {/* 选择框 */}
                    <div 
                      className="absolute -top-1 -left-1 z-10"
                      onClick={(e) => handleFormulaToggle(formula.id, e)}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-green-500 border-green-500 text-white' 
                          : 'bg-white border-gray-400 hover:border-blue-500'
                      }`}>
                        {isSelected && <span className="text-xs">✓</span>}
                      </div>
                    </div>
                    
                    {/* 置信度标签 */}
                    {formula.confidence && formula.confidence > 0 && (
                      <div className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                        formula.confidence >= 70 
                          ? 'bg-green-500 text-white' 
                          : formula.confidence >= 50 
                          ? 'bg-yellow-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {formula.confidence}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* 操作提示 */}
          <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded shadow">
            Ctrl+滚轮缩放 · Alt+拖拽平移 · ←→翻页
          </div>
        </div>

        {/* 公式列表侧边栏 */}
        <div className="w-72 bg-white border-l flex flex-col flex-shrink-0">
          <div className="p-3 border-b bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">当前页公式</span>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                {currentPageFormulas.length} 个
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAllOnPage}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {currentPageFormulas.every(f => selectedFormulas.has(f.id)) && currentPageFormulas.length > 0
                  ? '取消全选'
                  : '全选'}
              </button>
              <button
                onClick={handleExtractAll}
                disabled={currentPageFormulas.length === 0}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-purple-500 text-white hover:bg-purple-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                提取全部
              </button>
            </div>
          </div>
          
          <div ref={formulaListRef} className="flex-1 overflow-y-auto p-2 space-y-2">
            {currentPageFormulas.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-3xl mb-2">📭</div>
                <div className="text-sm">此页未检测到公式</div>
                <div className="text-xs mt-1">可手动框选区域提取</div>
              </div>
            ) : (
              currentPageFormulas.map((formula, index) => (
                <FormulaCard
                  key={formula.id}
                  formula={formula}
                  index={index}
                  isSelected={selectedFormulas.has(formula.id)}
                  isHighlighted={formula.id === selectedFormulaId}
                  isHovered={formula.id === hoveredFormulaId}
                  onToggle={() => handleFormulaToggle(formula.id)}
                  onClick={() => {
                    handleFormulaClick(formula);
                    scrollToFormula(formula);
                  }}
                  onExtract={() => onFormulaExtract?.([formula])}
                  onHover={(hovered) => setHoveredFormulaId(hovered ? formula.id : null)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t shadow-sm">
        {/* 页码导航 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage <= 1}
            className="px-2 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="第一页"
          >
            ⏮
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ◀ 上一页
          </button>
          <div className="flex items-center gap-1 text-sm">
            <span>第</span>
            <input
              type="number"
              value={currentPage}
              onChange={e => {
                const page = parseInt(e.target.value);
                if (page >= 1 && page <= document.pageCount) {
                  setCurrentPage(page);
                }
              }}
              className="w-14 px-2 py-1 border rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={1}
              max={document.pageCount}
            />
            <span>/ {document.pageCount} 页</span>
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(document.pageCount, p + 1))}
            disabled={currentPage >= document.pageCount}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            下一页 ▶
          </button>
          <button
            onClick={() => setCurrentPage(document.pageCount)}
            disabled={currentPage >= document.pageCount}
            className="px-2 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="最后一页"
          >
            ⏭
          </button>
        </div>

        {/* 提取按钮 */}
        <div className="flex items-center gap-3">
          {selectedFormulas.size > 0 && (
            <span className="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
              已选 <span className="font-medium text-blue-600">{selectedFormulas.size}</span> 个公式
            </span>
          )}
          <button
            onClick={handleExtractSelected}
            disabled={selectedFormulas.size === 0}
            className="px-5 py-2 text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
          >
            🚀 提取选中公式
          </button>
        </div>
      </div>
    </div>
  );
};

// 公式卡片组件
interface FormulaCardProps {
  formula: FormulaRegion;
  index: number;
  isSelected: boolean;
  isHighlighted: boolean;
  isHovered: boolean;
  onToggle: () => void;
  onClick: () => void;
  onExtract: () => void;
  onHover: (hovered: boolean) => void;
}

const FormulaCard: React.FC<FormulaCardProps> = ({
  formula,
  index,
  isSelected,
  isHighlighted,
  isHovered,
  onToggle,
  onClick,
  onExtract,
  onHover,
}) => {
  return (
    <div
      data-formula-id={formula.id}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`group relative flex gap-3 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
        isHighlighted
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : isHovered
          ? 'border-blue-400 bg-blue-50/50 shadow'
          : isSelected
          ? 'border-green-500 bg-green-50 shadow'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
      }`}
    >
      {/* 选择框 */}
      <div 
        className="flex-shrink-0 pt-1"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected 
            ? 'bg-green-500 border-green-500 text-white' 
            : 'bg-white border-gray-300 hover:border-blue-500'
        }`}>
          {isSelected && <span className="text-xs">✓</span>}
        </div>
      </div>

      {/* 公式预览图 */}
      <div className="flex-shrink-0">
        <div className="w-16 h-16 rounded-lg border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
          <img
            src={formula.imageData}
            alt={`公式 ${index + 1}`}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>

      {/* 公式信息 */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-700">公式 {index + 1}</span>
            {formula.type && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                formula.type === 'display' 
                  ? 'bg-blue-100 text-blue-700' 
                  : formula.type === 'equation'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {formula.type === 'display' ? '独立' : formula.type === 'equation' ? '编号' : '行内'}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400">
            {Math.round(formula.originalPosition.width)} × {Math.round(formula.originalPosition.height)} px
          </div>
        </div>
        
        {/* 置信度和操作 */}
        <div className="flex items-center justify-between mt-1">
          {formula.confidence && formula.confidence > 0 ? (
            <div className="flex items-center gap-1">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    formula.confidence >= 70 
                      ? 'bg-green-500' 
                      : formula.confidence >= 50 
                      ? 'bg-yellow-500' 
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${formula.confidence}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400">{formula.confidence}%</span>
            </div>
          ) : (
            <div />
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExtract();
            }}
            className="opacity-0 group-hover:opacity-100 px-2 py-1 text-xs font-medium bg-purple-500 text-white rounded hover:bg-purple-600 transition-all"
          >
            提取
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;
