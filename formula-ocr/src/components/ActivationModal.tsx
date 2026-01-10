import React, { useState, useEffect } from 'react';
import { 
  validateActivationCode, 
  saveActivationCode, 
  getActivationStatus, 
  clearActivationCode,
  AMOUNT_TO_DAYS
} from '../utils/activation';
import type { ActivationInfo } from '../utils/activation';
import { isBackendEnabled, activateCode, checkQuota } from '../utils/api';
import type { QuotaInfo } from '../utils/api';

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivationChange?: (isActivated: boolean) => void;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({ 
  isOpen, 
  onClose,
  onActivationChange 
}) => {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStatus, setCurrentStatus] = useState<ActivationInfo>({ isValid: false });
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const useBackend = isBackendEnabled();

  useEffect(() => {
    if (isOpen) {
      setCurrentStatus(getActivationStatus());
      setInputCode('');
      setError('');
      setSuccess('');
      
      // 如果启用后端，获取额度信息
      if (useBackend) {
        checkQuota().then(setQuotaInfo).catch(console.error);
      }
    }
  }, [isOpen, useBackend]);

  const handleActivate = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (useBackend) {
        // 使用后端 API
        const result = await activateCode(inputCode);
        if (result.success) {
          setSuccess(result.message);
          // 刷新额度信息
          const newQuota = await checkQuota();
          setQuotaInfo(newQuota);
          setCurrentStatus({
            isValid: true,
            expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
            daysRemaining: result.daysRemaining,
          });
          onActivationChange?.(true);
        } else {
          setError(result.message);
        }
      } else {
        // 使用本地验证
        const info = validateActivationCode(inputCode);
        
        if (!info.isValid) {
          setError('激活码无效或已过期，请检查后重试');
          return;
        }

        if (saveActivationCode(inputCode)) {
          setSuccess(`激活成功！有效期至 ${info.expiresAt?.toLocaleDateString('zh-CN')}，剩余 ${info.daysRemaining} 天`);
          setCurrentStatus(info);
          onActivationChange?.(true);
        } else {
          setError('保存激活码失败，请重试');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '激活失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = () => {
    clearActivationCode();
    setCurrentStatus({ isValid: false });
    setSuccess('');
    onActivationChange?.(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white p-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🔑</span>
            激活付费服务
          </h2>
          <p className="text-sm mt-1 opacity-90">
            输入激活码解锁智谱AI免费额度
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Current Status */}
          {currentStatus.isValid ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <span>✓</span>
                <span>已激活</span>
              </div>
              <div className="mt-2 text-sm text-green-600 space-y-1">
                <p>付费金额: ¥{currentStatus.amount}</p>
                <p>到期时间: {currentStatus.expiresAt?.toLocaleDateString('zh-CN')}</p>
                <p>剩余天数: {currentStatus.daysRemaining} 天</p>
              </div>
              <button
                onClick={handleDeactivate}
                className="mt-3 text-sm text-red-500 hover:text-red-600"
              >
                清除激活码
              </button>
            </div>
          ) : (
            <>
              {/* Pricing Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-gray-700 mb-3">💰 付费方案</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(AMOUNT_TO_DAYS).map(([amount, days]) => (
                    <div key={amount} className="flex justify-between bg-white rounded-lg px-3 py-2 border">
                      <span className="text-orange-500 font-medium">¥{amount}</span>
                      <span className="text-gray-600">{days}天</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="text-sm text-gray-600 space-y-2">
                <p className="font-medium">📋 获取激活码步骤：</p>
                <ol className="list-decimal list-inside space-y-1 text-gray-500">
                  <li>点击下方"支持作者"扫码支付</li>
                  <li>支付时备注您的邮箱</li>
                  <li>作者会在24小时内发送激活码</li>
                </ol>
              </div>

              {/* Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  输入激活码
                </label>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="FOCR-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                />
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">
                  ❌ {error}
                </div>
              )}
              {success && (
                <div className="text-green-600 text-sm bg-green-50 px-4 py-2 rounded-lg">
                  ✅ {success}
                </div>
              )}

              {/* Activate Button */}
              <button
                onClick={handleActivate}
                disabled={!inputCode.trim() || isLoading}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? '激活中...' : '激活'}
              </button>

              {/* Quota Info (Backend Mode) */}
              {useBackend && quotaInfo && (
                <div className="bg-blue-50 rounded-xl p-4 text-sm">
                  <p className="font-medium text-blue-700 mb-2">📊 当前额度</p>
                  <div className="grid grid-cols-2 gap-2 text-blue-600">
                    <div>今日: {quotaInfo.todayRemaining}/{quotaInfo.todayLimit}</div>
                    <div>本月: {quotaInfo.monthRemaining}/{quotaInfo.monthLimit}</div>
                  </div>
                  {quotaInfo.isPaid && quotaInfo.daysRemaining && (
                    <p className="mt-2 text-green-600">✓ 付费用户 (剩余 {quotaInfo.daysRemaining} 天)</p>
                  )}
                </div>
              )}
            </>
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
