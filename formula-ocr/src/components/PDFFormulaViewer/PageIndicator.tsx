/**
 * 页码指示器组件
 * 显示当前页码，支持输入跳转
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const PageIndicator: React.FC<PageIndicatorProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 开始编辑
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setInputValue(String(currentPage + 1));
  }, [currentPage]);

  // 确认跳转
  const handleConfirm = useCallback(() => {
    const page = parseInt(inputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page - 1);
    }
    setIsEditing(false);
  }, [inputValue, totalPages, onPageChange]);

  // 取消编辑
  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleConfirm, handleCancel]);

  // 处理输入变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 只允许数字
    if (/^\d*$/.test(value)) {
      setInputValue(value);
    }
  }, []);

  // 聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // 上一页
  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  // 下一页
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  return (
    <div className="flex items-center gap-1">
      {/* 上一页按钮 */}
      <button
        onClick={handlePrevPage}
        disabled={currentPage === 0}
        className={`p-1.5 rounded transition-colors ${
          currentPage === 0
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        title="上一页 (PageUp)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 页码显示/输入 */}
      <div className="flex items-center gap-1 text-sm">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleConfirm}
            className="w-12 px-2 py-1 text-center border border-purple-400 rounded focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        ) : (
          <button
            onClick={handleStartEdit}
            className="px-2 py-1 hover:bg-gray-100 rounded transition-colors"
            title="点击跳转到指定页"
          >
            <span className="font-medium text-gray-700">{currentPage + 1}</span>
          </button>
        )}
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">{totalPages}</span>
      </div>

      {/* 下一页按钮 */}
      <button
        onClick={handleNextPage}
        disabled={currentPage === totalPages - 1}
        className={`p-1.5 rounded transition-colors ${
          currentPage === totalPages - 1
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        title="下一页 (PageDown)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export default PageIndicator;
