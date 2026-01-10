import React, { useState, useEffect } from 'react';
import { ActivationModal } from './ActivationModal';
import { getActivationStatus } from '../utils/activation';
import type { ActivationInfo } from '../utils/activation';

interface DonationButtonProps {
  className?: string;
  onActivationChange?: (isActivated: boolean) => void;
}

export const DonationButton: React.FC<DonationButtonProps> = ({ 
  className = '',
  onActivationChange 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [activationStatus, setActivationStatus] = useState<ActivationInfo>({ isValid: false });

  useEffect(() => {
    setActivationStatus(getActivationStatus());
  }, []);

  const handleDonationClick = () => {
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
  };

  const handleDonated = () => {
    setShowModal(false);
    setShowActivation(true);
  };

  const handleActivationChange = (isActivated: boolean) => {
    setActivationStatus(getActivationStatus());
    onActivationChange?.(isActivated);
    if (isActivated) {
      setShowThankYou(true);
      setTimeout(() => setShowThankYou(false), 3000);
    }
  };

  return (
    <>
      {/* Donation Button */}
      <div className="inline-flex items-center gap-2">
        <button
          onClick={handleDonationClick}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-full shadow-md hover:shadow-lg hover:from-yellow-500 hover:to-orange-500 transition-all font-medium ${className}`}
        >
          <span>☕</span>
          <span>支持作者</span>
        </button>
        
        {/* Activation Status Badge */}
        {activationStatus.isValid ? (
          <button
            onClick={() => setShowActivation(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm hover:bg-green-200 transition-colors"
          >
            <span>✓</span>
            <span>已激活 ({activationStatus.daysRemaining}天)</span>
          </button>
        ) : (
          <button
            onClick={() => setShowActivation(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm hover:bg-purple-200 transition-colors"
          >
            <span>🔑</span>
            <span>激活码</span>
          </button>
        )}
      </div>

      {/* Thank You Toast */}
      {showThankYou && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          🎉 激活成功！感谢您的支持！
        </div>
      )}

      {/* Activation Modal */}
      <ActivationModal
        isOpen={showActivation}
        onClose={() => setShowActivation(false)}
        onActivationChange={handleActivationChange}
      />

      {/* Donation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white p-5">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>☕</span>
                支持作者
              </h2>
              <p className="text-sm mt-1 opacity-90">
                付费后可获得激活码，解锁智谱AI免费额度
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Creator Info */}
              <div className="text-center text-gray-600 text-sm">
                <p>👨‍🎓 物理系大三学生独立开发</p>
                <p className="mt-1">您的支持是我持续更新的动力！</p>
              </div>

              {/* Pricing Reminder */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm">
                <p className="font-medium text-purple-700 mb-2">💡 付费说明</p>
                <ul className="text-purple-600 space-y-1">
                  <li>• ¥5 = 30天 | ¥10 = 90天</li>
                  <li>• ¥20 = 180天 | ¥50 = 365天</li>
                  <li>• 支付时请备注您的邮箱</li>
                  <li>• 24小时内发送激活码</li>
                </ul>
              </div>

              {/* Payment Options */}
              <div className="grid grid-cols-2 gap-4">
                {/* WeChat Pay */}
                <div className="border border-gray-200 rounded-xl p-4 text-center hover:border-green-400 hover:bg-green-50 transition-all cursor-pointer">
                  <div className="w-24 h-24 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                    <img src={import.meta.env.BASE_URL + 'wechat-pay.png'} alt="微信支付" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">微信支付</p>
                  <p className="text-xs text-gray-400 mt-1">扫码付款</p>
                </div>

                {/* Alipay */}
                <div className="border border-gray-200 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                  <div className="w-24 h-24 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                    <img src={import.meta.env.BASE_URL + 'alipay.png'} alt="支付宝" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">支付宝</p>
                  <p className="text-xs text-gray-400 mt-1">扫码付款</p>
                </div>
              </div>

              {/* International Options */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400 text-center">国际用户</p>
                <div className="flex gap-2 justify-center">
                  <a
                    href="https://buymeacoffee.com/tryandaction"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-yellow-400 text-gray-800 rounded-lg text-sm font-medium hover:bg-yellow-500 transition-colors"
                  >
                    ☕ Buy Me a Coffee
                  </a>
                  <a
                    href="https://github.com/sponsors/tryandaction"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 transition-colors"
                  >
                    💖 GitHub Sponsors
                  </a>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-between">
              <button
                onClick={handleDonated}
                className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm font-medium"
              >
                🔑 我已付款，输入激活码
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
