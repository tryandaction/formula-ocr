import React, { useEffect, useRef, useState, useCallback } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ImageItem } from './ImageUploader';

interface FormulaResultsProps {
  images: ImageItem[];
  onLatexChange: (imageId: string, newLatex: string) => void;
  onRemove: (imageId: string) => void;
  onClearAll: () => void;
}

export const FormulaResults: React.FC<FormulaResultsProps> = ({
  images,
  onLatexChange,
  onRemove,
  onClearAll
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 复制所有 LaTeX
  const handleCopyAll = useCallback(async () => {
    const allLatex = images.map(img => img.latex).join('\n\n');
    try {
      await navigator.clipboard.writeText(allLatex);
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = allLatex;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [images]);

  // 下载所有为 .tex 文件
  const handleDownloadAll = useCallback(() => {
    const allLatex = images.map((img, i) => 
      `% Formula ${i + 1}\n${img.latex}`
    ).join('\n\n');
    
    const blob = new Blob([allLatex], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formulas_${Date.now()}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [images]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <span>✨</span> 识别结果 ({images.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopyAll}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
              copiedId === 'all' 
                ? 'bg-green-500 text-white' 
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            {copiedId === 'all' ? '✓ 已复制' : '📋 复制全部'}
          </button>
          <button
            onClick={handleDownloadAll}
            className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-all"
          >
            💾 下载 .tex
          </button>
          <button
            onClick={onClearAll}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
          >
            🗑️ 清空
          </button>
        </div>
      </div>

      {/* Results Grid */}
      <div className="space-y-4">
        {images.map((img, index) => (
          <FormulaResultCard
            key={img.id}
            image={img}
            index={index}
            isExpanded={expandedId === img.id}
            onToggleExpand={() => setExpandedId(expandedId === img.id ? null : img.id)}
            onExpand={() => setExpandedId(img.id)}
            onLatexChange={(latex) => onLatexChange(img.id, latex)}
            onRemove={() => onRemove(img.id)}
            copiedId={copiedId}
            onCopy={(id) => {
              setCopiedId(id);
              setTimeout(() => setCopiedId(null), 2000);
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface FormulaResultCardProps {
  image: ImageItem;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onExpand: () => void;
  onLatexChange: (latex: string) => void;
  onRemove: () => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
}

const FormulaResultCard: React.FC<FormulaResultCardProps> = ({
  image,
  index,
  isExpanded,
  onToggleExpand,
  onExpand,
  onLatexChange,
  onRemove,
  copiedId,
  onCopy
}) => {
  const renderRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Render LaTeX
  useEffect(() => {
    if (!renderRef.current || !image.latex) return;

    try {
      katex.render(image.latex.trim(), renderRef.current, {
        displayMode: true,
        throwOnError: false,
        errorColor: '#cc0000'
      });
    } catch {
      if (renderRef.current) {
        renderRef.current.innerHTML = `<span class="text-red-500">${image.latex}</span>`;
      }
    }
  }, [image.latex]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(image.latex || '');
      onCopy(image.id);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = image.latex || '';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onCopy(image.id);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Compact View */}
      <div 
        className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggleExpand}
      >
        {/* Thumbnail */}
        <img
          src={image.base64}
          alt={`Formula ${index + 1}`}
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
        />

        {/* Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">#{index + 1}</span>
          </div>
          <div 
            ref={renderRef}
            className="overflow-x-auto overflow-y-visible py-2"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleCopy}
            className={`p-2 rounded-lg transition-all ${
              copiedId === image.id 
                ? 'bg-green-100 text-green-600' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            title="复制 LaTeX"
          >
            {copiedId === image.id ? '✓' : '📋'}
          </button>
          <button
            onClick={() => {
              setIsEditing(!isEditing);
              if (!isEditing) onExpand();
            }}
            className={`p-2 rounded-lg transition-all ${
              isEditing ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
            }`}
            title="编辑"
          >
            ✏️
          </button>
          <button
            onClick={onRemove}
            className="p-2 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-600 transition-all"
            title="删除"
          >
            🗑️
          </button>
          <span className="text-gray-400 ml-1">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Image */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">原图</h4>
              <img
                src={image.base64}
                alt={`Formula ${index + 1}`}
                className="max-w-full max-h-48 object-contain rounded-lg border border-gray-200"
              />
            </div>

            {/* LaTeX Code */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">LaTeX 代码</h4>
              {isEditing ? (
                <textarea
                  value={image.latex || ''}
                  onChange={(e) => onLatexChange(e.target.value)}
                  className="w-full h-32 p-2 font-mono text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              ) : (
                <pre className="p-2 bg-white border border-gray-200 rounded-lg text-sm font-mono overflow-x-auto">
                  {image.latex}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
