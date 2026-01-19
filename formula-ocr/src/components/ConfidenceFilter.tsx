/**
 * Confidence Filter Component
 * Allows users to filter formulas by confidence threshold
 */

import React, { useState, useCallback } from 'react';

export interface ConfidenceFilterProps {
  /** Current threshold value (0-1) */
  threshold: number;
  /** Callback when threshold changes */
  onThresholdChange: (threshold: number) => void;
  /** Total number of formulas */
  totalCount: number;
  /** Number of formulas after filtering */
  filteredCount: number;
  /** Show detailed stats */
  showStats?: boolean;
}

export const ConfidenceFilter: React.FC<ConfidenceFilterProps> = ({
  threshold,
  onThresholdChange,
  totalCount,
  filteredCount,
  showStats = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onThresholdChange(value);
  }, [onThresholdChange]);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate percentage
  const percentage = Math.round(threshold * 100);
  
  // Get color based on threshold
  const getColor = () => {
    if (threshold < 0.6) return 'text-red-600 bg-red-100';
    if (threshold < 0.85) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getSliderColor = () => {
    if (threshold < 0.6) return 'accent-red-500';
    if (threshold < 0.85) return 'accent-yellow-500';
    return 'accent-green-500';
  };

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h4 className="font-semibold text-gray-800 text-sm">置信度过滤</h4>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${getColor()}`}>
          {percentage}%
        </div>
      </div>

      {/* Slider */}
      <div className="mb-3">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={threshold}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
          className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${getSliderColor()} ${
            isDragging ? 'scale-105' : ''
          } transition-transform`}
          style={{
            background: `linear-gradient(to right, 
              rgb(239 68 68) 0%, 
              rgb(234 179 8) 60%, 
              rgb(34 197 94) 85%, 
              rgb(34 197 94) 100%)`,
          }}
        />
        
        {/* Threshold labels */}
        <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
          <span>0%</span>
          <span className="text-red-500">低</span>
          <span className="text-yellow-500">中</span>
          <span className="text-green-500">高</span>
          <span>100%</span>
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            显示 <span className="font-bold text-purple-600">{filteredCount}</span> / {totalCount}
          </span>
          {filteredCount < totalCount && (
            <span className="text-xs text-gray-500">
              已隐藏 {totalCount - filteredCount} 个
            </span>
          )}
        </div>
      )}

      {/* Quick presets */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onThresholdChange(0.5)}
          className="flex-1 py-1.5 px-2 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 transition-colors"
        >
          全部
        </button>
        <button
          onClick={() => onThresholdChange(0.7)}
          className="flex-1 py-1.5 px-2 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 transition-colors"
        >
          中等
        </button>
        <button
          onClick={() => onThresholdChange(0.85)}
          className="flex-1 py-1.5 px-2 text-xs font-medium rounded-md bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 transition-colors"
        >
          高质量
        </button>
      </div>
    </div>
  );
};

export default ConfidenceFilter;
