/**
 * FormulaOverlay组件
 * 在PDF页面上渲染公式边界框覆盖层
 */

import React, { useState, useCallback } from 'react';
import type { FormulaInstance } from '../../utils/wholePageRecognition/types';

interface FormulaOverlayProps {
  /** 公式实例数组 */
  formulas: FormulaInstance[];
  /** 页面宽度 */
  pageWidth: number;
  /** 页面高度 */
  pageHeight: number;
  /** 选中的公式ID */
  selectedFormulaId?: string;
  /** 公式选择回调 */
  onFormulaSelect?: (formula: FormulaInstance) => void;
  /** 公式悬停回调 */
  onFormulaHover?: (formula: FormulaInstance | null) => void;
}

/**
 * FormulaOverlay组件实现
 */
export const FormulaOverlay: React.FC<FormulaOverlayProps> = ({
  formulas,
  pageWidth,
  pageHeight,
  selectedFormulaId,
  onFormulaSelect,
  onFormulaHover,
}) => {
  const [hoveredFormulaId, setHoveredFormulaId] = useState<string | null>(null);

  // 处理公式点击
  const handleFormulaClick = useCallback(
    (formula: FormulaInstance, event: React.MouseEvent) => {
      event.stopPropagation();
      onFormulaSelect?.(formula);
    },
    [onFormulaSelect]
  );

  // 处理公式悬停
  const handleFormulaMouseEnter = useCallback(
    (formula: FormulaInstance) => {
      setHoveredFormulaId(formula.id);
      onFormulaHover?.(formula);
    },
    [onFormulaHover]
  );

  // 处理公式离开
  const handleFormulaMouseLeave = useCallback(() => {
    setHoveredFormulaId(null);
    onFormulaHover?.(null);
  }, [onFormulaHover]);

  // 获取边界框样式
  const getBoundingBoxStyle = (formula: FormulaInstance): React.CSSProperties => {
    const { boundingBox, confidence } = formula;
    const isSelected = formula.id === selectedFormulaId;
    const isHovered = formula.id === hoveredFormulaId;

    // 根据置信度确定颜色
    let borderColor = 'rgba(59, 130, 246, 0.6)'; // 蓝色 - 高置信度
    if (confidence < 0.75) {
      borderColor = 'rgba(251, 191, 36, 0.6)'; // 黄色 - 中等置信度
    }
    if (confidence < 0.5) {
      borderColor = 'rgba(239, 68, 68, 0.6)'; // 红色 - 低置信度
    }

    // 选中或悬停时的样式
    if (isSelected) {
      borderColor = 'rgba(34, 197, 94, 0.8)'; // 绿色 - 选中
    } else if (isHovered) {
      borderColor = 'rgba(59, 130, 246, 0.8)'; // 深蓝色 - 悬停
    }

    return {
      position: 'absolute',
      left: `${boundingBox.x}px`,
      top: `${boundingBox.y}px`,
      width: `${boundingBox.width}px`,
      height: `${boundingBox.height}px`,
      border: `2px solid ${borderColor}`,
      backgroundColor: isSelected || isHovered ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
      borderRadius: '2px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      transform: `rotate(${boundingBox.rotation}deg)`,
      transformOrigin: 'top left',
      pointerEvents: 'auto',
      zIndex: isSelected ? 20 : isHovered ? 15 : 10,
    };
  };

  // 获取置信度标签样式
  const getConfidenceLabelStyle = (formula: FormulaInstance): React.CSSProperties => {
    const { boundingBox } = formula;
    
    return {
      position: 'absolute',
      left: `${boundingBox.x}px`,
      top: `${boundingBox.y - 20}px`,
      fontSize: '11px',
      fontWeight: '500',
      color: '#fff',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '2px 6px',
      borderRadius: '3px',
      pointerEvents: 'none',
      zIndex: 25,
      whiteSpace: 'nowrap',
    };
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {formulas.map((formula) => {
        const isSelected = formula.id === selectedFormulaId;
        const isHovered = formula.id === hoveredFormulaId;
        const showLabel = isSelected || isHovered;

        return (
          <React.Fragment key={formula.id}>
            {/* 边界框 */}
            <div
              style={getBoundingBoxStyle(formula)}
              onClick={(e) => handleFormulaClick(formula, e)}
              onMouseEnter={() => handleFormulaMouseEnter(formula)}
              onMouseLeave={handleFormulaMouseLeave}
              title={`Confidence: ${(formula.confidence * 100).toFixed(1)}%`}
            />
            
            {/* 置信度标签 */}
            {showLabel && (
              <div style={getConfidenceLabelStyle(formula)}>
                {`${(formula.confidence * 100).toFixed(1)}% - ${formula.type}`}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
