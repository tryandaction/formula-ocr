# Formula OCR API - Cloudflare Worker

基于 Cloudflare Workers 的公式识别后端 API。

## 功能

- 🆓 免费用户：每天10次，每月100次
- 💎 付费用户：每天200次，每月5000次
- 💳 支付系统：支付后即时生效
- 🔑 激活码系统：备用方案
- 🚀 全球边缘加速
- 💰 完全免费（每天10万请求内）

## 付费方案

| 套餐 | 金额 | 有效期 |
|------|------|--------|
| 月度会员 | ¥5 | 30天 |
| 季度会员 | ¥14 | 90天 |
| 年度会员 | ¥40 | 365天 |

## 支付流程（全自动）

1. 用户选择套餐，系统创建订单并生成6位验证码
2. 用户扫码支付时备注验证码
3. 支付完成后，用户输入验证码
4. 系统自动验证并升级用户权益
5. 无需管理员介入，全程自助完成！

## 部署步骤

### 1. 安装依赖

```bash
cd formula-ocr-worker
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 KV 命名空间

```bash
npx wrangler kv:namespace create USERS
```

复制输出的 `id`，更新 `wrangler.toml` 中的 `id` 字段。

### 4. 设置 Secrets

```bash
# 智谱 API Key
npx wrangler secret put ZHIPU_API_KEY
# 输入你的智谱 API Key

# 管理员密钥（用于生成激活码和确认支付）
npx wrangler secret put ADMIN_SECRET
# 输入一个随机字符串作为管理员密钥

# Resend API Key（用于发送验证邮件）
npx wrangler secret put RESEND_API_KEY
# 输入你的 Resend API Key（从 https://resend.com 获取）

# 管理员邮箱列表（逗号分隔，这些邮箱拥有无限额度和模拟模式）
npx wrangler secret put ADMIN_EMAILS
# 输入: admin@example.com,another@example.com
```

### 5. 更新配置

编辑 `wrangler.toml`：
- 替换 KV namespace id
- 设置 `CORS_ORIGIN` 为你的前端域名

### 6. 部署

```bash
npm run deploy
```

部署成功后会显示 Worker URL，如：
`https://formula-ocr-api.your-account.workers.dev`

## API 接口

### 用户相关

```
GET /api/user/info
Header: X-User-ID: <设备ID>
```

```
GET /api/quota/check
Header: X-User-ID: <设备ID>
```

### 公式识别

```
POST /api/recognize
Header: X-User-ID: <设备ID>
Body: { "image": "data:image/png;base64,..." }
```

### 支付相关

```
GET /api/payment/plans
返回: { "plans": [...] }
```

```
POST /api/payment/create-order
Header: X-User-ID: <设备ID>
Body: { "planId": "monthly" | "quarterly" | "yearly" }
返回: { "success": true, "order": { orderId, verifyCode, ... } }
```

```
GET /api/payment/query-order?orderId=ORD-XXXXXXXX-XXXXXXXX
返回: { "success": true, "order": {...} }
```

```
POST /api/payment/verify
Header: X-User-ID: <设备ID>
Body: { "verifyCode": "123456" }
返回: { "success": true, "message": "支付验证成功！已为您开通 30 天会员" }
说明: 用户自助验证支付，输入支付时备注的验证码
```

### 激活码（备用）

```
POST /api/activate
Header: X-User-ID: <设备ID>
Body: { "code": "FOCR-XXXX-XXXX-XXXX" }
```

### 管理员接口

```
POST /api/admin/generate-code
Header: X-Admin-Key: <管理员密钥>
Body: { "amount": 10, "count": 5 }
```

```
POST /api/admin/confirm-payment
Header: X-Admin-Key: <管理员密钥>
Body: { "orderId": "ORD-XXXXXXXX-XXXXXXXX" }
说明: 备用功能，正常情况下用户通过验证码自助完成
```

```
POST /api/admin/simulate
Header: X-User-ID: <管理员设备ID>
Body: { "mode": "none" | "anonymous" | "registered" | "paid" }
说明: 管理员可切换模拟模式体验不同用户层级
- none: 管理员模式（无限额度）
- anonymous: 模拟游客体验
- registered: 模拟注册用户体验
- paid: 模拟付费用户体验
```

### 管理员功能

管理员邮箱配置后，该邮箱绑定的账户将拥有：
- 🔓 无限使用额度
- 🎭 模拟模式：可在前端切换体验不同用户层级
- 📊 管理后台访问权限

## ~~支付流程（旧）~~

> 以下流程已废弃，现在使用全自动验证码流程

~~1. 前端调用 `/api/payment/create-order` 创建订单~~
~~2. 用户扫码支付（微信/支付宝）~~
~~3. 前端轮询 `/api/payment/query-order` 查询状态~~
~~4. 管理员收到付款后，调用 `/api/admin/confirm-payment` 确认~~
~~5. 用户权益即时生效~~

## 前端集成

```typescript
const API_BASE = 'https://formula-ocr-api.your-account.workers.dev';

// 生成或获取设备ID
function getDeviceId(): string {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2);
    localStorage.setItem('device_id', id);
  }
  return id;
}

// 检查额度
async function checkQuota() {
  const res = await fetch(`${API_BASE}/api/quota/check`, {
    headers: { 'X-User-ID': getDeviceId() }
  });
  return res.json();
}

// 识别公式
async function recognize(imageBase64: string) {
  const res = await fetch(`${API_BASE}/api/recognize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': getDeviceId()
    },
    body: JSON.stringify({ image: imageBase64 })
  });
  return res.json();
}

// 创建订单
async function createOrder(planId: string) {
  const res = await fetch(`${API_BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': getDeviceId()
    },
    body: JSON.stringify({ planId })
  });
  return res.json();
}

// 验证支付（用户自助）
async function verifyPayment(verifyCode: string) {
  const res = await fetch(`${API_BASE}/api/payment/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-ID': getDeviceId()
    },
    body: JSON.stringify({ verifyCode })
  });
  return res.json();
}
```

## 本地开发

```bash
npm run dev
```

访问 `http://localhost:8787`

## 成本估算

| 用户数 | 日请求量 | 月成本 |
|--------|----------|--------|
| 100 | 1,000 | $0 |
| 1,000 | 10,000 | $0 |
| 5,000 | 50,000 | $0 |
| 10,000+ | 100,000+ | ~$5 |

Cloudflare Workers 免费层：每天 100,000 请求
