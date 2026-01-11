# Formula OCR Worker

Cloudflare Worker 后端服务，提供用户管理、额度控制和公式识别 API。

## 功能

- 用户注册/登录（设备ID）
- 免费额度管理（每天/每月限制）
- 一次性激活码系统
- 代理智谱 API 调用
- 邮箱验证和账户恢复

## 支付流程

```
用户选择套餐 → 扫码支付 → 联系客服获取激活码 → 输入激活码 → 自动升级权益
```

### 激活码特性
- 每个激活码只能使用一次
- 激活码格式：`FOCR-XXXX-XXXX-XXXX`
- 激活码由管理员通过 API 生成

## API 端点

### 公开接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/user/info` | GET | 获取用户信息 |
| `/api/quota/check` | GET | 检查额度 |
| `/api/activate` | POST | 激活码验证 |
| `/api/recognize` | POST | 公式识别 |
| `/api/payment/plans` | GET | 获取套餐列表 |

### 认证接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/send-code` | POST | 发送邮箱验证码 |
| `/api/auth/verify` | POST | 验证邮箱 |
| `/api/auth/recover` | POST | 账户恢复 |

### 管理员接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/admin/generate-code` | POST | 生成激活码 |
| `/api/admin/simulate` | POST | 设置模拟模式 |
| `/api/admin/users` | GET | 查看用户列表 |

## 套餐价格

| 套餐 | 价格 | 有效期 |
|------|------|--------|
| 月度会员 | ¥5 | 30天 |
| 季度会员 | ¥14 | 90天 |
| 年度会员 | ¥40 | 365天 |

## 管理员操作

### 生成激活码

```bash
curl -X POST https://formula-ocr-api.formula-ocr.workers.dev/api/admin/generate-code \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: YOUR_ADMIN_SECRET" \
  -d '{"amount": 5, "count": 1}'
```

参数说明：
- `amount`: 套餐金额（5/14/40）
- `count`: 生成数量（默认1，最多10）

返回示例：
```json
{
  "codes": ["FOCR-ABCD-EFGH-IJKL"]
}
```

## 部署

```bash
npm install
npm run deploy
```

## 环境变量

在 Cloudflare Dashboard 中配置：

- `ZHIPU_API_KEY`: 智谱 API 密钥
- `ADMIN_SECRET`: 管理员密钥
- `CORS_ORIGIN`: 允许的跨域来源
- `RESEND_API_KEY`: (可选) Resend 邮件服务密钥
- `ADMIN_EMAILS`: (可选) 管理员邮箱列表，逗号分隔

## KV 命名空间

需要绑定名为 `USERS` 的 KV 命名空间。
