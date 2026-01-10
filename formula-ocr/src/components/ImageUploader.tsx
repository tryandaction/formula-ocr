import React, { useState, useRef, useCallback, useEffect } from 'react';
import { validateFile, convertToBase64 } from '../utils/fileHandler';

export interface ImageItem {
  id: string;
  base64: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  latex?: string;
  error?: string;
  fileName?: string;
  fileSize?: number;
  source?: string; // 来源文档名称，用于分组
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
  // 区分全局拖拽和拖拽区域内的状态
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

  // 生成唯一ID
  const generateId = () => `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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
        status: 'pending',
        fileName: file.name,
        fileSize: file.size
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

  // 处理全局拖拽 - 只用于检测是否有文件被拖入页面
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (!disabled && e.dataTransfer?.types.includes('Files')) {
        setIsDraggingGlobal(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingGlobal(false);
        setIsOverDropZone(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingGlobal(false);
      setIsOverDropZone(false);
      
      if (disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        await handleFiles(files);
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [disabled, handleFiles]);

  // 处理拖拽区域的进入/离开
  const handleDropZoneDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsOverDropZone(true);
    }
  }, [disabled]);

  const handleDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否真的离开了拖拽区域
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsOverDropZone(false);
      }
    }
  }, []);

  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

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
    e.target.value = '';
  }, [handleFiles]);

  const handleRemoveImage = useCallback((id: string) => {
    onImagesChange(images.filter(img => img.id !== id));
  }, [images, onImagesChange]);

  const handleRetry = useCallback((id: string) => {
    onImagesChange(images.map(img => 
      img.id === id ? { ...img, status: 'pending', error: undefined } : img
    ));
  }, [images, onImagesChange]);

  // 计算拖拽区域的样式
  const getDropZoneClassName = () => {
    const baseClasses = `
      relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
      transition-all duration-200 ease-in-out
    `;
    
    if (disabled) {
      return `${baseClasses} border-gray-300 bg-gray-100 cursor-not-allowed opacity-60`;
    }
    
    if (isOverDropZone) {
      // 拖拽到区域内：高亮边框 + 微弱背景色 + 脉冲动画
      return `${baseClasses} border-blue-500 border-[3px] bg-blue-50 drop-zone-active`;
    }
    
    if (isDraggingGlobal) {
      // 全局拖拽中但未进入区域：轻微提示
      return `${baseClasses} border-blue-300 bg-blue-50/50`;
    }
    
    return `${baseClasses} border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* 上传区域 - 不再使用全屏覆盖层 */}
      <div
        ref={dropZoneRef}
        onClick={handleClick}
        onDragEnter={handleDropZoneDragEnter}
        onDragLeave={handleDropZoneDragLeave}
        onDragOver={handleDropZoneDragOver}
        className={getDropZoneClassName()}
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
          <div className={`text-5xl transition-transform duration-200 ${isOverDropZone ? 'scale-110' : ''}`}>
            {isOverDropZone ? '📥' : '📷'}
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              {isOverDropZone ? '释放以添加图片' : '拖拽、粘贴或点击上传图片'}
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
              <ImageThumbnail
                key={img.id}
                image={img}
                onRemove={() => handleRemoveImage(img.id)}
                onRetry={() => handleRetry(img.id)}
                formatFileSize={formatFileSize}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// 图片缩略图组件 - 优化状态显示
interface ImageThumbnailProps {
  image: ImageItem;
  onRemove: () => void;
  onRetry: () => void;
  formatFileSize: (bytes: number) => string;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  image,
  onRemove,
  onRetry,
  formatFileSize
}) => {
  const [showInfo, setShowInfo] = useState(false);

  const getBorderClass = () => {
    switch (image.status) {
      case 'processing':
        return 'border-blue-400 ring-2 ring-blue-100';
      case 'done':
        return 'border-green-400';
      case 'error':
        return 'border-red-400';
      default:
        return 'border-gray-200 hover:border-gray-300';
    }
  };

  return (
    <div
      className={`relative group rounded-lg overflow-hidden border-2 transition-all image-thumbnail-hover ${getBorderClass()}`}
      onMouseEnter={() => setShowInfo(true)}
      onMouseLeave={() => setShowInfo(false)}
    >
      {/* 原图始终显示 */}
      <img
        src={image.base64}
        alt="Formula"
        className="w-full h-24 object-cover"
      />
      
      {/* 处理中状态：半透明白色遮罩 + 居中 spinner */}
      {image.status === 'processing' && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-500 border-t-transparent"></div>
        </div>
      )}

      {/* 完成状态：右下角小绿勾 */}
      {image.status === 'done' && (
        <div className="absolute bottom-1.5 right-1.5 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* 错误状态：红色边框 + 错误图标 + 重试按钮 */}
      {image.status === 'error' && (
        <div className="absolute inset-0 bg-red-500/10 flex flex-col items-center justify-center gap-1">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="px-2 py-0.5 bg-white rounded text-xs text-red-600 hover:bg-red-50 shadow-sm"
          >
            重试
          </button>
        </div>
      )}

      {/* 待处理状态：显示待处理标识 */}
      {image.status === 'pending' && (
        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-gray-800/70 rounded text-[10px] text-white">
          待识别
        </div>
      )}

      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70"
      >
        ✕
      </button>

      {/* 悬停时显示文件信息 */}
      {showInfo && image.fileSize && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-2 py-1 truncate">
          {formatFileSize(image.fileSize)}
          {image.fileName && ` • ${image.fileName}`}
        </div>
      )}

      {/* 错误提示 tooltip */}
      {image.status === 'error' && image.error && showInfo && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-red-600 text-white text-xs rounded shadow-lg z-10">
          {image.error}
        </div>
      )}
    </div>
  );
};
