import type { ProviderType } from './providers/types';

export type FormulaType = 'auto' | 'math' | 'physics' | 'chemistry';
export type RecognitionMode = 'single' | 'multiple';
export type RecognitionStatus = 'success' | 'uncertain' | 'invalid' | 'error';
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

function unwrapResponse(text: string): { latex: string; uncertainties: string[]; candidates?: RecognitionCandidate[] } {
  const trimmed = text.trim();
  if (!trimmed) return { latex: '', uncertainties: [] };

  try {
    const parsed = JSON.parse(trimmed) as {
      latex?: unknown;
      uncertainties?: unknown;
      candidates?: unknown;
    };
    if (typeof parsed.latex === 'string') {
      return {
        latex: parsed.latex.trim(),
        uncertainties: Array.isArray(parsed.uncertainties)
          ? parsed.uncertainties.filter((value): value is string => typeof value === 'string')
          : [],
        candidates: Array.isArray(parsed.candidates)
          ? parsed.candidates.filter((candidate): candidate is RecognitionCandidate =>
              !!candidate && typeof candidate === 'object' && typeof (candidate as RecognitionCandidate).latex === 'string')
          : undefined,
      };
    }
  } catch {
    // Providers may return fenced text; parse it below.
  }

  const fenced = trimmed.match(/```(?:latex|tex)?\s*([\s\S]*?)\s*```/i);
  const body = fenced?.[1]?.trim() ?? trimmed;
  const mathMatches = [...body.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$([^$\n]+)\$(?!\$)/g)];
  if (mathMatches.length > 0) {
    return {
      latex: mathMatches.map(match => (match[1] ?? match[2]).trim()).join('\n'),
      uncertainties: body.includes('[unclear]') ? ['[unclear]'] : [],
    };
  }
  return { latex: fenced ? body : trimmed, uncertainties: body.includes('[unclear]') ? ['[unclear]'] : [] };
}

function looksLikeProse(value: string): boolean {
  return /\b(?:the|this|formula|image|cannot|can't|unable|sorry|please|clear|read)\b|无法|不能|抱歉|请提供|看不清|识别失败/i.test(value);
}

function hasBalancedDelimiters(value: string): boolean {
  const pairs: Array<[string, string]> = [['{', '}'], ['[', ']'], ['(', ')']];
  return pairs.every(([open, close]) => {
    let depth = 0;
    for (const char of value) {
      if (char === open) depth++;
      if (char === close) depth--;
      if (depth < 0) return false;
    }
    return depth === 0;
  });
}

export function parseRecognitionText(text: string): Pick<StructuredRecognitionResult, 'status' | 'latex' | 'formulaCount' | 'uncertainties' | 'candidates' | 'success'> {
  const parsed = unwrapResponse(text);
  const validation = validateRecognitionResult({ latex: parsed.latex, success: true, uncertainties: parsed.uncertainties });
  return {
    status: validation.status,
    success: validation.success,
    latex: parsed.latex,
    formulaCount: parsed.latex ? parsed.latex.split(/\n+/).filter(Boolean).length : 0,
    uncertainties: parsed.uncertainties,
    candidates: parsed.candidates,
  };
}

export function validateRecognitionResult(input: {
  latex?: string;
  success: boolean;
  uncertainties?: string[];
}): Pick<StructuredRecognitionResult, 'success' | 'status' | 'errorClass' | 'error' | 'latex' | 'formulaCount' | 'uncertainties'> {
  const latex = input.latex?.trim() ?? '';
  const uncertainties = input.uncertainties ?? [];
  if (!input.success || !latex) {
    return { success: false, status: 'invalid', latex, formulaCount: 0, uncertainties, errorClass: 'invalid_output', error: '识别结果为空' };
  }
  if (/\\(?:input|include|write18|openout)\b/i.test(latex)) {
    return { success: false, status: 'invalid', latex, formulaCount: 0, uncertainties, errorClass: 'unsafe_output', error: '识别结果包含禁止命令' };
  }
  if (looksLikeProse(latex) || !hasBalancedDelimiters(latex) || /```|\$\$/.test(latex)) {
    return { success: false, status: 'invalid', latex, formulaCount: 0, uncertainties, errorClass: 'invalid_output', error: '识别结果不是有效的纯 LaTeX' };
  }
  const status: RecognitionStatus = uncertainties.length > 0 || latex.includes('[unclear]') ? 'uncertain' : 'success';
  return { success: true, status, latex, formulaCount: latex.split(/\n+/).filter(Boolean).length, uncertainties };
}
