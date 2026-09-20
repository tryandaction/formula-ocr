import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLocalServer, localProvider } from '../../utils/providers/local';

const context = {
  requestId: 'local-request-1',
  mime: 'image/png',
  formulaType: 'physics' as const,
  mode: 'single' as const,
  source: { kind: 'pdf' as const, fileName: 'paper.pdf', pageNumber: 3, regionId: 'r-1' },
};

afterEach(() => vi.unstubAllGlobals());

describe('local OCR provider', () => {
  it('reports service reachability separately from formula capability', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        engines: [{ id: 'paddle-pp-formulanet-s', kind: 'formula', available: false, state: 'not_loaded', license: 'verified' }],
        supportedMimeTypes: ['image/png'],
        limits: {},
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkLocalServer()).resolves.toMatchObject({
      reachable: true,
      available: false,
      errorClass: 'model_unavailable',
    });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://127.0.0.1:8502/health',
      'http://127.0.0.1:8502/v1/capabilities',
    ]);
  });

  it('sends the full recognition contract and preserves structured response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        engines: [{ id: 'paddle-pp-formulanet-s', kind: 'formula', available: true, state: 'not_loaded', license: 'verified' }],
        supportedMimeTypes: ['image/png'],
        limits: {},
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        requestId: 'local-request-1', success: true, status: 'success', latex: 'E=mc^2',
        formulas: [{ latex: 'E=mc^2', uncertainties: [] }], formulaCount: 1,
        uncertainties: [], confidence: null, engine: 'paddle-pp-formulanet-s',
        provider: 'local', processingTime: 1170, errorClass: null, error: null,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await localProvider.recognize('data:image/png;base64,AAAA', undefined, context);

    const [, requestOptions] = fetchMock.mock.calls.at(-1)!;
    expect(fetchMock.mock.calls.at(-1)![0]).toBe('http://127.0.0.1:8502/v1/recognize');
    expect(requestOptions).toMatchObject({ method: 'POST' });
    expect(JSON.parse(requestOptions.body)).toEqual({ image: 'data:image/png;base64,AAAA', ...context });
    expect(result).toMatchObject({ latex: 'E=mc^2', engine: 'paddle-pp-formulanet-s', processingTime: 1170 });
  });
});
