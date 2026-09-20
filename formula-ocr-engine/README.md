# Formula OCR Local Engine

本目录提供可选的 Windows 本地伴随服务。它把模型依赖与静态 React 前端隔离，只监听 `127.0.0.1:8502`，不上传图片、PDF 或识别结果。

## 安装

需要 [uv](https://docs.astral.sh/uv/)；脚本会使用独立 Python 3.11，不修改系统 Python：

```powershell
cd "formula-ocr-engine"
./scripts/setup.ps1
```

安装实验性公式检测模型：

```powershell
./scripts/setup.ps1 -WithDetection
```

检查环境但不加载模型：

```powershell
./scripts/doctor.ps1
./scripts/doctor.ps1 -Json
```

启动服务：

```powershell
./scripts/start.ps1
```

首次公式识别会下载约 224 MB 的 PP-FormulaNet-S 权重；首次实验检测会下载约 80 MB 的 MFD 1.5 ONNX 权重。

## 能力

| 能力 | 状态 | 当前证据 |
|---|---|---|
| 单公式图片 OCR | 实验、可选 | 33 样本 product-valid 15/33、人工可接受 10/33、exact 0/33、P95 5340 ms |
| 公式区域检测 | 实验、不自动启用 | display precision 25.00%、recall 27.27%、IoU 0.6322 |
| PDF-to-Markdown 模型 | 禁用 | Pix2Text 1.1.7 可运行依赖存在审计问题；安全 Transformers 版本与其 Optimum 依赖不兼容 |
| PDF 作业协议 | 已测试、无默认引擎 | multipart、容量、取消、轮询和临时文件清理 |

这些数字只适用于 2026-09-20 的本机、指定模型版本和 33 个物理论文公式，不代表通用准确率。前端不会自动从本地模型切换到收费云端服务。

## API

- `GET /health`：快速状态，不加载权重。
- `GET /v1/capabilities`：安装能力、限制、状态和许可。
- `POST /v1/recognize`：结构化单图公式识别。
- `POST /v1/detect`：实验性公式框检测，不执行 OCR。
- `POST/GET/DELETE /v1/jobs/...`：文档作业协议；默认文档引擎禁用。

请求只接受 base64 data URL 或 multipart bytes，不接受远程 URL。默认限制为 16 MB 图片编码、4000 万解码像素、50 MB PDF、100 页和 8 个文档作业。

## 开发验证

```powershell
uv run pytest -q
uv run ruff check .
uv run mypy "src/formula_ocr_engine"
uv run pip-audit
```

模型测试默认跳过。显式运行：

```powershell
$env:RUN_MODEL_TESTS='1'
uv run pytest -m model -v
Remove-Item Env:RUN_MODEL_TESTS
```

完整第三方许可与商业使用决策见 `THIRD_PARTY_NOTICES.md`。
