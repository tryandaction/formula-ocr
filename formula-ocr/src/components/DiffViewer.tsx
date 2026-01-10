import React from 'react';
import { computeDiff, hasDiff, getDiffStats, type DiffSegment } from '../utils/diffUtils';

interface DiffViewerProps {
  original: string;
  modified: string;
  className?: string;
}

/**
 * 差异查看器组件
 * 高亮显示原始文本和修改后文本之间的差异
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  className = ''
}) => {
  if (!hasDiff(original, modified)) {
    return (
      <div className={`font-mono text-sm ${className}`}>
        <pre className="whitespace-pre-wrap break-all">{original}</pre>
      </div>
    );
  }

  const diff = computeDiff(original, modified);
  const stats = getDiffStats(original, modified);

  return (
    <div className={className}>
      {/* 差异统计 */}
      <div className="flex items-center gap-3 mb-2 text-xs">
        {stats.added > 0 && (
          <span className="text-green-600">
            +{stats.added} 添加
          </span>
        )}
        {stats.removed > 0 && (
          <span className="text-red-600">
            -{stats.removed} 删除
          </span>
        )}
      </div>

      {/* 差异内容 */}
      <div className="font-mono text-sm bg-gray-50 rounded-lg p-3 overflow-x-auto">
        <pre className="whitespace-pre-wrap break-all">
          {diff.map((segment, index) => (
            <DiffSegmentSpan key={index} segment={segment} />
          ))}
        </pre>
      </div>
    </div>
  );
};

interface DiffSegmentSpanProps {
  segment: DiffSegment;
}

const DiffSegmentSpan: React.FC<DiffSegmentSpanProps> = ({ segment }) => {
  switch (segment.type) {
    case 'added':
      return (
        <span className="bg-green-200 text-green-800 rounded px-0.5">
          {segment.text}
        </span>
      );
    case 'removed':
      return (
        <span className="bg-red-200 text-red-800 line-through rounded px-0.5">
          {segment.text}
        </span>
      );
    default:
      return <span>{segment.text}</span>;
  }
};

/**
 * 简化版差异指示器
 * 只显示是否有修改，不显示具体差异
 */
interface DiffIndicatorProps {
  original: string;
  modified: string;
  onRevert?: () => void;
}

export const DiffIndicator: React.FC<DiffIndicatorProps> = ({
  original,
  modified,
  onRevert
}) => {
  if (!hasDiff(original, modified)) {
    return null;
  }

  const stats = getDiffStats(original, modified);

  return (
    <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
      <span className="text-amber-600">⚠️ 已修改</span>
      <span className="text-gray-500">
        ({stats.added > 0 && `+${stats.added}`}
        {stats.added > 0 && stats.removed > 0 && ' / '}
        {stats.removed > 0 && `-${stats.removed}`})
      </span>
      {onRevert && (
        <button
          onClick={onRevert}
          className="ml-2 text-blue-600 hover:text-blue-800 underline"
        >
          还原
        </button>
      )}
    </div>
  );
};
