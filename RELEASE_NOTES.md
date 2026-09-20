# Release Notes

## 2026-09-20 工作台迭代

### 用户流程

- 用统一工作台替换分离的图片/文档流程。
- 支持多文件任务状态、并发控制、取消、失败重试和批量选择导出。
- PDF 完成后状态稳定，保留文本层公式、视觉候选和手动框选补漏。
- DOCX 支持常见 OMML 与内嵌公式图片；不支持对象给出段落级警告。
- Markdown 保留源码公式并正确跳过代码内容。
- 结果直接编辑与预览；人工修改不会被自动重试覆盖。

### OCR 契约

- 多公式通过 `formulas[]` 返回；不再按响应换行错误拆分多行环境。
- 保留 uncertainties、candidates、confidence、Provider 和处理耗时。
- KaTeX 负责 LaTeX 语法验证；自然语言和危险命令被拒绝。
- 取消信号传入实际 HTTP 请求；超时、取消、认证、限流和 Provider 错误分开处理。
- Worker 代理与浏览器直连使用同一种结构化响应语义，只有验证成功才记录额度。

### 工程质量

- 增加结果解析、Provider 取消、DOCX、Markdown、队列、PDF 生命周期和工作台组件回归测试。
- PDF.js Worker 改为本地构建资产，不依赖运行时 CDN。
- 活动代码与测试 lint 通过；旧不可达 UI 明确隔离为 legacy。
- 依赖升级后 `npm audit` 为 0 vulnerabilities。
