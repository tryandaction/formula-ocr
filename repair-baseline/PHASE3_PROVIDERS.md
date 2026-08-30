# Phase 3 Provider 交付记录

## Provider 事实清单

| Provider | Endpoint | 模型 | 认证 | 图像字段/MIME | 超时 |
|---|---|---|---|---|---|
| backend | `/api/recognize` | Worker 内部智谱 | `X-User-ID` | JSON `image` + `mime` | 前端 60s |
| anthropic | `api.anthropic.com/v1/messages` | `claude-sonnet-4-20250514` | `x-api-key` | base64 source + media_type | 待核实 |
| openai | `api.openai.com/v1/chat/completions` | `gpt-4o` | Bearer | data URL | 待核实 |
| gemini | `generativelanguage.googleapis.com/...generateContent` | `gemini-2.0-flash` | query key | inline_data mime_type/base64 | 待核实 |
| simpletex | `server.simpletex.cn/api/latex_ocr` | 服务端未公开于代码 | token header | multipart Blob | 待核实 |
| siliconflow | `api.siliconflow.cn/v1/chat/completions` | `Qwen/Qwen2-VL-72B-Instruct` | Bearer | data URL | 待核实 |
| qwen | `dashscope.aliyuncs.com/.../chat/completions` | `qwen-vl-max` | Bearer | data URL | 待核实 |
| zhipu | `open.bigmodel.cn/api/paas/v4/chat/completions` | `glm-4v-flash` | Bearer | data URL | 60s |
| local | `localhost:8502/recognize` | 服务端配置 | 无 | raw base64 JSON | 120s |

以上只记录代码配置，未联网核实模型可用性或服务端结构化输出能力。

## 修改与验证

- `providers/contract.ts` 新增统一 prompt、结构化 adapter 和错误映射。
- `providerAdapter.test.ts` 覆盖结构化成功、rate limit 和取消分类。
- 阶段测试：25/25 通过。
- 前端 `npx tsc -b --pretty false`：通过。
- Worker `npx tsc --noEmit`：通过。

## Fallback 策略现状

现有 `formulaOCR.ts` 仍包含 provider fallback。Phase 3 没有将 adapter 自动接入收费 Provider 链；后续只允许在可重试错误、用户明确许可且可见候选链时 fallback。当前风险是旧路径仍可能依据可用性选择其他 Provider。

## 未验证项

- 未对真实 API 发请求；所有契约测试离线运行。
- 各服务的结构化输出能力、模型版本和 MIME 上限待官方文档/真实账号核实。
- 部分底层 fetch 尚未贯穿外部 AbortSignal。
