import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  type HistoryItem,
  type HistoryStats,
  searchHistory,
  toggleFavorite,
  deleteHistory,
  deleteHistoryBatch,
  clearAllHistory,
  getStats,
  exportHistory,
} from '../utils/historyService';
import { generateExportContent, downloadExport, type OutputFormat } from '../utils/formatConverter';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreItem?: (item: HistoryItem) => void;
}

type FilterMode = 'all' | 'favorites';

// 每页显示数量
const PAGE_SIZE = 20;

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  onRestoreItem,
}) => {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<OutputFormat>('latex');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // 加载数据 - 使用防抖
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyItems, historyStats] = await Promise.all([
        searchHistory({
          query: searchQuery || undefined,
          startDate: dateRange.start ? new Date(dateRange.start).getTime() : undefined,
          endDate: dateRange.end ? new Date(dateRange.end).setHours(23, 59, 59, 999) : undefined,
          favoritesOnly: filterMode === 'favorites',
        }),
        getStats(),
      ]);
      setItems(historyItems);
      setStats(historyStats);
      setDisplayCount(PAGE_SIZE); // 重置显示数量
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, dateRange, filterMode]);

  // 防抖搜索
  useEffect(() => {
    if (!isOpen) return;
    
    const timer = setTimeout(() => {
      loadData();
    }, 300); // 300ms 防抖
    
    return () => clearTimeout(timer);
  }, [isOpen, loadData]);

  // 显示的项目（分页）
  const displayedItems = useMemo(() => {
    return items.slice(0, displayCount);
  }, [items, displayCount]);

  // 是否还有更多
  const hasMore = displayCount < items.length;

  // 加载更多
  const loadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + PAGE_SIZE, items.length));
  }, [items.length]);

  // 切换收藏
  const handleToggleFavorite = useCallback(async (id: string) => {
    try {
      await toggleFavorite(id);
      await loadData();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }, [loadData]);

  // 删除单个
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return;
    try {
      await deleteHistory(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  }, [loadData]);

  // 批量删除
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;
    try {
      await deleteHistoryBatch(Array.from(selectedIds));
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  }, [selectedIds, loadData]);

  // 清空全部
  const handleClearAll = useCallback(async () => {
    if (!confirm('确定要清空所有历史记录吗？此操作不可恢复！')) return;
    try {
      await clearAllHistory();
      setSelectedIds(new Set());
      await loadData();
    } catch (error) {
      console.error('Failed to clear all:', error);
    }
  }, [loadData]);

  // 导出选中
  const handleExport = useCallback(async () => {
    try {
      const itemsToExport = selectedIds.size > 0
        ? await exportHistory(Array.from(selectedIds))
        : items;
      
      const exportItems = itemsToExport.map((item, i) => ({
        latex: item.latex,
        index: i + 1,
      }));
      
      const content = generateExportContent(exportItems, exportFormat, true);
      downloadExport(content, `history_${Date.now()}`, exportFormat);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  }, [selectedIds, items, exportFormat]);

  // 选择/取消选择
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  }, [items, selectedIds]);

  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* 面板 */}
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-xl flex flex-col h-full">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <h2 className="text-lg font-semibold">历史记录</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 统计信息 */}
        {stats && (
          <div className="flex gap-4 px-4 py-3 bg-gray-50 border-b text-sm">
            <span className="text-gray-600">
              总计: <strong>{stats.totalCount}</strong>
            </span>
            <span className="text-gray-600">
              本月: <strong>{stats.monthCount}</strong>
            </span>
            <span className="text-gray-600">
              收藏: <strong className="text-yellow-600">{stats.favoriteCount}</strong>
            </span>
          </div>
        )}

        {/* 筛选栏 */}
        <div className="p-4 border-b space-y-3">
          <div className="flex flex-wrap gap-2">
            {/* 搜索框 */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="搜索公式内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>

            {/* 筛选模式 */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-2 text-sm ${
                  filterMode === 'all' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-50'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilterMode('favorites')}
                className={`px-3 py-2 text-sm ${
                  filterMode === 'favorites' ? 'bg-yellow-500 text-white' : 'bg-white hover:bg-gray-50'
                }`}
              >
                ⭐ 收藏
              </button>
            </div>
          </div>

          {/* 日期范围 */}
          <div className="flex gap-2 items-center text-sm">
            <span className="text-gray-500">日期:</span>
            <input
              type="date"
              value={dateRange.start || ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-2 py-1 border rounded text-sm"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={dateRange.end || ''}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-2 py-1 border rounded text-sm"
            />
            {(dateRange.start || dateRange.end) && (
              <button
                onClick={() => setDateRange({})}
                className="text-gray-400 hover:text-gray-600"
              >
                清除
              </button>
            )}
          </div>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
          <button
            onClick={handleSelectAll}
            className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded"
          >
            {selectedIds.size === items.length && items.length > 0 ? '取消全选' : '全选'}
          </button>
          
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-gray-500">已选 {selectedIds.size} 项</span>
              <button
                onClick={handleDeleteSelected}
                className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
              >
                删除选中
              </button>
            </>
          )}

          <div className="flex-1" />

          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as OutputFormat)}
            className="px-2 py-1 text-sm border rounded"
          >
            <option value="latex">LaTeX</option>
            <option value="markdown">Markdown</option>
            <option value="mathml">MathML</option>
          </select>
          <button
            onClick={handleExport}
            className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
          >
            💾 导出
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
          >
            清空
          </button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery || dateRange.start || dateRange.end || filterMode === 'favorites'
                ? '没有找到匹配的记录'
                : '暂无历史记录'}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedItems.map((item) => (
                <HistoryItemCard
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={() => handleToggleSelect(item.id)}
                  onToggleFavorite={() => handleToggleFavorite(item.id)}
                  onDelete={() => handleDelete(item.id)}
                  onRestore={onRestoreItem ? () => onRestoreItem(item) : undefined}
                  formatDate={formatDate}
                />
              ))}
              {/* 加载更多按钮 */}
              {hasMore && (
                <button
                  onClick={loadMore}
                  className="w-full py-3 text-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  加载更多 ({items.length - displayCount} 条)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 历史记录卡片
interface HistoryItemCardProps {
  item: HistoryItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  formatDate: (timestamp: number) => string;
}

const HistoryItemCard: React.FC<HistoryItemCardProps> = ({
  item,
  isSelected,
  onToggleSelect,
  onToggleFavorite,
  onDelete,
  onRestore,
  formatDate,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.latex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = item.latex;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border transition-all ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* 选择框 */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />

      {/* 缩略图 */}
      <img
        src={item.imageBase64}
        alt="Formula"
        className="w-16 h-16 object-cover rounded border border-gray-200 flex-shrink-0"
      />

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-mono text-gray-700 truncate mb-1">
          {item.latex}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{formatDate(item.createdAt)}</span>
          {item.source && (
            <>
              <span>•</span>
              <span className="truncate max-w-[150px]">{item.source}</span>
            </>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onToggleFavorite}
          className={`p-1.5 rounded transition-colors ${
            item.isFavorite ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'
          }`}
          title={item.isFavorite ? '取消收藏' : '收藏'}
        >
          {item.isFavorite ? '⭐' : '☆'}
        </button>
        <button
          onClick={handleCopy}
          className={`p-1.5 rounded transition-colors ${
            copied ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:bg-gray-100'
          }`}
          title="复制"
        >
          {copied ? '✓' : '📋'}
        </button>
        {onRestore && (
          <button
            onClick={onRestore}
            className="p-1.5 rounded text-gray-400 hover:bg-gray-100 transition-colors"
            title="恢复到编辑区"
          >
            ↩️
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="删除"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};
