import React, { useState, useCallback, useRef } from 'react';
import {
  validateDocument,
  parsePdfDocument,
  getSupportedFormats,
  isSupportedDocument,
  type ParsedDocument,
  type FormulaRegion,
  type DocumentValidationResult,
} from '../utils/documentParser';
import { DocumentPreview } from './DocumentPreview';

interface DocumentUploaderProps {
  onFormulasExtracted?: (formulas: FormulaRegion[]) => void;
  disabled?: boolean;
}

type UploadState = 'idle' | 'validating' | 'parsing' | 'preview' | 'error';

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onFormulasExtracted,
  disabled = false,
}) => {
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!isSupportedDocument(file)) {
      setError('不支持的文件格式');
      setState('error');
      return;
    }

    setState('validating');
    setError(null);
    setProgress(0);

    try {
      // 验证文档
      const validation: DocumentValidationResult = await validateDocument(file);
      if (!validation.valid) {
        setError(validation.error || '文件验证失败');
        setState('error');
        return;
      }

      // 解析文档
      setState('parsing');
      
      if (validation.fileType === 'pdf') {
        const doc = await parsePdfDocument(file, (prog, msg) => {
          setProgress(prog);
          setProgressMessage(msg);
        });
        setParsedDocument(doc);
        setState('preview');
      } else {
        // TODO: 支持 DOCX 和 Markdown
        setError(`${validation.fileType?.toUpperCase()} 格式解析功能开发中`);
        setState('error');
      }
    } catch (err) {
      console.error('Document processing error:', err);
      setError(err instanceof Error ? err.message : '文档处理失败');
      setState('error');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [disabled, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // 重置 input 以允许选择相同文件
    e.target.value = '';
  }, [handleFile]);

  const handleFormulasExtract = useCallback((formulas: FormulaRegion[]) => {
    onFormulasExtracted?.(formulas);
  }, [onFormulasExtracted]);

  const handleClose = useCallback(() => {
    setState('idle');
    setParsedDocument(null);
    setError(null);
    setProgress(0);
  }, []);

  const handleRetry = useCallback(() => {
    setState('idle');
    setError(null);
    setProgress(0);
  }, []);

  // 预览模式
  if (state === 'preview' && parsedDocument) {
    return (
      <div className="h-[600px]">
        <DocumentPreview
          document={parsedDocument}
          onFormulaExtract={handleFormulasExtract}
          onClose={handleClose}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 上传区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isDragging 
            ? 'border-purple-500 bg-purple-50' 
            : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
          }
          ${state === 'error' ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.md,.markdown"
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        {state === 'idle' && (
          <>
            <div className="text-4xl mb-3">📄</div>
            <div className="text-lg font-medium text-gray-700 mb-1">
              上传文档提取公式
            </div>
            <div className="text-sm text-gray-500 mb-3">
              拖拽文件到此处，或点击选择文件
            </div>
            <div className="text-xs text-gray-400">
              支持格式: {getSupportedFormats()}
            </div>
          </>
        )}

        {(state === 'validating' || state === 'parsing') && (
          <div className="py-4">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-purple-500 border-t-transparent mx-auto mb-3" />
            <div className="text-gray-600 mb-2">
              {state === 'validating' ? '正在验证文件...' : progressMessage || '正在解析文档...'}
            </div>
            {state === 'parsing' && (
              <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {state === 'error' && (
          <div className="py-4">
            <div className="text-4xl mb-3">❌</div>
            <div className="text-red-600 mb-3">{error}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
            >
              重试
            </button>
          </div>
        )}
      </div>

      {/* 功能说明 */}
      <div className="bg-purple-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <div className="text-sm text-purple-800">
            <div className="font-medium mb-1">文档公式提取</div>
            <ul className="list-disc list-inside space-y-1 text-purple-700">
              <li>自动检测 PDF 文档中的数学公式</li>
              <li>支持预览文档并手动选择公式区域</li>
              <li>批量提取公式进行 OCR 识别</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentUploader;
