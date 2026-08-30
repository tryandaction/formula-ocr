import type { RecognitionRequestContext } from './types';
import type { ProviderInterface } from './types';
import {
  parseRecognitionText,
  validateRecognitionResult,
  type RecognitionRequest,
  type StructuredRecognitionResult,
  type RecognitionErrorClass,
} from '../ocrContract';

/** One prompt shared by every vision provider. */
export function buildFormulaPrompt(context?: RecognitionRequestContext): string {
  const typeHint = context?.formulaType && context.formulaType !== 'auto'
    ? `\n公式类型提示：${context.formulaType}。只在图像证据支持时采用该提示。`
    : '';
  const modeHint = context?.mode === 'multiple'
    ? '\n这是多公式图像，请每个公式单独一行输出。'
    : '\n这是单公式图像，只输出一个公式。';
  return `识别图片中的${context?.source?.kind || 'image'}公式并输出结构化 JSON。${typeHint}${modeHint}

只允许以下 JSON 结构，不要 Markdown 或解释：
{"latex":"...","uncertainties":[],"candidates":[]}

latex 必须是纯 LaTeX；无法确认的字符保留为 [unclear] 并写入 uncertainties。看不到公式时 latex 为空字符串。`;
}

export interface ProviderFixture {
  provider: string;
  request: RecognitionRequestContext;
  image: string;
}

export const PROVIDER_FIXTURE_CONTEXT: RecognitionRequestContext = {
  requestId: 'fixture-request',
  mime: 'image/png',
  formulaType: 'physics',
  mode: 'single',
  source: { kind: 'image' },
};

export function getProviderFixture(provider: string): ProviderFixture {
  return {
    provider,
    request: PROVIDER_FIXTURE_CONTEXT,
    image: 'data:image/png;base64,AAAA',
  };
}

export function mapProviderError(error: unknown): RecognitionErrorClass | 'auth' | 'rate_limit' | 'provider_response' | 'uncertain_result' {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/AbortError|cancel/i.test(message)) return 'cancelled';
  if (/timeout|超时/i.test(message)) return 'timeout';
  if (/429|rate.?limit/i.test(message)) return 'rate_limit';
  if (/quota|额度/i.test(message)) return 'quota';
  if (/401|403|api.?key|认证|unauthor/i.test(message)) return 'auth';
  if (/network|fetch|网络|连接/i.test(message)) return 'network';
  if (/invalid_output|latex|响应格式|Invalid API response/i.test(message)) return 'invalid_latex';
  return 'provider_response';
}

export interface ProviderAdapter {
  recognize(request: RecognitionRequest, signal?: AbortSignal): Promise<StructuredRecognitionResult>;
}

export function createProviderAdapter(provider: ProviderInterface, apiKey?: string): ProviderAdapter {
  return {
    async recognize(request, signal) {
      const startedAt = Date.now();
      try {
        if (signal?.aborted) {
          return {
            success: false, status: 'error', latex: '', formulaCount: 0,
            uncertainties: [], provider: provider.type, processingTime: 0,
            errorClass: 'cancelled', error: '请求已取消',
          };
        }
        const raw = await provider.recognize(request.image, apiKey, {
          requestId: request.requestId,
          mime: request.mime,
          formulaType: request.formulaType,
          mode: request.mode,
          source: request.source,
          signal,
        });
        const parsed = parseRecognitionText(raw);
        const checked = validateRecognitionResult({
          latex: parsed.latex,
          success: parsed.success,
          uncertainties: parsed.uncertainties,
        });
        if (!checked.success) {
          return {
            success: false, status: 'invalid', latex: parsed.latex, formulaCount: 0,
            uncertainties: parsed.uncertainties, provider: provider.type,
            processingTime: Date.now() - startedAt,
            errorClass: checked.errorClass,
            error: checked.error,
          };
        }
        return {
          success: true,
          status: checked.status,
          latex: checked.latex,
          formulaCount: checked.formulaCount,
          uncertainties: checked.uncertainties,
          provider: provider.type,
          processingTime: Date.now() - startedAt,
          ...(checked.status === 'uncertain' ? { errorClass: 'uncertain_result' as const } : {}),
        };
      } catch (error) {
        const errorClass = mapProviderError(error);
        return {
          success: false, status: 'error', latex: '', formulaCount: 0,
          uncertainties: [], provider: provider.type,
          processingTime: Date.now() - startedAt,
          errorClass, error: error instanceof Error ? error.message : 'Provider 请求失败',
        };
      }
    },
  };
}
