/**
 * WholePageFormulaDetector组件
 * 整页公式检测的主应用组件
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  WholePageProcessor,
  OperationManager,
  type FormulaInstance,
  type PageData,
  type ProcessingOptions,
} from '../../utils/wholePageRecognition';
import {
  FormulaOverlay,
  OperationMenu,
  ProgressIndicator,
  NotificationSystem,
  useNotifications,
} from './index';

interface WholePageFormulaDetectorProps {
  /** PDF页面数据 */
  pageData: PageData | null;
  /** 处理选项 */
  options?: Partial<ProcessingOptions>;
  /** 是否自动检测 */
  autoDetect?: boolean;
  /** 检测完成回调 */
  onDetectionComplete?: (formulas: FormulaInstance[]) => void;
}

/**
 * WholePageFormulaDetector组件实现
 */
export const WholePageFormulaDetector: React.FC<WholePageFormulaDetectorProps> = ({
  pageData,
  options,
  autoDetect = false,
  onDetectionComplete,
}) => {
  // 状态管理
  const [formulas, setFormulas] = useState<FormulaInstance[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<FormulaInstance | null>(null);
  const [hoveredFormula, setHoveredFormula] = useState<FormulaInstance | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // 通知系统
  const { notifications, removeNotification, showSuccess, showError, showWarning } =
    useNotifications();

  // 处理器实例
  const processorRef = useRef<WholePageProcessor | null>(null);
  const operationManagerRef = useRef<OperationManager | null>(null);

  // 初始化处理器
  useEffect(() => {
    processorRef.current = new WholePageProcessor();
    operationManagerRef.current = new OperationManager();

    return () => {
      processorRef.current?.cancelProcessing();
    };
  }, []);

  // 自动检测
  useEffect(() => {
    if (autoDetect && pageData && !isProcessing) {
      handleDetect();
    }
  }, [pageData, autoDetect]);

  // 进度更新
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      if (processorRef.current) {
        const currentProgress = processorRef.current.getProgress();
        setProgress(currentProgress);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isProcessing]);

  // 处理检测
  const handleDetect = useCallback(async () => {
    if (!pageData || isProcessing) return;

    setIsProcessing(true);
    setProgress(0);
    setFormulas([]);
    setSelectedFormula(null);

    try {
      const processor = processorRef.current;
      if (!processor) throw new Error('Processor not initialized');

      const detectedFormulas = await processor.processWholePage(pageData, options);
      
      setFormulas(detectedFormulas);
      setProgress(100);
      
      showSuccess(
        `Detected ${detectedFormulas.length} formula${detectedFormulas.length !== 1 ? 's' : ''}`
      );
      
      onDetectionComplete?.(detectedFormulas);
    } catch (error) {
      console.error('Detection failed:', error);
      showError('Formula detection failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [pageData, options, isProcessing, showSuccess, showError, onDetectionComplete]);

  // 处理公式选择
  const handleFormulaSelect = useCallback((formula: FormulaInstance) => {
    setSelectedFormula(formula);
    
    // 计算菜单位置（公式右下角）
    const menuX = formula.boundingBox.x + formula.boundingBox.width + 10;
    const menuY = formula.boundingBox.y + formula.boundingBox.height;
    
    setMenuPosition({ x: menuX, y: menuY });
  }, []);

  // 处理公式悬停
  const handleFormulaHover = useCallback((formula: FormulaInstance | null) => {
    setHoveredFormula(formula);
  }, []);

  // 处理复制LaTeX
  const handleCopyLatex = useCallback(
    async (formula: FormulaInstance) => {
      const manager = operationManagerRef.current;
      if (!manager) return;

      const success = await manager.copyAsLatex(formula);
      if (success) {
        showSuccess('LaTeX copied to clipboard');
      } else {
        showError('Failed to copy LaTeX');
      }
    },
    [showSuccess, showError]
  );

  // 处理复制Markdown
  const handleCopyMarkdown = useCallback(
    async (formula: FormulaInstance) => {
      const manager = operationManagerRef.current;
      if (!manager) return;

      const success = await manager.copyAsMarkdown(formula);
      if (success) {
        showSuccess('Markdown copied to clipboard');
      } else {
        showError('Failed to copy Markdown');
      }
    },
    [showSuccess, showError]
  );

  // 处理编辑
  const handleEdit = useCallback(
    async (formula: FormulaInstance) => {
      const newContent = prompt('Edit formula:', formula.latexContent || '');
      if (!newContent) return;

      const manager = operationManagerRef.current;
      if (!manager) return;

      try {
        const updatedFormula = await manager.editFormula(formula, newContent);
        
        // 更新公式列表
        setFormulas((prev) =>
          prev.map((f) => (f.id === formula.id ? updatedFormula : f))
        );
        
        showSuccess('Formula updated');
      } catch (error) {
        console.error('Edit failed:', error);
        showError('Failed to edit formula');
      }
    },
    [showSuccess, showError]
  );

  // 关闭菜单
  const handleCloseMenu = useCallback(() => {
    setMenuPosition(null);
    setSelectedFormula(null);
  }, []);

  // 点击背景关闭菜单
  const handleBackgroundClick = useCallback(() => {
    if (menuPosition) {
      handleCloseMenu();
    }
  }, [menuPosition, handleCloseMenu]);

  if (!pageData) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#6b7280',
          fontSize: '14px',
        }}
      >
        No page data available
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
      onClick={handleBackgroundClick}
    >
      {/* 公式覆盖层 */}
      {formulas.length > 0 && (
        <FormulaOverlay
          formulas={formulas}
          pageWidth={pageData.width}
          pageHeight={pageData.height}
          selectedFormulaId={selectedFormula?.id}
          onFormulaSelect={handleFormulaSelect}
          onFormulaHover={handleFormulaHover}
        />
      )}

      {/* 操作菜单 */}
      {menuPosition && selectedFormula && (
        <OperationMenu
          formula={selectedFormula}
          position={menuPosition}
          onCopyLatex={handleCopyLatex}
          onCopyMarkdown={handleCopyMarkdown}
          onEdit={handleEdit}
          onClose={handleCloseMenu}
        />
      )}

      {/* 进度指示器 */}
      <ProgressIndicator
        progress={progress}
        visible={isProcessing}
        message={
          progress < 30
            ? 'Preprocessing...'
            : progress < 70
            ? 'Detecting formulas...'
            : 'Finalizing...'
        }
      />

      {/* 通知系统 */}
      <NotificationSystem
        notifications={notifications}
        onRemove={removeNotification}
      />

      {/* 控制面板 */}
      {!autoDetect && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 100,
          }}
        >
          <button
            onClick={handleDetect}
            disabled={isProcessing}
            style={{
              padding: '10px 20px',
              backgroundColor: isProcessing ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            {isProcessing ? 'Detecting...' : 'Detect Formulas'}
          </button>
        </div>
      )}

      {/* 统计信息 */}
      {formulas.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '12px 16px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            fontSize: '13px',
            color: '#374151',
            zIndex: 100,
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            {formulas.length} formula{formulas.length !== 1 ? 's' : ''} detected
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            Avg confidence:{' '}
            {(
              formulas.reduce((sum, f) => sum + f.confidence, 0) / formulas.length *
              100
            ).toFixed(1)}
            %
          </div>
        </div>
      )}
    </div>
  );
};
