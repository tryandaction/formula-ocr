import { describe, expect, it } from 'vitest';
import { classifyPdfPage, extractTextLayerFormulaCandidates, formulaRegionKey, type PdfPageKind } from '../../utils/pdfPipeline';

describe('PDF page pipeline', () => {
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
});
