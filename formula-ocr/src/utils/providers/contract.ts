import type { RecognitionRequestContext } from './types';
import type { ProviderInterface } from './types';
import {
  parseRecognitionText,
  type RecognitionRequest,
  type StructuredRecognitionResult,
  type RecognitionErrorClass,
} from '../ocrContract';

/** One prompt shared by every vision provider. */
export function buildFormulaPrompt(context?: RecognitionRequestContext): string {
  const typeHint = context?.formulaType && context.formulaType !== 'auto'
    ? `\n公式类型提示：${context.formulaType}。只在图像证据支持时采用该提示。`
    : '';
  const modeHint = context?.mode === 'multiple' ? '按阅读顺序提取所有公式，各占 formulas 的一项。' : '仅提取所选区域中的一个公式。';
  return `识别图片中的${context?.source?.kind || 'image'}公式并输出结构化 JSON。${typeHint}${modeHint}

完整转录裁剪内公式本体的每个可见符号，必须保留等号左侧、上下标、求和/积分上下限和全部公式行。忽略右侧圆括号公式编号。latex 中禁止 \`$\`、\`$$\`、\`\\begin{equation}\`、\`\\begin{aligned}\`、解释文字和公式外正文。

只允许以下 JSON 结构，不要 Markdown 或解释：
{"formulas":[{"latex":"...","uncertainties":[]}],"uncertainties":[]}

latex 必须是纯 LaTeX；无法确认的字符保留为 [unclear] 并写入 uncertainties。只转录可见内容，不推导或补全。看不到公式时 formulas 为空数组。JSON 中反斜杠必须正确转义。`;
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
  if (/TimeoutError|timeout|超时/i.test(message)) return 'timeout';
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new DOMException('识别超时', 'TimeoutError')), provider.type === 'local' ? 120000 : 60000);
      const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
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
          signal: combined,
        });
        combined.throwIfAborted();
        const parsed = parseRecognitionText(raw);
        return { ...parsed, provider: provider.type, processingTime: Date.now() - startedAt };
      } catch (error) {
        const errorClass = combined.aborted ? mapProviderError(combined.reason) : mapProviderError(error);
        return {
          success: false, status: 'error', latex: '', formulaCount: 0,
          uncertainties: [], provider: provider.type,
          processingTime: Date.now() - startedAt,
          errorClass, error: error instanceof Error ? error.message : 'Provider 请求失败',
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
