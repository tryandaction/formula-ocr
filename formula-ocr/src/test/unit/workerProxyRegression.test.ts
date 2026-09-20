import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyZhipuAPI } from '../../../../formula-ocr-worker/src/zhipu';

afterEach(() => vi.unstubAllGlobals());

describe('Worker provider proxy', () => {
  it('preserves structured formulas and uncertainties', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"formulas":[{"latex":"x^2","uncertainties":["exponent"]},{"latex":"y=1","uncertainties":[]}],"uncertainties":[]}\n```' } }] }))));
    const result = await proxyZhipuAPI('data:image/png;base64,AAAA', 'key', { requestId: 'r', mime: 'image/png', formulaType: 'physics', mode: 'multiple' });
    expect(result).toMatchObject({ success: true, formulaCount: 2, uncertainties: ['exponent'], formulas: [{ latex: 'x^2' }, { latex: 'y=1' }] });
  });

  it('maps upstream rate limits without claiming success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":{"message":"limited"}}', { status: 429 })));
    expect(await proxyZhipuAPI('data:image/png;base64,AAAA', 'key')).toMatchObject({ success: false, errorClass: 'rate_limit' });
  });
});
