# Formula OCR - 开发者文档

## 项目概述

Formula OCR 是一个将图片中的数学公式转换为 LaTeX 代码的 Web 应用，包含前端和后端两部分。

## 项目结构

```
├── formula-ocr/          # 前端 (React + Vite)
│   ├── src/
│   │   ├── components/   # React 组件
│   │   │   ├── ImageUploader.tsx      # 图片上传组件
│   │   │   ├── FormulaResults.tsx     # 识别结果展示
│   │   │   ├── DocumentUploader.tsx   # 文档上传组件
│   │   │   ├── DocumentPreview.tsx    # 文档预览组件
│   │   │   ├── HistoryPanel.tsx       # 历史记录面板
│   │   │   ├── PaymentModal.tsx       # 支付弹窗
│   │   │   ├── UserStatusBadge.tsx    # 用户状态徽章
│   │   │   ├── PricingSection.tsx     # 定价展示
│   │   │   ├── FAQ.tsx                # 常见问题
│   │   │   ├── DiffViewer.tsx         # LaTeX 差异对比
│   │   │   ├── QualityIndicator.tsx   # 图片质量指示器
│   │   │   ├── FormulaTypeSelector.tsx # 公式类型选择
│   │   │   └── MultiFormulaDetector.tsx # 多公式检测器
│   │   ├── utils/        # 工具函数和 API 客户端
│   │   │   ├── api.ts              # 后端 API 客户端
│   │   │   ├── activation.ts       # 激活码本地验证
│   │   │   ├── userService.ts      # 用户服务（设备ID、层级）
│   │   │   ├── formatConverter.ts  # 格式转换（LaTeX/Markdown/MathML/Unicode）
│   │   │   ├── diffUtils.ts        # LaTeX 差异对比工具
│   │   │   ├── documentParser.ts   # 文档解析服务
│   │   │   ├── imageQuality.ts     # 图片质量检测
│   │   │   ├── formulaDetection.ts # 多公式检测
│   │   │   ├── historyService.ts   # 历史记录服务（IndexedDB）
│   │   │   └── providers/          # 多 AI 服务商支持
│   │   └── App.tsx       # 主应用
│   ├── dist/             # 构建产物
│   └── .env              # 环境变量（不提交）
│
├── formula-ocr-worker/   # 后端 (Cloudflare Worker)
│   ├── src/
│   │   ├── index.ts      # 路由入口
│   │   ├── activation.ts # 激活码系统
│   │   ├── payment.ts    # 支付系统（订单管理）
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

### 线上访问地址
| 服务 | URL | 说明 |
|------|-----|------|
| 🌐 前端网站 | https://formula-ocr.pages.dev | Cloudflare Pages |
| 🔌 后端 API | https://formula-ocr-api.formula-ocr.workers.dev | Cloudflare Workers |

### 管理后台
| 平台 | URL | 用途 |
|------|-----|------|
| Cloudflare Dashboard | https://dash.cloudflare.com | Workers/Pages/KV 管理 |
| 智谱 AI 控制台 | https://open.bigmodel.cn | API 用量和费用监控 |

## API 接口

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/user/info` | 获取用户信息 |
| GET | `/api/quota/check` | 检查额度 |
| POST | `/api/activate` | 激活码验证 |
| POST | `/api/recognize` | 公式识别 |
| GET | `/api/payment/plans` | 获取套餐列表 |

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/send-code` | 发送邮箱验证码 |
| POST | `/api/auth/verify` | 验证邮箱 |
| POST | `/api/auth/recover` | 账户恢复 |

### 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/generate-code` | 生成激活码 |
| POST | `/api/admin/simulate` | 切换模拟模式 |

所有接口需要 `X-User-ID` 请求头（设备标识）。
管理员接口需要 `X-Admin-Key` 请求头。

## 用户额度

| 用户类型 | 每日限制 | 每月限制 |
|----------|----------|----------|
| 免费用户 | 10 次 | 100 次 |
| 付费用户 | 200 次 | 5000 次 |

## 付费方案

| 套餐 | 金额 | 有效期 |
|------|------|--------|
| 月度会员 | ¥5 | 30 天 |
| 季度会员 | ¥14 | 90 天 |
| 年度会员 | ¥40 | 365 天 |

### 支付流程（激活码模式）

```
用户选择套餐 → 扫码支付 → 联系客服获取激活码 → 输入激活码 → 自动升级权益
```

1. 用户在前端选择套餐，查看支付二维码和价格
2. 用户扫码支付（无需备注任何内容）
3. 支付后联系客服，客服确认收款后生成激活码
4. 用户输入激活码，系统验证后自动升级权益

### 激活码

激活码格式: `FOCR-XXXX-XXXX-XXXX`

特性：
- 每个激活码只能使用一次
- 激活码由管理员通过 `/api/admin/generate-code` 生成
- 用于正常支付流程和特殊场景（赠送、补偿等）

### 管理员生成激活码

```bash
curl -X POST https://formula-ocr-api.formula-ocr.workers.dev/api/admin/generate-code \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: YOUR_ADMIN_SECRET" \
  -d '{"amount": 5, "count": 1}'
```

