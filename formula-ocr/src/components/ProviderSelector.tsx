import React, { useState, useEffect } from 'react';
import type { ProviderType } from '../utils/providers';
import { 
  PROVIDER_CONFIGS, 
  storeApiKey, 
  clearApiKey,
  getAvailableProviders,
  getUserApiKey,
  hasZhipuBuiltInKeyConfigured
} from '../utils/providers';
import { isPaidUser, getActivationStatus } from '../utils/activation';
import { isBackendEnabled, checkQuota } from '../utils/api';
import type { QuotaInfo } from '../utils/api';

interface ProviderSelectorProps {
  selectedProvider: ProviderType;
  onProviderChange: (provider: ProviderType) => void;
  onClose: () => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider,
  onProviderChange,
  onClose
}) => {
  const [providers, setProviders] = useState<Array<{
    type: ProviderType;
    config: typeof PROVIDER_CONFIGS[ProviderType];
    hasApiKey: boolean;
    hasUserKey: boolean;
    hasBuiltInKey: boolean;
    isAvailable: boolean;
  }>>([]);
  const [editingKey, setEditingKey] = useState<ProviderType | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [localStatus, setLocalStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [backendQuota, setBackendQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setIsLoading(true);
    try {
      const { providers: available, localServerStatus } = await getAvailableProviders();
      setProviders(available);
      setLocalStatus(localServerStatus.message);
      
      // 如果启用后端，获取额度信息
      if (isBackendEnabled()) {
        try {
          const quota = await checkQuota();
          setBackendQuota(quota);
        } catch (e) {
          console.error('Failed to fetch quota:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveApiKey = (type: ProviderType) => {
    if (apiKeyInput.trim()) {
      storeApiKey(type, apiKeyInput.trim());
      setEditingKey(null);
      setApiKeyInput('');
      loadProviders();
    }
  };

  const handleClearApiKey = (type: ProviderType) => {
    clearApiKey(type);
    loadProviders();
  };

  const handleSelectProvider = (type: ProviderType) => {
    const provider = providers.find(p => p.type === type);
    if (provider?.isAvailable) {
      onProviderChange(type);
      onClose();
    }
  };

  const handleEditApiKey = (type: ProviderType) => {
    setEditingKey(type);
    // Only show user's own key, not built-in key
    setApiKeyInput(getUserApiKey(type));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
          <h2 className="text-xl font-bold">🔧 选择识别服务</h2>
        </div>

        {/* Provider List */}
        <div className="p-4 overflow-y-auto max-h-[55vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-gray-500 text-sm">正在加载服务列表...</p>
            </div>
          ) : (
          <div className="space-y-3">
            {providers.map(({ type, config, hasUserKey, hasBuiltInKey, isAvailable }) => (
              <div
                key={type}
                className={`
                  border rounded-lg p-3 transition-all cursor-pointer
                  ${selectedProvider === type 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${type === 'backend' && isAvailable ? 'ring-2 ring-green-400' : ''}
                `}
                onClick={() => isAvailable && handleSelectProvider(type)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{config.name}</span>
                    {/* 后端模式：显示额度信息 */}
                    {type === 'backend' && isAvailable && backendQuota && (
                      <>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          今日 {backendQuota.todayRemaining}/{backendQuota.todayLimit}
                        </span>
                        {backendQuota.isPaid && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                            ✓ 付费用户
                          </span>
                        )}
                      </>
                    )}
                    {type === 'backend' && !isAvailable && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                        未配置
                      </span>
                    )}
                    {/* 智谱API特殊处理：显示付费用户专属标签 */}
                    {type === 'zhipu' && hasZhipuBuiltInKeyConfigured() && (
                      isPaidUser() ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          ✓ 已激活 ({getActivationStatus().daysRemaining}天)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                          🔑 付费激活可用
                        </span>
                      )
                    )}
                    {hasBuiltInKey && type !== 'zhipu' && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        🎁 内置免费
                      </span>
                    )}
                    {config.freeQuota && !hasBuiltInKey && type !== 'zhipu' && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        {config.freeQuota}
                      </span>
                    )}
                    {!config.requiresApiKey && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                        免费
                      </span>
                    )}
                  </div>
                  {selectedProvider === type && isAvailable && (
                    <span className="text-blue-600 text-sm">✓ 已选择</span>
                  )}
                </div>

                {/* API Key Section */}
                {config.requiresApiKey && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {editingKey === type ? (
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="输入你自己的 API Key"
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => handleSaveApiKey(type)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => { setEditingKey(null); setApiKeyInput(''); }}
                          className="px-2 py-1 bg-gray-200 rounded text-sm"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm" onClick={e => e.stopPropagation()}>
                        <span className="text-gray-500">
                          {hasUserKey 
                            ? '✓ 使用你的 API Key' 
                            : hasBuiltInKey 
                              ? '✓ 使用内置 API（免费）' 
                              : '需要 API Key'
                          }
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditApiKey(type)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {hasUserKey ? '修改' : hasBuiltInKey ? '使用自己的' : '配置'}
                          </button>
                          {hasUserKey && (
                            <button onClick={() => handleClearApiKey(type)} className="text-red-500">
                              清除
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Local Server Status */}
                {type === 'local' && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <span className={`text-sm ${isAvailable ? 'text-green-600' : 'text-orange-500'}`}>
                      {localStatus}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
