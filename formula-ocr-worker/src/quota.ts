/**
 * 用户额度管理
 */

import { getTodayKey, getMonthKey } from './utils';

// 免费用户限制
const FREE_DAILY_LIMIT = 10;   // 每天10次
const FREE_MONTHLY_LIMIT = 100; // 每月100次

// 付费用户限制
const PAID_DAILY_LIMIT = 200;   // 每天200次
const PAID_MONTHLY_LIMIT = 5000; // 每月5000次

export interface UserInfo {
  userId: string;
  isPaid: boolean;
  expiresAt: number | null;  // 付费到期时间戳
  daysRemaining: number | null;
  todayUsage: number;
  monthUsage: number;
  totalUsage: number;
  createdAt: number;
}

export interface QuotaInfo {
  canUse: boolean;
  isPaid: boolean;
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

  // 检查付费状态
  let isPaid = false;
  let expiresAt: number | null = null;
  let daysRemaining: number | null = null;

  if (userData?.expiresAt) {
    const now = Date.now();
    if (userData.expiresAt > now) {
      isPaid = true;
      expiresAt = userData.expiresAt;
      daysRemaining = Math.ceil((userData.expiresAt - now) / (24 * 60 * 60 * 1000));
    }
  }

  // 如果是新用户，创建记录
  if (!userData) {
    const newUser = {
      userId,
      createdAt: Date.now(),
      expiresAt: null,
    };
    await kv.put(`user:${userId}`, JSON.stringify(newUser));
  }

  return {
    userId,
    isPaid,
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
  
  const dailyLimit = userInfo.isPaid ? PAID_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const monthlyLimit = userInfo.isPaid ? PAID_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;

  const todayRemaining = Math.max(0, dailyLimit - userInfo.todayUsage);
  const monthRemaining = Math.max(0, monthlyLimit - userInfo.monthUsage);

  const canUse = todayRemaining > 0 && monthRemaining > 0;

  return {
    canUse,
    isPaid: userInfo.isPaid,
    todayUsage: userInfo.todayUsage,
    todayLimit: dailyLimit,
    todayRemaining,
    monthUsage: userInfo.monthUsage,
    monthLimit: monthlyLimit,
    monthRemaining,
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
