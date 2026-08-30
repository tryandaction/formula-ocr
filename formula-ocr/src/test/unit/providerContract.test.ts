import { describe, expect, it } from 'vitest';
import { buildFormulaPrompt, getProviderFixture, PROVIDER_FIXTURE_CONTEXT } from '../../utils/providers/contract';

describe('provider contract fixtures', () => {
  it.each(['backend', 'anthropic', 'openai', 'gemini', 'simpletex', 'siliconflow', 'qwen', 'zhipu', 'local'])('has the same request metadata for %s', (provider) => {
    const fixture = getProviderFixture(provider);
    expect(fixture.image.startsWith(`data:${fixture.request.mime};base64,`)).toBe(true);
    expect(fixture.request.requestId).toBe('fixture-request');
    expect(fixture.request.formulaType).toBe('physics');
    expect(fixture.request.mode).toBe('single');
  });

  it('builds a single canonical prompt with type and mode hints', () => {
    const prompt = buildFormulaPrompt(PROVIDER_FIXTURE_CONTEXT);
    expect(prompt).toContain('physics');
    expect(prompt).toContain('单公式');
    expect(prompt).toContain('{"latex"');
  });
});
