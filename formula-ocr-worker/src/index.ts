/**
 * Formula OCR API - Cloudflare Worker
 * 
 * 功能：
 * 1. 用户注册/登录（设备ID）
 * 2. 免费额度管理（每天/每月限制）
 * 3. 激活码验证
 * 4. 代理智谱API调用
 */

import { handleCORS, jsonResponse, errorResponse } from './utils';
import { checkQuota, recordUsage, getUserInfo, setSimulateMode, addAdminEmail, type SimulateMode } from './quota';
import { validateActivationCode, activateUser, generateActivationCode } from './activation';
import { proxyZhipuAPI } from './zhipu';
import { createOrder, queryOrder, confirmPayment, verifyPayment, getPlans, type PlanId } from './payment';
import { sendVerificationCode, verifyEmailCode, recoverByEmail, isValidEmail } from './auth';

export interface Env {
  USERS: KVNamespace;
  ZHIPU_API_KEY: string;
  ADMIN_SECRET: string;
  CORS_ORIGIN: string;
  RESEND_API_KEY?: string;  // 可选，用于发送验证邮件
  ADMIN_EMAILS?: string;    // 可选，逗号分隔的管理员邮箱列表
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestOrigin = request.headers.get('Origin');
    
    // 初始化管理员邮箱列表
    if (env.ADMIN_EMAILS) {
      env.ADMIN_EMAILS.split(',').forEach(email => addAdminEmail(email.trim()));
    }
    
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleCORS(env.CORS_ORIGIN, requestOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 路由
      switch (path) {
        // 根路径
        case '/':
          return jsonResponse({ 
            name: 'Formula OCR API',
            version: '1.0.0',
            status: 'running',
            endpoints: [
              '/api/health', 
              '/api/user/info', 
              '/api/quota/check', 
              '/api/activate', 
              '/api/recognize',
              '/api/auth/send-code',
              '/api/auth/verify',
              '/api/auth/recover',
              '/api/payment/plans',
              '/api/payment/create-order',
              '/api/payment/query-order',
              '/api/payment/verify'
            ]
          }, env.CORS_ORIGIN, 200, requestOrigin);

        // 获取用户信息和额度
        case '/api/user/info':
          return await handleGetUserInfo(request, env, requestOrigin);

        // 检查是否可以使用
        case '/api/quota/check':
          return await handleCheckQuota(request, env, requestOrigin);

        // 发送验证码
        case '/api/auth/send-code':
          return await handleSendVerificationCode(request, env, requestOrigin);

        // 验证邮箱
        case '/api/auth/verify':
          return await handleVerifyEmail(request, env, requestOrigin);

        // 账户恢复
        case '/api/auth/recover':
          return await handleRecoverAccount(request, env, requestOrigin);

        // 管理员：设置模拟模式
        case '/api/admin/simulate':
          return await handleSetSimulateMode(request, env, requestOrigin);

        // 激活码验证
        case '/api/activate':
          return await handleActivate(request, env, requestOrigin);

        // 公式识别（代理智谱API）
        case '/api/recognize':
          return await handleRecognize(request, env, requestOrigin);

        // 管理员：生成激活码
        case '/api/admin/generate-code':
          return await handleAdminGenerateCode(request, env, requestOrigin);

        // 管理员：确认支付
        case '/api/admin/confirm-payment':
          return await handleAdminConfirmPayment(request, env, requestOrigin);

        // 管理员：查看用户
        case '/api/admin/users':
          return await handleAdminListUsers(request, env, requestOrigin);

        // 支付：获取套餐列表
        case '/api/payment/plans':
          return jsonResponse({ plans: getPlans() }, env.CORS_ORIGIN, 200, requestOrigin);

        // 支付：创建订单
        case '/api/payment/create-order':
          return await handleCreateOrder(request, env, requestOrigin);

        // 支付：查询订单
        case '/api/payment/query-order':
          return await handleQueryOrder(request, env, requestOrigin);

        // 支付：用户自助验证支付
        case '/api/payment/verify':
          return await handleVerifyPayment(request, env, requestOrigin);

        // 健康检查
        case '/api/health':
          return jsonResponse({ status: 'ok', timestamp: Date.now() }, env.CORS_ORIGIN, 200, requestOrigin);

        default:
          return errorResponse('Not Found', 404, env.CORS_ORIGIN, requestOrigin);
      }
    } catch (error) {
      console.error('Error:', error);
      return errorResponse(
        error instanceof Error ? error.message : 'Internal Server Error',
        500,
        env.CORS_ORIGIN,
        requestOrigin
      );
    }
  },
};

// 获取用户信息
async function handleGetUserInfo(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const userInfo = await getUserInfo(env.USERS, userId);
  return jsonResponse(userInfo, env.CORS_ORIGIN, 200, requestOrigin);
}

// 检查额度
async function handleCheckQuota(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const quota = await checkQuota(env.USERS, userId);
  return jsonResponse(quota, env.CORS_ORIGIN, 200, requestOrigin);
}

// 激活码验证
async function handleActivate(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { code: string };
  if (!body.code) {
    return errorResponse('Missing activation code', 400, env.CORS_ORIGIN, requestOrigin);
  }

  // 验证激活码
  const validation = await validateActivationCode(env.USERS, body.code);
  if (!validation.valid) {
    return errorResponse(validation.error || 'Invalid code', 400, env.CORS_ORIGIN, requestOrigin);
  }

  // 激活用户
  const result = await activateUser(env.USERS, userId, body.code, validation);
  return jsonResponse(result, env.CORS_ORIGIN, 200, requestOrigin);
}

