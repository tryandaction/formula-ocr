/**
 * 用户额度管理
 */

import { getTodayKey, getMonthKey } from './utils';

// 匿名用户限制（未登录/未绑定邮箱）
const ANONYMOUS_DAILY_LIMIT = 1;   // 每天1次
const ANONYMOUS_MONTHLY_LIMIT = 3; // 每月3次

// 注册用户限制（已绑定邮箱）
const FREE_DAILY_LIMIT = 10;   // 每天10次
const FREE_MONTHLY_LIMIT = 100; // 每月100次

// 付费用户限制
const PAID_DAILY_LIMIT = 200;   // 每天200次
const PAID_MONTHLY_LIMIT = 5000; // 每月5000次

// 管理员邮箱列表（这些用户拥有无限额度）
const ADMIN_EMAILS = [
  'admin@formula-ocr.com',
  // 在这里添加你的邮箱
];

// 用户层级
export type UserTier = 'anonymous' | 'registered' | 'paid' | 'admin';

// 模拟模式类型
export type SimulateMode = 'none' | 'anonymous' | 'registered' | 'paid';

/**
 * 检查是否是管理员
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * 添加管理员邮箱（运行时）
 */
export function addAdminEmail(email: string): void {
  if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
    ADMIN_EMAILS.push(email.toLowerCase());
  }
}

export interface UserInfo {
  userId: string;
  tier: UserTier;
  email?: string;
  emailVerified: boolean;
  isPaid: boolean;
  isAdmin: boolean;
  simulateMode: SimulateMode;
  expiresAt: number | null;  // 付费到期时间戳
  daysRemaining: number | null;
  todayUsage: number;
  monthUsage: number;
  totalUsage: number;
  createdAt: number;
}

export interface QuotaInfo {
  canUse: boolean;
  tier: UserTier;
  isPaid: boolean;
  isAdmin: boolean;
  isRegistered: boolean;
  simulateMode: SimulateMode;
  todayUsage: number;
  todayLimit: number;
  todayRemaining: number;
  monthUsage: number;
  monthLimit: number;
  monthRemaining: number;
  expiresAt: number | null;
  daysRemaining: number | null;
}

// 获取用户信息
export async function getUserInfo(kv: KVNamespace, userId: string): Promise<UserInfo> {
  const today = getTodayKey();
  const month = getMonthKey();

  // 并行获取所有数据
  const [userDataStr, todayUsageStr, monthUsageStr, totalUsageStr] = await Promise.all([
    kv.get(`user:${userId}`),
    kv.get(`usage:${userId}:${today}`),
    kv.get(`usage:${userId}:${month}`),
    kv.get(`usage:${userId}:total`),
  ]);

  const userData = userDataStr ? JSON.parse(userDataStr) : null;
  const todayUsage = parseInt(todayUsageStr || '0', 10);
  const monthUsage = parseInt(monthUsageStr || '0', 10);
  const totalUsage = parseInt(totalUsageStr || '0', 10);

  // 检查是否是管理员
  const isAdmin = isAdminEmail(userData?.email);
  const simulateMode: SimulateMode = userData?.simulateMode || 'none';

  // 确定用户层级
  let tier: UserTier = 'anonymous';
  let isPaid = false;
  let expiresAt: number | null = null;
  let daysRemaining: number | null = null;

  // 管理员特权
  if (isAdmin && simulateMode === 'none') {
    tier = 'admin';
  } else if (userData?.expiresAt) {
    const now = Date.now();
    if (userData.expiresAt > now) {
      isPaid = true;
      tier = 'paid';
      expiresAt = userData.expiresAt;
      daysRemaining = Math.ceil((userData.expiresAt - now) / (24 * 60 * 60 * 1000));
    }
  }

  // 如果不是付费用户也不是管理员，检查是否已注册（绑定邮箱）
  if (tier !== 'paid' && tier !== 'admin' && userData?.email && userData?.emailVerified) {
    tier = 'registered';
  }

  // 如果是新用户，创建记录
  if (!userData) {
    const newUser = {
      userId,
      createdAt: Date.now(),
      expiresAt: null,
      email: null,
      emailVerified: false,
      simulateMode: 'none',
    };
    await kv.put(`user:${userId}`, JSON.stringify(newUser));
  }

  return {
    userId,
    tier,
    email: userData?.email,
    emailVerified: userData?.emailVerified || false,
    isPaid,
    isAdmin,
    simulateMode,
    expiresAt,
    daysRemaining,
    todayUsage,
    monthUsage,
    totalUsage,
    createdAt: userData?.createdAt || Date.now(),
  };
}

