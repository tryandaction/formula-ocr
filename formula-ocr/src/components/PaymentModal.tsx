import React, { useState, useEffect, useCallback } from 'react';
import { getOrCreateDeviceId } from '../utils/userService';
import { verifyPayment } from '../utils/api';

// 套餐类型
interface Plan {
  id: string;
  name: string;
  price: number;
  days: number;
  description: string;
}

// 订单类型
interface Order {
  orderId: string;
  visibleId: string;
  verifyCode: string;
  userId: string;
  planId: string;
  amount: number;
  days: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  createdAt: number;
  paidAt: number | null;
  expiresAt: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'pay' | 'success'>('select');

  // 加载套餐列表
  useEffect(() => {
    if (isOpen && plans.length === 0) {
      fetchPlans();
    }
  }, [isOpen]);

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      // 延迟重置，避免关闭动画时看到状态变化
      setTimeout(() => {
        setStep('select');
        setOrder(null);
        setError(null);
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

  const createOrder = useCallback(async () => {
    if (!selectedPlan) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getOrCreateDeviceId(),
        },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });

      const data = await response.json();
      
      if (data.success && data.order) {
        setOrder(data.order);
        setStep('pay');
      } else {
        setError(data.error || '创建订单失败');
      }
    } catch (err) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  }, [selectedPlan]);

  const handlePaymentVerified = useCallback(() => {
    setStep('success');
    onPaymentSuccess();
  }, [onPaymentSuccess]);

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
              onConfirm={createOrder}
              loading={loading}
            />
          )}

          {step === 'pay' && order && (
            <PaymentStep 
              order={order} 
              onVerified={handlePaymentVerified}
              onError={setError}
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
  loading: boolean;
}

const PlanSelector: React.FC<PlanSelectorProps> = ({
  plans,
  selectedPlan,
  onSelectPlan,
  onConfirm,
  loading,
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
        disabled={!selectedPlan || loading}
        className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '创建订单中...' : `立即支付 ¥${selectedPlan?.price || 0}`}
      </button>
    </div>
  );
};


// 支付步骤
interface PaymentStepProps {
  order: Order;
  onVerified: () => void;
  onError: (error: string) => void;
}

const PaymentStep: React.FC<PaymentStepProps> = ({ order, onVerified, onError }) => {
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((order.expiresAt - Date.now()) / 1000)));

  // 倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((order.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [order.expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    if (!verifyCode.trim()) {
      onError('请输入验证码');
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyPayment(verifyCode.trim());
      if (result.success) {
        onVerified();
      } else {
        onError(result.message || '验证失败');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : '验证失败，请重试');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div>
      {/* 步骤指示 */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">1</div>
          <span className="text-sm text-gray-600">扫码支付</span>
        </div>
        <div className="w-8 h-0.5 bg-gray-300"></div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-gray-300 text-white text-xs flex items-center justify-center">2</div>
          <span className="text-sm text-gray-400">输入验证码</span>
        </div>
      </div>

      {/* 验证码显示 */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4 mb-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">支付时请备注以下验证码</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-amber-600 tracking-widest font-mono">
              {order.verifyCode}
            </span>
            <button
              onClick={() => handleCopy(order.verifyCode)}
              className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 rounded transition-colors"
            >
              {copied ? '✓' : '复制'}
            </button>
          </div>
        </div>
      </div>

      {/* 支付二维码 */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4">
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
        <p className="text-center mt-3 text-lg font-bold text-amber-600">¥{order.amount}</p>
        <p className="text-center text-xs text-gray-400 mt-1">
          订单 {minutes}:{seconds.toString().padStart(2, '0')} 后过期
        </p>
      </div>

      {/* 验证码输入 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-700 mb-3">
          <span className="font-medium">💡 支付完成后</span>，请在下方输入您支付时备注的验证码
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="输入6位验证码"
            maxLength={6}
            className="flex-1 px-4 py-2 border border-blue-300 rounded-lg text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleVerify}
            disabled={verifyCode.length !== 6 || verifying}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? '验证中...' : '确认'}
          </button>
        </div>
      </div>

      {/* 说明 */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• 扫码支付时，请在备注/留言中填写验证码 <span className="font-mono text-amber-600">{order.verifyCode}</span></p>
        <p>• 支付完成后，输入验证码即可自动开通会员</p>
        <p>• 如遇问题，请联系客服：support@formula-ocr.com</p>
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
      <h3 className="text-xl font-bold text-gray-800 mb-2">支付成功！</h3>
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
