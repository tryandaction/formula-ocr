# Phase 8 最终回归记录

日期：2026-09-20

## 当前实现范围

- 图片、PDF、DOCX、Markdown 已进入统一工作台。
- OCR 请求/响应包含 MIME、公式类型、单/多公式模式、request id、候选、置信度、不确定项、Provider、耗时和错误分类。
- PDF 逐页检测可等待、取消，并保留页面手动框选补漏。
- DOCX 支持常见 OMML 与内嵌 PNG/JPEG/WebP；OLE 与未支持 OMML 明确警告。
- Markdown 直接保留源码公式并跳过代码块、行内代码和转义分隔符。
- 文件处理队列与 OCR 队列独立限流，取消信号进入真实网络请求。

## 基准与指标边界

- `fixtures/manifest.json` 有 8 条人工核对的合成 PDF LaTeX ground truth 和 1 条待复核失败样本。
- 样本少于 30 条，`evaluate.mjs` 按设计只输出“样本不足”，不输出 OCR 百分比。
- 尚无 PDF 检测框 ground truth，因此 detection precision、recall、IoU 和页级漏检率均为“未测量”。
- 未使用授权生产 Key 运行多 Provider 基准，因此云端 OCR 准确率及 P50/P95 为“未测量”。

## 浏览器证据

- 桌面 1280x800：Markdown 上传、结果编辑、选择和 Markdown 导出完成，无横向溢出。
- 移动端 390x844：控制栏与结果操作换行正常，无横向溢出。
- 两页版本化 PDF fixture：逐页渲染、文本层候选、视觉候选和手动框选入口完成。
- 检查时浏览器控制台为 0 error、0 warning。

## 质量门

| 命令 | 结果 |
|---|---|
| `formula-ocr: npm run lint` | 通过，0 error、0 warning |
| `formula-ocr: npm run test:run` | 通过，32 个测试文件、247/247 测试通过 |
| `formula-ocr: npm run build` | 通过，74 个模块完成生产构建；PDF Worker 为本地构建资产 |
| `formula-ocr: npm audit --omit=dev --audit-level=high` | 通过，0 vulnerabilities |
| `formula-ocr-worker: npx tsc --noEmit` | 通过 |
| `formula-ocr-worker: npm audit --omit=dev --audit-level=high` | 通过，0 vulnerabilities |
| `git diff --check` | 通过 |

## 已知限制

- DOCX 旧式 OLE 公式不转换。
- PDF 启发式检测尚未达到可声明准确率的证据门槛，必须保留人工补漏。
- 真实 Provider 行为受模型版本、配额、网络和用户凭据影响；自动化测试使用契约级 mock，不代表模型准确率。
