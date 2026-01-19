import React, { useState, useEffect } from 'react';
import { sendVerificationCode, verifyEmail, checkQuota, type QuotaInfo } from '../utils/api';
import { setUserEmail, markEmailVerified } from '../utils/userService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (quota: QuotaInfo) => void;
  reason?: 'quota_exhausted' | 'upgrade' | 'manual';
}

type Step = 'email' | 'verify';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  reason = 'manual',
}) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setCode('');
      setError('');
      setCountdown(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('请输入邮箱地址');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await sendVerificationCode(email.trim());
      if (result.success) {
        setUserEmail(email.trim());
        setStep('verify');
        setCountdown(60);
      } else {
        setError(result.message);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('请输入验证码');
      return;
    }

    if (code.trim().length !== 6) {
      setError('请输入6位验证码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await verifyEmail(email.trim(), code.trim());
      if (result.success) {
        markEmailVerified();
        // 刷新额度信息
        const quota = await checkQuota();
        onAuthSuccess(quota);
        onClose();
      } else {
        setError(result.message || '验证失败，请重试');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '验证失败，请重试';
      // 提取更友好的错误信息
      if (errorMsg.includes('400')) {
        setError('验证码错误或已过期，请重新获取');
      } else if (errorMsg.includes('403')) {
        setError('请求被拒绝，请刷新页面后重试');
      } else if (errorMsg.includes('网络') || errorMsg.includes('timeout')) {
        setError('网络连接失败，请检查网络后重试');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    await handleSendCode();
  };

  const getReasonText = () => {
    switch (reason) {
      case 'quota_exhausted':
        return '您的免费试用次数已用完，注册后可获得更多额度';
      case 'upgrade':
        return '注册账户后可享受更多功能';
      default:
        return '注册账户，获取更多免费额度';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {step === 'email' ? '注册 / 登录' : '验证邮箱'}
              </h2>
              <p className="text-sm opacity-90 mt-1">{getReasonText()}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* 权益说明 */}
          {step === 'email' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-xl">
              <h3 className="font-medium text-blue-800 mb-2">📧 注册后可获得：</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>✓ 每日 10 次免费识别（匿名用户仅 1 次）</li>
                <li>✓ 每月 100 次免费额度</li>
                <li>✓ 历史记录同步</li>
                <li>✓ 跨设备账户恢复</li>
              </ul>
            </div>
          )}

          {/* 邮箱输入 */}
          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 transition-all"
              >
                {loading ? '发送中...' : '发送验证码'}
              </button>
            </div>
          )}

          {/* 验证码输入 */}
          {step === 'verify' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600">
                  验证码已发送至 <span className="font-medium">{email}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  验证码
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="请输入6位验证码"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 transition-all"
              >
                {loading ? '验证中...' : '验证'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setStep('email')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ← 修改邮箱
                </button>
                <button
                  onClick={handleResendCode}
                  disabled={countdown > 0}
                  className={`${countdown > 0 ? 'text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
                >
                  {countdown > 0 ? `${countdown}s 后重发` : '重新发送'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
