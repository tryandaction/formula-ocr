# Formula OCR

📐 将图片中的数学公式转换为 LaTeX 代码的 Web 应用。

## 在线体验

🌐 **网站**: https://formula-ocr.pages.dev

## 功能特性

- 🖼️ 图片上传（拖拽、粘贴、点击）
- 📄 **PDF 公式查看器 v2.0** - 连续阅读、整页公式检测、直接 OCR、侧边栏管理
- 🔄 自动识别数学、物理、化学公式
- 📋 多格式输出（LaTeX、Markdown、MathML、Unicode）
- 📜 历史记录与收藏
- 💎 付费会员系统
- 📱 响应式布局（桌面/平板/移动端）

## 最新更新 (v2.0)

- ✨ 全新 PDF 公式查看器，支持连续滚动阅读
- 🔍 整页公式自动检测与高亮
- 📋 侧边公式面板，支持批量识别
- 🔗 PDF 与侧边栏双向联动
- 💾 状态缓存，切换界面不丢失进度
- ⚡ 虚拟滚动优化，流畅处理大文档

## 项目结构

```
├── formula-ocr/          # 前端 (React + Vite)
├── formula-ocr-worker/   # 后端 (Cloudflare Worker)
└── DEVELOPER.md          # 开发者文档
```

## 快速开始

### 前端

```bash
cd formula-ocr
npm install
npm run dev
```

### 后端

```bash
cd formula-ocr-worker
npm install
npm run dev
```

## 部署

- 前端: Cloudflare Pages
- 后端: Cloudflare Workers

详细部署说明请参考 [DEVELOPER.md](./DEVELOPER.md)

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite, Tailwind CSS |
| 后端 | Cloudflare Workers, KV Storage |
| AI | 智谱 GLM-4V-Flash |

## 许可证

MIT