参数：
- `amount`: 套餐金额（5/14/40 对应月度/季度/年度）
- `count`: 生成数量（默认1，最多10）

或者在浏览器控制台输入 `showAdminTools()` 打开管理员工具界面。

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

- [GitHub 仓库](https://github.com/tryandaction/formula-ocr)
- [GitHub Pages](https://tryandaction.github.io/formula-ocr)
- [智谱 AI 控制台](https://open.bigmodel.cn/)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)

---

## 更新日志

### v1.2.1 (2026-01-11)

**PDF 公式识别功能大幅优化：**
- 🖼️ 高清预览：使用高分辨率页面图像替代缩略图，公式清晰可见
- 🎯 精确定位：修复公式高亮框位置计算，基于 PDF 原始尺寸精确定位
- 🔗 双向联动：点击公式自动滚动到原文位置，侧边栏与预览区同步高亮
- 👆 悬停高亮：鼠标悬停时公式框和列表项同步高亮显示
- 📋 公式预览：侧边栏显示公式缩略图、类型标签、置信度进度条
- ⌨️ 快捷键支持：Ctrl+滚轮缩放、Alt+拖拽平移、←→翻页、+/-缩放、0重置
- 🖱️ 双击提取：双击公式可直接提取进行 OCR 识别
- 📊 置信度优化：改进公式检测算法，增加重心分布分析
- 🚀 性能优化：预加载 PDF.js，提升响应速度

**技术改进：**
- 提高公式渲染比例（FORMULA_RENDER_SCALE = 3.0）获取更清晰图像
- 修复 originalPosition 坐标计算，确保基于 PDF 原始尺寸
- 优化公式检测算法阈值和特征分析
- 改进预览模式高度，充分利用屏幕空间

### v1.2.0 (2026-01-10)

**新功能：**
- 📄 文档解析（Beta）：支持 PDF、DOCX、Markdown 文件上传
- 🔍 PDF 公式检测：自动检测 PDF 中的公式区域
- 👁️ 文档预览：页面缩略图、公式高亮、定位跳转
- 📊 图片质量检测：检测模糊、分辨率、对比度问题
- 🎯 公式类型选择：数学/物理/化学类型提示
- 🔢 多公式分离：检测并分离图片中的多个公式
- 📈 置信度显示：显示识别结果的置信度
- 📜 历史记录：本地存储识别历史（IndexedDB）
- ⭐ 收藏功能：收藏常用公式
- 📊 使用统计：总识别次数、本月次数、收藏数

**新文件：**
- `formula-ocr/src/utils/documentParser.ts` - 文档解析服务
- `formula-ocr/src/utils/imageQuality.ts` - 图片质量检测
- `formula-ocr/src/utils/formulaDetection.ts` - 多公式检测
- `formula-ocr/src/utils/historyService.ts` - 历史记录服务
- `formula-ocr/src/components/DocumentUploader.tsx` - 文档上传组件
- `formula-ocr/src/components/DocumentPreview.tsx` - 文档预览组件
- `formula-ocr/src/components/QualityIndicator.tsx` - 质量指示器
- `formula-ocr/src/components/FormulaTypeSelector.tsx` - 公式类型选择
- `formula-ocr/src/components/MultiFormulaDetector.tsx` - 多公式检测器
- `formula-ocr/src/components/HistoryPanel.tsx` - 历史记录面板

**依赖更新：**
- 新增 `pdfjs-dist` - PDF 解析库

### v1.1.0 (2026-01-10)

**新功能：**
- ✨ 支付系统：支持微信/支付宝扫码支付，支付后即时生效
- ✨ 多格式输出：支持 LaTeX、Markdown、MathML、Unicode 四种格式
- ✨ 用户状态徽章：显示用户层级和剩余额度
- ✨ 额度耗尽提示：引导用户升级
- ✨ 定价展示组件：清晰展示付费方案
- ✨ FAQ 组件：常见问题解答
- ✨ 键盘快捷键：↑↓导航、Ctrl+C复制、Del删除、Enter展开

**优化：**
- 🎨 拖拽上传：移除全屏蓝色覆盖，只高亮拖拽区域
- 🎨 图片队列：显示真实缩略图，完成状态显示小绿勾
- 🎨 识别结果：支持网格/列表视图切换，公式编号
- 🎨 LaTeX 编辑：差异高亮显示
- 🎨 结果选中：点击选中，蓝色高亮显示
- 🎨 搜索过滤：实时搜索公式内容

**新文件：**
- `formula-ocr/src/utils/formatConverter.ts` - 格式转换工具
- `formula-ocr/src/utils/userService.ts` - 用户服务
- `formula-ocr/src/utils/diffUtils.ts` - 差异对比工具
- `formula-ocr/src/components/PaymentModal.tsx` - 支付弹窗
- `formula-ocr/src/components/UserStatusBadge.tsx` - 用户状态组件
- `formula-ocr/src/components/PricingSection.tsx` - 定价展示
- `formula-ocr/src/components/FAQ.tsx` - 常见问题
- `formula-ocr/src/components/DiffViewer.tsx` - 差异查看器
- `formula-ocr-worker/src/payment.ts` - 支付系统

### v1.0.0 (初始版本)

- 基础公式识别功能
- 激活码系统
- 额度管理
