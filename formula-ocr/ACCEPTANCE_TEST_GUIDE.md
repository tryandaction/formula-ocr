# Formula OCR 验收测试指南

本指南区分软件行为、公式检测和 OCR 准确率。自动化测试通过不等于识别准确率达标；任何准确率数字都必须来自 `repair-baseline` 中经人工核对的 ground truth。

## 1. 自动质量门

在仓库根目录执行：

```powershell
cd "formula-ocr"
npm ci
npm run lint
npm run test:run
npm run build
npm audit --omit=dev --audit-level=high

cd "../formula-ocr-worker"
npm ci
npx tsc --noEmit
npm audit --omit=dev --audit-level=high
```

停止条件：任一命令非零退出、测试挂起、构建依赖外部 CDN，或审计存在 high/critical 漏洞时不得发布。

## 2. 浏览器验收

使用桌面 1280x800 与移动端 390x844 各执行一次：

1. 首屏可交互，无白屏、横向溢出、控制台 error/warning。
2. 连续上传 PNG、PDF、DOCX、Markdown；文件状态和公式状态分别变化。
3. 取消正在解析的 PDF 和正在识别的图片；取消后不得出现迟到结果。
4. 修改一条 LaTeX，确认标为“待复核”，批量重试不会覆盖人工修改。
5. 导出 Markdown、TeX、JSON，核对只包含已选择且有 LaTeX 的结果。
6. PDF 自动检测遗漏时，从页面预览拖框补录并单独识别。
7. 使用至少一份 50-100 页 PDF，确认处理中 UI 可响应、取消后无迟到结果、结果 DOM 首批不超过 20 条。
8. 并发上传一个损坏 PDF 和两个正常 PDF，确认失败按文件隔离。

## 3. 格式 fixture

| 格式 | 必须覆盖 | 预期 |
|---|---|---|
| 图片 | 清晰公式、自然语言、空白图、多公式图 | 成功、未检测到、需复核或明确错误互不混淆 |
| PDF | 文本层、扫描页、多页、密集批注/图形 | 逐页完成；候选可追溯到页码；可取消；可手动补漏 |
| DOCX | 常见 OMML、内嵌公式图片、OLE 旧公式 | OMML/图片可处理；OLE 明确警告，不伪装成功 |
| Markdown | `$...$`、`$$...$$`、转义美元、代码块、未闭合分隔符 | 仅提取真实源码公式；语法问题保留有效结果并报错 |

## 4. 人工基准

每条样本必须包含来源、许可/自建说明、人工 LaTeX ground truth，以及 PDF 检测框 ground truth（如适用）。分别报告：

- 检测：precision、recall、IoU、页级漏检率。
- OCR：exact match、规范化 match、人工可接受率。
- 运行时：文件解析、检测、OCR 队列、Provider 请求的 P50/P95；同时记录设备、浏览器、Provider 和样本版本。

样本不足、ground truth 未完成或 Provider Key 不可用时输出“未测量”，不得推断百分比。

仓库当前基准 `repair-baseline/fixtures/real-pdf-v1` 有 33 条 Provider 配对结果，可输出 v1 指标。新增模型、prompt、预处理或解析规则必须保留旧结果并以独立结果文件复测，禁止根据模型输出回改 ground truth。

## 5. 状态验收

结果必须明确区分：`未检测到`、`识别失败`、`网络/认证/额度/限流/Provider 错误`、`已取消`、`待复核`、`成功`。UI 文案、导出 JSON 和内部状态应一致。
