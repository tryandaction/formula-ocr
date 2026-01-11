import React, { useState } from 'react';
import { isBackendEnabled } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_BASE || '';

/**
 * 管理员工具组件 - 用于生成激活码
 * 
 * 支付流程：
 * 1. 用户扫码支付
 * 2. 管理员确认收款后，使用此工具生成激活码
 * 3. 将激活码发送给用户
 * 4. 用户输入激活码激活会员
 * 
 * 使用方法：在浏览器控制台输入 showAdminTools() 显示
 */
export const AdminTools: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [adminKey, setAdminKey] = useState<string>(localStorage.getItem('admin_key') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [amount, setAmount] = useState<number>(5);
  const [count, setCount] = useState<number>(1);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const saveAdminKey = (key: string) => {
    setAdminKey(key);
    localStorage.setItem('admin_key', key);
  };

  // 生成激活码
  const handleGenerateCode = async () => {
    if (!adminKey) {
      setError('请先输入管理员密钥');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedCodes([]);

    try {
      const response = await fetch(`${API_BASE}/api/admin/generate-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({ amount, count }),
      });

      const data = await response.json();
      
      if (response.ok && data.codes) {
        setGeneratedCodes(data.codes);
      } else {
        setError(data.error || '生成失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(generatedCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const useBackend = isBackendEnabled();

  if (!useBackend) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <p className="text-gray-600 text-center">后端未启用，管理员工具不可用</p>
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 bg-gray-200 text-gray-700 rounded-lg"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🔐</span>
            管理员工具
          </h2>
          <p className="text-sm mt-1 opacity-90">
            生成一次性激活码
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* 管理员密钥输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              管理员密钥 (ADMIN_SECRET)
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => saveAdminKey(e.target.value)}
              placeholder="输入管理员密钥..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 套餐选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择套餐金额
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { amount: 5, label: '月度 ¥5', days: 30 },
                { amount: 14, label: '季度 ¥14', days: 90 },
                { amount: 40, label: '年度 ¥40', days: 365 },
              ].map((plan) => (
                <button
                  key={plan.amount}
                  onClick={() => setAmount(plan.amount)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    amount === plan.amount
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="font-medium text-gray-800">{plan.label}</div>
                  <div className="text-xs text-gray-500">{plan.days}天</div>
                </button>
              ))}
            </div>
          </div>

          {/* 数量选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生成数量
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleGenerateCode}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50"
          >
            {loading ? '生成中...' : '🎫 生成激活码'}
          </button>

          {/* 生成结果 */}
          {generatedCodes.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700">
                  ✅ 生成成功！
                </span>
                <button
                  onClick={handleCopyAll}
                  className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
                >
                  {copied ? '已复制' : '复制全部'}
                </button>
              </div>
              <div className="space-y-1">
                {generatedCodes.map((code, index) => (
                  <div
                    key={index}
                    className="font-mono text-sm bg-white px-3 py-2 rounded border border-green-200 text-green-800"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <p className="text-xs text-green-600 mt-2">
                请将激活码发送给已支付的用户
              </p>
            </div>
          )}

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">💡 使用流程</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>确认用户已完成支付</li>
              <li>选择对应套餐金额生成激活码</li>
              <li>将激活码发送给用户</li>
              <li>用户输入激活码即可开通会员</li>
            </ol>
          </div>
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

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).showAdminTools = showAdminTools;
}
