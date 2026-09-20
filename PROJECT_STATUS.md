# Formula OCR 项目状态

最后更新：2026-09-20

## 已实现

- 图片、PDF、DOCX、Markdown 统一上传工作台。
- 文件级解析状态与公式级 OCR 状态分离。
- PDF 逐页检测可等待、可取消，保留页面预览和手动框选。
- DOCX 常见 OMML 与内嵌图片提取；不支持对象产生警告。
- Markdown 源码公式保留，代码块和转义美元符号不会误提取。
- 所有 Provider 使用统一 prompt、严格结构化解析、超时和 AbortSignal。
- 结果支持人工编辑、复核、选择、复制和批量 Markdown/TeX/JSON 导出。
- GitHub Pages workflow 包含 lint、测试、前端构建和 Worker typecheck。

## 已验证

- 桌面 1280×800：首屏、Markdown 上传、编辑状态、批量导出，无横向溢出。
- 移动端 390×844：控件换行、结果编辑与操作，无横向溢出。
- 两页真实 PDF fixture：本地渲染、逐页检测、文本层候选、页面补漏入口完成。
- 浏览器控制台：0 error、0 warning。
- npm audit：0 vulnerabilities（官方 npm registry）。

精确测试数和命令以最新 CI/本地质量门输出为准。

本次提交已推送至 `origin/main`（`b787829`）。GitHub Pages workflow 已触发，但 GitHub 账号当前因 billing issue 被锁定，job 未启动；因此当前 Pages 地址仍可能是历史部署，不能视为本次版本已发布。

## 未完成的证据

- 没有足够人工 ground truth，不能发布 OCR exact match 或 PDF precision/recall。
- 真实云 Provider 准确率与 P95 延迟需使用授权测试 Key 和基准集测量。
- 旧式 DOCX OLE 公式不转换，需另存为现代公式、PDF 或图片。

## Legacy 隔离

旧 PDF Viewer、旧整页 demo、历史/商业 UI 文件保留用于迁移参考，但已从当前 App 依赖图和发布 lint 中隔离。当前发布入口为 `FormulaWorkbench`。
