import { describe, expect, it } from 'vitest';
import { classifyPdfPage, extractTextLayerFormulaCandidates, formulaRegionKey, normalizePdfFormulaText, reconstructPdfTextLines, shouldUseVisualDetection, type PdfPageKind } from '../../utils/pdfPipeline';

describe('PDF page pipeline', () => {
  it('routes only scan pages through automatic visual detection', () => {
    expect(shouldUseVisualDetection('scan')).toBe(true);
    expect(shouldUseVisualDetection('text-layer')).toBe(false);
    expect(shouldUseVisualDetection('vector-or-text')).toBe(false);
  });

  it.each([
    ['E = mc^2 and \\frac{a}{b}', true, 'text-layer'],
    ['ordinary paragraph only', true, 'vector-or-text'],
    ['', false, 'scan'],
  ] as [string, boolean, PdfPageKind][])('classifies %s as %s', (text, hasText, expected) => {
    expect(classifyPdfPage({ text, hasTextLayer: hasText })).toBe(expected);
  });

  it('uses stable page/coordinate identity for deduplication', () => {
    const first = formulaRegionKey({ pageNumber: 2, x: 10.04, y: 20.06, width: 30.02, height: 40.01 });
    const second = formulaRegionKey({ pageNumber: 2, x: 10.03, y: 20.07, width: 30.01, height: 40.02 });
    expect(first).toBe(second);
  });

  it('keeps exact text-layer formulas separate from heuristic candidates', () => {
    expect(extractTextLayerFormulaCandidates('text $$E=mc^2$$ end')).toEqual([{
      latex: 'E=mc^2', source: 'text-layer', confidence: 'exact-delimiter', requiresVisualReview: false,
    }]);
    expect(extractTextLayerFormulaCandidates('E = mc^2')).toEqual([{
      latex: 'E = mc^2', source: 'text-layer', confidence: 'heuristic', requiresVisualReview: true,
    }]);
  });

  it('reconstructs split formula glyphs without merging a second column', () => {
    expect(reconstructPdfTextLines([
      { str: 'A', x: 20, y: 100, width: 8 },
      { str: '=', x: 32, y: 100.4, width: 7 },
      { str: 'B+C', x: 43, y: 99.7, width: 22 },
      { str: 'ordinary prose', x: 310, y: 100.2, width: 80 },
      { str: 'E=mc^2', x: 20, y: 80, width: 42 },
    ])).toEqual(['A = B+C', 'ordinary prose', 'E=mc^2']);
  });

  it('rejects prose lines that merely contain an inline equality', () => {
    expect(extractTextLayerFormulaCandidates('physical qubits in total achieve the net encoding rate r = k / 2 n')).toEqual([]);
    expect(extractTextLayerFormulaCandidates('A = A_1 + A_2')).toEqual([{
      latex: 'A = A_1 + A_2', source: 'text-layer', confidence: 'heuristic', requiresVisualReview: true,
    }]);
  });

  it('rejects numeric table rows while retaining symbolic inequalities', () => {
    expect(extractTextLayerFormulaCandidates('[[72, 12, 6]] 1/12 ≤6 0.0048 7 × 10')).toEqual([]);
    expect(extractTextLayerFormulaCandidates('d ≤ 2t + 1')).toEqual([{
      latex: 'd \\le 2t + 1', source: 'text-layer', confidence: 'heuristic', requiresVisualReview: true,
    }]);
  });

  it('normalizes unambiguous PDF math glyphs to LaTeX and rejects an isolated operator', () => {
    expect(normalizePdfFormulaText('∆ E ≤ 2 × μ, ⟨ Φ | Φ ′ ⟩')).toBe("\\Delta E \\le 2 \\times \\mu, \\langle \\Phi | \\Phi ' \\rangle");
    expect(extractTextLayerFormulaCandidates('√')).toEqual([]);
  });

  it('rejects prose suffixes while allowing mathematical connectors', () => {
    expect(extractTextLayerFormulaCandidates('A. L = 0 states')).toEqual([]);
    expect(extractTextLayerFormulaCandidates('H = H_0 and V = V_0')).toEqual([{
      latex: 'H = H_0 \\quad\\text{and}\\quad V = V_0', source: 'text-layer', confidence: 'heuristic', requiresVisualReview: true,
    }]);
  });
});
