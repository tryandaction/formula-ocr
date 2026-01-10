import React, { useState } from 'react';
import { isBackendEnabled } from '../utils/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * 管理员工具组件 - 用于管理订单
 * 使用方法：在浏览器控制台输入 showAdminTools() 显示
 */
export const AdminTools: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [adminKey, setAdminKey] = useState<string>(localStorage.getItem('admin_key') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [orderResult, setOrderResult] = useState<string>('');

  const saveAdminKey = (key: string) => {
    setAdminKey(key);
    localStorage.setItem('admin_key', key);
  };

  // 确认订单支付（备用功能）
  const handleConfirmPayment = async () => {
    if (!adminKey) {
      setError('请先输入管理员密钥');
      return;
    }

    if (!orderId.trim()) {
      setError('请输入订单号');
      return;
    }

    setLoading(true);
    setError('');
    setOrderResult('');

    try {
      const response = await fetch(`${API_BASE}/api/admin/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey,
        },
        body: JSON.stringify({ orderId: orderId.trim() }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setOrderResult(`✅ 订单 ${orderId} 确认成功！用户权益已升级。`);
        setOrderId('');
      } else {
        setError(data.message || data.error || '确认失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络错误');
    } finally {
      setLoading(false);
    }
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
        <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🔐</span>
            管理员工具
          </h2>
          <p className="text-sm mt-1 opacity-90">
            订单管理（备用）
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 订单确认 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              手动确认订单（备用）
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="输入订单号，如 ORD-20240101-XXXXXXXX"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={handleConfirmPayment}
            disabled={loading || !orderId.trim()}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
          >
            {loading ? '确认中...' : '✅ 确认支付'}
          </button>

          {orderResult && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {orderResult}
            </div>
          )}

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <p className="font-medium mb-1">💡 说明</p>
            <p>正常情况下，用户支付后输入验证码即可自动开通会员。</p>
            <p>此功能仅在用户无法自助验证时使用。</p>
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
