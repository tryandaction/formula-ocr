import { describe, expect, it } from 'vitest';
import { validateRecognitionBody } from '../../../../formula-ocr-worker/src/contract';

describe('worker recognition contract', () => {
  it('rejects missing, invalid MIME, and oversized payloads', () => {
    expect(validateRecognitionBody({})).toMatchObject({ valid: false, errorClass: 'invalid_input' });
    expect(validateRecognitionBody({ image: 'data:image/png;base64,a', mime: 'text/plain' })).toMatchObject({ valid: false, errorClass: 'invalid_input' });
    expect(validateRecognitionBody({ image: `data:image/png;base64,${'a'.repeat(14 * 1024 * 1024)}`, mime: 'image/png' })).toMatchObject({ valid: false, errorClass: 'invalid_input' });
  });

  it('accepts the documented request fields', () => {
    expect(validateRecognitionBody({ image: 'data:image/png;base64,AAAA', mime: 'image/png', formulaType: 'physics', mode: 'single' })).toEqual({ valid: true });
  });
});
