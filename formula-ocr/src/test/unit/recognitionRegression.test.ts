import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseRecognitionText, buildRecognitionRequest } from '../../utils/ocrContract';
import { createProviderAdapter } from '../../utils/providers/contract';
import { openaiProvider } from '../../utils/providers/openai';

afterEach(() => vi.unstubAllGlobals());
describe('real response boundaries', () => {
  it('preserves formulas and uncertainty from fenced JSON', () => {
    const parsed = parseRecognitionText('```json\n' + JSON.stringify({ formulas: [{ latex: 'x^2', uncertainties: ['exponent'] }, { latex: 'y=2' }] }) + '\n```');
    expect(parsed).toMatchObject({ success: true, status: 'uncertain', formulaCount: 2, uncertainties: ['exponent'] });
  });
  it('does not split a multiline aligned formula by source line', () => {
    expect(parseRecognitionText('\\begin{aligned}\nx&=1\\\\\ny&=2\n\\end{aligned}').formulaCount).toBe(1);
  });
  it.each(['null', '{"success":false,"latex":"x=1"}', 'Some arbitrary explanatory sentence.', '\\unknowncommand{x}'])('rejects invalid output %s', text => {
    expect(parseRecognitionText(text).success).toBe(false);
  });
  it('accepts valid intervals with unlike delimiters', () => {
    expect(parseRecognitionText('x\\in[0,1)').success).toBe(true);
  });
  it('distinguishes an explicit no-formula result from invalid output', () => {
    expect(parseRecognitionText('{"formulas":[]}')).toMatchObject({ status: 'no_formula', formulaCount: 0 });
  });
  it('repairs JSON control escapes that corrupt known LaTeX commands', () => {
    const cases = [
      ['|q' + '\r' + 'angle', '|q\\rangle'],
      ['\f' + 'rac{1}{2}', '\\frac{1}{2}'],
      ['\t' + 'ext{ok}', '\\text{ok}'],
      ['\b' + 'egin{matrix}x' + '\\end{matrix}', '\\begin{matrix}x\\end{matrix}'],
    ];
    for (const [damagedLatex, expected] of cases) {
      expect(parseRecognitionText(JSON.stringify({ formulas: [{ latex: damagedLatex }] }))).toMatchObject({
        success: true,
        latex: expected,
      });
    }
  });
  it('preserves uncertainty through a real provider with only HTTP mocked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ latex: 'x^2', uncertainties: ['exponent'] }) } }] }))));
    const request = buildRecognitionRequest({ image: 'data:image/png;base64,AAAA', mime: 'image/png', formulaType: 'physics', mode: 'multiple', source: { kind: 'image' } });
    const result = await createProviderAdapter(openaiProvider, 'fixture-key').recognize(request);
    expect(result).toMatchObject({ status: 'uncertain', uncertainties: ['exponent'] });
  });
  it('aborts a running HTTP request when user cancels', async () => {
    let transportSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => {
      transportSignal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => transportSignal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
    }));
    const controller = new AbortController();
    const request = buildRecognitionRequest({ image: 'data:image/png;base64,AAAA', mime: 'image/png', formulaType: 'math', mode: 'single', source: { kind: 'image' } });
    const result = createProviderAdapter(openaiProvider, 'fixture-key').recognize(request, controller.signal);
    controller.abort();
    expect(transportSignal?.aborted).toBe(true);
    expect(await result).toMatchObject({ errorClass: 'cancelled', success: false });
  });
});
