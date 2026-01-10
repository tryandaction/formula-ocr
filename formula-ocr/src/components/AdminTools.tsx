import React, { useState } from 'react';
import { generateActivationCode, AMOUNT_TO_DAYS, validateActivationCode } from '../utils/activation';

/**
 * 管理员工具组件 - 用于生成激活码
 * 使用方法：在浏览器控制台输入 showAdminTools() 显示
 */
export const AdminTools: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [batchCodes, setBatchCodes] = useState<string[]>([]);

  const handleGenerate = () => {
    try {
      const code = generateActivationCode(selectedAmount);
      setGeneratedCode(code);
      setCopied(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '生成失败');
    }
  };

  const handleBatchGenerate = (count: number) => {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(generateActivationCode(selectedAmount));
    }
    setBatchCodes(codes);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyAll = () => {
    const allCodes = batchCodes.join('\n');
    navigator.clipboard.writeText(allCodes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🔐</span>
            管理员工具
          </h2>
          <p className="text-sm mt-1 opacity-90">
            生成激活码（仅管理员可见）
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Amount Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择金额
            </label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(AMOUNT_TO_DAYS).map(([amount, days]) => (
                <button
                  key={amount}
                  onClick={() => setSelectedAmount(Number(amount))}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedAmount === Number(amount)
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ¥{amount} / {days}天
                </button>
              ))}
            </div>
          </div>

          {/* Generate Single */}
          <div>
            <button
              onClick={handleGenerate}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:from-red-600 hover:to-pink-600 transition-all"
            >
              生成单个激活码
            </button>
          </div>

          {/* Generated Code */}
          {generatedCode && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">生成的激活码：</span>
                <button
                  onClick={() => handleCopy(generatedCode)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {copied ? '✓ 已复制' : '复制'}
                </button>
              </div>
              <code className="block bg-white p-3 rounded-lg text-sm font-mono break-all border">
                {generatedCode}
              </code>
              <div className="mt-2 text-xs text-gray-500">
                {(() => {
                  const info = validateActivationCode(generatedCode);
                  return info.isValid 
                    ? `有效期至: ${info.expiresAt?.toLocaleDateString('zh-CN')} (${info.daysRemaining}天)`
                    : '验证失败';
                })()}
              </div>
            </div>
          )}

          {/* Batch Generate */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              批量生成
            </label>
            <div className="flex gap-2">
              {[5, 10, 20].map(count => (
                <button
                  key={count}
                  onClick={() => handleBatchGenerate(count)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  生成 {count} 个
                </button>
              ))}
            </div>
          </div>

          {/* Batch Codes */}
          {batchCodes.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">批量激活码 ({batchCodes.length}个)：</span>
                <button
                  onClick={handleCopyAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {copied ? '✓ 已复制' : '复制全部'}
                </button>
              </div>
              <div className="bg-white p-3 rounded-lg border max-h-40 overflow-y-auto">
                {batchCodes.map((code, i) => (
                  <div key={i} className="text-xs font-mono py-1 border-b last:border-0">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

// 全局函数，在控制台调用显示管理员工具
let adminToolsContainer: HTMLDivElement | null = null;

export function showAdminTools() {
  if (typeof window === 'undefined') return;
  
  // 动态导入 React 和 ReactDOM
  import('react-dom/client').then(({ createRoot }) => {
    if (adminToolsContainer) {
      document.body.removeChild(adminToolsContainer);
    }
    
    adminToolsContainer = document.createElement('div');
    adminToolsContainer.id = 'admin-tools-root';
    document.body.appendChild(adminToolsContainer);
    
    const root = createRoot(adminToolsContainer);
    
    const handleClose = () => {
      root.unmount();
      if (adminToolsContainer) {
        document.body.removeChild(adminToolsContainer);
        adminToolsContainer = null;
      }
    };
    
    root.render(<AdminTools onClose={handleClose} />);
  });
}

// 暴露到全局
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).showAdminTools = showAdminTools;
}
