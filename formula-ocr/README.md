# Formula OCR 工作台

面向图片与技术文献的公式提取工作台。所有文件先在浏览器中解析；只有需要视觉 OCR 的图片或裁剪区域会发送到用户选择的 Provider。

## 当前可用流程

- 图片：PNG、JPEG、WebP，可多选、拖拽或粘贴；支持单公式/多公式结构化 OCR。
- PDF：本地 PDF.js 逐页渲染并释放高清资源；文本层按坐标重建双栏公式，扫描页执行视觉候选检测；保留有界页面预览用于拖框补漏。
- DOCX：读取 OOXML，转换常见 OMML 分数、上下标、根式和矩阵；内嵌 PNG/JPEG/WebP 可进入 OCR；OLE 等未知对象明确列为警告。
- Markdown：解析 `$...$`、`$$...$$`、`\(...\)`、`\[...\]`，跳过代码块、行内代码和转义美元符号。
- 结果：来源、页/段、检测置信度、Provider、耗时、失败类型和不确定项可见；支持编辑、复核、选择、复制和批量导出 Markdown、TeX、JSON。
- 运行时：文件解析并发 2，OCR 并发 3；任务可取消；取消信号传递到 Provider HTTP 请求；结果首批渲染 20 条；不自动切换到其他付费 Provider。

## 本地运行

```bash
npm ci
npm run dev
```

质量门：

```bash
npm run lint
npm run test:run
npm run build
```

Worker：

```bash
cd ../formula-ocr-worker
npm ci
npx tsc --noEmit
```

## Provider 配置

在工作台的“服务”按钮中配置 API Key。浏览器直连支持 OpenAI、Anthropic、Gemini、SimpleTex、SiliconFlow、Qwen、智谱和本地服务；也可设置 `VITE_API_BASE` 使用 Worker 代理。

API Key 保存在浏览器 localStorage。部署时不要把 `.env`、私有图片或客户文献提交到仓库。

## 质量声明

自动化测试验证请求契约、严格结果解析、取消、队列、Markdown、DOCX/OMML、PDF 生命周期和主要 UI 交互。仓库尚无足够人工 ground truth，因此不发布 OCR 准确率或 PDF 检测 precision/recall 数字。测试通过只说明软件行为符合当前契约。
