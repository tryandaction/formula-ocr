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
    expect(mapProviderError(new Error('model_unavailable'))).toBe('model_unavailable');
    expect(mapProviderError(new Error('model_loading_failed'))).toBe('model_loading_failed');
    expect(mapProviderError(new Error('queue_full'))).toBe('queue_full');
    expect(mapProviderError(new Error('unsupported_format'))).toBe('unsupported_format');
  });

  it('preserves an already structured local response', async () => {
    const provider: ProviderInterface = {
      type: 'local',
      recognize: async () => ({
        requestId: context.requestId,
        success: true,
        status: 'success',
        latex: 'x^2',
        formulas: [{ latex: 'x^2', uncertainties: [] }],
        formulaCount: 1,
        uncertainties: [],
        engine: 'paddle-pp-formulanet-s',
        provider: 'local',
        processingTime: 1100,
      }),
    };

    const result = await createProviderAdapter(provider).recognize({
      requestId: context.requestId,
      image: 'data:image/png;base64,AAAA',
      mime: context.mime,
      formulaType: context.formulaType,
      mode: context.mode,
      source: context.source,
    });

    expect(result).toMatchObject({
      success: true,
      latex: 'x^2',
      engine: 'paddle-pp-formulanet-s',
      processingTime: 1100,
    });
  });

  it('rejects invalid latex even when a structured provider marks it successful', async () => {
    const provider: ProviderInterface = {
      type: 'local',
      recognize: async () => ({
        requestId: context.requestId,
        success: true,
        status: 'success',
        latex: 'I cannot read this formula',
        formulas: [{ latex: 'I cannot read this formula', uncertainties: [] }],
        formulaCount: 1,
        uncertainties: [],
        engine: 'paddle-pp-formulanet-s',
        processingTime: 100,
      }),
    };

    const result = await createProviderAdapter(provider).recognize({
      requestId: context.requestId,
      image: 'data:image/png;base64,AAAA',
      mime: context.mime,
      formulaType: context.formulaType,
      mode: context.mode,
      source: context.source,
    });

    expect(result).toMatchObject({ success: false, status: 'invalid', errorClass: 'invalid_output' });
  });
});
