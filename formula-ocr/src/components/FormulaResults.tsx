import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ImageItem } from './ImageUploader';
import { DiffIndicator } from './DiffViewer';
import { hasDiff } from '../utils/diffUtils';
import { 
  type OutputFormat, 
  convertLatex, 
  generateExportContent, 
  downloadExport 
} from '../utils/formatConverter';

type ViewMode = 'list' | 'grid';
type GroupMode = 'none' | 'source';

interface GroupedImages {
  source: string;
  images: ImageItem[];
}

interface FormulaResultsProps {
  images: ImageItem[];
  onLatexChange: (imageId: string, newLatex: string) => void;
  onRemove: (imageId: string) => void;
  onClearAll: () => void;
  onReorder?: (images: ImageItem[]) => void;
}

export const FormulaResults: React.FC<FormulaResultsProps> = ({
  images,
  onLatexChange,
  onRemove,
  onClearAll,
  onReorder
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('latex');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // 过滤结果
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter(img => 
      img.latex?.toLowerCase().includes(query)
    );
  }, [images, searchQuery]);

  // 按来源分组
  const groupedImages = useMemo((): GroupedImages[] => {
    if (groupMode === 'none') {
      return [{ source: '', images: filteredImages }];
    }
    
    const groups: Map<string, ImageItem[]> = new Map();
    const noSource: ImageItem[] = [];
    
    filteredImages.forEach(img => {
      const source = img.source || img.fileName;
      if (source) {
        const existing = groups.get(source) || [];
        existing.push(img);
        groups.set(source, existing);
      } else {
        noSource.push(img);
      }
    });
    
    const result: GroupedImages[] = [];
    groups.forEach((imgs, source) => {
      result.push({ source, images: imgs });
    });
    
    if (noSource.length > 0) {
      result.push({ source: '未分类', images: noSource });
    }
    
    return result;
  }, [filteredImages, groupMode]);

  // 拖拽处理
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && id !== draggedId) {
      setDragOverId(id);
    }
  }, [draggedId]);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    
    if (!draggedId || draggedId === targetId || !onReorder) {
      setDraggedId(null);
      return;
    }
    
    const newImages = [...images];
    const draggedIndex = newImages.findIndex(img => img.id === draggedId);
    const targetIndex = newImages.findIndex(img => img.id === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedItem] = newImages.splice(draggedIndex, 1);
      newImages.splice(targetIndex, 0, draggedItem);
      onReorder(newImages);
    }
    
    setDraggedId(null);
  }, [draggedId, images, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  // 格式转换函数（使用 formatConverter）
  const convertFormat = useCallback((latex: string, format: OutputFormat): string => {
    return convertLatex(latex, format);
  }, []);

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入框中，不处理快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + C: 复制选中或全部
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedId) {
          const selected = images.find(img => img.id === selectedId);
          if (selected?.latex) {
            navigator.clipboard.writeText(convertFormat(selected.latex, outputFormat));
            setCopiedId(selectedId);
            setTimeout(() => setCopiedId(null), 2000);
          }
        }
      }

      // Delete/Backspace: 删除选中
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onRemove(selectedId);
        setSelectedId(null);
      }

      // Escape: 取消选中
      if (e.key === 'Escape') {
        setSelectedId(null);
        setExpandedId(null);
      }

      // 上下箭头: 导航
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = selectedId 
          ? filteredImages.findIndex(img => img.id === selectedId)
          : -1;
        
        let newIndex: number;
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < filteredImages.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : filteredImages.length - 1;
        }
        
        if (filteredImages[newIndex]) {
          setSelectedId(filteredImages[newIndex].id);
        }
      }

      // Enter: 展开/收起选中项
      if (e.key === 'Enter' && selectedId) {
        setExpandedId(expandedId === selectedId ? null : selectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, images, filteredImages, outputFormat, convertFormat, onRemove, expandedId]);

  // 复制所有
  const handleCopyAll = useCallback(async () => {
    const allContent = filteredImages
      .map(img => convertFormat(img.latex || '', outputFormat))
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(allContent);
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = allContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId('all');
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, [filteredImages, outputFormat, convertFormat]);

  // 下载所有（使用 formatConverter）
  const handleDownloadAll = useCallback(() => {
    const items = filteredImages.map((img, i) => ({
      latex: img.latex || '',
      index: i + 1,
    }));
    const content = generateExportContent(items, outputFormat, true);
    downloadExport(content, `formulas_${Date.now()}`, outputFormat);
  }, [filteredImages, outputFormat]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <span>✨</span> 识别结果 
          <span className="text-sm font-normal text-gray-500">
            ({filteredImages.length}{filteredImages.length !== images.length ? `/${images.length}` : ''})
          </span>
        </h2>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              placeholder="搜索公式..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-32 sm:w-40 pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          </div>

          {/* 分组选择 */}
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            title="分组方式"
          >
            <option value="none">不分组</option>
            <option value="source">按来源</option>
          </select>

          {/* 格式选择 */}
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="latex">LaTeX</option>
            <option value="markdown">Markdown</option>
            <option value="mathml">MathML</option>
            <option value="unicode">Unicode</option>
          </select>

          {/* 视图切换 */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 py-1.5 text-sm transition-colors ${
                viewMode === 'list' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="列表视图"
            >
              ☰
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1.5 text-sm transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="网格视图"
            >
              ⊞
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
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
          💾 下载
        </button>
        <button
          onClick={onClearAll}
          className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
        >
          🗑️ 清空
        </button>
        
        {/* 快捷键提示 */}
        <span className="hidden sm:inline text-xs text-gray-400 ml-2">
          ↑↓ 导航 · Enter 展开 · Ctrl+C 复制 · Del 删除
        </span>
      </div>

      {/* 选中提示 */}
      {selectedId && (
        <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center justify-between">
          <span>已选中公式 #{filteredImages.findIndex(img => img.id === selectedId) + 1}</span>
          <button 
            onClick={() => setSelectedId(null)}
            className="text-blue-500 hover:text-blue-700"
          >
            取消选中
          </button>
        </div>
      )}

      {/* Results */}
      {filteredImages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? '没有找到匹配的公式' : '暂无识别结果'}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-4">
          {groupedImages.map((group, groupIndex) => (
            <div key={group.source || groupIndex}>
              {/* 分组标题 */}
              {groupMode !== 'none' && (
                <div className="flex items-center gap-2 mb-2 px-2">
                  <span className="text-sm font-medium text-gray-600">📁 {group.source}</span>
                  <span className="text-xs text-gray-400">({group.images.length})</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
              )}
              <div className="space-y-3">
                {group.images.map((img) => (
                  <FormulaResultCard
                    key={img.id}
                    image={img}
                    index={images.indexOf(img)}
                    isExpanded={expandedId === img.id}
                    isSelected={selectedId === img.id}
                    isDragging={draggedId === img.id}
                    isDragOver={dragOverId === img.id}
                    onToggleExpand={() => setExpandedId(expandedId === img.id ? null : img.id)}
                    onExpand={() => setExpandedId(img.id)}
                    onSelect={() => setSelectedId(selectedId === img.id ? null : img.id)}
                    onLatexChange={(latex) => onLatexChange(img.id, latex)}
                    onRemove={() => onRemove(img.id)}
                    copiedId={copiedId}
                    onCopy={(id) => {
                      setCopiedId(id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    outputFormat={outputFormat}
                    convertFormat={convertFormat}
                    draggable={!!onReorder}
                    onDragStart={(e) => handleDragStart(e, img.id)}
                    onDragOver={(e) => handleDragOver(e, img.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, img.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedImages.map((group, groupIndex) => (
            <div key={group.source || groupIndex}>
              {/* 分组标题 */}
              {groupMode !== 'none' && (
                <div className="flex items-center gap-2 mb-2 px-2">
                  <span className="text-sm font-medium text-gray-600">📁 {group.source}</span>
                  <span className="text-xs text-gray-400">({group.images.length})</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {group.images.map((img) => (
                  <FormulaGridCard
                    key={img.id}
                    image={img}
                    index={images.indexOf(img)}
                    onRemove={() => onRemove(img.id)}
                    copiedId={copiedId}
                    onCopy={(id) => {
                      setCopiedId(id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    outputFormat={outputFormat}
                    convertFormat={convertFormat}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 列表视图卡片
interface FormulaResultCardProps {
  image: ImageItem;
  index: number;
  isExpanded: boolean;
  isSelected: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onToggleExpand: () => void;
  onExpand: () => void;
  onSelect: () => void;
  onLatexChange: (latex: string) => void;
  onRemove: () => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
  outputFormat: OutputFormat;
  convertFormat: (latex: string, format: OutputFormat) => string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

const FormulaResultCard: React.FC<FormulaResultCardProps> = ({
  image,
  index,
  isExpanded,
  isSelected,
  isDragging,
  isDragOver,
  onToggleExpand,
  onExpand,
  onSelect,
  onLatexChange,
  onRemove,
  copiedId,
  onCopy,
  outputFormat,
  convertFormat,
  draggable,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}) => {
  const renderRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(image.latex || '');
  const [originalLatex] = useState(image.latex || '');

  // 同步编辑值
  useEffect(() => {
    if (!isEditing) {
      setEditValue(image.latex || '');
    }
  }, [image.latex, isEditing]);

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
    const content = convertFormat(image.latex || '', outputFormat);
    try {
      await navigator.clipboard.writeText(content);
      onCopy(image.id);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onCopy(image.id);
    }
  };

  const handleSaveEdit = () => {
    onLatexChange(editValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(image.latex || '');
    setIsEditing(false);
  };

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
        isDragging
          ? 'opacity-50 border-blue-400 ring-2 ring-blue-200'
          : isDragOver
          ? 'border-blue-500 ring-2 ring-blue-300 shadow-lg transform scale-[1.02]'
          : isSelected 
          ? 'border-blue-500 ring-2 ring-blue-200 shadow-md' 
          : 'border-gray-100 hover:shadow-md'
      }`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        // 点击卡片时选中（但不是点击按钮时）
        if (!(e.target as HTMLElement).closest('button')) {
          onSelect();
        }
      }}
    >
      {/* Compact View */}
      <div 
        className={`flex items-center gap-4 p-3 cursor-pointer ${
          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {/* 拖拽手柄 */}
        {draggable && (
          <div 
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
            title="拖拽排序"
          >
            ⋮⋮
          </div>
        )}

        {/* 编号 */}
        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
          {index + 1}
        </div>

        {/* Thumbnail */}
        <img
          src={image.base64}
          alt={`Formula ${index + 1}`}
          className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-200"
        />

        {/* Preview */}
        <div className="flex-1 min-w-0">
          <div 
            ref={renderRef}
            className="overflow-x-auto overflow-y-visible py-1 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleCopy}
            className={`p-2 rounded-lg transition-all ${
              copiedId === image.id 
                ? 'bg-green-100 text-green-600' 
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            title={`复制 ${outputFormat.toUpperCase()}`}
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
          <span className="text-gray-400 ml-1 text-sm">
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
                className="max-w-full max-h-48 object-contain rounded-lg border border-gray-200 bg-white"
              />
            </div>

            {/* Code */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-500">
                  {outputFormat.toUpperCase()} 代码
                </h4>
                {isEditing && (
                  <div className="flex gap-1">
                    <button
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      保存
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full h-32 p-2 font-mono text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  {/* 差异指示器 */}
                  {hasDiff(originalLatex, editValue) && (
                    <DiffIndicator
                      original={originalLatex}
                      modified={editValue}
                      onRevert={() => setEditValue(originalLatex)}
                    />
                  )}
                </div>
              ) : (
                <pre className="p-2 bg-white border border-gray-200 rounded-lg text-sm font-mono overflow-x-auto max-h-32">
                  {convertFormat(image.latex || '', outputFormat)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 网格视图卡片
interface FormulaGridCardProps {
  image: ImageItem;
  index: number;
  onRemove: () => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
  outputFormat: OutputFormat;
  convertFormat: (latex: string, format: OutputFormat) => string;
}

const FormulaGridCard: React.FC<FormulaGridCardProps> = ({
  image,
  index,
  onRemove,
  copiedId,
  onCopy,
  outputFormat,
  convertFormat
}) => {
  const renderRef = useRef<HTMLDivElement>(null);

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
        renderRef.current.innerHTML = `<span class="text-red-500 text-xs">${image.latex}</span>`;
      }
    }
  }, [image.latex]);

  const handleCopy = async () => {
    const content = convertFormat(image.latex || '', outputFormat);
    try {
      await navigator.clipboard.writeText(content);
      onCopy(image.id);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      onCopy(image.id);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
      {/* 编号标签 */}
      <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium shadow">
        {index + 1}
      </div>

      {/* 原图 */}
      <div className="relative aspect-video bg-gray-50">
        <img
          src={image.base64}
          alt={`Formula ${index + 1}`}
          className="w-full h-full object-contain"
        />
        
        {/* 悬停操作 */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={handleCopy}
            className={`p-2 rounded-full transition-all ${
              copiedId === image.id 
                ? 'bg-green-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            title="复制"
          >
            {copiedId === image.id ? '✓' : '📋'}
          </button>
          <button
            onClick={onRemove}
            className="p-2 bg-white text-red-600 rounded-full hover:bg-red-50 transition-all"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 公式渲染 */}
      <div className="p-3 border-t border-gray-100">
        <div 
          ref={renderRef}
          className="overflow-x-auto text-sm min-h-[2rem] flex items-center justify-center"
        />
      </div>
    </div>
  );
};
