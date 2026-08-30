# Formula OCR 验收指南

## 质量门

```bash
npm run test:run
npx tsc -b --pretty false
npm run lint
npx vite build --outDir ../repair-baseline/dist-check
cd ../formula-ocr-worker
npx tsc --noEmit
```

当前事实：前端 224/224 测试通过，前端/Worker TypeScript 通过；独立输出构建通过。默认 `npm run build` 可能因既有 `dist/alipay.png` 被占用而返回 `EPERM`。全仓 lint 仍有历史 67 errors、8 warnings。

## 输入格式验收

| 格式 | 运行行为 | 必测样例 | 当前状态 |
|---|---|---|---|
| 图片 | MIME/尺寸校验 -> 原图或显式预处理 -> Provider -> 结构化结果 | `imagePipeline.test.ts`、OCR contract fixture | 已自动化；真实模型准确率未测量 |
| PDF | PDF.js -> 文本层/扫描分类 -> 候选检测 -> 单区域 OCR | `pdfPipeline.test.ts`、`output/playwright/pdf-benchmark` | 检测与 OCR 分离；无人工框基准 |
| Markdown | 解析 `$...$`、`$$...$$`，跳过代码块 | `src/test/fixtures/documents/formulas.md` | 已支持源码公式，不重复 OCR |
| DOCX | 上传门禁返回暂不支持 | `src/test/fixtures/documents/unsupported.docx` | 暂不支持 |

## 状态验收

结果必须能区分：未检测到、检测成功但待 OCR、识别失败、结果需复核、识别成功。卡片应显示来源、页码/坐标、Provider 和耗时；编辑草稿不会被同步 effect 覆盖。

## 指标规则

`repair-baseline/fixtures/manifest.json` 只接受人工核对的 ground truth。使用：

```bash
node ../repair-baseline/evaluate.mjs ../repair-baseline/fixtures/manifest.json [results.json]
```

少于 30 个带 ground truth 的结果时必须输出“样本不足”，不能报告准确率。检测 precision/recall/IoU 与 OCR exact/normalized match 分开统计。

## 浏览器回归

已验证首页和文档模式 DOM 文案；文件 chooser 自动化受当前浏览器连接限制，未宣称上传 E2E 通过。部署前需在干净浏览器补测图片上传、PDF 文本层/扫描页、Markdown、取消、重试、导出和移动端布局，并记录 console error/warning。

## 证据与风险

完整阶段记录位于仓库根目录 `repair-baseline/`。不得把测试全绿视为 OCR 准确，也不得把现有 PDF benchmark 的检测数量/耗时当作识别准确率。
