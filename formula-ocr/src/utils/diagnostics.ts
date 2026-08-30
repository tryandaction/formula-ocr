/**
 * Privacy-safe diagnostic events for OCR pipeline boundaries.
 * Payloads intentionally contain metadata only; callers must never pass
 * image bytes, document contents, credentials, or absolute filesystem paths.
 */

export type DiagnosticStage =
  | 'input'
  | 'preprocess'
  | 'provider'
  | 'parse'
  | 'detection'
  | 'ocr'
  | 'queue'
  | 'ui';

export type DiagnosticOutcome = 'started' | 'succeeded' | 'failed' | 'cancelled';

export interface DiagnosticEvent {
  event: 'formula_ocr_boundary';
  requestId: string;
  stage: DiagnosticStage;
  outcome: DiagnosticOutcome;
  timestamp: number;
  inputMime?: string;
  formulaType?: string;
  mode?: 'single' | 'multiple';
  provider?: string;
  sourceType?: 'image' | 'pdf' | 'docx' | 'markdown';
  pageNumber?: number;
  formulaCount?: number;
  durationMs?: number;
  errorClass?: string;
}

export interface DiagnosticSink {
  (event: DiagnosticEvent): void;
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/;

/**
 * Build a validated event. Unknown or unsafe identifiers are replaced with a
 * deterministic redacted value instead of being logged verbatim.
 */
export function createDiagnosticEvent(
  input: Omit<DiagnosticEvent, 'event' | 'timestamp'> & { timestamp?: number },
): DiagnosticEvent {
  const requestId = REQUEST_ID_PATTERN.test(input.requestId) ? input.requestId : 'redacted';
  const event: DiagnosticEvent = {
    event: 'formula_ocr_boundary',
    requestId,
    stage: input.stage,
    outcome: input.outcome,
    timestamp: input.timestamp ?? Date.now(),
  };

  if (input.inputMime) event.inputMime = input.inputMime.split(';', 1)[0].slice(0, 80);
  if (input.formulaType) event.formulaType = input.formulaType.slice(0, 40);
  if (input.mode) event.mode = input.mode;
  if (input.provider) event.provider = input.provider.slice(0, 40);
  if (input.sourceType) event.sourceType = input.sourceType;
  if (Number.isInteger(input.pageNumber) && input.pageNumber! > 0) event.pageNumber = input.pageNumber;
  if (Number.isInteger(input.formulaCount) && input.formulaCount! >= 0) event.formulaCount = input.formulaCount;
  if (Number.isFinite(input.durationMs) && input.durationMs! >= 0) event.durationMs = Math.round(input.durationMs!);
  if (input.errorClass) event.errorClass = input.errorClass.slice(0, 80);

  return event;
}

/** Emit only when a caller explicitly enables diagnostics. */
export function emitDiagnostic(
  event: DiagnosticEvent,
  sink?: DiagnosticSink,
  enabled = false,
): void {
  if (enabled) sink?.(event);
}
