import type { RecognitionErrorClass, StructuredRecognitionResult } from '../ocrContract';
import type { ProviderInterface, ProviderType, RecognitionRequestContext } from './types';

const LOCAL_SERVER_URL = 'http://127.0.0.1:8502';

export interface LocalServerStatus {
  reachable: boolean;
  available: boolean;
  message: string;
  errorClass?: RecognitionErrorClass;
  capabilities?: Record<string, unknown>;
}

function abortTimeout(signal?: AbortSignal): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000);
}

export async function checkLocalServer(signal?: AbortSignal): Promise<LocalServerStatus> {
  try {
    const health = await fetch(`${LOCAL_SERVER_URL}/health`, { signal: abortTimeout(signal) });
    if (!health.ok) return { reachable: false, available: false, message: '本地服务健康检查失败', errorClass: 'network' };
    const capabilitiesResponse = await fetch(`${LOCAL_SERVER_URL}/v1/capabilities`, { signal: abortTimeout(signal) });
    if (!capabilitiesResponse.ok) return { reachable: true, available: false, message: '本地服务能力接口异常', errorClass: 'provider_response' };
    const capabilities = await capabilitiesResponse.json() as Record<string, unknown>;
    const engines = Array.isArray(capabilities.engines) ? capabilities.engines : [];
    const formula = engines.find((engine): engine is Record<string, unknown> => !!engine && typeof engine === 'object' && engine.kind === 'formula');
    if (formula?.available !== true) {
      return { reachable: true, available: false, message: '本地服务已连接，但公式模型不可用', errorClass: 'model_unavailable', capabilities };
    }
    return { reachable: true, available: true, message: '本地公式模型可用', capabilities };
  } catch {
    return { reachable: false, available: false, message: '本地服务未启动，请先运行 formula-ocr-engine', errorClass: 'network' };
  }
}

export const localProvider: ProviderInterface = {
  type: 'local' as ProviderType,

  async recognize(imageBase64: string, _key?: string, context?: RecognitionRequestContext): Promise<StructuredRecognitionResult> {
    const status = await checkLocalServer(context?.signal);
    context?.signal?.throwIfAborted();
    if (!status.reachable) throw new Error(status.message);
    if (!status.available) throw new Error(status.errorClass || 'model_unavailable');
    if (!context) throw new Error('invalid_input');
    const response = await fetch(`${LOCAL_SERVER_URL}/v1/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: context.requestId,
        image: imageBase64,
        mime: context.mime,
        formulaType: context.formulaType,
        mode: context.mode,
        source: context.source || { kind: 'image' },
      }),
      signal: context.signal ?? AbortSignal.timeout(120000),
    });
    const data = await response.json().catch(() => ({})) as StructuredRecognitionResult;
    if (!response.ok) throw new Error(data.errorClass || data.error || `local service error ${response.status}`);
    return data;
  },
};

export const LOCAL_SETUP_INSTRUCTIONS = `
## 本地公式 OCR 服务

在仓库的 formula-ocr-engine 目录运行：

\`\`\`powershell
uv sync --python 3.11 --extra paddle --extra dev
uv run formula-ocr-engine
\`\`\`

服务默认只监听 127.0.0.1:8502。首次识别会加载 PP-FormulaNet-S；模型未通过项目基准门槛前，本地服务保持可选，不会自动切换到云端 Provider。
`;
