/**
 * 简化版整页公式检测器
 * 专注于用户体验：检测 → 识别 → 复制/导出
 * 移除技术细节，只显示用户关心的内容
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  RecognitionEngine,
  ExportManager,
  type RecognizedFormula,
  type PageData,
  type RecognitionOptions,
  type RecognitionProgress,
  type ExportFormat,
} from '../../utils/wholePageRecognition';
import type { ProviderType } from '../../utils/providers/types';
import { getRecommendedProvider } from '../../utils/providers';

interface SimplifiedWholePageDetectorProps {
  pageData: PageData | null;
  provider?: ProviderType;
  autoStart?: boolean;
  onComplete?: (formulas: RecognizedFormula[]) => void;
}

/**
 * 简化版整页公式检测器组件
 */
export const SimplifiedWholePageDetector: React.FC<SimplifiedWholePageDetectorProps> = ({
  pageData,
  provider,
  autoStart = false,
  onComplete,
}) => {
  // 状态管理
  const [formulas, setFormulas] = useState<RecognizedFormula[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [progress, setProgress] = useState<RecognitionProgress | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // 引擎实例
  const engineRef = useRef<RecognitionEngine | null>(null);
  const exportManagerRef = useRef<ExportManager | null>(null);

  // 初始化
  useEffect(() => {
    engineRef.current = new RecognitionEngine();
    exportManagerRef.current = new ExportManager();

    return () => {
      engineRef.current?.cancel();
    };
  }, []);

  // 自动开始
  useEffect(() => {
    if (autoStart && pageData && !isDetecting && !isRecognizing) {
      handleStartRecognition();
    }
  }, [pageData, autoStart]);

  // 开始识别
  const handleStartRecognition = useCallback(async () => {
    if (!pageData || !engineRef.current) return;

    setIsDetecting(true);
    setIsRecognizing(true);
    setFormulas([]);
    setProgress(null);

    try {
      const selectedProvider = provider || getRecommendedProvider();

      const options: RecognitionOptions = {
        provider: selectedProvider,
        confidenceThreshold: 0.5,
        performanceMode: 'balanced',
        enableCache: true,
        concurrency: 2,
        skipLowConfidence: false,
        maxFormulas: 100,
      };

      const recognized = await engineRef.current.recognizeWholePage(
        pageData,
        options,
        (prog) => {
          setProgress(prog);
        }
      );

      setFormulas(recognized);
      setProgress(null);
      showNotification(`✓ 识别完成！共 ${recognized.length} 个公式`);
      onComplete?.(recognized);
    } catch (error) {
      console.error('Recognition failed:', error);
      showNotification('✗ 识别失败，请重试');
    } finally {
      setIsDetecting(false);
      setIsRecognizing(false);
    }
  }, [pageData, provider, onComplete]);

  // 显示通知
  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // 复制单个公式
  const handleCopyFormula = useCallback(async (formula: RecognizedFormula, format: 'latex' | 'markdown') => {
    try {
      const content = format === 'latex' ? formula.latexContent : formula.markdownContent;
      await navigator.clipboard.writeText(content);
      showNotification(`✓ 已复制 ${format.toUpperCase()}`);
    } catch (error) {
      showNotification('✗ 复制失败');
    }
  }, [showNotification]);

  // 导出所有公式
  const handleExportAll = useCallback((format: ExportFormat) => {
    if (!exportManagerRef.current || formulas.length === 0) return;

    try {
      const manager = exportManagerRef.current;
      let content: string;

      switch (format) {
        case 'latex':
          content = manager.exportAsLatex(formulas, {
            groupByPage: true,
            addComments: true,
            documentTitle: 'Exported Formulas',
          });
          break;
        case 'markdown':
          content = manager.exportAsMarkdown(formulas, {
            groupByPage: true,
            addComments: false,
            documentTitle: 'Exported Formulas',
          });
          break;
        case 'json':
          content = manager.exportAsJson(formulas, {
            includeMetadata: true,
          });
          break;
        case 'text':
          content = manager.exportAsText(formulas);
          break;
        default:
          return;
      }

      const filename = `formulas_page${pageData?.pageNumber || 1}_${Date.now()}`;
      manager.downloadFile(content, filename, format);
      showNotification(`✓ 已导出 ${format.toUpperCase()} 文件`);
    } catch (error) {
      showNotification('✗ 导出失败');
    }
  }, [formulas, pageData, showNotification]);

  // 选择公式
  const handleSelectFormula = useCallback((formulaId: string) => {
    setSelectedFormulaId(formulaId === selectedFormulaId ? null : formulaId);
  }, [selectedFormulaId]);

  // 计算统计信息
  const stats = useMemo(() => {
    if (formulas.length === 0) return null;

    const successful = formulas.filter((f) => f.recognitionSuccess).length;
    const failed = formulas.length - successful;

    return { total: formulas.length, successful, failed };
  }, [formulas]);

  if (!pageData) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📄</div>
        <div style={styles.emptyText}>请上传PDF文档</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 公式覆盖层 */}
      {formulas.length > 0 && (
        <div style={styles.overlay}>
          {formulas.map((formula, index) => (
            <FormulaBox
              key={formula.id}
              formula={formula}
              index={index + 1}
              isSelected={formula.id === selectedFormulaId}
              onClick={() => handleSelectFormula(formula.id)}
              onCopy={handleCopyFormula}
            />
          ))}
        </div>
      )}

      {/* 控制面板 */}
      <div style={styles.controlPanel}>
        {!isRecognizing && formulas.length === 0 && (
          <button onClick={handleStartRecognition} style={styles.primaryButton}>
            🔍 开始识别公式
          </button>
        )}

        {formulas.length > 0 && (
          <div style={styles.exportButtons}>
            <button onClick={() => handleExportAll('latex')} style={styles.exportButton}>
              📄 导出LaTeX
            </button>
            <button onClick={() => handleExportAll('markdown')} style={styles.exportButton}>
              📝 导出Markdown
            </button>
            <button onClick={() => handleExportAll('json')} style={styles.exportButton}>
              💾 导出JSON
            </button>
          </div>
        )}
      </div>

      {/* 进度指示器 */}
      {isRecognizing && progress && (
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress.percentage}%` }} />
          </div>
          <div style={styles.progressText}>
            识别中... {progress.completed}/{progress.total} ({progress.percentage.toFixed(0)}%)
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {stats && !isRecognizing && (
        <div style={styles.statsContainer}>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>总计:</span>
            <span style={styles.statsValue}>{stats.total}</span>
          </div>
          <div style={styles.statsItem}>
            <span style={styles.statsLabel}>成功:</span>
            <span style={{ ...styles.statsValue, color: '#10b981' }}>{stats.successful}</span>
          </div>
          {stats.failed > 0 && (
            <div style={styles.statsItem}>
              <span style={styles.statsLabel}>失败:</span>
              <span style={{ ...styles.statsValue, color: '#ef4444' }}>{stats.failed}</span>
            </div>
          )}
        </div>
      )}

      {/* 通知 */}
      {notification && (
        <div style={styles.notification}>
          {notification}
        </div>
      )}
    </div>
  );
};

/**
 * 公式边界框组件
 */
const FormulaBox: React.FC<{
  formula: RecognizedFormula;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onCopy: (formula: RecognizedFormula, format: 'latex' | 'markdown') => void;
}> = React.memo(({ formula, index, isSelected, onClick, onCopy }) => {
  const { boundingBox, recognitionSuccess } = formula;

  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${boundingBox.x}px`,
    top: `${boundingBox.y}px`,
    width: `${boundingBox.width}px`,
    height: `${boundingBox.height}px`,
    border: isSelected ? '3px solid #3b82f6' : '2px solid #60a5fa',
    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    zIndex: isSelected ? 20 : 10,
  };

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-24px',
    left: '0',
    backgroundColor: recognitionSuccess ? '#3b82f6' : '#ef4444',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={boxStyle} onClick={onClick}>
      <div style={labelStyle}>#{index}</div>

      {/* 操作菜单 */}
      {isSelected && recognitionSuccess && (
        <div style={styles.formulaMenu}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(formula, 'latex');
            }}
            style={styles.menuButton}
          >
            📋 LaTeX
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(formula, 'markdown');
            }}
            style={styles.menuButton}
          >
            📝 Markdown
          </button>
          <div style={styles.formulaPreview}>
            {formula.latexContent.substring(0, 50)}
            {formula.latexContent.length > 50 && '...'}
          </div>
        </div>
      )}
    </div>
  );
});

