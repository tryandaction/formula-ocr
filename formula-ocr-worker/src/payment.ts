/**
 * 支付系统
 * 
 * 支付流程：
 * 1. 用户选择套餐，创建订单
 * 2. 用户扫码支付
 * 3. 前端轮询订单状态
 * 4. 管理员确认支付后，自动升级用户权益
 * 
 * 注意：由于没有接入真实支付网关，采用管理员手动确认模式
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
    price: 10,
    days: 90,
    description: '每日200次识别额度，更优惠',
  },
  yearly: {
    id: 'yearly',
    name: '年度会员',
    price: 20,
    days: 365,
    description: '每日200次识别额度，最划算',
  },
} as const;

export type PlanId = keyof typeof PLANS;

// 订单状态
export type OrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export interface Order {
  orderId: string;
  userId: string;
  planId: PlanId;
  amount: number;
  days: number;
  status: OrderStatus;
  createdAt: number;
  paidAt: number | null;
  expiresAt: number; // 订单过期时间（非会员过期时间）
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

// 生成订单ID: ORD-YYYYMMDD-XXXXXX
function generateOrderId(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${dateStr}-${randomString(6)}`;
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
  const now = Date.now();
  
  const order: Order = {
    orderId,
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
    expirationTtl: 7 * 24 * 60 * 60, // 7天后自动删除
  });

  // 存储用户最新订单引用
  await kv.put(`user:${userId}:latest_order`, orderId, {
    expirationTtl: 7 * 24 * 60 * 60,
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

// 确认支付（管理员操作）
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

  // 计算新的到期时间
  const now = Date.now();
  const currentExpiry = userData.expiresAt && userData.expiresAt > now 
    ? userData.expiresAt 
    : now;
  const newExpiry = currentExpiry + (order.days * 24 * 60 * 60 * 1000);

  // 更新用户数据
  userData.expiresAt = newExpiry;
  await kv.put(`user:${order.userId}`, JSON.stringify(userData));
}

// 获取用户最新订单
export async function getUserLatestOrder(
  kv: KVNamespace,
  userId: string
): Promise<Order | null> {
  const orderId = await kv.get(`user:${userId}:latest_order`);
  if (!orderId) return null;

  const result = await queryOrder(kv, orderId);
  return result.success ? result.order! : null;
}

// 获取所有套餐信息
export function getPlans() {
  return Object.values(PLANS);
}
