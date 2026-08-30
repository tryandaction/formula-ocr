# Release Notes

## 2026-08-30 修复迭代

### 已完成

- 建立可脱敏的诊断事件和可版本化基准清单。
- 为单图 OCR 增加统一请求/响应契约、保守 LaTeX 清洗和错误分类。
- 公式类型选择会进入识别请求；默认云端路径不再强制增强原图。
- PDF 保留文本层候选、页面类型、检测/OCR 独立状态和坐标映射。
- Markdown 源码公式解析已实现；DOCX 明确标记为暂不支持。
- 修复批量结果乱序、Worker 失败扣额度和部分队列重试语义。
- 结果卡片显示来源、页码、Provider、耗时和失败状态。

### 验证结果

- `npm run test:run`：224/224 通过。
- `npx tsc -b --pretty false`：通过。
- `npx tsc --noEmit`（Worker）：通过。
- `npx vite build --outDir ../repair-baseline/dist-check`：通过。
- 全仓 `npm run lint`：67 errors、8 warnings；本轮涉及模块为 0 errors、0 warnings。

### 未测量/未支持

真实 OCR 准确率、检测 precision/recall/IoU、页级召回、峰值内存和 Provider 延迟均未测量；现有样本不足以发布百分比。DOCX 暂不支持。默认构建仍受既有 `dist/alipay.png` Windows `EPERM` 阻断。
