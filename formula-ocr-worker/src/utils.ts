/**
 * 工具函数
 */

// 允许的来源列表
const ALLOWED_ORIGINS = [
  'https://formula-ocr.pages.dev',
  'https://formula-ocr-api.formula-ocr.workers.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:3000',
];

// 允许的来源模式（支持 Cloudflare Pages 预览部署）
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.formula-ocr\.pages\.dev$/,  // Cloudflare Pages 预览部署
  /^https:\/\/[a-z0-9-]+\.pages\.dev$/,  // 其他 Pages 预览
];

// 检查来源是否允许
function isOriginAllowed(origin: string | null, configOrigin: string): boolean {
  if (!origin) return false;
  if (configOrigin === '*') return true;
  if (origin === configOrigin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // 检查模式匹配（支持预览部署）
  for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
    if (pattern.test(origin)) return true;
  }
  
  return false;
}

// CORS 响应头
export function corsHeaders(origin: string, requestOrigin?: string | null): HeadersInit {
  // 如果配置为 *，或者请求来源在允许列表中，返回请求来源
  const allowedOrigin = origin === '*' 
    ? '*' 
    : (requestOrigin && isOriginAllowed(requestOrigin, origin) ? requestOrigin : origin);
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-ID, X-Admin-Key',
    'Access-Control-Max-Age': '86400',
  };
}

// 处理 CORS 预检请求
export function handleCORS(origin: string, requestOrigin?: string | null): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, requestOrigin),
  });
}

// JSON 响应
export function jsonResponse(data: unknown, origin: string, status = 200, requestOrigin?: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, requestOrigin),
    },
  });
}

// 错误响应
export function errorResponse(message: string, status: number, origin: string, requestOrigin?: string | null): Response {
  return jsonResponse({ error: message }, origin, status, requestOrigin);
}

// 生成随机字符串
export function randomString(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的字符
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 获取今天的日期字符串 (YYYY-MM-DD)
export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

// 获取本月的月份字符串 (YYYY-MM)
export function getMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}
