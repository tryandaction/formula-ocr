# 部署指南

项目包含静态前端 `formula-ocr` 和可选 Cloudflare Worker `formula-ocr-worker`。当前默认发布目标是 GitHub Pages；Worker 只有在 Cloudflare 账号、KV 与 secrets 均已正确绑定时才能单独部署。

## GitHub Pages

`.github/workflows/deploy-pages.yml` 在推送到 `main` 后执行：

1. `formula-ocr` 安装锁定依赖、lint、全量测试和生产构建。
2. `formula-ocr-worker` 安装锁定依赖并执行 TypeScript typecheck。
3. 使用 `/formula-ocr/` 作为 Vite base 上传 Pages artifact。
4. 仅在以上质量门全部通过后发布。

仓库需在 GitHub Actions 中拥有 `pages: write` 与 `id-token: write` 权限。若组织策略禁止 workflow 自动启用 Pages，仓库管理员需在 Settings > Pages 中将 Source 设置为 GitHub Actions。

## 本地发布前验证

```powershell
cd "formula-ocr"
npm ci
npm run lint
npm run test:run
npm run build
npm audit --omit=dev --audit-level=high

cd "../formula-ocr-worker"
npm ci
npx tsc --noEmit
npm audit --omit=dev --audit-level=high
```

不要将 `.env`、API Key、Cloudflare token 或用户上传内容提交到仓库。

## Provider 配置

前端可让用户在浏览器本地配置受支持的 Provider。浏览器直连意味着 Key 保存在本机浏览器存储并发送到所选 Provider；这不是服务端托管凭据。生产团队若不接受该边界，应只开放 Worker 代理并在服务端管理 Key。

## 可选 Worker 部署

先检查 `formula-ocr-worker/wrangler.toml` 的账号资源与 KV namespace 确实属于目标 Cloudflare 账号，再设置 secrets：

```powershell
cd "formula-ocr-worker"
npx wrangler secret put ZHIPU_API_KEY
npx wrangler secret put ADMIN_SECRET
npx wrangler deploy
```

这是会修改外部生产状态的操作；执行前必须确认目标账号、Worker 名称、路由、KV 和 CORS。仓库不声称当前 Cloudflare Worker 已部署。

## 发布后冒烟测试

- 页面资源从 Pages 子路径正确加载，浏览器控制台无错误。
- Markdown 源码公式无需 Provider 即可解析和导出。
- PNG/PDF/DOCX 流程显示独立的文件状态和公式状态。
- 配置测试 Provider 后，成功、未检测到、认证、限流、网络、取消和需复核状态可区分。
- PDF 可逐页完成并通过页面预览手动框选补漏。

OCR 准确率、PDF 检测 precision/recall 和端到端延迟必须按 `formula-ocr/ACCEPTANCE_TEST_GUIDE.md` 使用带 ground truth 的版本化基准测量，不能从构建或单元测试结果推断。
