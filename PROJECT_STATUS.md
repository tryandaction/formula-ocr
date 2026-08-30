# Formula OCR 项目状态

最后更新：2026-08-30
状态：修复迭代中，未声明生产就绪。

## 已验证

- 前端全量测试：`npm run test:run`，26 个测试文件、224 个测试全部通过。
- 前端 TypeScript：`npx tsc -b --pretty false` 通过。
- Worker TypeScript：`npx tsc --noEmit` 通过。
- 独立输出构建：`npx vite build --outDir ../repair-baseline/dist-check` 通过。
- 本轮涉及模块 lint：0 errors、0 warnings。

## 当前阻塞与风险

- 默认 `npm run build` 在 Vite 清理既有 `formula-ocr/dist/alipay.png` 时返回 Windows `EPERM unlink`；未删除或覆盖该文件。
- 全仓 `npm run lint` 仍有 67 errors、8 warnings，主要集中在历史 PDF viewer、示例和旧组件。
- 真实 OCR 准确率、检测 precision/recall/IoU、文件页级召回、峰值内存和 Provider P50/P95：未测量。当前基准没有足够人工 ground truth，不能外推百分比。
- DOCX 暂不支持；Markdown 仅解析源码中的 `$...$`/`$$...$$`，代码块跳过。
- 真实 Provider、额度、取消和浏览器文件 chooser E2E 尚未完成；测试使用离线 fixture。

## 本轮改动

- 统一 OCR 请求/响应契约：MIME、formulaType、single/multiple、request id、来源、latex、uncertainties、状态、Provider、耗时和错误分类。
- 保守 LaTeX 解析，拒绝自然语言、危险命令和未闭合结构。
- 默认云端 OCR 保留原始图像；local 分支保留显式派生预处理。
- PDF 增加文本层/扫描页分类、文本公式候选、检测与 OCR 独立状态和坐标工具。
- Markdown 源码公式直接保留，不重复视觉 OCR；DOCX 上传明确失败。
- 批量结果按输入顺序返回；Worker 校验 JSON/MIME/体积，仅成功上游结果记额度。
- 结果卡片显示失败/待识别/需复核/成功、来源页码、Provider 和耗时。

## 基准与报告

详见 `repair-baseline/PHASE0_BASELINE.md`、`PHASE1_CONTRACT.md`、`PHASE2_PREPROCESSING.md`、`PHASE3_PROVIDERS.md`、`PHASE5_DOCUMENTS.md`、`PHASE6_RUNTIME.md`、`PHASE7_UI_QA.md`。离线评估：`node repair-baseline/evaluate.mjs repair-baseline/fixtures/manifest.json`，当前输出“样本不足”。
