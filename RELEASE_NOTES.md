# Release Notes

## 2026-09-21 本地 OCR 引擎迭代

### 本地服务

- 新增 uv 管理的 Python 3.11 FastAPI 伴随服务，默认只监听 `127.0.0.1:8502`。
- 增加 PP-FormulaNet-S 单图适配、MFD 1.5 独立检测、安全 MIME/像素校验、惰性加载、容量和取消。
- 前端 local Provider 发送完整识别契约并保留结构化 engine、耗时、不确定项和错误分类；离线状态给出可操作说明。
- 完整 Pix2Text PDF-to-Markdown 因审计/兼容阻断保持禁用，不伪装支持。

### 实测门槛

- PP-FormulaNet-S 原图 33 样本：product-valid 15/33、exact 0/33、normalized 0/33、人工可接受 10/33、P50 1235ms、P95 5340ms。
- MFD 1.5 display：precision 25.00%、recall 27.27%、mean matched IoU 0.6322；自动检测保持关闭。
- 当前可复现 GLM 结果/复核配对为人工可接受 2/33（6.06%），不再混用历史 3/33 数字。
- 上述模型均未达到本项目发布门槛，保持实验/可选。

### 安全与数据

- 移除完整 Pix2Text 聚合依赖后，锁定环境依赖审计无已知漏洞；仅保留 CnSTD/ONNX MFD 检测路径。
- 新增 33 个 KaTeX 合成公开 fixture 与 SHA-256 manifest；真实论文裁剪转为私有本地评估数据。

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
- 智谱浏览器直连和 Worker 请求增加 `response_format: {"type":"json_object"}`，并收紧完整公式边界 prompt。
- 结构化 LaTeX 解析可恢复 JSON 将 `\\rangle`、`\\frac`、`\\text` 等命令误解为控制字符的已知损坏。

### 工程质量

- 增加结果解析、Provider 取消、DOCX、Markdown、队列、PDF 生命周期和工作台组件回归测试。
- PDF.js Worker 改为本地构建资产，不依赖运行时 CDN。
- 活动代码与测试 lint 通过；旧不可达 UI 明确隔离为 legacy。
- 依赖升级后 `npm audit` 为 0 vulnerabilities。
- PDF 改为逐页渲染、检测和释放高清资源，仅保留有界 JPEG 预览。
- 文本层按坐标重建双栏公式行，过滤正文/数字表格误检，并规范化常见 Unicode 数学符号。
- 结果列表默认渲染 20 条，页面图像和公式裁剪使用懒加载。
- Wrangler 更新至 `4.135.0`，Workers types 更新至 `5.20260920.1`；Worker 完整依赖审计为 0 vulnerabilities。

### 真实文献 QA

- 扫描 71 份、0.289GB PDF 元数据，覆盖 85 页长文档、双栏论文、补充材料和损坏输入。
- 85 页/22.53MB 论文完成解析且处理中可交互；观测 JS 堆约 49-62MB，结果 DOM 首屏限制为 20 条。
- 三文件并发时，损坏 PDF 独立失败，两个正常 PDF 继续完成。
- 长文档取消后未出现迟到结果。
- 本地生产 Lighthouse：98/100/100/100；33 个测试文件、260/260 测试通过。

### 准确率基线

- 建立 3 篇论文、10 页、33 个公式的人工框与 LaTeX ground truth；标注在 Provider 调用前冻结。
- 栅格页检测器：precision 6.74%、recall 18.18%、matched mean IoU 0.677。
- `glm-4v-flash` 最终契约：产品可展示 69.70%，exact/strict normalized 均为 0%；当前可复现人工复核配对为 2/33（6.06%）。
- JSON mode 解决了部分响应契约失败，但没有把旧视觉模型提升为可靠公式 OCR。
- 官方 `glm-ocr` 当前因测试账户余额/资源包不足未能取得结果，未编造其准确率。

### 发布状态

- 修复提交已推送到 `main`。
- Pages workflow 的代码质量门已配置；GitHub Actions 当前因账号 billing issue 不启动，但代码仍按要求推送到 `main`。
- 未将历史 Pages URL 或旧成功运行误报为本次版本部署成功。
