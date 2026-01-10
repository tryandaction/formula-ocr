import React from 'react';

interface PricingSectionProps {
  onSelectPlan: (planId: string) => void;
}

/**
 * 定价展示组件
 * 展示所有付费方案
 */
export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan }) => {
  const plans = [
    {
      id: 'monthly',
      name: '月度会员',
      price: 5,
      originalPrice: 8,
      days: 30,
      features: ['每日200次识别', '批量上传20张', '多格式导出'],
      popular: false,
    },
    {
      id: 'quarterly',
      name: '季度会员',
      price: 10,
      originalPrice: 24,
      days: 90,
      features: ['每日200次识别', '批量上传20张', '多格式导出', '优先客服支持'],
      popular: true,
    },
    {
      id: 'yearly',
      name: '年度会员',
      price: 20,
      originalPrice: 96,
      days: 365,
      features: ['每日200次识别', '批量上传20张', '多格式导出', '优先客服支持', '新功能优先体验'],
      popular: false,
    },
  ];

  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">选择适合您的方案</h2>
        <p className="text-gray-500">解锁更多识别额度，提升工作效率</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-transform hover:scale-105 ${
              plan.popular ? 'ring-2 ring-amber-500' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs px-3 py-1 rounded-bl-lg">
                最受欢迎
              </div>
            )}

            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold text-amber-600">¥{plan.price}</span>
                <span className="text-gray-400 line-through ml-2">¥{plan.originalPrice}</span>
                <span className="text-sm text-gray-500 ml-1">/{plan.days}天</span>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="text-green-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onSelectPlan(plan.id)}
                className={`w-full py-2 rounded-lg font-medium transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                立即购买
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 保障说明 */}
      <div className="mt-10 text-center">
        <div className="flex justify-center gap-8 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <span>🔒</span> 安全支付
          </span>
          <span className="flex items-center gap-1">
            <span>⚡</span> 即时生效
          </span>
          <span className="flex items-center gap-1">
            <span>💬</span> 客服支持
          </span>
        </div>
      </div>
    </div>
  );
};

export default PricingSection;
