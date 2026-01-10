/**
 * 激活码系统
 */

import { randomString } from './utils';

// 金额对应有效期（天）- 与套餐配置保持一致
export const AMOUNT_TO_DAYS: Record<number, number> = {
  5: 30,    // ¥5 = 30天（月度会员）
  14: 90,   // ¥14 = 90天（季度会员）
  40: 365,  // ¥40 = 365天（年度会员）
};

export interface ActivationCodeData {
  code: string;
  amount: number;
  days: number;
  createdAt: number;
  usedBy: string | null;
  usedAt: number | null;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  amount?: number;
  days?: number;
  codeData?: ActivationCodeData;
}

export interface ActivationResult {
  success: boolean;
  message: string;
  expiresAt?: number;
  daysRemaining?: number;
}

// 生成激活码
export async function generateActivationCode(
  kv: KVNamespace,
  amount: number
): Promise<string> {
  const days = AMOUNT_TO_DAYS[amount];
  if (!days) {
    throw new Error(`Invalid amount: ${amount}. Valid amounts: ${Object.keys(AMOUNT_TO_DAYS).join(', ')}`);
  }

  // 生成唯一激活码: FOCR-XXXX-XXXX-XXXX
  const code = `FOCR-${randomString(4)}-${randomString(4)}-${randomString(4)}`;

  const codeData: ActivationCodeData = {
    code,
    amount,
    days,
    createdAt: Date.now(),
    usedBy: null,
    usedAt: null,
  };

  // 存储激活码（永不过期，直到被使用）
  await kv.put(`code:${code}`, JSON.stringify(codeData));

  return code;
}

// 验证激活码
export async function validateActivationCode(
  kv: KVNamespace,
  code: string
): Promise<ValidationResult> {
  // 标准化激活码格式
  const normalizedCode = code.trim().toUpperCase();

  // 检查格式
  if (!/^FOCR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizedCode)) {
    return { valid: false, error: '激活码格式无效' };
  }

  // 查询激活码
  const codeDataStr = await kv.get(`code:${normalizedCode}`);
  if (!codeDataStr) {
    return { valid: false, error: '激活码不存在' };
  }

  const codeData: ActivationCodeData = JSON.parse(codeDataStr);

  // 检查是否已使用
  if (codeData.usedBy) {
    return { valid: false, error: '激活码已被使用' };
  }

  return {
    valid: true,
    amount: codeData.amount,
    days: codeData.days,
    codeData,
  };
}

// 激活用户
export async function activateUser(
  kv: KVNamespace,
  userId: string,
  code: string,
  validation: ValidationResult
): Promise<ActivationResult> {
  if (!validation.valid || !validation.codeData) {
    return { success: false, message: validation.error || '激活码无效' };
  }

  const normalizedCode = code.trim().toUpperCase();
  const { days, codeData } = validation;

  // 获取用户当前数据
  const userDataStr = await kv.get(`user:${userId}`);
  const userData = userDataStr ? JSON.parse(userDataStr) : {
    userId,
    createdAt: Date.now(),
    expiresAt: null,
  };

  // 计算新的到期时间
  const now = Date.now();
  const currentExpiry = userData.expiresAt && userData.expiresAt > now ? userData.expiresAt : now;
  const newExpiry = currentExpiry + (days! * 24 * 60 * 60 * 1000);

  // 更新用户数据
  userData.expiresAt = newExpiry;
  await kv.put(`user:${userId}`, JSON.stringify(userData));

  // 标记激活码已使用
  codeData.usedBy = userId;
  codeData.usedAt = now;
  await kv.put(`code:${normalizedCode}`, JSON.stringify(codeData));

  const daysRemaining = Math.ceil((newExpiry - now) / (24 * 60 * 60 * 1000));

  return {
    success: true,
    message: `激活成功！有效期延长 ${days} 天`,
    expiresAt: newExpiry,
    daysRemaining,
  };
}
