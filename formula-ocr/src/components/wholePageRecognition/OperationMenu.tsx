/**
 * OperationMenu组件
 * 显示公式操作菜单（复制LaTeX、复制Markdown、编辑）
 */

import React, { useState, useCallback } from 'react';
import type { FormulaInstance } from '../../utils/wholePageRecognition/types';

interface OperationMenuProps {
  /** 选中的公式 */
  formula: FormulaInstance | null;
  /** 菜单位置 */
  position: { x: number; y: number };
  /** 复制LaTeX回调 */
  onCopyLatex?: (formula: FormulaInstance) => Promise<void>;
  /** 复制Markdown回调 */
  onCopyMarkdown?: (formula: FormulaInstance) => Promise<void>;
  /** 编辑回调 */
  onEdit?: (formula: FormulaInstance) => void;
  /** 关闭菜单回调 */
  onClose?: () => void;
}

/**
 * OperationMenu组件实现
 */
export const OperationMenu: React.FC<OperationMenuProps> = ({
  formula,
  position,
  onCopyLatex,
  onCopyMarkdown,
  onEdit,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 处理复制LaTeX
  const handleCopyLatex = useCallback(async () => {
    if (!formula || isProcessing) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      await onCopyLatex?.(formula);
      setFeedback('✓ LaTeX copied');
      setTimeout(() => {
        setFeedback(null);
        onClose?.();
      }, 1500);
    } catch (error) {
      setFeedback('✗ Copy failed');
      setTimeout(() => setFeedback(null), 2000);
    } finally {
      setIsProcessing(false);
    }
  }, [formula, isProcessing, onCopyLatex, onClose]);

  // 处理复制Markdown
  const handleCopyMarkdown = useCallback(async () => {
    if (!formula || isProcessing) return;

    setIsProcessing(true);
    setFeedback(null);

    try {
      await onCopyMarkdown?.(formula);
      setFeedback('✓ Markdown copied');
      setTimeout(() => {
        setFeedback(null);
        onClose?.();
      }, 1500);
    } catch (error) {
      setFeedback('✗ Copy failed');
      setTimeout(() => setFeedback(null), 2000);
    } finally {
      setIsProcessing(false);
    }
  }, [formula, isProcessing, onCopyMarkdown, onClose]);

  // 处理编辑
  const handleEdit = useCallback(() => {
    if (!formula || isProcessing) return;
    onEdit?.(formula);
    onClose?.();
  }, [formula, isProcessing, onEdit, onClose]);

  if (!formula) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '8px',
        zIndex: 1000,
        minWidth: '180px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 公式信息 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '4px',
        }}
      >
        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
          Formula #{formula.id.slice(0, 8)}
        </div>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          Confidence: {(formula.confidence * 100).toFixed(1)}%
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          onClick={handleCopyLatex}
          disabled={isProcessing}
          style={{
            padding: '8px 12px',
            border: 'none',
            backgroundColor: 'transparent',
            textAlign: 'left',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#374151',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          📋 Copy as LaTeX
        </button>

        <button
          onClick={handleCopyMarkdown}
          disabled={isProcessing}
          style={{
            padding: '8px 12px',
            border: 'none',
            backgroundColor: 'transparent',
            textAlign: 'left',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#374151',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          📝 Copy as Markdown
        </button>

        <button
          onClick={handleEdit}
          disabled={isProcessing}
          style={{
            padding: '8px 12px',
            border: 'none',
            backgroundColor: 'transparent',
            textAlign: 'left',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#374151',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ✏️ Edit Formula
        </button>
      </div>

      {/* 反馈消息 */}
      {feedback && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 12px',
            backgroundColor: feedback.startsWith('✓') ? '#d1fae5' : '#fee2e2',
            color: feedback.startsWith('✓') ? '#065f46' : '#991b1b',
            borderRadius: '4px',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          {feedback}
        </div>
      )}
    </div>
  );
};
