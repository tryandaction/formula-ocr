# Phase 7 交付记录

## 修改文件

- `formula-ocr/src/components/ImageUploader.tsx`：ImageItem 增加页码、坐标、OCR 状态、Provider、耗时和错误类别元数据。
- `formula-ocr/src/App.tsx`：文档来源信息进入结果项；错误/处理中/待识别项不再被 `completedImages` 过滤掉。
- `formula-ocr/src/components/FormulaResults.tsx`：结果卡片显示状态、来源、页码、Provider 和耗时；编辑草稿在进入编辑时初始化，避免 effect 同步 setState。
- `formula-ocr/src/test/unit/FormulaResults.status.test.tsx`：失败状态与来源元数据回归。

## 验证

- `npx vitest run src/test/unit/FormulaResults.status.test.tsx src/test/unit/documentFormats.test.ts`：4/4 通过。
- `npx eslint src/App.tsx src/components/ImageUploader.tsx src/components/FormulaResults.tsx`：0 errors、0 warnings。
- `npx tsc -b --pretty false`：通过。
- 浏览器 DOM smoke：首页和文档模式可打开；文案显示 PDF/Markdown 支持和 DOCX 暂不支持。
- 文件 chooser 自动化两次超时，未完成 Markdown 上传 E2E；记录为环境限制，不宣称 E2E 通过。

## 未解决问题与风险

- 其余全仓 lint 最终为 67 errors/8 warnings，未在本阶段无关扩散修复。
- PDFFormulaViewer 仍有直接修改 props、随机渲染等历史 lint 问题，需后续专项清理。
- 结果重试/换 Provider 控件尚未完整接入新状态机，仍依赖既有组件行为。
