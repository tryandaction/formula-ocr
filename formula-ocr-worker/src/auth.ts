/**
 * 用户认证模块
 * 支持邮箱注册/登录
 * 使用 Resend 发送验证邮件
 */

// 验证码有效期（10分钟）
const VERIFICATION_CODE_TTL = 10 * 60;

// Resend API 配置
const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'Formula OCR <onboarding@resend.dev>'; // 使用 Resend 默认发件地址

export interface VerificationResult {
  success: boolean;
  message: string;
  email?: string;
}

export interface SendCodeResult {
  success: boolean;
  message: string;
}

/**
 * 通过 Resend 发送邮件
 */
async function sendEmailViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Resend API error:', errorData);
      return { 
        success: false, 
        error: (errorData as any).message || `HTTP ${response.status}` 
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 生成验证码邮件 HTML
 */
function generateVerificationEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px 0; text-align: center;">📐 Formula OCR</h1>
    <p style="color: #666; font-size: 14px; margin: 0 0 24px 0; text-align: center;">公式识别工具</p>
    
    <p style="color: #333; font-size: 16px; margin: 0 0 16px 0;">您的验证码是：</p>
    
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
      <span style="color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</span>
    </div>
    
    <p style="color: #666; font-size: 14px; margin: 0 0 8px 0;">验证码有效期为 <strong>10 分钟</strong></p>
    <p style="color: #999; font-size: 12px; margin: 0;">如果您没有请求此验证码，请忽略此邮件。</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 生成验证码
 */
function generateVerificationCode(): string {
  // 生成6位数字验证码
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 发送验证码（存储到 KV 并通过 Resend 发送邮件）
 */
export async function sendVerificationCode(
  kv: KVNamespace,
  email: string,
  userId: string,
  resendApiKey?: string
): Promise<SendCodeResult> {
  if (!isValidEmail(email)) {
    return { success: false, message: '邮箱格式不正确' };
  }

  // 检查是否频繁发送（1分钟内只能发送一次）
  const rateLimitKey = `rate:email:${email}`;
  const lastSent = await kv.get(rateLimitKey);
  if (lastSent) {
    return { success: false, message: '发送太频繁，请稍后再试' };
  }

  // 生成验证码
  const code = generateVerificationCode();
  
  // 存储验证码
  const verificationData = {
    code,
    email,
    userId,
    createdAt: Date.now(),
  };
  
  await Promise.all([
    // 存储验证码（10分钟有效）
    kv.put(`verification:${email}`, JSON.stringify(verificationData), {
      expirationTtl: VERIFICATION_CODE_TTL,
    }),
    // 设置发送频率限制（1分钟）
    kv.put(rateLimitKey, '1', {
      expirationTtl: 60,
    }),
  ]);

  // 通过 Resend 发送邮件
  if (resendApiKey) {
    const emailResult = await sendEmailViaResend(
      resendApiKey,
      email,
      '【Formula OCR】邮箱验证码',
      generateVerificationEmailHtml(code)
    );

    if (!emailResult.success) {
      console.error(`Failed to send email to ${email}:`, emailResult.error);
      // 邮件发送失败，但验证码已存储，返回部分成功
      return { 
        success: true, 
        message: '验证码已生成，但邮件发送失败，请稍后重试' 
      };
    }

    console.log(`Verification email sent to ${email}`);
    return { 
      success: true, 
      message: '验证码已发送到您的邮箱，请查收' 
    };
  }

  // 没有配置 Resend API Key，仅打印到日志（开发模式）
  console.log(`[DEV] Verification code for ${email}: ${code}`);
  return { 
    success: true, 
    message: '验证码已发送（开发模式）' 
  };
}

/**
 * 验证邮箱验证码
 */
export async function verifyEmailCode(
  kv: KVNamespace,
  email: string,
  code: string,
  userId: string
): Promise<VerificationResult> {
  if (!isValidEmail(email)) {
    return { success: false, message: '邮箱格式不正确' };
  }

  if (!code || code.length !== 6) {
    return { success: false, message: '验证码格式不正确，请输入6位数字' };
  }

  // 获取存储的验证码
  const verificationDataStr = await kv.get(`verification:${email}`);
  if (!verificationDataStr) {
    return { success: false, message: '验证码已过期或不存在，请重新发送' };
  }

  let verificationData;
  try {
    verificationData = JSON.parse(verificationDataStr);
  } catch (e) {
    console.error('Failed to parse verification data:', e);
    return { success: false, message: '验证数据异常，请重新发送验证码' };
  }
  
  // 验证码匹配
  if (verificationData.code !== code) {
    console.log(`Code mismatch: expected ${verificationData.code}, got ${code}`);
    return { success: false, message: '验证码错误，请检查后重试' };
  }

  // 验证成功，更新用户信息
  const userDataStr = await kv.get(`user:${userId}`);
  const userData = userDataStr ? JSON.parse(userDataStr) : {
    userId,
    createdAt: Date.now(),
  };

  // 检查邮箱是否已被其他用户绑定
  const existingUserByEmail = await kv.get(`email:${email}`);
  if (existingUserByEmail && existingUserByEmail !== userId) {
    return { success: false, message: '该邮箱已被其他账户绑定' };
  }

  // 更新用户数据
  userData.email = email;
  userData.emailVerified = true;
  userData.emailVerifiedAt = Date.now();

  await Promise.all([
    // 更新用户数据
    kv.put(`user:${userId}`, JSON.stringify(userData)),
    // 建立邮箱到用户ID的映射
    kv.put(`email:${email}`, userId),
    // 删除验证码
    kv.delete(`verification:${email}`),
  ]);

  return { 
    success: true, 
    message: '邮箱验证成功',
    email,
  };
}

/**
 * 通过邮箱恢复账户（获取关联的设备ID）
 */
export async function recoverByEmail(
  kv: KVNamespace,
  email: string
): Promise<{ success: boolean; message: string; userId?: string }> {
  if (!isValidEmail(email)) {
    return { success: false, message: '邮箱格式不正确' };
  }

  const userId = await kv.get(`email:${email}`);
  if (!userId) {
    return { success: false, message: '该邮箱未绑定任何账户' };
  }

  return {
    success: true,
    message: '找到关联账户',
    userId,
  };
}

/**
 * 获取用户绑定的邮箱
 */
export async function getUserEmail(
  kv: KVNamespace,
  userId: string
): Promise<{ email?: string; verified: boolean }> {
  const userDataStr = await kv.get(`user:${userId}`);
  if (!userDataStr) {
    return { verified: false };
  }

  const userData = JSON.parse(userDataStr);
  return {
    email: userData.email,
    verified: userData.emailVerified || false,
  };
}
