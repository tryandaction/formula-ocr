# Formula OCR API - Cloudflare Worker

基于 Cloudflare Workers 的公式识别后端 API。

## 功能

- 🆓 免费用户：每天10次，每月100次
- 💎 付费用户：每天200次，每月5000次
- 🔑 激活码系统：支持多种付费方案
- 🚀 全球边缘加速
- 💰 完全免费（每天10万请求内）

## 付费方案

| 金额 | 有效期 |
|------|--------|
| ¥5 | 30天 |
| ¥10 | 90天 |
| ¥20 | 180天 |
| ¥50 | 365天 |

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

# 管理员密钥（用于生成激活码）
npx wrangler secret put ADMIN_SECRET
# 输入一个随机字符串作为管理员密钥
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

### 获取用户信息

```
GET /api/user/info
Header: X-User-ID: <设备ID>
```

### 检查额度

```
GET /api/quota/check
Header: X-User-ID: <设备ID>
```

### 激活码验证

```
POST /api/activate
Header: X-User-ID: <设备ID>
Body: { "code": "FOCR-XXXX-XXXX-XXXX" }
```

### 公式识别

```
POST /api/recognize
Header: X-User-ID: <设备ID>
Body: { "image": "data:image/png;base64,..." }
```

### 管理员：生成激活码

```
POST /api/admin/generate-code
Header: X-Admin-Key: <管理员密钥>
Body: { "amount": 10, "count": 5 }
```

## 前端集成

在前端代码中：

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
