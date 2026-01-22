# Formula OCR

📐 将图片中的数学公式转换为 LaTeX 代码的 Web 应用。

## 在线体验

🌐 **网站**: https://formula-ocr.pages.dev

## 功能特性

- 🖼️ 图片上传（拖拽、粘贴、点击）
- 📄 **PDF 公式查看器 v2.0** - 连续阅读、整页公式检测、直接 OCR、侧边栏管理
- 🎯 **整页公式识别系统** - 精准定位、批量处理、独立操作（v1.0新增）
- 🔄 自动识别数学、物理、化学公式
- 📋 多格式输出（LaTeX、Markdown、MathML、Unicode）
- 📜 历史记录与收藏
- 💎 付费会员系统
- 📱 响应式布局（桌面/平板/移动端）

## 最新更新

### v1.0.0 (2026-01-22) - 整页公式识别系统

**核心功能**：
- ✅ **整页批量识别** - 一次性识别整个页面的所有公式，无需切片
- ✅ **精准边界定位** - 每个公式精确边界定位（≤5像素误差）
- ✅ **智能优化** - 误检率≤5%，漏检率≤3%
- ✅ **高性能处理** - 标准页面≤2秒，复杂页面≤5秒
- ✅ **独立操作** - 每个公式可单独复制/编辑LaTeX或Markdown
- ✅ **多格式导出** - 支持LaTeX、Markdown、JSON批量导出
- ✅ **React UI集成** - 完整的交互式UI组件

**技术亮点**：
- 智能区域划分和并行处理
- 多维度置信度评分系统
- 边缘检测和像素密度分析
- 自动缓存和性能优化
- 完整的错误处理机制

详细使用指南：[WHOLE_PAGE_RECOGNITION_GUIDE.md](./formula-ocr/WHOLE_PAGE_RECOGNITION_GUIDE.md)

### v2.0 - PDF 公式查看器

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

详细部署说明请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 文档

- [开发者文档](./DEVELOPER.md) - 开发环境配置和API文档
- [部署指南](./DEPLOYMENT.md) - 生产环境部署流程
- [整页识别使用指南](./formula-ocr/WHOLE_PAGE_RECOGNITION_GUIDE.md) - 整页公式识别系统详细说明

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Vite, Tailwind CSS |
| 后端 | Cloudflare Workers, KV Storage |
| AI | 智谱 GLM-4V-Flash |

## 许可证

MIT
