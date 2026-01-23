/**
 * 优化的FormulaOverlay组件
 * 使用React.memo和虚拟化技术优化大量公式的渲染性能
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { FormulaInstance } from '../../utils/wholePageRecognition/types';

interface FormulaOverlayProps {
  formulas: FormulaInstance[];
  pageWidth: number;
  pageHeight: number;
  selectedFormulaId?: string;
  onFormulaSelect?: (formula: FormulaInstance) => void;
  onFormulaHover?: (formula: FormulaInstance | null) => void;
  /** 视口区域（用于虚拟滚动） */
  viewport?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 单个公式边界框组件（使用React.memo优化）
 */
const FormulaBoundingBox = React.memo<{
  formula: FormulaInstance;
  isSelected: boolean;
  isHovered: boolean;
  onClick: (formula: FormulaInstance, event: React.MouseEvent) => void;
  onMouseEnter: (formula: FormulaInstance) => void;
  onMouseLeave: () => void;
}>(({ formula, isSelected, isHovered, onClick, onMouseEnter, onMouseLeave }) => {
  const { boundingBox, confidence } = formula;

  // 根据置信度确定颜色
  const borderColor = useMemo(() => {
    if (isSelected) return 'rgba(34, 197, 94, 0.8)'; // 绿色 - 选中
    if (isHovered) return 'rgba(59, 130, 246, 0.8)'; // 深蓝色 - 悬停
    if (confidence >= 0.75) return 'rgba(59, 130, 246, 0.6)'; // 蓝色 - 高置信度
    if (confidence >= 0.5) return 'rgba(251, 191, 36, 0.6)'; // 黄色 - 中等置信度
    return 'rgba(239, 68, 68, 0.6)'; // 红色 - 低置信度
  }, [confidence, isSelected, isHovered]);

  const style: React.CSSProperties = useMemo(
    () => ({
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
      willChange: isSelected || isHovered ? 'transform, border-color' : 'auto',
    }),
    [boundingBox, borderColor, isSelected, isHovered]
  );

  return (
    <div
      style={style}
      onClick={(e) => onClick(formula, e)}
      onMouseEnter={() => onMouseEnter(formula)}
      onMouseLeave={onMouseLeave}
      title={`Confidence: ${(confidence * 100).toFixed(1)}%`}
    />
  );
});

FormulaBoundingBox.displayName = 'FormulaBoundingBox';

/**
 * 置信度标签组件（使用React.memo优化）
 */
const ConfidenceLabel = React.memo<{
  formula: FormulaInstance;
}>(({ formula }) => {
  const { boundingBox, confidence, type } = formula;

  const style: React.CSSProperties = useMemo(
    () => ({
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
    }),
    [boundingBox]
  );

  return (
    <div style={style}>
      {`${(confidence * 100).toFixed(1)}% - ${type}`}
    </div>
  );
});

ConfidenceLabel.displayName = 'ConfidenceLabel';

/**
 * 优化的FormulaOverlay组件
 */
export const OptimizedFormulaOverlay = React.memo<FormulaOverlayProps>(
  ({
    formulas,
    pageWidth,
    pageHeight,
    selectedFormulaId,
    onFormulaSelect,
    onFormulaHover,
    viewport,
  }) => {
    const [hoveredFormulaId, setHoveredFormulaId] = useState<string | null>(null);

    // 虚拟化：只渲染视口内的公式
    const visibleFormulas = useMemo(() => {
      if (!viewport) return formulas;

      const buffer = 100; // 缓冲区（像素）
      return formulas.filter((formula) => {
        const { boundingBox } = formula;
        return (
          boundingBox.x + boundingBox.width >= viewport.x - buffer &&
          boundingBox.x <= viewport.x + viewport.width + buffer &&
          boundingBox.y + boundingBox.height >= viewport.y - buffer &&
          boundingBox.y <= viewport.y + viewport.height + buffer
        );
      });
    }, [formulas, viewport]);

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
        {visibleFormulas.map((formula) => {
          const isSelected = formula.id === selectedFormulaId;
          const isHovered = formula.id === hoveredFormulaId;
          const showLabel = isSelected || isHovered;

          return (
            <React.Fragment key={formula.id}>
              <FormulaBoundingBox
                formula={formula}
                isSelected={isSelected}
                isHovered={isHovered}
                onClick={handleFormulaClick}
                onMouseEnter={handleFormulaMouseEnter}
                onMouseLeave={handleFormulaMouseLeave}
              />
              {showLabel && <ConfidenceLabel formula={formula} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);

OptimizedFormulaOverlay.displayName = 'OptimizedFormulaOverlay';