// 检查额度
export async function checkQuota(kv: KVNamespace, userId: string): Promise<QuotaInfo> {
  const userInfo = await getUserInfo(kv, userId);
  
  // 管理员模拟模式：返回模拟的用户层级体验
  let effectiveTier = userInfo.tier;
  if (userInfo.isAdmin && userInfo.simulateMode !== 'none') {
    effectiveTier = userInfo.simulateMode as UserTier;
  }
  
  // 根据用户层级确定限制
  let dailyLimit: number;
  let monthlyLimit: number;
  
  switch (effectiveTier) {
    case 'admin':
      dailyLimit = 999999;
      monthlyLimit = 999999;
      break;
    case 'paid':
      dailyLimit = PAID_DAILY_LIMIT;
      monthlyLimit = PAID_MONTHLY_LIMIT;
      break;
    case 'registered':
      dailyLimit = FREE_DAILY_LIMIT;
      monthlyLimit = FREE_MONTHLY_LIMIT;
      break;
    default: // anonymous
      dailyLimit = ANONYMOUS_DAILY_LIMIT;
      monthlyLimit = ANONYMOUS_MONTHLY_LIMIT;
  }

  const todayRemaining = Math.max(0, dailyLimit - userInfo.todayUsage);
  const monthRemaining = Math.max(0, monthlyLimit - userInfo.monthUsage);

  // 管理员始终可以使用（即使在模拟模式下）
  const canUse = userInfo.isAdmin || (todayRemaining > 0 && monthRemaining > 0);

  return {
    canUse,
    tier: effectiveTier,
    isPaid: userInfo.isPaid || effectiveTier === 'paid',
    isAdmin: userInfo.isAdmin,
    isRegistered: effectiveTier === 'registered' || effectiveTier === 'paid' || effectiveTier === 'admin',
    simulateMode: userInfo.simulateMode,
    todayUsage: userInfo.todayUsage,
    todayLimit: dailyLimit,
    todayRemaining: userInfo.isAdmin ? 999999 : todayRemaining,
    monthUsage: userInfo.monthUsage,
    monthLimit: monthlyLimit,
    monthRemaining: userInfo.isAdmin ? 999999 : monthRemaining,
    expiresAt: userInfo.expiresAt,
    daysRemaining: userInfo.daysRemaining,
  };
}

// 记录使用
export async function recordUsage(kv: KVNamespace, userId: string): Promise<void> {
  const today = getTodayKey();
  const month = getMonthKey();

  // 获取当前使用量
  const [todayUsageStr, monthUsageStr, totalUsageStr] = await Promise.all([
    kv.get(`usage:${userId}:${today}`),
    kv.get(`usage:${userId}:${month}`),
    kv.get(`usage:${userId}:total`),
  ]);

  const todayUsage = parseInt(todayUsageStr || '0', 10) + 1;
  const monthUsage = parseInt(monthUsageStr || '0', 10) + 1;
  const totalUsage = parseInt(totalUsageStr || '0', 10) + 1;

  // 更新使用量（设置过期时间自动清理）
  await Promise.all([
    kv.put(`usage:${userId}:${today}`, todayUsage.toString(), {
      expirationTtl: 2 * 24 * 60 * 60, // 2天后过期
    }),
    kv.put(`usage:${userId}:${month}`, monthUsage.toString(), {
      expirationTtl: 35 * 24 * 60 * 60, // 35天后过期
    }),
    kv.put(`usage:${userId}:total`, totalUsage.toString()),
  ]);
}


/**
 * 设置管理员模拟模式
 * 只有管理员可以使用此功能
 */
export async function setSimulateMode(
  kv: KVNamespace,
  userId: string,
  mode: SimulateMode
): Promise<{ success: boolean; message: string }> {
  const userDataStr = await kv.get(`user:${userId}`);
  if (!userDataStr) {
    return { success: false, message: '用户不存在' };
  }

  const userData = JSON.parse(userDataStr);
  
  // 检查是否是管理员
  if (!isAdminEmail(userData.email)) {
    return { success: false, message: '只有管理员可以使用模拟模式' };
  }

  // 更新模拟模式
  userData.simulateMode = mode;
  await kv.put(`user:${userId}`, JSON.stringify(userData));

  const modeNames: Record<SimulateMode, string> = {
    none: '管理员模式（无限额度）',
    anonymous: '匿名用户体验',
    registered: '注册用户体验',
    paid: '付费用户体验',
  };

  return { 
    success: true, 
    message: `已切换到：${modeNames[mode]}` 
  };
}
