/**
 * PDFFormulaViewer 主组件
 * 整合虚拟滚动容器、公式高亮、侧边面板，实现 PDF 公式识别功能
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { VirtualScrollContainer } from './VirtualScrollContainer';
import { FormulaHighlighter, type FormulaStatus } from './FormulaHighlighter';
import { FormulaPanel } from './FormulaPanel';
import { FormulaCodeEditor } from './FormulaCodeEditor';
import { PageIndicator } from './PageIndicator';
import type { ParsedDocument, FormulaRegion } from '../../utils/documentParser';
import { recognizeFormula, recognizeFormulas } from '../../utils/formulaOCR';
import {
  saveState,
  loadState,
  clearState,
  generateDocumentId,
  serializeRecognizedFormulas,
  deserializeRecognizedFormulas,
  type PDFViewerState,
} from '../../utils/stateCacheService';

interface RecognizedFormula {
  id: string;
  latex: string;
  markdown?: string;
  status: FormulaStatus;
  error?: string;
}

interface PDFFormulaViewerProps {
  document: ParsedDocument | null;
  onClose?: () => void;
  onFormulasExtracted?: (formulas: FormulaRegion[]) => void;
}

// 缩放范围
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

// 响应式断点
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

// 自定义 Hook: 监听窗口尺寸
function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return size;
}

export const PDFFormulaViewer: React.FC<PDFFormulaViewerProps> = ({
  document,
  onClose,
  onFormulasExtracted: _onFormulasExtracted,
}) => {
  // 响应式状态
  const windowSize = useWindowSize();
  const isMobile = windowSize.width < MOBILE_BREAKPOINT;
  const isTablet = windowSize.width >= MOBILE_BREAKPOINT && windowSize.width < TABLET_BREAKPOINT;
  
  // 状态
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [hoveredFormulaId, setHoveredFormulaId] = useState<string | null>(null);
  const [recognizedFormulas, setRecognizedFormulas] = useState<Map<string, RecognizedFormula>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(isMobile || isTablet);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const documentIdRef = useRef<string | null>(null);

  // 响应式：窗口尺寸变化时自动折叠面板
  useEffect(() => {
    if (isMobile || isTablet) {
      setIsPanelCollapsed(true);
    }
  }, [isMobile, isTablet]);

  // 生成文档 ID
  useEffect(() => {
    if (document) {
      // 使用文件名和页数生成简单的 ID
      documentIdRef.current = generateDocumentId(document.fileName, document.pageCount * 1000);
      
      // 尝试恢复缓存状态
      const cachedState = loadState(documentIdRef.current);
      if (cachedState) {
        setCurrentPage(cachedState.currentPage);
        setZoom(cachedState.zoom);
        setScrollPosition(cachedState.scrollPosition);
        setRecognizedFormulas(deserializeRecognizedFormulas(cachedState.recognizedFormulas));
      }
    }
  }, [document]);

  // 保存状态（防抖）
  const saveStateDebounced = useCallback(() => {
    if (!document || !documentIdRef.current) return;

    const state: PDFViewerState = {
      documentId: documentIdRef.current,
      currentPage,
      zoom,
      scrollPosition,
      recognizedFormulas: serializeRecognizedFormulas(
        document.formulas,
        recognizedFormulas as Map<string, { latex: string; markdown?: string; status: string; error?: string }>
      ),
      timestamp: Date.now(),
    };

    saveState(state, document.fileName);
  }, [document, currentPage, zoom, scrollPosition, recognizedFormulas]);

  // 状态变化时保存
  useEffect(() => {
    const timer = setTimeout(saveStateDebounced, 1000);
    return () => clearTimeout(timer);
  }, [saveStateDebounced]);

  // 获取公式状态 Map
  const formulaStatuses = new Map<string, FormulaStatus>();
  recognizedFormulas.forEach((value, key) => {
    formulaStatuses.set(key, value.status);
  });

  // 处理页面变化
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // 处理滚动
  const handleScroll = useCallback((scrollTop: number) => {
    setScrollPosition(scrollTop);
  }, []);

  // 处理缩放
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta));
      return Math.round(newZoom * 100) / 100;
    });
  }, []);

  // 处理滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      handleZoom(delta);
    }
  }, [handleZoom]);

  // 处理公式点击
  const handleFormulaClick = useCallback((formula: FormulaRegion) => {
    setSelectedFormulaId(formula.id);
    setShowEditor(true);

    // 如果未识别，自动开始识别
    const recognized = recognizedFormulas.get(formula.id);
    if (!recognized || recognized.status === 'pending') {
      handleRecognize(formula);
    }
  }, [recognizedFormulas]);

  // 处理公式悬停
  const handleFormulaHover = useCallback((formulaId: string | null) => {
    setHoveredFormulaId(formulaId);
  }, []);

  // 识别单个公式
  const handleRecognize = useCallback(async (formula: FormulaRegion) => {
    // 设置为处理中
    setRecognizedFormulas(prev => {
      const next = new Map(prev);
      next.set(formula.id, {
        id: formula.id,
        latex: '',
        status: 'processing',
      });
      return next;
    });

    try {
      const result = await recognizeFormula(formula);
      
      setRecognizedFormulas(prev => {
        const next = new Map(prev);
        next.set(formula.id, {
          id: formula.id,
          latex: result.latex,
          markdown: result.markdown,
          status: result.success ? 'done' : 'error',
          error: result.error,
        });
        return next;
      });
    } catch (error) {
      setRecognizedFormulas(prev => {
        const next = new Map(prev);
        next.set(formula.id, {
          id: formula.id,
          latex: '',
          status: 'error',
          error: error instanceof Error ? error.message : '识别失败',
        });
        return next;
      });
    }
  }, []);

  // 批量识别当前页公式
  const handleRecognizeAll = useCallback(async () => {
    if (!document) return;

    const pageFormulas = document.formulas.filter(f => f.pageNumber === currentPage + 1);
    const pendingFormulas = pageFormulas.filter(f => {
      const recognized = recognizedFormulas.get(f.id);
      return !recognized || recognized.status === 'pending' || recognized.status === 'error';
    });

    if (pendingFormulas.length === 0) return;

    // 设置所有为处理中
    setRecognizedFormulas(prev => {
      const next = new Map(prev);
      pendingFormulas.forEach(f => {
        next.set(f.id, {
          id: f.id,
          latex: '',
          status: 'processing',
        });
      });
      return next;
    });

    // 批量识别
    await recognizeFormulas(pendingFormulas, (_completed, _total, result) => {
      setRecognizedFormulas(prev => {
        const next = new Map(prev);
        next.set(result.id, {
          id: result.id,
          latex: result.latex,
          markdown: result.markdown,
          status: result.success ? 'done' : 'error',
          error: result.error,
        });
        return next;
      });
    });
  }, [document, currentPage, recognizedFormulas]);

  // 处理代码变化
  const handleCodeChange = useCallback((formulaId: string, code: string) => {
    setRecognizedFormulas(prev => {
      const next = new Map(prev);
      const existing = next.get(formulaId);
      if (existing) {
        next.set(formulaId, {
          ...existing,
          latex: code,
          markdown: `$$${code}$$`,
        });
      }
      return next;
    });
  }, []);

  // 处理复制
  const handleCopy = useCallback((code: string, format: 'latex' | 'markdown') => {
    navigator.clipboard.writeText(code).then(() => {
      setCopyMessage(`已复制 ${format.toUpperCase()}`);
      setTimeout(() => setCopyMessage(null), 2000);
    });
  }, []);

  // 处理关闭
  const handleClose = useCallback(() => {
    if (documentIdRef.current) {
      clearState(documentIdRef.current);
    }
    onClose?.();
  }, [onClose]);

  // 处理全屏切换
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
    setIsPanelCollapsed(prev => !prev ? true : prev);
  }, []);

  // 处理键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 缩放快捷键
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoom(ZOOM_STEP);
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoom(-ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        setZoom(1.0);
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else if (showEditor) {
          setShowEditor(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoom, isFullscreen, showEditor]);

  // 渲染页面覆盖层（公式高亮）
  const renderPageOverlay = useCallback((pageIndex: number) => {
    if (!document) return null;

    return (
      <FormulaHighlighter
        formulas={document.formulas}
        pageIndex={pageIndex}
        selectedId={selectedFormulaId}
        hoveredId={hoveredFormulaId}
        formulaStatuses={formulaStatuses}
        onFormulaClick={handleFormulaClick}
        onFormulaHover={handleFormulaHover}
        zoom={zoom}
      />
    );
  }, [document, selectedFormulaId, hoveredFormulaId, formulaStatuses, handleFormulaClick, handleFormulaHover, zoom]);

  // 获取选中的公式
  const selectedFormula = document?.formulas.find(f => f.id === selectedFormulaId) || null;
  const selectedRecognized = selectedFormulaId ? recognizedFormulas.get(selectedFormulaId) || null : null;

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <p>请上传 PDF 文档</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col bg-gray-100 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
      onWheel={handleWheel}
    >
      {/* 工具栏 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-2 sm:px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* 文件名 */}
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <span className="font-medium text-gray-700 truncate max-w-[100px] sm:max-w-[200px]">
              {document.fileName}
            </span>
          </div>

          {/* 页码指示器 */}
          <PageIndicator
            currentPage={currentPage}
            totalPages={document.pageCount}
            onPageChange={setCurrentPage}
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* 缩放控制 - 桌面端显示 */}
          <div className="hidden sm:flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
            <button
              onClick={() => handleZoom(-ZOOM_STEP)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="缩小"
            >
              <span className="text-gray-600">−</span>
            </button>
            <span className="text-sm text-gray-600 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => handleZoom(ZOOM_STEP)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="放大"
            >
              <span className="text-gray-600">+</span>
            </button>
          </div>

          {/* 移动端：公式面板按钮 */}
          {isMobile && (
            <button
              onClick={() => setShowMobilePanel(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
              title="公式列表"
            >
              <span>📋</span>
              {document.formulas.filter(f => f.pageNumber === currentPage + 1).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                  {document.formulas.filter(f => f.pageNumber === currentPage + 1).length}
                </span>
              )}
            </button>
          )}

          {/* 全屏按钮 */}
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            <span>{isFullscreen ? '⛶' : '⛶'}</span>
          </button>

          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            title="关闭"
          >
            <span>✕</span>
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex min-h-0 relative">
        {/* PDF 阅读区 */}
        <div className="flex-1 min-w-0">
          <VirtualScrollContainer
            pageCount={document.pageCount}
            pageImages={document.pageImages}
            pageDimensions={document.pageDimensions}
            zoom={zoom}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onScroll={handleScroll}
            renderOverlay={renderPageOverlay}
            className="bg-gray-200"
          />
        </div>

        {/* 侧边面板 - 桌面端和平板端 */}
        {!isFullscreen && !isMobile && (
          <FormulaPanel
            formulas={document.formulas}
            currentPage={currentPage}
            selectedId={selectedFormulaId}
            hoveredId={hoveredFormulaId}
            recognizedFormulas={recognizedFormulas}
            onFormulaSelect={handleFormulaClick}
            onFormulaHover={handleFormulaHover}
            onRecognize={handleRecognize}
            onRecognizeAll={handleRecognizeAll}
            onCopy={handleCopy}
            isCollapsed={isPanelCollapsed}
            onToggleCollapse={() => setIsPanelCollapsed(prev => !prev)}
          />
        )}

        {/* 代码编辑器（浮动面板）- 非移动端 */}
        {!isMobile && showEditor && selectedFormula && (
          <div className={`absolute ${isPanelCollapsed ? 'right-16' : 'right-80'} top-4 bottom-4 w-80 bg-white shadow-xl rounded-lg border border-gray-200 overflow-hidden z-10`}>
            <FormulaCodeEditor
              formula={selectedFormula}
              recognized={selectedRecognized}
              onCodeChange={handleCodeChange}
              onCopy={handleCopy}
              onReRecognize={handleRecognize}
              onClose={() => setShowEditor(false)}
            />
          </div>
        )}
      </div>

      {/* 移动端底部抽屉 */}
      {isMobile && showMobilePanel && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* 遮罩 */}
          <div 
            className="flex-1 bg-black/50"
            onClick={() => setShowMobilePanel(false)}
          />
          
          {/* 抽屉内容 */}
          <div className="bg-white rounded-t-2xl max-h-[70vh] flex flex-col animate-slide-up">
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">公式列表 (第 {currentPage + 1} 页)</h3>
              <button
                onClick={() => setShowMobilePanel(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <span>✕</span>
              </button>
            </div>
            
            {/* 批量识别按钮 */}
            {document.formulas.filter(f => f.pageNumber === currentPage + 1).length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100">
                <button
                  onClick={() => {
                    handleRecognizeAll();
                  }}
                  className="w-full py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>✨</span>
                  提取全部公式
                </button>
              </div>
            )}
            
            {/* 公式列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {document.formulas.filter(f => f.pageNumber === currentPage + 1).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📭</div>
                  <p>此页未检测到公式</p>
                </div>
              ) : (
                document.formulas
                  .filter(f => f.pageNumber === currentPage + 1)
                  .map((formula, index) => {
                    const recognized = recognizedFormulas.get(formula.id);
                    const isSelected = formula.id === selectedFormulaId;
                    
                    return (
                      <div
                        key={formula.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-green-500 bg-green-50' 
                            : 'border-gray-200 bg-white'
                        }`}
                        onClick={() => {
                          handleFormulaClick(formula);
                          setShowMobilePanel(false);
                        }}
                      >
                        {/* 公式缩略图 */}
                        <div className="mb-2 bg-gray-50 rounded overflow-hidden">
                          <img
                            src={formula.imageData}
                            alt={`公式 ${index + 1}`}
                            className="w-full h-auto max-h-20 object-contain"
                          />
                        </div>
                        
                        {/* 公式信息 */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            公式 {currentPage + 1}-{index + 1}
                          </span>
                          {recognized?.status === 'done' && (
                            <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                              已识别
                            </span>
                          )}
                          {recognized?.status === 'processing' && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                              识别中...
                            </span>
                          )}
                        </div>
                        
                        {/* 识别结果 */}
                        {recognized?.status === 'done' && recognized.latex && (
                          <div className="mt-2 bg-gray-900 text-gray-100 p-2 rounded text-xs font-mono overflow-x-auto">
                            {recognized.latex}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 复制成功提示 */}
      {copyMessage && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-50">
          {copyMessage}
        </div>
      )}
    </div>
  );
};

export default PDFFormulaViewer;
