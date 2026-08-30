import { describe, expect, it } from 'vitest';
import { createDiagnosticEvent, emitDiagnostic } from '../../utils/diagnostics';

describe('privacy-safe diagnostics', () => {
  it('keeps boundary metadata while excluding content-like fields', () => {
    const event = createDiagnosticEvent({
      requestId: 'req-123',
      stage: 'provider',
      outcome: 'failed',
      inputMime: 'image/png; charset=binary',
      formulaType: 'physics',
      mode: 'single',
      provider: 'backend',
      sourceType: 'image',
      durationMs: 12.6,
      errorClass: 'network',
    });

    expect(event).toMatchObject({
      event: 'formula_ocr_boundary',
      requestId: 'req-123',
      inputMime: 'image/png',
      durationMs: 13,
    });
    expect(JSON.stringify(event)).not.toMatch(/base64|latex|absolute|path|api.?key/i);
  });

  it('does not call a sink unless diagnostics are explicitly enabled', () => {
    const sink = vi.fn();
    const event = createDiagnosticEvent({ requestId: 'req', stage: 'ui', outcome: 'started' });

    emitDiagnostic(event, sink);
    expect(sink).not.toHaveBeenCalled();

    emitDiagnostic(event, sink, true);
    expect(sink).toHaveBeenCalledWith(event);
  });

  it('redacts unsafe request ids and invalid numeric metadata', () => {
    const event = createDiagnosticEvent({
      requestId: 'C:\\private\\document.pdf',
      stage: 'parse',
      outcome: 'failed',
      pageNumber: 0,
      formulaCount: -1,
      durationMs: -4,
    });

    expect(event.requestId).toBe('redacted');
    expect(event).not.toHaveProperty('pageNumber');
    expect(event).not.toHaveProperty('formulaCount');
    expect(event).not.toHaveProperty('durationMs');
  });
});
