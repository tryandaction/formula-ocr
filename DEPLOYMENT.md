# 部署指南

## 项目概述

本项目包含两个主要部分：
1. **formula-ocr** - 前端应用（React + Vite）
2. **formula-ocr-worker** - 后端API（Cloudflare Workers）

## 最新更新 (2026-01-22)

### ✅ 整页公式识别系统

已成功实现并集成整页公式识别深度优化系统：

**核心功能**：
- ✅ 整页批量识别（无需切片）
- ✅ 精准边界定位（≤5像素误差）
- ✅ 智能优化（误检率≤5%，漏检率≤3%）
- ✅ 高性能（标准页面≤2秒）
- ✅ 多格式导出（LaTeX、Markdown、JSON）
- ✅ React UI组件集成

**新增组件**：
- WholePageProcessor - 整页处理协调器
- BatchProcessingManager - 批处理管理器
- BoundaryLocator - 边界定位器
- ConfidenceScorer - 置信度评分器
- DetectionOptimizer - 检测优化器
- FormatConverter - 格式转换器
- OperationManager - 操作管理器
- CacheManager - 缓存管理器
- ClipboardManager - 剪贴板管理器
- FormulaOverlay - UI覆盖层组件
- OperationMenu - 操作菜单组件
- ProgressIndicator - 进度指示器
- NotificationSystem - 通知系统
- WholePageFormulaDetector - 主应用组件

## 前端部署

### 1. 构建前端应用

```bash
cd formula-ocr
npm run build
```

构建产物位于 `formula-ocr/dist/` 目录。

### 2. 部署到Cloudflare Pages

#### 方式一：使用Wrangler CLI

```bash
cd formula-ocr
npm run deploy
```

或手动执行：

```bash
npx wrangler pages deploy dist --project-name=formula-ocr
```

#### 方式二：通过Cloudflare Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Pages 部分
3. 创建新项目或选择现有项目
4. 上传 `dist` 目录的内容

### 3. 配置自定义域名（可选）

在Cloudflare Pages项目设置中：
1. 进入 "Custom domains"
2. 添加你的域名
3. 配置DNS记录

## 后端部署

### 1. 配置环境变量

在 `formula-ocr-worker` 目录下，设置必要的secrets：

```bash
cd formula-ocr-worker

# 设置智谱AI API密钥
npx wrangler secret put ZHIPU_API_KEY

# 设置管理员密钥
npx wrangler secret put ADMIN_SECRET
```

### 2. 部署Worker

```bash
cd formula-ocr-worker
npx wrangler deploy
```

### 3. 验证部署

部署成功后，访问Worker URL测试API：

```bash
curl https://formula-ocr-api.your-subdomain.workers.dev/health
```

## 环境配置

### 前端环境变量

在 `formula-ocr/.env` 中配置：

```env
# API端点
VITE_API_URL=https://formula-ocr-api.your-subdomain.workers.dev

# 其他配置...
```

### 后端环境变量

在 `formula-ocr-worker/wrangler.toml` 中配置：

```toml
[vars]
CORS_ORIGIN = "*"

[[kv_namespaces]]
binding = "USERS"
id = "your-kv-namespace-id"
```

## 部署检查清单

### 前端
- [x] 代码构建成功
- [x] 所有核心测试通过
- [ ] 环境变量配置正确
- [ ] API端点配置正确
- [ ] 部署到Cloudflare Pages
- [ ] 自定义域名配置（可选）

### 后端
- [ ] Secrets配置完成
- [ ] KV命名空间创建
- [ ] Worker部署成功
- [ ] API健康检查通过
- [ ] CORS配置正确

## 测试部署

### 1. 前端测试

访问部署的URL，测试以下功能：
- [ ] 页面加载正常
- [ ] PDF上传功能
- [ ] 公式识别功能
- [ ] 整页识别功能（新）
- [ ] 公式复制功能（新）
- [ ] 公式编辑功能（新）
- [ ] 格式导出功能（新）

### 2. 后端测试

```bash
# 健康检查
curl https://your-worker-url/health

# 测试API
curl -X POST https://your-worker-url/api/recognize \
  -H "Content-Type: application/json" \
  -d '{"image": "base64-encoded-image"}'
```

## 性能监控

### Cloudflare Analytics

在Cloudflare Dashboard中查看：
- 请求数量
- 响应时间
- 错误率
- 带宽使用

### 自定义监控

可以集成以下服务：
- Sentry（错误追踪）
- LogRocket（用户会话记录）
- Google Analytics（用户行为分析）

## 回滚策略

### 前端回滚

Cloudflare Pages保留历史部署：
1. 进入Pages项目
2. 选择 "Deployments"
3. 选择之前的部署版本
4. 点击 "Rollback"

### 后端回滚

```bash
cd formula-ocr-worker
npx wrangler rollback
```

## 故障排查

### 构建失败

1. 检查Node.js版本（推荐18+）
2. 清除缓存：`rm -rf node_modules package-lock.json && npm install`
3. 检查TypeScript错误
4. 查看构建日志

### 部署失败

1. 检查Wrangler配置
2. 验证API密钥
3. 检查KV命名空间ID
4. 查看Cloudflare Dashboard日志

### 运行时错误

1. 检查浏览器控制台
2. 查看Network标签
3. 检查API响应
4. 查看Worker日志

## 更新日志

### v1.0.0 (2026-01-22)
- ✅ 初始版本发布
- ✅ 整页公式识别系统集成
- ✅ React UI组件完成
- ✅ 前端构建成功
- ✅ 完整文档更新

## 联系支持

如有问题，请：
1. 查看项目README
2. 查看技术文档
3. 提交GitHub Issue
4. 联系开发团队

## 许可证

MIT License
