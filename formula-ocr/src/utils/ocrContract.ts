import katex from 'katex';
import 'katex/contrib/mhchem';
import type { ProviderType } from './providers/types';

export type FormulaType = 'auto' | 'math' | 'physics' | 'chemistry';
export type RecognitionMode = 'single' | 'multiple';
export type RecognitionStatus = 'success' | 'uncertain' | 'invalid' | 'error' | 'no_formula';
export type RecognitionErrorClass =
  | 'invalid_input'
  | 'invalid_output'
  | 'unsafe_output'
  | 'network'
  | 'quota'
  | 'provider'
  | 'cancelled'
  | 'timeout'
  | 'auth'
  | 'rate_limit'
  | 'provider_response'
  | 'uncertain_result'
  | 'invalid_latex';
  

export interface RecognitionSource {
  kind: 'image' | 'pdf' | 'docx' | 'markdown';
  fileName?: string;
  pageNumber?: number;
  regionId?: string;
}

export interface RecognitionRequest {
  requestId: string;
  image: string;
  mime: string;
  formulaType: FormulaType;
  mode: RecognitionMode;
  source: RecognitionSource;
}

export interface RecognitionCandidate {
  latex: string;
  confidence?: number;
}

export interface StructuredRecognitionResult {
  success: boolean;
  status: RecognitionStatus;
  latex: string;
  formulaCount: number;
  formulas?: RecognitionCandidate[];
  confidence?: number;
  uncertainties: string[];
  candidates?: RecognitionCandidate[];
  provider?: ProviderType | string;
  processingTime?: number;
  error?: string;
  errorClass?: RecognitionErrorClass;
}

export interface RecognitionRequestInput {
  image: string;
  mime: string;
  formulaType: FormulaType;
  mode: RecognitionMode;
  source: RecognitionSource;
  requestId?: string;
}

const MIME_PATTERN = /^[a-z]+\/[a-z0-9.+-]+$/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

function makeRequestId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `ocr-${random}`;
}

export function buildRecognitionRequest(input: RecognitionRequestInput): RecognitionRequest {
  if (!input.image || !MIME_PATTERN.test(input.mime)) {
    throw new Error('invalid_input');
  }
  const requestId = input.requestId && REQUEST_ID_PATTERN.test(input.requestId)
    ? input.requestId
    : makeRequestId();
  return {
    requestId,
    image: input.image,
    mime: input.mime.split(';', 1)[0].toLowerCase(),
    formulaType: input.formulaType,
    mode: input.mode,
    source: { ...input.source },
  };
}


function invalid(error = '模型输出无效，请调整选区或换服务重试', errorClass: RecognitionErrorClass = 'invalid_output'): StructuredRecognitionResult {
  return { success: false, status: 'invalid', latex: '', formulaCount: 0, formulas: [], uncertainties: [], errorClass, error };
}
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string') : [];

function restoreControlCommand(value: string, control: string, prefix: string, suffixes: string[]): string {
  let result = '';
  for (let index = 0; index < value.length; index++) {
    const suffix = value[index] === control ? suffixes.find(candidate => value.startsWith(candidate, index + 1)) : undefined;
    if (suffix) {
      result += `\\${prefix}`;
    } else {
      result += value[index];
    }
  }
  return result;
}

function repairJsonControlEscapes(value: string): string {
  return [
    ['\b', 'b', ['egin', 'eta', 'ig', 'mathbf']],
    ['\f', 'f', ['rac']],
    ['\n', 'n', ['eq', 'u']],
    ['\r', 'r', ['angle', 'ight', 'ho']],
    ['\t', 't', ['ext', 'imes', 'heta', 'au']],
  ].reduce((result, [control, prefix, suffixes]) => restoreControlCommand(result, control as string, prefix as string, suffixes as string[]), value);
}