// 公式识别
async function handleRecognize(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  // 检查额度
  const quota = await checkQuota(env.USERS, userId);
  if (!quota.canUse) {
    return errorResponse('Quota exceeded. Please upgrade or wait for reset.', 403, env.CORS_ORIGIN, requestOrigin);
  }

  // 获取图片数据
  const body = await request.json() as { image: string };
  if (!body.image) {
    return errorResponse('Missing image data', 400, env.CORS_ORIGIN, requestOrigin);
  }

  // 调用智谱API
  const result = await proxyZhipuAPI(body.image, env.ZHIPU_API_KEY);

  // 记录使用
  await recordUsage(env.USERS, userId);

  return jsonResponse(result, env.CORS_ORIGIN, 200, requestOrigin);
}

// 管理员：生成激活码
async function handleAdminGenerateCode(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  // 验证管理员密钥
  const adminKey = request.headers.get('X-Admin-Key');
  if (adminKey !== env.ADMIN_SECRET) {
    return errorResponse('Unauthorized', 401, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { amount: number; count?: number };
  if (!body.amount) {
    return errorResponse('Missing amount', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const count = body.count || 1;
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = await generateActivationCode(env.USERS, body.amount);
    codes.push(code);
  }

  return jsonResponse({ codes }, env.CORS_ORIGIN, 200, requestOrigin);
}

// 管理员：查看用户列表
async function handleAdminListUsers(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  const adminKey = request.headers.get('X-Admin-Key');
  if (adminKey !== env.ADMIN_SECRET) {
    return errorResponse('Unauthorized', 401, env.CORS_ORIGIN, requestOrigin);
  }

  // KV list 有限制，这里简单返回提示
  return jsonResponse({ 
    message: 'Use Cloudflare Dashboard to view KV data',
    tip: 'Or implement pagination with KV list API'
  }, env.CORS_ORIGIN, 200, requestOrigin);
}

// 创建订单
async function handleCreateOrder(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { planId: string };
  if (!body.planId) {
    return errorResponse('Missing planId', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await createOrder(env.USERS, userId, body.planId as PlanId);
  if (!result.success) {
    return errorResponse(result.error || 'Failed to create order', 400, env.CORS_ORIGIN, requestOrigin);
  }

  return jsonResponse(result, env.CORS_ORIGIN, 200, requestOrigin);
}

// 查询订单
async function handleQueryOrder(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId');
  
  if (!orderId) {
    return errorResponse('Missing orderId parameter', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await queryOrder(env.USERS, orderId);
  if (!result.success) {
    return errorResponse(result.error || 'Order not found', 404, env.CORS_ORIGIN, requestOrigin);
  }

  return jsonResponse(result, env.CORS_ORIGIN, 200, requestOrigin);
}

// 用户自助验证支付
async function handleVerifyPayment(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { verifyCode: string };
  if (!body.verifyCode) {
    return errorResponse('Missing verifyCode', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await verifyPayment(env.USERS, body.verifyCode, userId);
  return jsonResponse(result, env.CORS_ORIGIN, result.success ? 200 : 400, requestOrigin);
}

// 管理员：确认支付
async function handleAdminConfirmPayment(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const adminKey = request.headers.get('X-Admin-Key');
  if (adminKey !== env.ADMIN_SECRET) {
    return errorResponse('Unauthorized', 401, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { orderId: string };
  if (!body.orderId) {
    return errorResponse('Missing orderId', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await confirmPayment(env.USERS, body.orderId);
  if (!result.success) {
    return errorResponse(result.message, 400, env.CORS_ORIGIN, requestOrigin);
  }

  return jsonResponse(result, env.CORS_ORIGIN, 200, requestOrigin);
}

// 发送验证码
async function handleSendVerificationCode(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { email: string };
  if (!body.email) {
    return errorResponse('Missing email', 400, env.CORS_ORIGIN, requestOrigin);
  }

  if (!isValidEmail(body.email)) {
    return errorResponse('Invalid email format', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await sendVerificationCode(env.USERS, body.email, userId, env.RESEND_API_KEY);
  return jsonResponse(result, env.CORS_ORIGIN, result.success ? 200 : 400, requestOrigin);
}

// 验证邮箱
async function handleVerifyEmail(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { email: string; code: string };
  if (!body.email || !body.code) {
    return errorResponse('Missing email or code', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await verifyEmailCode(env.USERS, body.email, body.code, userId);
  return jsonResponse(result, env.CORS_ORIGIN, result.success ? 200 : 400, requestOrigin);
}

// 账户恢复
async function handleRecoverAccount(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { email: string };
  if (!body.email) {
    return errorResponse('Missing email', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await recoverByEmail(env.USERS, body.email);
  return jsonResponse(result, env.CORS_ORIGIN, result.success ? 200 : 400, requestOrigin);
}

// 管理员：设置模拟模式
async function handleSetSimulateMode(request: Request, env: Env, requestOrigin: string | null): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, env.CORS_ORIGIN, requestOrigin);
  }

  const userId = request.headers.get('X-User-ID');
  if (!userId) {
    return errorResponse('Missing X-User-ID header', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const body = await request.json() as { mode: SimulateMode };
  if (!body.mode || !['none', 'anonymous', 'registered', 'paid'].includes(body.mode)) {
    return errorResponse('Invalid mode. Must be: none, anonymous, registered, or paid', 400, env.CORS_ORIGIN, requestOrigin);
  }

  const result = await setSimulateMode(env.USERS, userId, body.mode);
  return jsonResponse(result, env.CORS_ORIGIN, result.success ? 200 : 403, requestOrigin);
}
