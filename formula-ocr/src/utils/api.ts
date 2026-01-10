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

// 通用请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': getDeviceId(),
      ...options.headers,
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }
  
  return data as T;
}

// 用户信息
export interface UserInfo {
  userId: string;
  isPaid: boolean;
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
