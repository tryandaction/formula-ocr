import { afterEach, describe, expect, it, vi } from 'vitest';
import { zhipuProvider } from '../../utils/providers/zhipu';

afterEach(() => vi.unstubAllGlobals());

describe('Zhipu browser provider request', () => {
  it('asks the API to enforce the canonical JSON response shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"formulas":[{"latex":"x","uncertainties":[]}],"uncertainties":[]}' } }],
    })));
    vi.stubGlobal('fetch', fetchMock);

    await zhipuProvider.recognize('data:image/png;base64,AAAA', 'key');

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.response_format).toEqual({ type: 'json_object' });
  });
});
