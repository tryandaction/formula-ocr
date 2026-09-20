# Formula OCR 项目状态

最后更新：2026-09-20

## 已实现

- 图片、PDF、DOCX、Markdown 统一上传工作台。
- 文件级解析状态与公式级 OCR 状态分离。
- PDF 逐页检测可等待、可取消，保留页面预览和手动框选。
- PDF 高清渲染改为逐页处理并立即释放，只保留 1200px 有界 JPEG 预览；结果首批最多渲染 20 条。
- PDF 文本项按坐标重建行并切开双栏，常用 Unicode 数学符号转换为 LaTeX；含普通 prose 的候选被拒绝。
- DOCX 常见 OMML 与内嵌图片提取；不支持对象产生警告。
- Markdown 源码公式保留，代码块和转义美元符号不会误提取。
- 所有 Provider 使用统一 prompt、严格结构化解析、超时和 AbortSignal。
- 结果支持人工编辑、复核、选择、复制和批量 Markdown/TeX/JSON 导出。
- GitHub Pages workflow 包含 lint、测试、前端构建和 Worker typecheck。

## 已验证

- 桌面 1280×800：首屏、Markdown 上传、编辑状态、批量导出，无横向溢出。
- 移动端 390×844：控件换行、结果编辑与操作，无横向溢出。
- 两页真实 PDF fixture：本地渲染、逐页检测、文本层候选、页面补漏入口完成。
- `C:/universe/MyStudy/atom/Categorized Papers`：扫描 71 份、0.289GB 文献元数据；70 份结构可读、1 份损坏样本。
- 85 页/22.53MB 真实论文：处理中 UI 可响应，完成后首屏 20 条结果、无横向溢出；观测 JS 堆约 49-62MB。该数据是本机单次观测，不是性能 SLA。
- 11 页论文：候选从旧启发式路径的 89 条收敛为 6 条待复核文本候选；没有人工框/LaTeX ground truth，不能换算 precision/recall。
- 损坏 PDF + 两个正常 PDF 并发：损坏任务独立失败，正常任务均完成；85 页任务取消后 5 秒无迟到结果。
- 浏览器控制台：0 error、0 warning。
- Lighthouse（本地生产构建）：Performance 98、Accessibility 100、Best Practices 100、SEO 100。
- 前端与 Worker 完整 `npm audit --audit-level=moderate`：0 vulnerabilities（官方 npm registry）。
- 自动化：32 个测试文件，258/258 测试通过；前端 lint 0 error、0 warning；前端/Worker typecheck 和生产构建通过。

精确测试数和命令以最新 CI/本地质量门输出为准。

代码以 `origin/main` 为交付目标。GitHub Actions 当前受账号 billing lock 限制，仓库推送仍正常；Pages 地址由现有 GitHub 发布链路管理，本文不把历史 workflow 成功记录当成本轮构建证据。

## 未完成的证据

- 没有足够人工 ground truth，不能发布 OCR exact match 或 PDF precision/recall。
- 真实云 Provider 准确率与 P95 延迟需使用授权测试 Key 和基准集测量。
- 旧式 DOCX OLE 公式不转换，需另存为现代公式、PDF 或图片。

## Legacy 隔离

旧 PDF Viewer、旧整页 demo、历史/商业 UI 文件保留用于迁移参考，但已从当前 App 依赖图和发布 lint 中隔离。当前发布入口为 `FormulaWorkbench`。
