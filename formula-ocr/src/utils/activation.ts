// 激活码系统 - 用于付费用户解锁智谱API

// 激活码格式: FOCR-{金额}-{过期时间戳}-{校验码}
// 例如: FOCR-10-1737504000-a1b2c3d4

// 金额对应有效期（天）- 与后端套餐配置保持一致
export const AMOUNT_TO_DAYS: Record<number, number> = {
  5: 30,    // ¥5 = 30天（月度会员）
  14: 90,   // ¥14 = 90天（季度会员）
  40: 365,  // ¥40 = 365天（年度会员）
};

// 激活码密钥（用于生成校验码）
// 注意：这个密钥在前端是可见的，但足以防止普通用户伪造
const SECRET_KEY = 'formula-ocr-2024-secret';

export interface ActivationInfo {
  isValid: boolean;
  amount?: number;
  expiresAt?: Date;
  daysRemaining?: number;
  code?: string;
}

/**
 * 生成简单的校验码
 */
function generateChecksum(amount: number, expireTimestamp: number): string {
  const data = `${SECRET_KEY}-${amount}-${expireTimestamp}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8).padStart(8, '0');
}

/**
 * 生成激活码（供管理员使用）
 * 可以在浏览器控制台调用：generateActivationCode(10)
 */
export function generateActivationCode(amount: number): string {
  const days = AMOUNT_TO_DAYS[amount];
  if (!days) {
    throw new Error(`不支持的金额: ${amount}，支持的金额: ${Object.keys(AMOUNT_TO_DAYS).join(', ')}`);
  }
  
  const expireTimestamp = Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);
  const checksum = generateChecksum(amount, expireTimestamp);
  
  return `FOCR-${amount}-${expireTimestamp}-${checksum}`;
}

/**
 * 验证激活码
 */
export function validateActivationCode(code: string): ActivationInfo {
  if (!code || typeof code !== 'string') {
    return { isValid: false };
  }

  const parts = code.trim().toUpperCase().split('-');
  if (parts.length !== 4 || parts[0] !== 'FOCR') {
    return { isValid: false };
  }

  const amount = parseInt(parts[1], 10);
  const expireTimestamp = parseInt(parts[2], 10);
  const providedChecksum = parts[3].toLowerCase();

  // 验证金额
  if (!AMOUNT_TO_DAYS[amount]) {
    return { isValid: false };
  }

  // 验证校验码
  const expectedChecksum = generateChecksum(amount, expireTimestamp);
  if (providedChecksum !== expectedChecksum) {
    return { isValid: false };
  }

  // 验证是否过期
  const now = Math.floor(Date.now() / 1000);
  if (expireTimestamp < now) {
    return { isValid: false };
  }

  const expiresAt = new Date(expireTimestamp * 1000);
  const daysRemaining = Math.ceil((expireTimestamp - now) / (24 * 60 * 60));

  return {
    isValid: true,
    amount,
    expiresAt,
    daysRemaining,
    code: code.trim().toUpperCase()
  };
}

// localStorage 键名
const ACTIVATION_CODE_KEY = 'formula_ocr_activation_code';

/**
 * 保存激活码到本地存储
 */
export function saveActivationCode(code: string): boolean {
  const info = validateActivationCode(code);
  if (info.isValid) {
    localStorage.setItem(ACTIVATION_CODE_KEY, code.trim().toUpperCase());
    return true;
  }
  return false;
}

/**
 * 获取当前激活状态
 */
export function getActivationStatus(): ActivationInfo {
  const code = localStorage.getItem(ACTIVATION_CODE_KEY);
  if (!code) {
    return { isValid: false };
  }
  return validateActivationCode(code);
}

/**
 * 清除激活码
 */
export function clearActivationCode(): void {
  localStorage.removeItem(ACTIVATION_CODE_KEY);
}

/**
 * 检查是否为付费用户（激活码有效）
 */
export function isPaidUser(): boolean {
  return getActivationStatus().isValid;
}

// 将生成函数暴露到全局，方便管理员在控制台使用
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).generateActivationCode = generateActivationCode;
}
