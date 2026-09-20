/**
 * Zhipu vision proxy. The Worker validates the response shape before charging quota.
 */
const prompt = (context?: RecognitionContext) => `Transcribe only the formulas visible in this image.
Formula hint: ${context?.formulaType || 'auto'}. Mode: ${context?.mode || 'single'}.
Keep every visible symbol, including the left-hand side, scripts, limits, and all formula rows. Omit a parenthesized equation number at the right edge. Do not use $, $$, equation/aligned wrappers, explanations, or surrounding prose in latex.
Return JSON only: {"formulas":[{"latex":"...","uncertainties":[]}],"uncertainties":[]}.
Do not explain, infer, or complete missing content. Use an empty formulas array when no formula is visible.`;

export interface RecognitionFormula { latex: string; uncertainties?: string[] }
export interface RecognitionResult {
  success: boolean;
  latex?: string;
  formulas?: RecognitionFormula[];
  error?: string;
  formulaCount?: number;
  uncertainties?: string[];
  processingTime?: number;
  errorClass?: string;
}
export interface RecognitionContext {
  requestId: string;
  mime: string;
  formulaType: 'auto' | 'math' | 'physics' | 'chemistry';
  mode: 'single' | 'multiple';
}

function parse(content: string): Pick<RecognitionResult, 'success' | 'latex' | 'formulas' | 'formulaCount' | 'uncertainties' | 'error' | 'errorClass'> {
  const fenced = content.trim().match(/^`{3}(?:json)?\s*([\s\S]*?)\s*`{3}$/i);
  let data: unknown;
  try { data = JSON.parse(fenced?.[1] || content); } catch { return { success: false, error: 'Provider returned invalid JSON', errorClass: 'invalid_output' }; }
  if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).formulas)) return { success: false, error: 'Provider response schema is invalid', errorClass: 'invalid_output' };
  const root = data as { formulas: unknown[]; uncertainties?: unknown };
  const formulas: RecognitionFormula[] = [];
  for (const item of root.formulas) {
    if (!item || typeof item !== 'object' || typeof (item as RecognitionFormula).latex !== 'string' || !(item as RecognitionFormula).latex.trim()) return { success: false, error: 'Provider formula is invalid', errorClass: 'invalid_output' };
    const formula = item as RecognitionFormula;
    formulas.push({ latex: formula.latex.trim(), uncertainties: Array.isArray(formula.uncertainties) ? formula.uncertainties.filter((value): value is string => typeof value === 'string') : [] });
  }
  const uncertainties = [...new Set([
    ...(Array.isArray(root.uncertainties) ? root.uncertainties.filter((value): value is string => typeof value === 'string') : []),
    ...formulas.flatMap(formula => formula.uncertainties || []),
  ])];
  return { success: true, latex: formulas.map(formula => formula.latex).join('\n\n'), formulas, formulaCount: formulas.length, uncertainties };
}

export async function proxyZhipuAPI(imageBase64: string, apiKey: string, context?: RecognitionContext): Promise<RecognitionResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'glm-4v-flash',
        max_tokens: 2048,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imageBase64 } },
          { type: 'text', text: prompt(context) },
        ] }],
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      return { success: false, error: errorData.error?.message || `API error: ${response.status}`, errorClass: response.status === 429 ? 'rate_limit' : response.status === 401 || response.status === 403 ? 'auth' : 'provider', processingTime: Date.now() - startedAt };
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { success: false, error: 'Invalid API response', errorClass: 'provider', processingTime: Date.now() - startedAt };
    return { ...parse(content), processingTime: Date.now() - startedAt };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', errorClass: 'network', processingTime: Date.now() - startedAt };
  }
}
