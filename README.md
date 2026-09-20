# Formula OCR

Formula OCR 是一个 React + TypeScript 公式提取工作台，用于从图片、PDF、DOCX 和 Markdown 中获得可编辑 LaTeX，并批量导出 Markdown、TeX 或 JSON。

## 主要能力

- 统一的文件任务和公式结果视图，不再在图片与文档页面之间搬运结果。
- PDF 文本层、视觉候选检测和手动框选三条路径分开显示。
- DOCX 常见 OMML 结构和内嵌图片解析；未知 OLE 对象提示用户复核或转换。
- Provider 使用统一请求/响应契约，支持公式类型、单/多公式模式、取消、超时和明确错误分类。
- 模型输出通过结构化 JSON 和 KaTeX 校验；自然语言、危险命令和无效 LaTeX 不进入成功状态。
- 编辑后的结果标记为人工修改，异步重试不会覆盖。

## 项目结构

```text
formula-ocr/          React 前端与浏览器文件解析
formula-ocr-worker/   Cloudflare Worker 代理与额度服务
repair-baseline/      可重复基线和阶段证据
```

## 开发

```bash
cd formula-ocr
npm ci
npm run lint
npm run test:run
npm run build
```

```bash
cd formula-ocr-worker
npm ci
npx tsc --noEmit
```

GitHub Pages 工作流位于 `.github/workflows/deploy-pages.yml`。仓库 Pages Source 需使用 GitHub Actions。

## 现有限制

- `repair-baseline/fixtures/real-pdf-v1` 已提供 3 篇物理论文、10 页、33 个公式的首版人工标注。该小样本上的栅格检测 precision/recall 为 6.74%/18.18%，`glm-4v-flash` 人工数学可接受率为 9.09%；不能外推为通用准确率。
- DOCX 的旧式 OLE/Equation Editor 对象无法在浏览器中可靠转换，会显示明确警告。
- 视觉 OCR 依赖所选外部服务或本地模型；没有可用 Provider 时，源码公式仍可解析和导出。
