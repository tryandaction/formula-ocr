import React, { useState, useCallback, useEffect } from 'react';
import {
  detectMultipleFormulas,
  type DetectedFormula,
  type DetectionResult,
} from '../utils/formulaDetection';

interface MultiFormulaDetectorProps {
  imageBase64: string;
  onFormulasDetected?: (formulas: DetectedFormula[]) => void;
  onCancel?: () => void;
}

export const MultiFormulaDetector: React.FC<MultiFormulaDetectorProps> = ({
  imageBase64,
  onFormulasDetected,
  onCancel,
}) => {
  const [detecting, setDetecting] = useState(true);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // 检测公式
  useEffect(() => {
    let cancelled = false;

    setDetecting(true);
    setError(null);

    detectMultipleFormulas(imageBase64)
      .then((res) => {
        if (!cancelled) {
          setResult(res);
          // 默认全选
          setSelectedIds(new Set(res.formulas.map((f) => f.id)));
          setDetecting(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || '检测失败');
          setDetecting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageBase64]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!result) return;
    if (selectedIds.size === result.formulas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(result.formulas.map((f) => f.id)));
    }
  }, [result, selectedIds]);

  const handleConfirm = useCallback(() => {
    if (!result) return;
    const selected = result.formulas.filter((f) => selectedIds.has(f.id));
    onFormulasDetected?.(selected);
  }, [result, selectedIds, onFormulasDetected]);

  if (detecting) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-500 border-t-transparent mb-4" />
        <p className="text-gray-600">正在检测公式区域...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">❌</div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          返回
        </button>
      </div>
    );
  }

  if (!result || result.formulas.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-gray-600 mb-4">未检测到公式区域</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-800">检测到 {result.formulas.length} 个公式区域</h3>
          <p className="text-sm text-gray-500">选择要识别的公式</p>
        </div>
        <button
          onClick={handleSelectAll}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {selectedIds.size === result.formulas.length ? '取消全选' : '全选'}
        </button>
      </div>

      {/* 原图预览 */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
        <img
          src={imageBase64}
          alt="Original"
          className="w-full"
          style={{ maxHeight: '300px', objectFit: 'contain' }}
        />
        {/* 高亮检测区域 */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${result.originalWidth} ${result.originalHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {result.formulas.map((formula, index) => (
            <g key={formula.id}>
              <rect
                x={formula.bounds.x}
                y={formula.bounds.y}
                width={formula.bounds.width}
                height={formula.bounds.height}
                fill={selectedIds.has(formula.id) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(156, 163, 175, 0.1)'}
                stroke={selectedIds.has(formula.id) ? '#3b82f6' : '#9ca3af'}
                strokeWidth="2"
                strokeDasharray={selectedIds.has(formula.id) ? 'none' : '4'}
              />
              <text
                x={formula.bounds.x + 5}
                y={formula.bounds.y + 16}
                fill={selectedIds.has(formula.id) ? '#3b82f6' : '#6b7280'}
                fontSize="14"
                fontWeight="bold"
              >
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* 公式列表 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {result.formulas.map((formula, index) => (
          <div
            key={formula.id}
            onClick={() => handleToggleSelect(formula.id)}
            className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
              selectedIds.has(formula.id)
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* 编号 */}
            <div
              className={`absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                selectedIds.has(formula.id)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {index + 1}
            </div>

            {/* 选中标记 */}
            <div className="absolute top-1 right-1">
              <input
                type="checkbox"
                checked={selectedIds.has(formula.id)}
                onChange={() => handleToggleSelect(formula.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* 公式图片 */}
            <img
              src={formula.imageData}
              alt={`Formula ${index + 1}`}
              className="w-full h-20 object-contain bg-white p-2"
            />

            {/* 置信度 */}
            <div className="px-2 py-1 bg-gray-50 text-xs text-gray-500 text-center">
              置信度: {Math.round(formula.confidence * 100)}%
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedIds.size === 0}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          识别选中 ({selectedIds.size})
        </button>
      </div>
    </div>
  );
};

export default MultiFormulaDetector;
