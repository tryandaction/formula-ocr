import { describe, expect, it } from 'vitest';
import {
  buildRecognitionRequest,
  parseRecognitionText,
  validateRecognitionResult,
  type RecognitionRequest,
} from '../../utils/ocrContract';
import { classifyProviderError, extractLatex } from '../../utils/apiClient';

describe('single-image OCR contract', () => {
  const request: RecognitionRequest = buildRecognitionRequest({
    image: 'data:image/png;base64,AAAA',
    mime: 'image/png',
    formulaType: 'physics',
    mode: 'single',
    source: { kind: 'image', fileName: 'fixture.png' },
  });

  it('includes explicit request metadata and a stable request id', () => {
    expect(request).toMatchObject({
      mime: 'image/png',
      formulaType: 'physics',
      mode: 'single',
      source: { kind: 'image' },
    });
    expect(request.requestId).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(request.image).toBe('data:image/png;base64,AAAA');
  });

  it.each([
    ['auto', 'auto'],
    ['math', 'math'],
    ['physics', 'physics'],
    ['chemistry', 'chemistry'],
  ] as const)('preserves formula type %s in request fixture', (type, expected) => {
    const typed = buildRecognitionRequest({
      image: 'data:image/jpeg;base64,AAAA',
      mime: 'image/jpeg',
      formulaType: type,
      mode: 'single',
      source: { kind: 'image' },
    });
    expect(typed.formulaType).toBe(expected);
  });

  it('parses JSON, fenced LaTeX, and math wrappers without accepting prose', () => {
    expect(parseRecognitionText('{"latex":"E = mc^2","uncertainties":["m"]}')).toMatchObject({
      latex: 'E = mc^2',
      uncertainties: ['m'],
    });
    expect(parseRecognitionText('```latex\n\\frac{a}{b}\n```').latex).toBe('\\frac{a}{b}');
    expect(parseRecognitionText('The formula is clear, but I cannot read it.').status).toBe('invalid');
    expect(parseRecognitionText('[unclear]')).toMatchObject({ status: 'uncertain', latex: '[unclear]' });
  });

  it('rejects unsafe or structurally invalid LaTeX', () => {
    expect(validateRecognitionResult({ latex: '', success: true })).toMatchObject({
      success: false,
      status: 'invalid',
    });
    expect(validateRecognitionResult({ latex: '\\frac{a}{b', success: true }).errorClass).toBe('invalid_output');
    expect(validateRecognitionResult({ latex: '\\input{secret}', success: true }).errorClass).toBe('unsafe_output');
    expect(validateRecognitionResult({ latex: 'x+y', success: true })).toMatchObject({
      success: true,
      status: 'success',
    });
  });

  it('classifies provider failures without exposing provider response text', () => {
    expect(classifyProviderError(new Error('Quota exceeded (429)'))).toBe('quota');
    expect(classifyProviderError(new DOMException('The operation was aborted', 'AbortError'))).toBe('timeout');
    expect(classifyProviderError(new Error('cancelled by user'))).toBe('cancelled');
    expect(classifyProviderError(new Error('fetch failed'))).toBe('network');
    expect(extractLatex('I cannot read this image.')).toBe('');
  });
});
