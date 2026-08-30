import { describe, expect, it } from 'vitest';
import { createProviderAdapter, mapProviderError } from '../../utils/providers/contract';
import type { ProviderInterface } from '../../utils/providers/types';

const context = {
  requestId: 'adapter-fixture',
  mime: 'image/png',
  formulaType: 'math' as const,
  mode: 'single' as const,
  source: { kind: 'image' as const },
};

describe('structured provider adapter', () => {
  it('returns a structured success result from a legacy provider', async () => {
    const provider: ProviderInterface = {
      type: 'local',
      recognize: async (_image, _key, received) => {
        expect(received).toMatchObject(context);
        return '{"latex":"x^2","uncertainties":[]}';
      },
    };
    const result = await createProviderAdapter(provider).recognize({
      requestId: context.requestId,
      image: 'data:image/png;base64,AAAA',
      mime: context.mime,
      formulaType: context.formulaType,
      mode: context.mode,
      source: context.source,
    });
    expect(result).toMatchObject({ success: true, status: 'success', latex: 'x^2', formulaCount: 1, provider: 'local' });
  });

  it('maps provider failures and cancellation to stable error classes', async () => {
    const provider: ProviderInterface = { type: 'local', recognize: async () => { throw new Error('429 quota exceeded'); } };
    await expect(createProviderAdapter(provider).recognize({
      requestId: context.requestId,
      image: 'data:image/png;base64,AAAA',
      mime: context.mime,
      formulaType: context.formulaType,
      mode: context.mode,
      source: context.source,
    })).resolves.toMatchObject({ success: false, status: 'error', errorClass: 'rate_limit' });
    expect(mapProviderError(new DOMException('aborted', 'AbortError'))).toBe('cancelled');
  });
});
