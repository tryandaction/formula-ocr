import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  validateDocument,
  parsePdfDocument,
  preloadPdfJs,
  getSupportedFormats,
  isSupportedDocument,
  formatFileSize,
  type ParsedDocument,
  type FormulaRegion,
  type DocumentValidationResult,
} from '../utils/documentParser';
import { parseMarkdownSource, type DocumentFormulaSource } from '../utils/documentFormats';
import { PDFFormulaViewer } from './PDFFormulaViewer';

interface DocumentUploaderProps {
  onFormulasExtracted?: (formulas: FormulaRegion[]) => void;
  onMarkdownFormulasExtracted?: (formulas: DocumentFormulaSource[]) => void;
  disabled?: boolean;
}

type UploadState = 'idle' | 'validating' | 'parsing' | 'preview' | 'error';

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onFormulasExtracted,
  onMarkdownFormulasExtracted,
  disabled = false,
}) => {
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [parsedDocument, setParsedDocument] = useState<ParsedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [detectionProgress, setDetectionProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFormulasRef = useRef<FormulaRegion[]>([]);
  const detectedPagesRef = useRef(0);
  const totalPagesRef = useRef(0);
  const isActiveRef = useRef(true);

  const mergeFormulasByPosition = useCallback((existing: FormulaRegion[], incoming: FormulaRegion[]) => {
    if (incoming.length === 0) return existing;
    const round = (value: number) => Math.round(value * 10) / 10;
    const keyOf = (formula: FormulaRegion) => {
      const pos = formula.originalPosition;
      return [
        formula.pageNumber,
        round(pos.x),
        round(pos.y),
        round(pos.width),
        round(pos.height),
      ].join('|');
    };
    const map = new Map<string, FormulaRegion>();
    for (const formula of existing) {
      map.set(keyOf(formula), formula);
    }
    for (const formula of incoming) {
      const key = keyOf(formula);
      const current = map.get(key);
      if (!current) {
        map.set(key, formula);
        continue;
      }
      const currentHasImage = !!current.imageData;
      const incomingHasImage = !!formula.imageData;
      const currentConfidence = current.confidence ?? -1;
      const incomingConfidence = formula.confidence ?? -1;
      if (!currentHasImage && incomingHasImage) {
        map.set(key, formula);
      } else if (incomingConfidence > currentConfidence + 0.01) {
        map.set(key, formula);
      }
    }
    return Array.from(map.values());
  }, []);

  // 预加载 PDF.js
  useEffect(() => {
    preloadPdfJs().catch(console.error);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!isSupportedDocument(file)) {
      setError('不支持的文件格式。本轮支持 PDF 和 Markdown；DOCX 暂不支持');
      setState('error');
      return;
    }

    setFileInfo({ name: file.name, size: file.size });
    setState('validating');
    setError(null);
    setProgress(0);
    setDetectionProgress(null);
    pendingFormulasRef.current = [];
    detectedPagesRef.current = 0;
    totalPagesRef.current = 0;
    isActiveRef.current = true;

    try {
      // 验证文档
      const validation: DocumentValidationResult = await validateDocument(file);
      if (!validation.valid) {
        setError(validation.error || '文件验证失败');
        setState('error');
        return;
      }
      totalPagesRef.current = validation.pageCount || 0;

      // 解析文档
      setState('parsing');
      
      if (validation.fileType === 'pdf') {
        const doc = await parsePdfDocument(
          file,
          (prog, msg) => {
            setProgress(prog);
            setProgressMessage(msg);
          },
          undefined,
          (formulas) => {
            if (!isActiveRef.current) {
              return false;
            }
            detectedPagesRef.current += 1;
            setParsedDocument(prev => {
              if (!prev) {
                pendingFormulasRef.current = mergeFormulasByPosition(pendingFormulasRef.current, formulas);
                return prev;
              }
              return { ...prev, formulas: mergeFormulasByPosition(prev.formulas, formulas) };
            });
            const total = totalPagesRef.current || 0;
            setDetectionProgress({ done: detectedPagesRef.current, total });
            return true;
          }
        );
        const mergedFormulas = pendingFormulasRef.current.length > 0
          ? mergeFormulasByPosition(doc.formulas, pendingFormulasRef.current)
          : doc.formulas;
        const mergedDoc = pendingFormulasRef.current.length > 0
          ? { ...doc, formulas: mergedFormulas }
          : doc;
        pendingFormulasRef.current = [];
        setParsedDocument(mergedDoc);
        setDetectionProgress({ done: detectedPagesRef.current, total: doc.pageCount });
        setState('preview');
      } else if (validation.fileType === 'markdown') {
        const parsed = parseMarkdownSource(await file.text(), file.name);
        if (parsed.status === 'parse_error') {
          setError(parsed.error || 'Markdown 公式语法无效');
          setState('error');
          return;
        }
        if (parsed.status === 'no_formulas') {
          setError('Markdown 中未检测到公式');
          setState('error');
          return;
        }
        onMarkdownFormulasExtracted?.(parsed.formulas);
        setState('idle');
        setFileInfo(null);
        setProgress(100);
      } else {
        setError('DOCX 暂不支持解析。请转换为 PDF 或 Markdown 后再试');
        setState('error');
      }
    } catch (err) {
      console.error('Document processing error:', err);
      setError(err instanceof Error ? err.message : '文档处理失败');
      setState('error');
    }
  }, [mergeFormulasByPosition, onMarkdownFormulasExtracted]);

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
    setFileInfo(null);
    setDetectionProgress(null);
    pendingFormulasRef.current = [];
    detectedPagesRef.current = 0;
    totalPagesRef.current = 0;
    isActiveRef.current = false;
  }, []);

  const handleRetry = useCallback(() => {
    setState('idle');
    setError(null);
    setProgress(0);
    setFileInfo(null);
    setDetectionProgress(null);
    pendingFormulasRef.current = [];
    detectedPagesRef.current = 0;
    totalPagesRef.current = 0;
    isActiveRef.current = false;
  }, []);

  // 预览模式 - 全屏展示
  if (state === 'preview' && parsedDocument) {
    return (
      <div className="h-[calc(100vh-200px)] min-h-[600px]">
        <PDFFormulaViewer
          document={parsedDocument}
          onClose={handleClose}
          onFormulasExtracted={handleFormulasExtract}
          detectionProgress={detectionProgress}
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
        onClick={() => !disabled && state === 'idle' && fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300
          ${disabled ? 'opacity-50 cursor-not-allowed' : state === 'idle' ? 'cursor-pointer' : ''}
          ${isDragging 
            ? 'border-purple-500 bg-purple-50 scale-[1.02] shadow-lg' 
            : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/30'
          }
          ${state === 'error' ? 'border-red-300 bg-red-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.md,.markdown"
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        {state === 'idle' && (
          <div className="space-y-4">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center">
              <span className="text-4xl">📄</span>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-700 mb-1">
                上传文档提取公式
              </div>
              <div className="text-sm text-gray-500 mb-3">
                拖拽文件到此处，或点击选择文件
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors">
                <span>📁</span>
                选择文件
              </div>
            </div>
            <div className="text-xs text-gray-400 pt-2 border-t border-gray-100">
              支持格式: {getSupportedFormats()}
            </div>
          </div>
        )}

        {(state === 'validating' || state === 'parsing') && (
          <div className="py-6 space-y-4">
            {/* 文件信息 */}
            {fileInfo && (
              <div className="flex items-center justify-center gap-3 mb-4">
                <span className="text-2xl">📄</span>
                <div className="text-left">
                  <div className="font-medium text-gray-700 truncate max-w-[200px]">
                    {fileInfo.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatFileSize(fileInfo.size)}
                  </div>
                </div>
              </div>
            )}
            
            {/* 加载动画 */}
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 border-4 border-purple-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg">{state === 'validating' ? '🔍' : '⚙️'}</span>
              </div>
            </div>
            
            <div className="text-gray-600 font-medium">
              {state === 'validating' ? '正在验证文件...' : progressMessage || '正在解析文档...'}
            </div>
            
            {/* 进度条 */}
            {state === 'parsing' && (
              <div className="w-full max-w-xs mx-auto">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>处理进度</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'error' && (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <div className="text-red-600 font-medium">{error}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              <span>🔄</span>
              重新上传
            </button>
          </div>
        )}
      </div>

      {/* 功能说明 */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-xl">💡</span>
          </div>
          <div className="text-sm">
            <div className="font-semibold text-purple-800 mb-2">文档公式提取功能</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-purple-700">
              <div className="flex items-center gap-2">
                <span className="text-purple-500">✓</span>
                自动检测 PDF 中的数学公式
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-500">✓</span>
                在线预览文档，点击定位公式
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-500">✓</span>
                批量选择公式进行 OCR 识别
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-500">✓</span>
                支持缩放、翻页、快捷键操作
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="text-xs text-gray-400 text-center">
        快捷键: Ctrl+滚轮缩放 · Alt+拖拽平移 · ←→翻页 · +/- 缩放 · 0 重置视图
      </div>
    </div>
  );
};

export default DocumentUploader;
