# Phase 6 交付记录

## 修改文件

- `formula-ocr/src/utils/runtimeState.ts`
- `formula-ocr/src/utils/formulaOCR.ts`
- `formula-ocr/src/test/unit/runtimeState.test.ts`
- `formula-ocr-worker/src/contract.ts`
- `formula-ocr-worker/src/index.ts`
- `formula-ocr/src/test/unit/workerContract.test.ts`

## 验证

- runtime/Worker/文档/PDF 回归：`npx vitest run ...`，目标测试 6/6（另加文档/PDF 共 12/12）通过。
- `formula-ocr`: `npx tsc -b --pretty false` 通过。
- `formula-ocr-worker`: `npx tsc --noEmit` 通过。

## 行为

- 批量结果以输入顺序返回，完成回调仍可按完成顺序显示进度。
- 网络、超时、Provider 临时响应错误可有限重试；取消、额度、认证、限流、无效 LaTeX 不盲重试。
- Worker 仅在上游返回 `success` 后记录额度；失败/取消不会记账。
- Worker 拒绝无效 JSON、非图片 MIME、超大 data URL。

## 未解决问题与风险

- 取消信号尚未贯穿所有外部 Provider 的 fetch；底层适配器仍需逐个接入。
- 旧 `formulaOCR` 队列仍以 Promise 为主，完整状态机主要作为纯函数契约存在。
- 缓存 key 工具已定义，但现有 PDF 状态缓存尚未携带 Provider/预处理版本。
