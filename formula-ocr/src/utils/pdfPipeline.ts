export type PdfPageKind = 'text-layer' | 'vector-or-text' | 'scan';

export function classifyPdfPage(input: { text: string; hasTextLayer: boolean }): PdfPageKind {
  if (!input.hasTextLayer || !input.text.trim()) return 'scan';
  if (/\\(?:frac|sqrt|sum|int|lim|alpha|beta|gamma|theta|pi)|[=∑∫√^_{}]/.test(input.text)) {
    return 'text-layer';
  }
  return 'vector-or-text';
}

export function formulaRegionKey(input: {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}): string {
  const round = (value: number) => Math.round(value * 10) / 10;
  return [input.pageNumber, round(input.x), round(input.y), round(input.width), round(input.height)].join('|');
}

export interface TextFormulaCandidate {
  latex: string;
  source: 'text-layer';
  confidence: 'exact-delimiter' | 'heuristic';
  requiresVisualReview: boolean;
}

export function extractTextLayerFormulaCandidates(text: string): TextFormulaCandidate[] {
  const candidates: TextFormulaCandidate[] = [];
  const delimited = [...text.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$([^$\n]+)\$(?!\$)/g)];
  for (const match of delimited) {
    const latex = (match[1] ?? match[2]).trim();
    if (latex) candidates.push({ latex, source: 'text-layer', confidence: 'exact-delimiter', requiresVisualReview: false });
  }
  if (candidates.length === 0) {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && /(?:\\(?:frac|sqrt|sum|int)|[A-Za-z0-9]\s*=\s*[A-Za-z0-9]|[∑∫√])/.test(trimmed)) {
        candidates.push({ latex: trimmed, source: 'text-layer', confidence: 'heuristic', requiresVisualReview: true });
      }
    }
  }
  return candidates;
}