FormulaBox.displayName = 'FormulaBox';

// 样式定义
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 5,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '16px',
  },
  controlPanel: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    zIndex: 100,
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    transition: 'all 0.2s ease',
  },
  exportButtons: {
    display: 'flex',
    gap: '8px',
  },
  exportButton: {
    padding: '10px 16px',
    backgroundColor: '#fff',
    color: '#374151',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
  },
  progressContainer: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '300px',
    backgroundColor: '#fff',
    padding: '16px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 100,
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '13px',
    color: '#6b7280',
    textAlign: 'center',
  },
  statsContainer: {
    position: 'absolute',
    bottom: '20px',
    left: '20px',
    backgroundColor: '#fff',
    padding: '12px 16px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    gap: '16px',
    zIndex: 100,
  },
  statsItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statsLabel: {
    fontSize: '13px',
    color: '#6b7280',
  },
  statsValue: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151',
  },
  notification: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#fff',
    padding: '16px 24px',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '500',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
  },
  formulaMenu: {
    position: 'absolute',
    top: '100%',
    left: '0',
    marginTop: '8px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    padding: '8px',
    minWidth: '200px',
    zIndex: 30,
    pointerEvents: 'auto',
  },
  menuButton: {
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    marginBottom: '4px',
  },
  formulaPreview: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f9fafb',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#374151',
    wordBreak: 'break-all',
    maxHeight: '60px',
    overflow: 'auto',
  },
};
