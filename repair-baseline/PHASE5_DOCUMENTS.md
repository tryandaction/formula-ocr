# Phase 5 交付记录

## 支持矩阵

| 格式 | 当前状态 | 真实路径 | 失败样例 |
|---|---|---|---|
| PDF | 支持 | PDF.js 渲染、文本层分类、候选区域检测 | 现有 benchmark 中 backend unavailable/检测超时 |
| Markdown | 支持源码公式 | `$...$`/`$$...$$` 解析，代码块跳过，源码优先 | `src/test/fixtures/documents/unclosed-formula.md` |
| DOCX | 暂不支持 | 上传门禁拒绝，不进入 OCR | `src/test/fixtures/documents/unsupported.docx` |

## 修改文件

- `formula-ocr/src/utils/documentFormats.ts`
- `formula-ocr/src/components/DocumentUploader.tsx`
- `formula-ocr/src/App.tsx`
- `formula-ocr/src/utils/documentParser.ts`
- `formula-ocr/src/test/unit/documentFormats.test.ts`
- `formula-ocr/src/test/fixtures/documents/*`
- `formula-ocr/README.md`

## 验证

- `npx vitest run src/test/unit/documentFormats.test.ts src/test/unit/pdfPipeline.test.ts`：8/8 通过。
- `npx tsc -b --pretty false`：通过。

Markdown 源码公式直接作为已解析结果进入结果列表，不调用视觉 Provider；DOCX UI 文案改为“暂不支持”。

## 未解决问题与风险

- DOCX 尚无 OOXML/OMML 解析；README 不再宣称支持。
- Markdown 行号以解析时的源码行记录，跨平台换行已覆盖；复杂嵌套 Markdown 语法仍需后续 fixture。
- 端到端浏览器上传测试尚未运行，留待 Phase 7。
