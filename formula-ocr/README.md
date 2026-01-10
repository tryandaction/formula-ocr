# Formula OCR - 公式识别工具

📐 将图片中的数学公式转换为 LaTeX 代码的 Web 应用。

## 功能特性

- 🖼️ 支持拖拽、粘贴、点击上传图片
- 🔄 自动识别数学、物理、化学公式
- 📋 一键复制 LaTeX 代码
- 🆓 免费用户：每天 10 次，每月 100 次
- 💎 付费用户：每天 200 次，每月 5000 次
- 🔑 激活码系统支持多种付费方案

## 技术栈

- React 19 + TypeScript
- Vite
- Tailwind CSS
- 智谱 AI GLM-4V-Flash（视觉模型）

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
# 后端 API 地址（部署 Worker 后填写）
VITE_API_BASE=https://formula-ocr-api.your-account.workers.dev

# 或者直连模式（不使用后端）
VITE_ZHIPU_API_KEY=your-api-key
```

## 部署

### 前端部署（Vercel/Netlify）

1. 连接 Git 仓库
2. 设置环境变量 `VITE_API_BASE`
3. 构建命令：`npm run build`
4. 输出目录：`dist`

### 后端部署

参考 [formula-ocr-worker/README.md](../formula-ocr-worker/README.md)

## 付费方案

| 金额 | 有效期 |
|------|--------|
| ¥5 | 30天 |
| ¥10 | 90天 |
| ¥20 | 180天 |
| ¥50 | 365天 |

## 注意事项

⚠️ `.env` 文件包含敏感信息，请勿提交到 Git！
