/**
 * 工具函数
 */

// CORS 响应头
export function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-ID, X-Admin-Key',
    'Access-Control-Max-Age': '86400',
  };
}

// 处理 CORS 预检请求
export function handleCORS(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// JSON 响应
export function jsonResponse(data: unknown, origin: string, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

// 错误响应
export function errorResponse(message: string, status: number, origin: string): Response {
  return jsonResponse({ error: message }, origin, status);
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
