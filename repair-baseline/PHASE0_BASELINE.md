# Phase 0 基线报告

日期：2026-08-30  
工作目录：`Physics Formula OCR`  
基线性质：仅记录现状；未修改业务实现。

## 工作树保护

`git status --short`：

```text
 M formula-ocr/src/utils/advancedFormulaDetection/interfaces.ts
 M formula-ocr/src/utils/wholePageRecognition/types.ts
?? REPAIR_PLAN/
```

`git diff` 显示两个已修改接口文件：

- `advancedFormulaDetection/interfaces.ts`：缓存 `set/get` 新增 `DetectionOptions` 参数。
- `wholePageRecognition/types.ts`：`FormulaFeatures.operatorCount` 与 `RawDetection.id` 字段。

这些改动属于用户现有工作，后续阶段不得回退、覆盖或删除。

## 命令基线

| 命令 | 退出码 | 观察结果 |
|---|---:|---|
| `cd formula-ocr; npm run test:run` | 1 | 16 个测试文件中 15 通过、1 失败；181 个测试中 180 通过。失败为 `src/test/property/ContentClassifier.property.test.ts` 的线性区域性质反例，`hasMatrixBrackets=true`。总耗时约 40.20s。 |
| `cd formula-ocr; npm run build` | 1 | `tsc -b` 通过；Vite 在清理既有 `dist/alipay.png` 时因 Windows `EPERM unlink` 失败。重复运行同样失败。 |
| `cd formula-ocr; npm run lint` | 1 | 79 个问题：70 errors、9 warnings。 |
| `cd formula-ocr-worker; npx tsc --noEmit` | 0 | Worker TypeScript 检查通过。 |

构建失败涉及已有产物 `formula-ocr/dist/alipay.png`，本阶段没有删除或覆盖它。

## PDF benchmark 观察

现有目录：`formula-ocr/output/playwright/pdf-benchmark`。

- `results-summary.json` 有 4 次“ready”记录：页数 2、2、11、12；检测数分别为 1、36、4、1；耗时约 2.46s、2.54s、4.71s、4.41s。
- `ocr-results.json` 只有一条失败记录：`detect_ready=false`、`detect_ms=53996`、`ocr_done=false`、`ocr_error=BACKEND_UNAVAILABLE`、`backend_available=false`。
- `results.json` 有 4 条超时/未就绪记录，耗时约 180.9s 至 277.9s，未记录页数和公式数。
- 目录没有人工标注的公式框或 LaTeX ground truth，因此这些数字只能作为 UI/耗时/失败分类观测，不构成检测 precision/recall 或 OCR 准确率。

## 已验证代码证据

- `formula-ocr/src/App.tsx` 的 `processImage` 调用 `recognizeWithProvider(image.base64, selectedProvider)`，没有传递 `formulaType`。
- `formula-ocr/src/utils/providers/types.ts` 的 `ProviderInterface.recognize` 只接收 `imageBase64` 和可选 key，返回裸 `string`。
- `formula-ocr/src/utils/apiClient.ts` 与 `formula-ocr-worker/src/zhipu.ts` 的 `extractLatex` 在没有代码块/数学分隔符时返回整段自然语言。
- `formula-ocr/src/utils/documentParser.ts` 对 PDF 先渲染整页，再通过 `requestIdleCallback`/`setTimeout` 异步检测；`DocumentUploader.tsx` 对非 PDF 直接返回“解析功能开发中”。
- `formula-ocr-worker/src/index.ts` 的 `/api/recognize` 只读取 JSON `image`，检查额度后调用智谱并在返回成功路径无条件 `recordUsage`。

## Phase 0 根因假设与停止条件

单一待验证假设：识别链路的边界没有统一的、可脱敏的观测契约，导致失败无法区分输入、检测、OCR、Provider、额度或 UI 合并层；现有宽松解析和异步文件流程进一步隐藏了失败位置。

Phase 0 停止条件已满足：每条可确定的数据流均已记录字段；无法从代码确定的内容被列为证据缺口，未自行推断。

## 证据缺口

- 没有人工核对的图片/PDF/DOCX/Markdown ground truth，无法报告真实识别准确率。
- 未发现仓库中的 DOCX/Markdown 解析实现或 fixture；当前 UI 行为是显式失败。
- Provider 的统一超时、取消、错误分类、候选结果和置信度契约尚不存在。
- `dist` 文件锁定原因尚未定位到具体进程/权限；需要后续独立处理，不应与 OCR 根因混修。
