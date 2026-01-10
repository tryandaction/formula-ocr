import React, { useState, useEffect, useCallback } from 'react';
import { getOrCreateDeviceId } from '../utils/userService';

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

  // 轮询订单状态
  useEffect(() => {
    if (!order || order.status !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/payment/query-order?orderId=${order.orderId}`
        );
        const data = await response.json();
        
        if (data.success && data.order) {
          setOrder(data.order);
          if (data.order.status === 'paid') {
            setStep('success');
            onPaymentSuccess();
          } else if (data.order.status === 'expired') {
            setError('订单已过期，请重新下单');
          }
        }
      } catch (err) {
        console.error('Failed to query order:', err);
      }
    }, 3000); // 每3秒轮询一次

    return () => clearInterval(interval);
  }, [order, onPaymentSuccess]);

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

  const handleClose = () => {
    setStep('select');
    setOrder(null);
    setError(null);
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
            <PaymentQRCode order={order} />
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

// 支付二维码
interface PaymentQRCodeProps {
  order: Order;
  onManualVerify?: (orderId: string) => void;
}

const PaymentQRCode: React.FC<PaymentQRCodeProps> = ({ order }) => {
  const [showManualInput, setShowManualInput] = useState(false);
  const remainingTime = Math.max(0, Math.floor((order.expiresAt - Date.now()) / 1000));
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <div className="text-center">
      <h3 className="font-medium text-gray-800 mb-2">扫码支付</h3>
      <p className="text-sm text-gray-500 mb-4">
        订单号: {order.orderId}
      </p>

      {/* 支付二维码区域 */}
      <div className="bg-gray-50 rounded-xl p-6 mb-4">
        <div className="flex justify-center gap-6">
          {/* 微信支付 */}
          <div className="text-center">
            <div className="w-32 h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center mb-2">
              <img 
                src="/wechat-pay.png" 
                alt="微信支付" 
                className="w-28 h-28 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%2307C160" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="white" font-size="12">微信</text></svg>';
                }}
              />
            </div>
            <span className="text-xs text-gray-500">微信支付</span>
          </div>

          {/* 支付宝 */}
          <div className="text-center">
            <div className="w-32 h-32 bg-white rounded-lg border border-gray-200 flex items-center justify-center mb-2">
              <img 
                src="/alipay.png" 
                alt="支付宝" 
                className="w-28 h-28 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231677FF" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="white" font-size="12">支付宝</text></svg>';
                }}
              />
            </div>
            <span className="text-xs text-gray-500">支付宝</span>
          </div>
        </div>

        <div className="mt-4 text-2xl font-bold text-amber-600">
          ¥{order.amount}
        </div>
      </div>

      {/* 倒计时 */}
      <div className="text-sm text-gray-500 mb-4">
        订单将在 <span className="text-amber-600 font-medium">{minutes}:{seconds.toString().padStart(2, '0')}</span> 后过期
      </div>

      {/* 状态提示 */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        等待支付确认...
      </div>

      <p className="mt-4 text-xs text-gray-400">
        支付完成后，系统将自动确认并升级您的账户
      </p>

      {/* 手动验证入口 */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        {!showManualInput ? (
          <button
            onClick={() => setShowManualInput(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            已支付但未自动确认？点击这里
          </button>
        ) : (
          <div className="text-left">
            <p className="text-xs text-gray-500 mb-2">
              如果您已完成支付但系统未自动确认，请联系客服并提供以下订单号：
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono text-gray-700">
                {order.orderId}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(order.orderId);
                }}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
              >
                复制
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              客服邮箱: support@formula-ocr.com
            </p>
          </div>
        )}
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
