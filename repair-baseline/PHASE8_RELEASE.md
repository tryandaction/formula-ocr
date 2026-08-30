# Phase 8 最终回归记录

日期：2026-08-30

## 质量门结果

| 命令 | 结果 |
|---|---|
| `formula-ocr: npm run test:run` | 通过：26 个测试文件，224/224 测试通过 |
| `formula-ocr: npx tsc -b --pretty false` | 通过 |
| `formula-ocr: npm run lint` | 失败：67 errors、8 warnings，主要为历史 PDF viewer、示例和旧组件；本轮涉及模块单独 lint 为 0/0 |
| `formula-ocr: npm run build` | 失败：Vite 清理既有 `dist/alipay.png` 时 Windows `EPERM unlink` |
| `formula-ocr: npx vite build --outDir ../repair-baseline/dist-check` | 通过；未触碰既有 `dist` |
| `formula-ocr-worker: npx tsc --noEmit` | 通过 |
| `git diff --check` | 通过，无空白错误 |

## 指标边界

- OCR exact match、规范化 match、检测 precision/recall/IoU、页级召回、峰值内存和 Provider P50/P95：未测量。
- `repair-baseline/evaluate.mjs` 在当前 9 条 manifest（0 条已配对 OCR 结果）上输出“样本不足”。
- 现有 PDF benchmark 仅有检测数、耗时、页面状态和 backend unavailable 记录，未含人工框或 ground truth，不能当作准确率。

## 功能状态

- 图片：统一 MIME/请求契约；云端默认原图，结果保留 Provider/耗时/错误状态。
- PDF：文本层/扫描分类、文本候选和视觉检测分层；坐标可往返；OCR 失败不伪装成功。
- Markdown：源码公式直接解析，代码块跳过，不重复视觉 OCR；未闭合分隔符报错。
- DOCX：明确暂不支持，上传不会显示“支持”后再静默失败。

## 残余风险与发布前置条件

- 需释放/定位占用 `formula-ocr/dist/alipay.png` 的 Windows 进程后再运行默认构建；本轮未删除文件。
- 需清理剩余 67 个 lint errors、8 个 warnings，尤其是 PDF viewer 的 props 修改和随机渲染。
- 需补充至少 30 个经人工核对的图片/PDF/DOCX/Markdown 基准结果，再报告任何百分比。
- 需在干净浏览器完成文件 chooser、取消、重试、导出和移动端 E2E；当前环境 chooser 超时，未宣称通过。
- 未执行 git commit/push/reset/checkout。

## 部署尝试（2026-08-30）

- `wrangler whoami`：当前 OAuth 账号为 `Tryandaction@gmail.com's Account`（`2b234c5cf6eee4c634410cd05c5c2d21`）。
- Worker 部署被阻止：配置中的 KV namespace `23a0822d80fc47f594e650acaceedef4` 不属于当前账号（Cloudflare `10041`）。
- Pages 部署被阻止：当前账号不存在 `formula-ocr` 项目（Cloudflare `8000007`）；项目列表也未包含该项目。
- 未创建新 Pages 项目、KV namespace 或 Worker，以避免误部署/误绑定生产数据。
