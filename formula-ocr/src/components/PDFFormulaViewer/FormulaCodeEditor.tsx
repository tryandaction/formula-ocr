/**
 * 公式代码编辑器组件
 * 显示和编辑识别出的 LaTeX/Markdown 代码，支持实时预览
 * 优化：更好的视觉效果和交互体验
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { FormulaRegion } from '../../utils/documentParser';
import type { FormulaStatus } from './FormulaHighlighter';

// 动态导入 KaTeX
let katexModule: { renderToString: (tex: string, options?: object) => string } | null = null;

interface RecognizedFormula {
  id: string;
  latex: string;
  markdown?: string;
  status: FormulaStatus;
  error?: string;
}

interface FormulaCodeEditorProps {
  formula: FormulaRegion | null;
  recognized: RecognizedFormula | null;
  onCodeChange: (formulaId: string, code: string) => void;
  onCopy: (code: string, format: 'latex' | 'markdown') => void;
  onReRecognize: (formula: FormulaRegion) => void;
  onClose?: () => void;
}

type CodeFormat = 'latex' | 'markdown';

export const FormulaCodeEditor: React.FC<FormulaCodeEditorProps> = ({
  formula,
  recognized,
  onCodeChange,
  onCopy,
  onReRecognize,
  onClose,
}) => {
  const [format, setFormat] = useState<CodeFormat>('latex');
  const [editedCode, setEditedCode] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载 KaTeX
  useEffect(() => {
    if (!katexModule) {
      import('katex').then(module => {
        katexModule = module.default || module;
      }).catch(console.error);
    }
  }, []);

  // 当识别结果变化时，更新编辑器内容
  useEffect(() => {
    if (recognized?.status === 'done') {
      const code = format === 'latex' ? recognized.latex : (recognized.markdown || recognized.latex);
      setEditedCode(code);
    } else {
      setEditedCode('');
    }
  }, [recognized, format]);

  // 渲染预览
  useEffect(() => {
    if (!editedCode || !katexModule) {
      setPreviewHtml('');
      setPreviewError(null);
      return;
    }

    try {
      // 从 LaTeX 或 Markdown 中提取公式
      let latexCode = editedCode;
      
      // 如果是 Markdown 格式，提取 $...$ 或 $$...$$ 中的内容
      if (format === 'markdown') {
        const match = editedCode.match(/\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/);
        if (match) {
          latexCode = match[1] || match[2] || editedCode;
        }
      }

      const html = katexModule.renderToString(latexCode, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
      });
      setPreviewHtml(html);
      setPreviewError(null);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : '渲染错误');
      setPreviewHtml('');
    }
  }, [editedCode, format]);

  // 处理代码变化
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setEditedCode(newCode);
    
    if (formula) {
      onCodeChange(formula.id, newCode);
    }
  }, [formula, onCodeChange]);

  // 处理复制
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editedCode);
      setCopySuccess(true);
      onCopy(editedCode, format);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [editedCode, format, onCopy]);

  // 处理重新识别
  const handleReRecognize = useCallback(() => {
    if (formula) {
      onReRecognize(formula);
    }
  }, [formula, onReRecognize]);

  // 切换格式
  const handleFormatChange = useCallback((newFormat: CodeFormat) => {
    setFormat(newFormat);
    
    if (recognized?.status === 'done') {
      if (newFormat === 'markdown') {
        // 转换为 Markdown 格式
        const markdown = recognized.markdown || `$$${recognized.latex}$$`;
        setEditedCode(markdown);
      } else {
        setEditedCode(recognized.latex);
      }
    }
  }, [recognized]);

  // 如果没有选中公式，显示空状态
  if (!formula) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center">
          <div className="text-5xl mb-3">📝</div>
          <p className="font-medium text-gray-600">选择一个公式</p>
          <p className="text-sm mt-1">点击 PDF 中的公式框查看详情</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 头部 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <span>📝</span>
            公式编辑器
          </h4>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-gray-400 text-lg">✕</span>
            </button>
          )}
        </div>

        {/* 格式切换 */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => handleFormatChange('latex')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
              format === 'latex'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            LaTeX
          </button>
          <button
            onClick={() => handleFormatChange('markdown')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
              format === 'markdown'
                ? 'bg-white text-purple-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Markdown
          </button>
        </div>
      </div>

      {/* 公式原图 */}
      <div className="flex-shrink-0 p-4 border-b border-gray-100">
        <div className="text-xs text-gray-500 mb-2 font-medium">原始公式</div>
        <div className="bg-gray-50 rounded-xl p-3 overflow-hidden border border-gray-100">
          <img
            src={formula.imageData}
            alt="公式原图"
            className="w-full h-auto max-h-24 object-contain"
          />
        </div>
      </div>

      {/* 代码编辑区 */}
      <div className="flex-1 flex flex-col min-h-0 p-4">
        {recognized?.status === 'done' ? (
          <>
            {/* 代码输入框 */}
            <div className="flex-1 min-h-0 mb-4">
              <div className="text-xs text-gray-500 mb-2 font-medium">识别结果 (可编辑)</div>
              <textarea
                ref={textareaRef}
                value={editedCode}
                onChange={handleCodeChange}
                className="w-full h-full p-4 bg-gray-900 text-gray-100 font-mono text-sm rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-inner"
                placeholder="输入 LaTeX 代码..."
                spellCheck={false}
              />
            </div>

            {/* 预览区 */}
            <div className="flex-shrink-0 mb-4">
              <div className="text-xs text-gray-500 mb-2 font-medium">实时预览</div>
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl min-h-[70px] overflow-x-auto border border-gray-100">
                {previewError ? (
                  <div className="text-red-500 text-sm flex items-center gap-2">
                    <span>⚠️</span>
                    {previewError}
                  </div>
                ) : previewHtml ? (
                  <div 
                    className="katex-preview text-center"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <div className="text-gray-400 text-sm text-center">输入代码以预览</div>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex-shrink-0 flex gap-2">
              <button
                onClick={handleCopy}
                className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
                  copySuccess
                    ? 'bg-green-500 text-white shadow-lg'
                    : 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg'
                }`}
              >
                <span>{copySuccess ? '✓' : '📋'}</span>
                {copySuccess ? '已复制!' : '复制代码'}
              </button>
              <button
                onClick={handleReRecognize}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
              >
                <span>🔄</span>
                重新识别
              </button>
            </div>
          </>
        ) : recognized?.status === 'processing' ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600 font-medium">正在识别公式...</p>
              <p className="text-sm text-gray-400 mt-1">请稍候</p>
            </div>
          </div>
        ) : recognized?.status === 'error' ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">❌</div>
              <p className="text-red-600 font-medium text-lg">识别失败</p>
              <p className="text-sm text-gray-500 mt-2 max-w-[200px]">{recognized.error}</p>
            </div>
            <button
              onClick={handleReRecognize}
              className="py-2.5 px-6 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-md"
            >
              <span>🔄</span>
              重新识别
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔍</div>
              <p className="text-gray-600 font-medium">点击下方按钮识别公式</p>
              <p className="text-sm text-gray-400 mt-1">将自动转换为 LaTeX 代码</p>
            </div>
            <button
              onClick={handleReRecognize}
              className="py-3 px-8 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <span>✨</span>
              开始识别
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormulaCodeEditor;
