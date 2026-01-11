import React, { useState, useEffect, useCallback } from 'react';
import { setPaidUntil } from '../utils/userService';
import { activateCode } from '../utils/api';

// 套餐类型
interface Plan {
  id: string;
  name: string;
  price: number;
  days: number;
  description: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (paidDays: number) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'pay' | 'activate' | 'success'>('select');
  const [activationCode, setActivationCode] = useState('');
  const [activating, setActivating] = useState(false);

  // 加载套餐列表
  useEffect(() => {
    if (isOpen && plans.length === 0) {
      fetchPlans();
    }
  }, [isOpen]);

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('select');
        setError(null);
        setActivationCode('');
      }, 300);
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/payment/plans`);
      const data = await response.json();
      if (data.plans) {
        setPlans(data.plans);
        setSelectedPlan(data.plans[0]);
      }
    } catch (err) {
      setError('获取套餐信息失败');
    }
  };

  const handleProceedToPay = useCallback(() => {
    if (!selectedPlan) return;
    setStep('pay');
  }, [selectedPlan]);

  const handleProceedToActivate = useCallback(() => {
    setStep('activate');
  }, []);

  const handleActivate = useCallback(async () => {
    if (!activationCode.trim()) {
      setError('请输入激活码');
      return;
    }

    setActivating(true);
    setError(null);

    try {
      const result = await activateCode(activationCode.trim());
      if (result.success) {
        // 更新本地存储的付费状态
        if (result.expiresAt) {
          setPaidUntil(new Date(result.expiresAt));
        }
        setStep('success');
        onPaymentSuccess(result.daysRemaining || 30);
      } else {
        setError(result.message || '激活失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '激活失败，请重试');
    } finally {
      setActivating(false);
    }
  }, [activationCode, onPaymentSuccess]);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">💎 升级会员</h2>
              <p className="text-sm opacity-90 mt-1">解锁更多识别额度</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 'select' && (
            <PlanSelector
              plans={plans}
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
              onConfirm={handleProceedToPay}
            />
          )}

          {step === 'pay' && selectedPlan && (
            <PaymentStep 
              plan={selectedPlan}
              onProceedToActivate={handleProceedToActivate}
              onBack={() => setStep('select')}
            />
          )}

          {step === 'activate' && (
            <ActivateStep
              activationCode={activationCode}
              onCodeChange={setActivationCode}
              onActivate={handleActivate}
              activating={activating}
              onBack={() => setStep('pay')}
            />
          )}

          {step === 'success' && (
            <PaymentSuccess onClose={handleClose} />
          )}
        </div>
      </div>
    </div>
  );
};

// 套餐选择器
interface PlanSelectorProps {
  plans: Plan[];
  selectedPlan: Plan | null;
  onSelectPlan: (plan: Plan) => void;
  onConfirm: () => void;
}

const PlanSelector: React.FC<PlanSelectorProps> = ({
  plans,
  selectedPlan,
  onSelectPlan,
  onConfirm,
}) => {
  return (
    <div>
      <h3 className="font-medium text-gray-800 mb-4">选择套餐</h3>
      
      <div className="space-y-3 mb-6">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onSelectPlan(plan)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              selectedPlan?.id === plan.id
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">{plan.name}</div>
                <div className="text-sm text-gray-500 mt-1">{plan.description}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-amber-600">¥{plan.price}</div>
                <div className="text-xs text-gray-400">{plan.days}天</div>
              </div>
            </div>
            {plan.id === 'yearly' && (
              <div className="mt-2 inline-block px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                最划算
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 功能对比 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-6">
        <h4 className="font-medium text-gray-700 mb-3">会员权益</h4>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2 text-gray-600">
            <span className="text-green-500">✓</span>
            每日 200 次识别额度（免费版 10 次）
          </li>
          <li className="flex items-center gap-2 text-gray-600">
            <span className="text-green-500">✓</span>
            每月 5000 次识别额度（免费版 100 次）
          </li>
          <li className="flex items-center gap-2 text-gray-600">
            <span className="text-green-500">✓</span>
            批量上传 20 张图片（免费版 3 张）
          </li>
          <li className="flex items-center gap-2 text-gray-600">
            <span className="text-green-500">✓</span>
            多格式导出：LaTeX / Markdown / MathML
          </li>
        </ul>
      </div>

      <button
        onClick={onConfirm}
        disabled={!selectedPlan}
        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        下一步：查看支付方式
      </button>
    </div>
  );
};

// 支付步骤
interface PaymentStepProps {
  plan: Plan;
  onProceedToActivate: () => void;
  onBack: () => void;
}

const PaymentStep: React.FC<PaymentStepProps> = ({ plan, onProceedToActivate, onBack }) => {
  return (
    <div>
      {/* 步骤指示 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">1</div>
          <span className="text-sm text-amber-600 font-medium">扫码支付</span>
        </div>
        <div className="w-8 h-0.5 bg-gray-300"></div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center">2</div>
          <span className="text-sm text-gray-400">输入激活码</span>
        </div>
      </div>

      {/* 套餐信息 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-gray-800">{plan.name}</div>
            <div className="text-sm text-gray-500">{plan.days}天会员</div>
          </div>
          <div className="text-2xl font-bold text-amber-600">¥{plan.price}</div>
        </div>
      </div>

      {/* 支付二维码 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
        <p className="text-center text-sm text-gray-600 mb-3">请扫码支付 <span className="font-bold text-amber-600">¥{plan.price}</span></p>
        <div className="flex justify-center gap-4">
          <div className="text-center">
            <div className="w-28 h-28 bg-white rounded-lg border border-gray-200 flex items-center justify-center mb-1">
              <img 
                src="/wechat-pay.png" 
                alt="微信支付" 
                className="w-24 h-24 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%2307C160" width="100" height="100" rx="8"/><text x="50" y="55" text-anchor="middle" fill="white" font-size="14">微信</text></svg>';
                }}
              />
            </div>
            <span className="text-xs text-gray-500">微信</span>
          </div>
          <div className="text-center">
            <div className="w-28 h-28 bg-white rounded-lg border border-gray-200 flex items-center justify-center mb-1">
              <img 
                src="/alipay.png" 
                alt="支付宝" 
                className="w-24 h-24 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231677FF" width="100" height="100" rx="8"/><text x="50" y="55" text-anchor="middle" fill="white" font-size="14">支付宝</text></svg>';
                }}
              />
            </div>
            <span className="text-xs text-gray-500">支付宝</span>
          </div>
        </div>
      </div>

      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <h4 className="font-medium text-blue-700 mb-2">📋 支付流程</h4>
        <ol className="text-sm text-blue-600 space-y-1 list-decimal list-inside">
          <li>扫描上方二维码完成支付</li>
          <li>支付后联系客服获取激活码</li>
          <li>输入激活码即可开通会员</li>
        </ol>
        <p className="text-xs text-blue-500 mt-2">
          客服微信：formula-ocr（或扫码添加）
        </p>
      </div>

      {/* 按钮 */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
        >
          返回
        </button>
        <button
          onClick={onProceedToActivate}
          className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
        >
          我已支付，输入激活码
        </button>
      </div>
    </div>
  );
};

// 激活步骤
interface ActivateStepProps {
  activationCode: string;
  onCodeChange: (code: string) => void;
  onActivate: () => void;
  activating: boolean;
  onBack: () => void;
}

const ActivateStep: React.FC<ActivateStepProps> = ({
  activationCode,
  onCodeChange,
  onActivate,
  activating,
  onBack,
}) => {
  // 格式化激活码输入
  const handleCodeChange = (value: string) => {
    // 移除非字母数字字符，转大写
    const cleaned = value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    onCodeChange(cleaned);
  };

  return (
    <div>
      {/* 步骤指示 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">✓</div>
          <span className="text-sm text-green-600">已支付</span>
        </div>
        <div className="w-8 h-0.5 bg-amber-500"></div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">2</div>
          <span className="text-sm text-amber-600 font-medium">输入激活码</span>
        </div>
      </div>

      {/* 激活码输入 */}
      <div className="bg-gray-50 rounded-xl p-6 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          请输入激活码
        </label>
        <input
          type="text"
          value={activationCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder="FOCR-XXXX-XXXX-XXXX"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg font-mono tracking-wider focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-2 text-center">
          激活码格式：FOCR-XXXX-XXXX-XXXX
        </p>
      </div>

      {/* 说明 */}
      <div className="text-xs text-gray-500 space-y-1 mb-4">
        <p>• 激活码由客服在确认支付后发放</p>
        <p>• 每个激活码只能使用一次</p>
        <p>• 激活后会员权益立即生效</p>
      </div>

      {/* 按钮 */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
        >
          返回
        </button>
        <button
          onClick={onActivate}
          disabled={!activationCode.trim() || activating}
          className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {activating ? '激活中...' : '激活会员'}
        </button>
      </div>
    </div>
  );
};

// 支付成功
interface PaymentSuccessProps {
  onClose: () => void;
}

const PaymentSuccess: React.FC<PaymentSuccessProps> = ({ onClose }) => {
  return (
    <div className="text-center py-6">
      <div className="text-6xl mb-4">🎉</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">激活成功！</h3>
      <p className="text-gray-600 mb-6">
        您的会员权益已生效，感谢您的支持！
      </p>
      <button
        onClick={onClose}
        className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-all"
      >
        开始使用
      </button>
    </div>
  );
};

export default PaymentModal;
