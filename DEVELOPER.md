# Formula OCR - 开发者文档

## 项目概述

Formula OCR 是一个将图片中的数学公式转换为 LaTeX 代码的 Web 应用，包含前端和后端两部分。

## 项目结构

```
├── formula-ocr/          # 前端 (React + Vite)
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── utils/        # 工具函数和 API 客户端
│   │   │   ├── api.ts           # 后端 API 客户端
│   │   │   ├── activation.ts    # 激活码本地验证
│   │   │   └── providers/       # 多 AI 服务商支持
│   │   └── App.tsx       # 主应用
│   ├── dist/             # 构建产物
│   └── .env              # 环境变量（不提交）
│
├── formula-ocr-worker/   # 后端 (Cloudflare Worker)
│   ├── src/
│   │   ├── index.ts      # 路由入口
│   │   ├── activation.ts # 激活码系统
│   │   ├── quota.ts      # 额度管理
│   │   ├── zhipu.ts      # 智谱 API 代理
│   │   └── utils.ts      # 工具函数
│   └── wrangler.toml     # Worker 配置
│
├── .secrets.md           # 私密信息（不提交）
└── DEVELOPER.md          # 本文档
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite, Tailwind CSS |
| 后端 | Cloudflare Workers, KV Storage |
| AI | 智谱 GLM-4V-Flash (免费视觉模型) |
| 部署 | Cloudflare Pages + Workers |

## 部署信息

| 服务 | URL |
|------|-----|
| 前端 | https://formula-ocr.pages.dev |
| 后端 API | https://formula-ocr-api.formula-ocr.workers.dev |

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/user/info` | 获取用户信息 |
| GET | `/api/quota/check` | 检查额度 |
| POST | `/api/activate` | 激活码验证 |
| POST | `/api/recognize` | 公式识别 |

### 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/generate-code` | 生成激活码 |

所有接口需要 `X-User-ID` 请求头（设备标识）。
管理员接口需要 `X-Admin-Key` 请求头。

## 用户额度

| 用户类型 | 每日限制 | 每月限制 |
|----------|----------|----------|
| 免费用户 | 10 次 | 100 次 |
| 付费用户 | 200 次 | 5000 次 |

## 付费方案

| 金额 | 有效期 |
|------|--------|
| ¥5 | 30 天 |
| ¥10 | 90 天 |
| ¥20 | 180 天 |
| ¥50 | 365 天 |

## 本地开发

### 前端

```bash
cd formula-ocr
npm install
npm run dev
# 访问 http://localhost:5173
```

### 后端

```bash
cd formula-ocr-worker
npm install
npm run dev
# 访问 http://localhost:8787
```

## 部署命令

### 部署后端 (Cloudflare Worker)

```bash
cd formula-ocr-worker
npm run deploy
```

首次部署前需要设置 Secrets：
```bash
npx wrangler secret put ZHIPU_API_KEY
npx wrangler secret put ADMIN_SECRET
```

### 部署前端 (Cloudflare Pages)

方式一：命令行部署
```bash
cd formula-ocr
npm run build
npx wrangler pages deploy dist --project-name formula-ocr
```

方式二：GitHub 自动部署（推荐）
1. 在 Cloudflare Pages 创建项目，连接 GitHub 仓库
2. 设置构建配置：
   - 构建命令: `cd formula-ocr && npm install && npm run build`
   - 输出目录: `formula-ocr/dist`
3. 在 Cloudflare Pages 设置环境变量：
   - `VITE_API_BASE` = `https://formula-ocr-api.formula-ocr.workers.dev`

**注意**: 前端环境变量需要在 Cloudflare Pages 的项目设置中配置，不是通过 .env 文件！

## 环境变量

### 前端 (.env)

```bash
VITE_API_BASE=https://formula-ocr-api.formula-ocr.workers.dev
VITE_ZHIPU_API_KEY=xxx  # 可选，直连模式用
```

### 后端 (Secrets)

通过 `wrangler secret put` 设置：
- `ZHIPU_API_KEY` - 智谱 API 密钥
- `ADMIN_SECRET` - 管理员密钥

## 激活码格式

后端生成: `FOCR-XXXX-XXXX-XXXX` (随机字符)

## 数据存储 (KV)

| Key 格式 | 说明 |
|----------|------|
| `user:{userId}` | 用户基本信息 |
| `usage:{userId}:{date}` | 每日使用量 |
| `usage:{userId}:{month}` | 每月使用量 |
| `usage:{userId}:total` | 总使用量 |
| `code:{code}` | 激活码数据 |

## 注意事项

1. **敏感文件不要提交 Git**
   - `.env` - 前端环境变量（已在 .gitignore）
   - `.secrets.md` - 私密信息汇总（已在 .gitignore）
   - `.wrangler/` - Wrangler 本地状态（已在 .gitignore）

2. **生产环境变量配置**
   - 后端 Secrets: 通过 `wrangler secret put` 设置
   - 前端环境变量: 在 Cloudflare Pages 项目设置中配置

3. **CORS 配置**
   - `wrangler.toml` 中的 `CORS_ORIGIN` 设为生产域名
   - 后端代码已支持本地开发域名 (localhost:5173)

4. **Secrets 更新**
   - 修改后需要重新 `wrangler secret put`
   - 然后重新部署 Worker

## 常用命令

```bash
# 查看 Worker 日志
cd formula-ocr-worker && npm run tail

# 登录 Cloudflare
npx wrangler login

# 查看当前登录状态
npx wrangler whoami
```

## 相关链接

- [智谱 AI 控制台](https://open.bigmodel.cn/)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
