/**
 * 用户服务
 * 管理用户身份、设备ID、邮箱绑定等
 */

// 用户层级
export type UserTier = 'anonymous' | 'registered' | 'paid';

// 用户身份信息
export interface UserIdentity {
  deviceId: string;
  email?: string;
  emailVerified: boolean;
  tier: UserTier;
  paidUntil?: Date;
  createdAt: Date;
  lastActiveAt: Date;
}

// 本地存储的用户数据
interface StoredUserData {
  deviceId: string;
  email?: string;
  emailVerified: boolean;
  paidUntil?: string;
  createdAt: string;
  lastActiveAt: string;
}

// 存储键
const STORAGE_KEYS = {
  USER_DATA: 'formula_ocr_user',
  DEVICE_ID: 'formula_ocr_device_id',
} as const;

/**
 * 生成稳定的设备ID
 * 基于浏览器特征生成，尽量保持跨会话一致
 */
function generateDeviceId(): string {
  // 收集浏览器特征
  const components: string[] = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency || 0),
    navigator.platform || '',
  ];
  
  // 简单哈希函数
  const fingerprint = components.join('|');
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // 添加随机部分以防止完全相同的指纹
  const random = Math.random().toString(36).slice(2, 8);
  const timestamp = Date.now().toString(36);
  
  return `dev_${Math.abs(hash).toString(36)}_${timestamp}_${random}`;
}

/**
 * 获取或创建设备ID
 */
export function getOrCreateDeviceId(): string {
  // 先尝试从 localStorage 获取
  let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  
  if (!deviceId) {
    // 生成新的设备ID
    deviceId = generateDeviceId();
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
  }
  
  return deviceId;
}

/**
 * 获取存储的用户数据
 */
function getStoredUserData(): StoredUserData | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to parse user data:', e);
  }
  return null;
}

/**
 * 保存用户数据
 */
function saveUserData(data: StoredUserData): void {
  localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data));
}

/**
 * 确定用户层级
 */
function determineUserTier(data: StoredUserData | null): UserTier {
  if (!data) return 'anonymous';
  
  // 检查是否付费有效
  if (data.paidUntil) {
    const paidUntil = new Date(data.paidUntil);
    if (paidUntil > new Date()) {
      return 'paid';
    }
  }
  
  // 检查是否已绑定邮箱
  if (data.email && data.emailVerified) {
    return 'registered';
  }
  
  return 'anonymous';
}

/**
 * 获取用户身份信息
 */
export function getUserIdentity(): UserIdentity {
  const deviceId = getOrCreateDeviceId();
  const storedData = getStoredUserData();
  
  const now = new Date();
  
  if (storedData) {
    // 更新最后活跃时间
    storedData.lastActiveAt = now.toISOString();
    saveUserData(storedData);
    
    return {
      deviceId: storedData.deviceId,
      email: storedData.email,
      emailVerified: storedData.emailVerified,
      tier: determineUserTier(storedData),
      paidUntil: storedData.paidUntil ? new Date(storedData.paidUntil) : undefined,
      createdAt: new Date(storedData.createdAt),
      lastActiveAt: now,
    };
  }
  
  // 创建新用户数据
  const newUserData: StoredUserData = {
    deviceId,
    emailVerified: false,
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
  };
  saveUserData(newUserData);
  
  return {
    deviceId,
    emailVerified: false,
    tier: 'anonymous',
    createdAt: now,
    lastActiveAt: now,
  };
}

/**
 * 更新用户邮箱（待验证）
 */
export function setUserEmail(email: string): void {
  const storedData = getStoredUserData();
  const deviceId = getOrCreateDeviceId();
  
  const updatedData: StoredUserData = {
    ...storedData,
    deviceId,
    email,
    emailVerified: false,
    createdAt: storedData?.createdAt || new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  
  saveUserData(updatedData);
}

/**
 * 标记邮箱已验证
 */
export function markEmailVerified(): void {
  const storedData = getStoredUserData();
  if (storedData && storedData.email) {
    storedData.emailVerified = true;
    storedData.lastActiveAt = new Date().toISOString();
    saveUserData(storedData);
  }
}

/**
 * 设置付费到期时间
 */
export function setPaidUntil(date: Date): void {
  const storedData = getStoredUserData();
  const deviceId = getOrCreateDeviceId();
  
  const updatedData: StoredUserData = {
    ...storedData,
    deviceId,
    emailVerified: storedData?.emailVerified || false,
    paidUntil: date.toISOString(),
    createdAt: storedData?.createdAt || new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  
  saveUserData(updatedData);
}

/**
 * 清除付费状态
 */
export function clearPaidStatus(): void {
  const storedData = getStoredUserData();
  if (storedData) {
    delete storedData.paidUntil;
    storedData.lastActiveAt = new Date().toISOString();
    saveUserData(storedData);
  }
}

/**
 * 通过邮箱恢复账户（需要后端支持）
 */
export async function recoverByEmail(_email: string): Promise<{ success: boolean; message: string }> {
  // 这个功能需要后端支持
  // 暂时返回模拟结果
  return {
    success: false,
    message: '账户恢复功能需要后端支持，请联系管理员',
  };
}

/**
 * 获取用户层级的显示名称
 */
export function getTierDisplayName(tier: UserTier): string {
  switch (tier) {
    case 'paid':
      return '付费用户';
    case 'registered':
      return '注册用户';
    default:
      return '免费用户';
  }
}

/**
 * 获取用户层级的颜色类名
 */
export function getTierColorClass(tier: UserTier): string {
  switch (tier) {
    case 'paid':
      return 'text-amber-600 bg-amber-50';
    case 'registered':
      return 'text-blue-600 bg-blue-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * 计算付费剩余天数
 */
export function getPaidDaysRemaining(paidUntil?: Date): number | null {
  if (!paidUntil) return null;
  
  const now = new Date();
  const diff = paidUntil.getTime() - now.getTime();
  
  if (diff <= 0) return 0;
  
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
