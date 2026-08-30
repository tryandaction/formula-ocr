# Phase 1 交付记录

## 修改文件

- `formula-ocr/src/utils/ocrContract.ts`：统一请求、结构化结果、保守文本解析和基础 LaTeX 验证。
- `formula-ocr/src/utils/providers/types.ts`：Provider 上下文与结构化结果类型。
- `formula-ocr/src/utils/providers/index.ts`：兼容旧字符串调用，同时构造/校验统一请求。
- `formula-ocr/src/utils/providers/contract.ts`：共享提示词和离线 fixture 上下文。
- `formula-ocr/src/utils/providers/{anthropic,backend,gemini,openai,qwen,siliconflow,zhipu}.ts`：接收统一上下文；Backend 将契约转发 Worker。
- `formula-ocr/src/utils/api.ts`、`apiClient.ts`：Worker 请求字段、结果字段、保守 `extractLatex` 和错误分类。
- `formula-ocr/src/App.tsx`：真正传递 `formulaType`、模式、来源和 request id。
- `formula-ocr-worker/src/index.ts`、`zhipu.ts`：接收/回传契约元数据，保留耗时和错误分类。
- `formula-ocr/src/test/unit/{ocrContract,providerContract}.test.ts`：离线契约测试。
- `repair-baseline/fixtures/manifest.json`、`evaluate.mjs`：人工 ground truth 清单和离线评估脚本。

## 验证

- `npx vitest run src/test/unit/ocrContract.test.ts src/test/unit/providerContract.test.ts src/test/unit/diagnostics.test.ts`：21/21 通过。
- `npx tsc -b --pretty false`：通过。
- `cd formula-ocr-worker; npx tsc --noEmit`：通过。
- `node repair-baseline/evaluate.mjs repair-baseline/fixtures/manifest.json`：可重复运行，报告“样本不足”，没有 OCR 结果时不输出准确率。

## 真实指标

当前没有足够的人工标注和离线 Provider 输出，exact/normalized match、Provider P50/P95 均为“样本不足”。已有 PDF UI benchmark 仍只提供检测数量、耗时和后端不可用分类，未转化为 OCR 准确率。

## 未解决问题与风险

- Provider 网络适配器尚未全部改为直接返回结构化对象，入口目前仍兼容裸字符串，需后续逐步收紧。
- 统一取消信号已定义但尚未贯穿每个适配器的 fetch。
- 额度记账和错误状态尚未按契约拆分。
- `extractLatex` 的 KaTeX 渲染验证留待后续 UI/结果阶段。
