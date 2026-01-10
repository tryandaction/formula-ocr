/**
 * 支付系统 - 全自动支付确认
 * 
 * 支付流程：
 * 1. 用户选择套餐，创建订单（生成唯一验证码）
 * 2. 用户扫码支付，备注验证码
 * 3. 用户输入验证码，系统自动确认并升级权益
 */

import { randomString } from './utils';

// 套餐配置
export const PLANS = {
  monthly: {
    id: 'monthly',
    name: '月度会员',
    price: 5,
    days: 30,
    description: '每日200次识别额度',
  },
  quarterly: {
    id: 'quarterly',
    name: '季度会员',
    price: 14,
    days: 90,
    description: '每日200次识别额度，更优惠',
  },
  yearly: {
    id: 'yearly',
    name: '年度会员',
    price: 40,
    days: 365,
    description: '每日200次识别额度，最划算',
  },
} as const;

export type PlanId = keyof typeof PLANS;

// 订单状态
export type OrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export interface Order {
  orderId: string;
  visibleId: string;      // 用户可见的短订单号
  verifyCode: string;     // 支付验证码（用户支付时备注）
  userId: string;
  planId: PlanId;
  amount: number;
  days: number;
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  expiresAt: number;
}

export interface CreateOrderResult {
  success: boolean;
  order?: Order;
  error?: string;
}

export interface QueryOrderResult {
  success: boolean;
  order?: Order;
  error?: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  message: string;
  order?: Order;
}

// 生成短订单号: 日期+4位随机
function generateVisibleId(): string {
  const date = new Date();
  const dateStr = `${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  return `${dateStr}${randomString(4)}`;
}

// 生成内部订单ID
function generateOrderId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${dateStr}-${randomString(8)}`;
}

// 生成6位数字验证码
function generateVerifyCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 创建订单
export async function createOrder(
  kv: KVNamespace,
  userId: string,
  planId: PlanId
): Promise<CreateOrderResult> {
  const plan = PLANS[planId];
  if (!plan) {
    return { success: false, error: '无效的套餐' };
  }

  const orderId = generateOrderId();
  const visibleId = generateVisibleId();
  const verifyCode = generateVerifyCode();
  const now = Date.now();
  
  const order: Order = {
    orderId,
    visibleId,
    verifyCode,
    userId,
    planId,
    amount: plan.price,
    days: plan.days,
    status: 'pending',
    createdAt: now,
    paidAt: null,
    expiresAt: now + 30 * 60 * 1000, // 订单30分钟后过期
  };

  // 存储订单
  await kv.put(`order:${orderId}`, JSON.stringify(order), {
    expirationTtl: 24 * 60 * 60, // 24小时后自动删除
  });

  // 存储验证码到订单的映射（用于快速查找）
  await kv.put(`verify:${verifyCode}`, orderId, {
    expirationTtl: 60 * 60, // 1小时后过期
  });

  // 存储用户最新订单引用
  await kv.put(`user:${userId}:latest_order`, orderId, {
    expirationTtl: 24 * 60 * 60,
  });

  return { success: true, order };
}

// 查询订单
export async function queryOrder(
  kv: KVNamespace,
  orderId: string
): Promise<QueryOrderResult> {
  const orderStr = await kv.get(`order:${orderId}`);
  if (!orderStr) {
    return { success: false, error: '订单不存在' };
  }

  const order: Order = JSON.parse(orderStr);
  
  // 检查订单是否过期
  if (order.status === 'pending' && Date.now() > order.expiresAt) {
    order.status = 'expired';
    await kv.put(`order:${orderId}`, JSON.stringify(order));
  }

  return { success: true, order };
}

// 用户自助验证支付
export async function verifyPayment(
  kv: KVNamespace,
  verifyCode: string,
  userId: string
): Promise<VerifyPaymentResult> {
  // 通过验证码查找订单
  const orderId = await kv.get(`verify:${verifyCode}`);
  if (!orderId) {
    return { success: false, message: '验证码无效或已过期' };
  }

  const orderStr = await kv.get(`order:${orderId}`);
  if (!orderStr) {
    return { success: false, message: '订单不存在' };
  }

  const order: Order = JSON.parse(orderStr);

  // 验证订单归属
  if (order.userId !== userId) {
    return { success: false, message: '订单不属于当前用户' };
  }

  if (order.status === 'paid') {
    return { success: false, message: '订单已支付，无需重复验证' };
  }

  if (order.status === 'expired') {
    return { success: false, message: '订单已过期，请重新下单' };
  }

  if (order.status === 'cancelled') {
    return { success: false, message: '订单已取消' };
  }

  // 更新订单状态
  order.status = 'paid';
  order.paidAt = Date.now();
  await kv.put(`order:${orderId}`, JSON.stringify(order));

  // 删除验证码映射（防止重复使用）
  await kv.delete(`verify:${verifyCode}`);

  // 升级用户权益
  await upgradeUserFromOrder(kv, order);

  return { 
    success: true, 
    message: `支付验证成功！已为您开通 ${order.days} 天会员`, 
    order 
  };
}

// 管理员确认支付（保留作为备用）
export async function confirmPayment(
  kv: KVNamespace,
  orderId: string
): Promise<{ success: boolean; message: string; order?: Order }> {
  const orderStr = await kv.get(`order:${orderId}`);
  if (!orderStr) {
    return { success: false, message: '订单不存在' };
  }

  const order: Order = JSON.parse(orderStr);

  if (order.status === 'paid') {
    return { success: false, message: '订单已支付' };
  }

  if (order.status === 'expired') {
    return { success: false, message: '订单已过期' };
  }

  if (order.status === 'cancelled') {
    return { success: false, message: '订单已取消' };
  }

  // 更新订单状态
  order.status = 'paid';
  order.paidAt = Date.now();
  await kv.put(`order:${orderId}`, JSON.stringify(order));

  // 删除验证码映射
  if (order.verifyCode) {
    await kv.delete(`verify:${order.verifyCode}`);
  }

  // 升级用户权益
  await upgradeUserFromOrder(kv, order);

  return { success: true, message: '支付确认成功', order };
}

// 根据订单升级用户权益
async function upgradeUserFromOrder(kv: KVNamespace, order: Order): Promise<void> {
  const userDataStr = await kv.get(`user:${order.userId}`);
  const userData = userDataStr ? JSON.parse(userDataStr) : {
    userId: order.userId,
    createdAt: Date.now(),
    expiresAt: null,
  };

  // 计算新的到期时间（在现有基础上叠加）
  const now = Date.now();
  const currentExpiry = userData.expiresAt && userData.expiresAt > now 
    ? userData.expiresAt 
    : now;
  const newExpiry = currentExpiry + (order.days * 24 * 60 * 60 * 1000);

  // 更新用户数据
  userData.expiresAt = newExpiry;
  await kv.put(`user:${order.userId}`, JSON.stringify(userData));
}

// 获取所有套餐信息
export function getPlans() {
  return Object.values(PLANS);
}
