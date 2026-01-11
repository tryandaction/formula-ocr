/**
 * 后端 API 客户端
 * 连接 Cloudflare Worker 后端
 */

// API 基础地址（部署后替换）
const API_BASE = import.meta.env.VITE_API_BASE || '';

// 获取或生成设备ID
export function getDeviceId(): string {
  let id = localStorage.getItem('formula_ocr_device_id');
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem('formula_ocr_device_id', id);
  }
  return id;
}

// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 30000; // 30秒
const RECOGNIZE_TIMEOUT = 60000; // 识别请求60秒（AI模型需要更长时间）

// 带超时的 fetch
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 通用请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  timeout?: number
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const requestTimeout = timeout || (endpoint.includes('/recognize') ? RECOGNIZE_TIMEOUT : REQUEST_TIMEOUT);
  
  try {
    const response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': getDeviceId(),
        ...options.headers,
      },
    }, requestTimeout);

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }
    
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接后重试');
    }
    throw error;
  }
}

// 用户信息
export interface UserInfo {
  userId: string;
  tier: 'anonymous' | 'registered' | 'paid' | 'admin';
  email?: string;
  emailVerified: boolean;
  isPaid: boolean;
  isAdmin: boolean;
  simulateMode: 'none' | 'anonymous' | 'registered' | 'paid';
  expiresAt: number | null;
  daysRemaining: number | null;
  todayUsage: number;
  monthUsage: number;
  totalUsage: number;
  createdAt: number;
}

// 额度信息
export interface QuotaInfo {
  canUse: boolean;
  tier: 'anonymous' | 'registered' | 'paid' | 'admin';
  isPaid: boolean;
  isAdmin: boolean;
  isRegistered: boolean;
  simulateMode: 'none' | 'anonymous' | 'registered' | 'paid';
  todayUsage: number;
  todayLimit: number;
  todayRemaining: number;
  monthUsage: number;
  monthLimit: number;
  monthRemaining: number;
  expiresAt: number | null;
  daysRemaining: number | null;
}

// 激活结果
export interface ActivationResult {
  success: boolean;
  message: string;
  expiresAt?: number;
  daysRemaining?: number;
}

// 识别结果
export interface RecognitionResult {
  success: boolean;
  latex?: string;
  error?: string;
}

/**
 * 获取用户信息
 */
export async function getUserInfo(): Promise<UserInfo> {
  return apiRequest<UserInfo>('/api/user/info');
}

/**
 * 检查额度
 */
export async function checkQuota(): Promise<QuotaInfo> {
  return apiRequest<QuotaInfo>('/api/quota/check');
}

/**
 * 激活码验证
 */
export async function activateCode(code: string): Promise<ActivationResult> {
  return apiRequest<ActivationResult>('/api/activate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * 公式识别（通过后端代理）
 */
export async function recognizeFormula(imageBase64: string): Promise<RecognitionResult> {
  return apiRequest<RecognitionResult>('/api/recognize', {
    method: 'POST',
    body: JSON.stringify({ image: imageBase64 }),
  });
}

/**
 * 检查后端是否可用
 */
export async function checkBackendHealth(): Promise<boolean> {
  if (!API_BASE) return false;
  
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 是否启用后端模式
 */
export function isBackendEnabled(): boolean {
  return !!API_BASE;
}


// 认证相关接口
export interface SendCodeResult {
  success: boolean;
  message: string;
}

export interface VerifyEmailResult {
  success: boolean;
  message: string;
  email?: string;
}

/**
 * 发送验证码
 */
export async function sendVerificationCode(email: string): Promise<SendCodeResult> {
  return apiRequest<SendCodeResult>('/api/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * 验证邮箱
 */
export async function verifyEmail(email: string, code: string): Promise<VerifyEmailResult> {
  return apiRequest<VerifyEmailResult>('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

/**
 * 账户恢复
 */
export async function recoverAccount(email: string): Promise<{ success: boolean; message: string; userId?: string }> {
  return apiRequest<{ success: boolean; message: string; userId?: string }>('/api/auth/recover', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}


// 模拟模式类型
export type SimulateMode = 'none' | 'anonymous' | 'registered' | 'paid';

/**
 * 设置管理员模拟模式
 * 只有管理员可以使用此功能
 */
export async function setSimulateMode(mode: SimulateMode): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>('/api/admin/simulate', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

// 支付流程说明：
// 1. 用户选择套餐，查看支付二维码
// 2. 用户扫码支付后联系客服获取激活码
// 3. 用户使用 activateCode() 函数激活会员
// 激活码接口已在上方定义：activateCode(code: string)