export function validateRecognitionResult(input: { latex?: string; success: boolean; uncertainties?: string[] }): StructuredRecognitionResult {
  const latex = input.latex?.trim() ?? '';
  if (!input.success || !latex) return invalid('识别结果为空');
  if (/\\(?:input|include|write|openout|read|catcode|def|gdef|href|url|html\w*)\b/i.test(latex)) return invalid('识别结果包含禁止命令', 'unsafe_output');
  const visible = latex.replace(/\\(?:text|mathrm|operatorname|begin|end)\{[^{}]*\}/g, '').replace(/\\[a-zA-Z]+/g, '').replaceAll('[unclear]', '');
  if (/\x60|\$/.test(latex) || /[a-zA-Z]{4,}|[\u4e00-\u9fff]{2,}/.test(visible)) return invalid();
  const uncertainties = [...new Set([...(input.uncertainties ?? []), ...(latex.includes('[unclear]') ? ['[unclear]'] : [])])];
  try {
    katex.renderToString(latex.replaceAll('[unclear]', '\\square'), { throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000 });
  } catch { return invalid('LaTeX 语法或渲染验证失败'); }
  return { success: true, status: uncertainties.length ? 'uncertain' : 'success', latex, formulaCount: 1, formulas: [{ latex }], uncertainties };
}

export function parseRecognitionText(text: string): StructuredRecognitionResult {
  if (typeof text !== 'string' || text.length > 200_000) return invalid();
  let body = text.trim();
  const fence = body.match(/^\x60{3}(?:json|latex|tex)?\s*\n?([\s\S]*?)\n?\x60{3}$/i);
  if (fence) body = fence[1].trim();
  let entries: Array<{ latex: string; uncertainties?: string[] }> = [];
  let uncertainties: string[] = [];
  let candidates: RecognitionCandidate[] | undefined;
  let confidence: number | undefined;
  if ((body.startsWith('{') || body.startsWith('[') || /^(null|true|false)$/.test(body)) && !body.startsWith('[unclear]')) {
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { return invalid('结构化结果不是完整 JSON'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid();
    const object = parsed as Record<string, unknown>;
    if (object.success === false) return invalid('Provider 返回识别失败', 'provider_response');
    uncertainties = strings(object.uncertainties);
    if (typeof object.confidence === 'number' && object.confidence >= 0 && object.confidence <= 1) confidence = object.confidence;
    if (Array.isArray(object.candidates)) {
      candidates = object.candidates.filter((c): c is RecognitionCandidate => !!c && typeof c === 'object' && typeof c.latex === 'string');
      if (candidates.length) uncertainties.push('存在候选结果，请人工复核');
    }
    if (Array.isArray(object.formulas)) {
      for (const entry of object.formulas) {
        if (!entry || typeof entry !== 'object' || typeof entry.latex !== 'string' || !entry.latex.trim()) return invalid();
        entries.push({ latex: repairJsonControlEscapes(entry.latex), uncertainties: strings(entry.uncertainties) });
      }
    } else if (typeof object.latex === 'string') {
      if (object.latex.trim()) entries = [{ latex: repairJsonControlEscapes(object.latex) }];
    } else return invalid('结构化结果缺少 formulas 或 latex');
    if (!entries.length) return { success: false, status: 'no_formula', latex: '', formulaCount: 0, formulas: [], uncertainties };
  } else {
    const wrapper = /\$\$([\s\S]*?)\$\$|(?<!\$)\$([^$\n]+)\$(?!\$)|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
    const matches = [...body.matchAll(wrapper)];
    entries = matches.length ? matches.map(m => ({ latex: (m[1] ?? m[2] ?? m[3] ?? m[4]).trim() })) : [{ latex: body }];
    if (matches.length && body.replace(wrapper, '').trim()) uncertainties.push('响应包含公式之外的说明，请复核');
  }
  const formulas: RecognitionCandidate[] = [];
  for (const entry of entries) {
    const checked = validateRecognitionResult({ latex: entry.latex, success: true, uncertainties: entry.uncertainties });
    if (!checked.success) return checked;
    formulas.push({ latex: checked.latex });
    uncertainties.push(...checked.uncertainties);
  }
  return { success: true, status: uncertainties.length ? 'uncertain' : 'success', latex: formulas.map(f => f.latex).join('\n\n'), formulas, formulaCount: formulas.length, uncertainties: [...new Set(uncertainties)], candidates, confidence };
}
