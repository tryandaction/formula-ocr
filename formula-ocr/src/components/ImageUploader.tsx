import React, { useState, useRef, useCallback, useEffect } from 'react';
import { validateFile, convertToBase64 } from '../utils/fileHandler';

export interface ImageItem {
  id: string;
  base64: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  latex?: string;
  error?: string;
}

interface ImageUploaderProps {
  images: ImageItem[];
  onImagesChange: (images: ImageItem[]) => void;
  onProcessImage: (id: string) => void;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  images,
  onImagesChange,
  onProcessImage,
  disabled = false 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // 生成唯一ID
  const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 处理单个文件
  const processFile = useCallback(async (file: File): Promise<ImageItem | null> => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || '无效文件');
      return null;
    }

    try {
      const base64 = await convertToBase64(file);
      return {
        id: generateId(),
        base64,
        status: 'pending'
      };
    } catch {
      setError('读取文件失败');
      return null;
    }
  }, []);

  // 处理多个文件
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(files);
    
    const newImages: ImageItem[] = [];
    for (const file of fileArray) {
      const item = await processFile(file);
      if (item) {
        newImages.push(item);
      }
    }

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      onImagesChange(updatedImages);
      // 不再自动处理，等待用户点击执行按钮
    }
  }, [images, onImagesChange, processFile]);

  // 处理所有待处理的图片
  const handleProcessAll = useCallback(() => {
    const pendingImages = images.filter(img => img.status === 'pending');
    pendingImages.forEach(img => {
      onProcessImage(img.id);
    });
  }, [images, onProcessImage]);

  // 处理粘贴事件（全局）
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (disabled) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await handleFiles(imageFiles);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [disabled, handleFiles]);

  // 处理全局拖拽
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // 只有当离开整个窗口时才取消拖拽状态
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      
      if (disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        await handleFiles(files);
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [disabled, handleFiles]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // 重置 input 以便可以重复选择同一文件
    e.target.value = '';
  }, [handleFiles]);

  const handleRemoveImage = useCallback((id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
  }, [images, onImagesChange]);

  const handleRetry = useCallback((id: string) => {
    // 只重置状态为 pending，等待用户点击"开始识别"
    onImagesChange(images.map(img => 
      img.id === id ? { ...img, status: 'pending', error: undefined } : img
    ));
  }, [images, onImagesChange]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* 全局拖拽覆盖层 */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500 bg-opacity-20 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="text-6xl mb-4">📥</div>
            <p className="text-xl font-medium text-blue-600">释放以添加图片</p>
            <p className="text-sm text-gray-500 mt-2">支持同时添加多张图片</p>
          </div>
        </div>
      )}

      {/* 上传区域 */}
      <div
        ref={dropZoneRef}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${disabled 
            ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60' 
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFileChange}
          disabled={disabled}
          multiple
          className="hidden"
        />

        <div className="space-y-3">
          <div className="text-5xl">📷</div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              拖拽、粘贴或点击上传图片
            </p>
            <p className="text-sm text-gray-500 mt-1">
              支持多张图片批量识别 • Ctrl+V 粘贴
            </p>
          </div>
          <p className="text-xs text-gray-400">
            支持 JPG, PNG, WebP, HEIC • 单张最大 10MB
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </p>
        </div>
      )}

      {/* 图片队列 */}
      {images.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">
              图片队列 ({images.length})
            </h3>
            <div className="flex items-center gap-3">
              {images.some(img => img.status === 'pending') && (
                <button
                  onClick={handleProcessAll}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <span>🚀</span> 开始识别
                </button>
              )}
              {images.length > 1 && (
                <button
                  onClick={() => onImagesChange([])}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  清空全部
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map((img) => (
              <div
                key={img.id}
                className={`
                  relative group rounded-lg overflow-hidden border-2 transition-all
                  ${img.status === 'processing' ? 'border-blue-400 ring-2 ring-blue-200' : ''}
                  ${img.status === 'done' ? 'border-green-400' : ''}
                  ${img.status === 'error' ? 'border-red-400' : ''}
                  ${img.status === 'pending' ? 'border-gray-200' : ''}
                `}
              >
                <img
                  src={img.base64}
                  alt="Formula"
                  className="w-full h-24 object-cover"
                />
                
                {/* 状态覆盖层 */}
                <div className={`
                  absolute inset-0 flex items-center justify-center
                  ${img.status === 'processing' ? 'bg-blue-500 bg-opacity-30' : ''}
                  ${img.status === 'done' ? 'bg-green-500 bg-opacity-20' : ''}
                  ${img.status === 'error' ? 'bg-red-500 bg-opacity-30' : ''}
                `}>
                  {img.status === 'processing' && (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  )}
                  {img.status === 'done' && (
                    <span className="text-2xl">✓</span>
                  )}
                  {img.status === 'error' && (
                    <button
                      onClick={() => handleRetry(img.id)}
                      className="px-2 py-1 bg-white rounded text-xs text-red-600 hover:bg-red-50"
                    >
                      重试
                    </button>
                  )}
                </div>

                {/* 删除按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(img.id);
                  }}
                  className="absolute top-1 right-1 w-5 h-5 bg-black bg-opacity-50 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
