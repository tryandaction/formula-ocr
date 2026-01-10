import React, { useState } from 'react';
import type { QuotaInfo } from '../utils/api';

interface UserStatusBadgeProps {
  quota: QuotaInfo | null;
  onUpgradeClick?: () => void;
  onLoginClick?: () => void;
  onSimulateModeChange?: (mode: 'none' | 'anonymous' | 'registered' | 'paid') => void;
}

/**
 * 获取层级显示名称
 */
function getTierDisplayName(tier: string): string {
  switch (tier) {
    case 'admin':
      return '管理员';
    case 'paid':
      return '付费用户';
    case 'registered':
      return '注册用户';
    default:
      return '游客';
  }
}

/**
 * 获取层级颜色类名
 */
function getTierColorClass(tier: string): string {
  switch (tier) {
    case 'admin':
      return 'text-purple-600 bg-purple-50';
    case 'paid':
      return 'text-amber-600 bg-amber-50';
    case 'registered':
      return 'text-blue-600 bg-blue-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * 用户状态徽章组件
 * 显示用户层级、额度信息
 */
export const UserStatusBadge: React.FC<UserStatusBadgeProps> = ({
  quota,
  onUpgradeClick,
  onLoginClick,
  onSimulateModeChange
}) => {
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const tier = quota?.tier || 'anonymous';
  const isAdmin = quota?.isAdmin || false;
  const simulateMode = quota?.simulateMode || 'none';
  const daysRemaining = quota?.daysRemaining;

  // 计算额度状态
  const getQuotaStatus = () => {
    if (!quota) return 'unknown';
    if (quota.todayRemaining === 0) return 'exhausted';
    if (quota.todayRemaining <= 3) return 'low';
    return 'normal';
  };

  const quotaStatus = getQuotaStatus();

  // 额度颜色
  const getQuotaColorClass = () => {
    switch (quotaStatus) {
      case 'exhausted':
        return 'text-red-600';
      case 'low':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  // 模拟模式选项
  const simulateModes = [
    { value: 'none', label: '管理员模式', icon: '👑' },
    { value: 'anonymous', label: '游客体验', icon: '👤' },
    { value: 'registered', label: '注册用户体验', icon: '✓' },
    { value: 'paid', label: '付费用户体验', icon: '💎' },
  ] as const;

  return (
    <div className="flex items-center gap-2 relative">
      {/* 用户层级标签 */}
      <div 
        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTierColorClass(tier)} ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={() => isAdmin && setShowAdminMenu(!showAdminMenu)}
      >
        {tier === 'admin' && '👑 '}
        {tier === 'paid' && '💎 '}
        {tier === 'registered' && '✓ '}
        {getTierDisplayName(tier)}
        {isAdmin && simulateMode !== 'none' && (
          <span className="ml-1 text-purple-500">(模拟中)</span>
        )}
        {daysRemaining !== null && daysRemaining !== undefined && daysRemaining > 0 && (
          <span className="ml-1 opacity-75">({daysRemaining}天)</span>
        )}
        {isAdmin && <span className="ml-1">▼</span>}
      </div>

      {/* 管理员模式切换菜单 */}
      {isAdmin && showAdminMenu && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
          <div className="px-3 py-1 text-xs text-gray-500 border-b">切换体验模式</div>
          {simulateModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => {
                onSimulateModeChange?.(mode.value);
                setShowAdminMenu(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
                simulateMode === mode.value ? 'bg-purple-50 text-purple-600' : 'text-gray-700'
              }`}
            >
              <span>{mode.icon}</span>
              <span>{mode.label}</span>
              {simulateMode === mode.value && <span className="ml-auto">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* 额度显示 */}
      {quota && (
        <div className={`text-sm ${getQuotaColorClass()}`}>
          <span className="hidden sm:inline">今日: </span>
          <span className="font-medium">
            {quota.todayRemaining > 9999 ? '∞' : quota.todayRemaining}
          </span>
          <span className="text-gray-400">
            /{quota.todayLimit > 9999 ? '∞' : quota.todayLimit}
          </span>
        </div>
      )}

      {/* 登录按钮（匿名用户显示） */}
      {tier === 'anonymous' && onLoginClick && (
        <button
          onClick={onLoginClick}
          className="px-2 py-0.5 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full hover:from-blue-600 hover:to-indigo-600 transition-all"
        >
          登录
        </button>
      )}

      {/* 升级按钮（非付费用户显示） */}
      {tier !== 'paid' && tier !== 'anonymous' && tier !== 'admin' && onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="px-2 py-0.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full hover:from-amber-600 hover:to-orange-600 transition-all"
        >
          升级
        </button>
      )}

      {/* 点击外部关闭菜单 */}
      {showAdminMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowAdminMenu(false)}
        />
      )}
    </div>
  );
};

/**
 * 额度耗尽提示组件
 */
interface QuotaExhaustedPromptProps {
  quota: QuotaInfo;
  onUpgradeClick: () => void;
  onLoginClick?: () => void;
  onConfigApiKey?: () => void;
}

export const QuotaExhaustedPrompt: React.FC<QuotaExhaustedPromptProps> = ({
  quota,
  onUpgradeClick,
  onLoginClick,
  onConfigApiKey
}) => {
  if (quota.todayRemaining > 0) return null;

  const isAnonymous = quota.tier === 'anonymous';

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-medium text-amber-800 mb-1">
            {isAnonymous ? '免费试用次数已用完' : '今日免费额度已用完'}
          </h3>
          <p className="text-sm text-amber-700 mb-3">
            {isAnonymous ? (
              <>
                游客每天仅有 1 次免费试用机会。
                <strong>注册账户后可获得每日 10 次免费额度！</strong>
              </>
            ) : (
              <>
                您今日的 {quota.todayLimit} 次免费识别额度已全部使用。
                {quota.isPaid 
                  ? '付费用户每日额度将在明天重置。' 
                  : '升级为付费用户可获得更多额度。'}
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {isAnonymous && onLoginClick && (
              <button
                onClick={onLoginClick}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition-all"
              >
                📧 立即注册
              </button>
            )}
            {!quota.isPaid && !isAnonymous && (
              <button
                onClick={onUpgradeClick}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
              >
                💎 升级付费版
              </button>
            )}
            {onConfigApiKey && (
              <button
                onClick={onConfigApiKey}
                className="px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm hover:bg-amber-50 transition-all"
              >
                🔧 配置自己的 API Key
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 功能对比卡片
 */
interface FeatureComparisonProps {
  onUpgradeClick: () => void;
}

export const FeatureComparison: React.FC<FeatureComparisonProps> = ({
  onUpgradeClick
}) => {
  const features = [
    { name: '每日识别次数', free: '10 次', paid: '200 次' },
    { name: '每月识别次数', free: '100 次', paid: '5000 次' },
    { name: '批量上传', free: '3 张', paid: '20 张' },
    { name: '历史记录', free: '7 天', paid: '365 天' },
    { name: '导出格式', free: 'LaTeX', paid: 'LaTeX/Markdown/MathML' },
    { name: '优先支持', free: '❌', paid: '✅' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4">
        <h3 className="text-lg font-bold">功能对比</h3>
        <p className="text-sm opacity-90">选择适合您的方案</p>
      </div>
      
      <div className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-gray-600">功能</th>
              <th className="text-center py-2 text-gray-600">免费版</th>
              <th className="text-center py-2 text-amber-600">付费版</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature, index) => (
              <tr key={index} className="border-b last:border-0">
                <td className="py-2 text-gray-700">{feature.name}</td>
                <td className="py-2 text-center text-gray-500">{feature.free}</td>
                <td className="py-2 text-center text-amber-600 font-medium">{feature.paid}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <button
          onClick={onUpgradeClick}
          className="w-full mt-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
        >
          💎 立即升级
        </button>
      </div>
    </div>
  );
};
