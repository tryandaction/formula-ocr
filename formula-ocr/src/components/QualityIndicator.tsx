import React, { useState, useEffect } from 'react';
import {
  analyzeImageQuality,
  getQualityLevel,
  type ImageQualityResult,
  type ImageQualityIssue,
} from '../utils/imageQuality';

interface QualityIndicatorProps {
  imageBase64: string;
  showDetails?: boolean;
  compact?: boolean;
}

export const QualityIndicator: React.FC<QualityIndicatorProps> = ({
  imageBase64,
  showDetails = false,
  compact = false,
}) => {
  const [quality, setQuality] = useState<ImageQualityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    
    setLoading(true);
    analyzeImageQuality(imageBase64)
      .then(result => {
        if (!cancelled) {
          setQuality(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageBase64]);

  if (loading) {
    return compact ? (
      <span className="text-xs text-gray-400">检测中...</span>
    ) : (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full" />
        <span>分析图片质量...</span>
      </div>
    );
  }

  if (!quality) return null;

  const { label, color } = getQualityLevel(quality.score);
  const hasIssues = quality.issues.length > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <QualityBadge score={quality.score} size="sm" />
        {hasIssues && (
          <span className="text-xs text-yellow-600" title={quality.issues.map(i => i.message).join('\n')}>
            ⚠️
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 质量分数 */}
      <div className="flex items-center gap-3">
        <QualityBadge score={quality.score} />
        <div>
          <div className={`font-medium ${color}`}>{label}</div>
          <div className="text-xs text-gray-500">图片质量评分</div>
        </div>
        {showDetails && hasIssues && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-sm text-gray-500 hover:text-gray-700"
          >
            {expanded ? '收起' : '详情'}
          </button>
        )}
      </div>

      {/* 问题列表 */}
      {hasIssues && (!showDetails || expanded) && (
        <div className="space-y-1">
          {quality.issues.map((issue, idx) => (
            <IssueItem key={idx} issue={issue} />
          ))}
        </div>
      )}

      {/* 详细指标 */}
      {showDetails && expanded && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
          <MetricItem label="清晰度" value={quality.metrics.sharpness} />
          <MetricItem label="对比度" value={quality.metrics.contrast} />
          <MetricItem label="亮度" value={Math.round(quality.metrics.brightness / 2.55)} />
        </div>
      )}
    </div>
  );
};

// 质量分数徽章
interface QualityBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

const QualityBadge: React.FC<QualityBadgeProps> = ({ score, size = 'md' }) => {
  const { color } = getQualityLevel(score);
  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-10 h-10 text-sm';
  
  // 计算环形进度
  const circumference = 2 * Math.PI * 16;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`relative ${sizeClasses} flex items-center justify-center`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : score >= 40 ? '#eab308' : '#ef4444'}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-medium ${color}`}>{score}</span>
    </div>
  );
};

// 问题项
interface IssueItemProps {
  issue: ImageQualityIssue;
}

const IssueItem: React.FC<IssueItemProps> = ({ issue }) => {
  const icon = issue.severity === 'error' ? '❌' : '⚠️';
  const bgColor = issue.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50';
  const textColor = issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700';

  return (
    <div className={`flex items-start gap-2 px-2 py-1.5 rounded ${bgColor}`}>
      <span className="flex-shrink-0">{icon}</span>
      <span className={`text-xs ${textColor}`}>{issue.message}</span>
    </div>
  );
};

// 指标项
interface MetricItemProps {
  label: string;
  value: number;
}

const MetricItem: React.FC<MetricItemProps> = ({ label, value }) => {
  const color = value >= 70 ? 'text-green-600' : value >= 40 ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <div className="text-center">
      <div className={`font-medium ${color}`}>{Math.round(value)}</div>
      <div className="text-gray-500">{label}</div>
    </div>
  );
};

// 置信度指示器
interface ConfidenceIndicatorProps {
  confidence?: number; // 0-1
  compact?: boolean;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  compact = false,
}) => {
  if (confidence === undefined || confidence === null) {
    return null;
  }

  const percent = Math.round(confidence * 100);
  const level = percent >= 90 ? 'high' : percent >= 70 ? 'medium' : 'low';
  
  const colors = {
    high: { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500' },
    low: { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' },
  };

  const { bg, text, bar } = colors[level];

  if (compact) {
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${bg} ${text}`}>
        {percent}%
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${bar} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${text}`}>{percent}%</span>
      {level === 'low' && (
        <span className="text-xs text-red-600" title="置信度较低，建议检查结果">
          ⚠️
        </span>
      )}
    </div>
  );
};

export default QualityIndicator;
