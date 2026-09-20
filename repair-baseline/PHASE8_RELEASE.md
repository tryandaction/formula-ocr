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

- `fixtures/manifest.json` 保留 8 条人工核对的合成 PDF LaTeX ground truth 和 1 条待复核失败样本。
- `fixtures/real-pdf-v1` 新增 33 条人工 LaTeX、公式框、裁剪和 Provider 配对结果。
- 真实基准使用授权测试 Key 运行 `glm-4v-flash`；单批观测 P50 1321ms、P95 2711ms、最小/最大 634/2834ms。这不是生产 SLA。
- 只完成一个云 Provider；其他 Provider 的准确率和延迟仍为“未测量”。

真实基准 v1 包含 3 篇论文、10 页、33 个公式框与人工 LaTeX。栅格检测 precision 6.74%、recall 18.18%、matched mean IoU 0.677；`glm-4v-flash` 最终契约产品可展示 23/33、exact 0/33、strict normalized 0/33、人工数学可接受 3/33。该结果只适用于 v1 样本与指定模型版本。

## 浏览器证据

- 桌面 1280x800：Markdown 上传、结果编辑、选择和 Markdown 导出完成，无横向溢出。
- 移动端 390x844：控制栏与结果操作换行正常，无横向溢出。
- 两页版本化 PDF fixture：逐页渲染、文本层候选、视觉候选和手动框选入口完成。
- 真实论文目录扫描：71 份 PDF、0.289GB；70 份结构可读，1 份损坏样本用于失败隔离验证。
- 85 页/22.53MB 文档：处理期间 DOM 可响应，完成后观测 JS 堆约 49-62MB，首屏结果限制为 20 条。
- 损坏 PDF 与两个正常 PDF 并发时，损坏任务独立失败；取消 85 页任务后 5 秒内无迟到结果。
- 检查时浏览器控制台为 0 error、0 warning。
- 本地生产 Lighthouse：Performance 98、Accessibility 100、Best Practices 100、SEO 100；FCP/LCP 2.0s、TBT 0ms、CLS 0。

## 质量门

| 命令 | 结果 |
|---|---|
| `formula-ocr: npm run lint` | 通过，0 error、0 warning |
| `formula-ocr: npm run test:run` | 通过，33 个测试文件、260/260 测试通过 |
| `formula-ocr: npm run build` | 通过，76 个模块完成生产构建；PDF Worker 为本地构建资产 |
| `formula-ocr: npm audit --audit-level=moderate` | 通过，0 vulnerabilities |
| `formula-ocr-worker: npx tsc --noEmit` | 通过 |
| `formula-ocr-worker: npm audit --audit-level=moderate` | 通过，0 vulnerabilities |
| `git diff --check` | 通过 |

## 已知限制

- DOCX 旧式 OLE 公式不转换。
- PDF 启发式检测尚未达到可声明准确率的证据门槛，必须保留人工补漏。
- 文本层公式可能丢失上下标/二维排版，全部 heuristic 候选均标记为待复核。
- 真实 Provider 行为受模型版本、配额、网络和用户凭据影响；自动化测试使用契约级 mock，不代表模型准确率。
