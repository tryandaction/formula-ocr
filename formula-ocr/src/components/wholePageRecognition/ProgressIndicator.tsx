/**
 * ProgressIndicator组件
 * 显示检测进度条
 */

import React from 'react';

interface ProgressIndicatorProps {
  /** 进度值（0-100） */
  progress: number;
  /** 是否显示 */
  visible: boolean;
  /** 状态消息 */
  message?: string;
}

/**
 * ProgressIndicator组件实现
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  visible,
  message = 'Processing...',
}) => {
  if (!visible) return null;

  // 确保进度值在0-100范围内
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        padding: '24px',
        zIndex: 2000,
        minWidth: '320px',
      }}
    >
      {/* 标题 */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '16px',
          textAlign: 'center',
        }}
      >
        Detecting Formulas
      </div>

      {/* 进度条容器 */}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '12px',
        }}
      >
        {/* 进度条填充 */}
        <div
          style={{
            width: `${clampedProgress}%`,
            height: '100%',
            backgroundColor: '#3b82f6',
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* 进度文本 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: '#6b7280',
        }}
      >
        <span>{message}</span>
        <span style={{ fontWeight: '600', color: '#374151' }}>
          {clampedProgress.toFixed(0)}%
        </span>
      </div>

      {/* 加载动画 */}
      {clampedProgress < 100 && (
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#3b82f6',
                borderRadius: '50%',
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* CSS动画 */}
      <style>
        {`
          @keyframes pulse {
            0%, 80%, 100% {
              opacity: 0.3;
              transform: scale(0.8);
            }
            40% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
    </div>
  );
};
