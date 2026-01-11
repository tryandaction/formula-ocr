/**
 * 支付系统 - 激活码模式
 * 
 * 支付流程（简化版）：
 * 1. 用户选择套餐，查看支付二维码和价格
 * 2. 用户扫码支付（无需备注任何内容）
 * 3. 支付后联系客服获取一次性激活码
 * 4. 用户输入激活码，系统自动验证并升级权益
 * 
 * 激活码特性：
 * - 每个激活码只能使用一次
 * - 激活码格式：FOCR-XXXX-XXXX-XXXX
 * - 激活码由管理员通过 /api/admin/generate-code 生成
 */

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

// 获取所有套餐信息
export function getPlans() {
  return Object.values(PLANS);
}

// 获取单个套餐信息
export function getPlan(planId: PlanId) {
  return PLANS[planId] || null;
}
