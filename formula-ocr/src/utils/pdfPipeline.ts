export type PdfPageKind = 'text-layer' | 'vector-or-text' | 'scan';

export function shouldUseVisualDetection(pageKind: PdfPageKind): boolean {
  return pageKind === 'scan';
}

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

export interface PdfTextFragment {
  str: string;
  x: number;
  y: number;
  width: number;
}

export function reconstructPdfTextLines(fragments: PdfTextFragment[]): string[] {
  const rows: Array<{ y: number; fragments: PdfTextFragment[] }> = [];
  for (const fragment of [...fragments].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let row = rows.find(candidate => Math.abs(candidate.y - fragment.y) <= 1.5);
    if (!row) {
      row = { y: fragment.y, fragments: [] };
      rows.push(row);
    }
    row.fragments.push(fragment);
  }

  const lines: string[] = [];
  for (const row of rows) {
    const ordered = row.fragments.sort((a, b) => a.x - b.x);
    let segment: PdfTextFragment[] = [];
    for (const fragment of ordered) {
      const previous = segment.at(-1);
      if (previous && fragment.x - (previous.x + previous.width) > 36) {
        lines.push(segment.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim());
        segment = [];
      }
      segment.push(fragment);
    }
    if (segment.length) lines.push(segment.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim());
  }
  return lines.filter(Boolean);
}

function looksLikeFormulaLine(value: string): boolean {
  const proseWords = value.match(/[A-Za-z]{3,}/g) ?? [];
  const mathWords = new Set(['and', 'for', 'min', 'max', 'sin', 'cos', 'tan', 'log', 'exp', 'lim', 'mod', 'det']);
  if (proseWords.some(word => !mathWords.has(word.toLowerCase())) || value.length > 500) return false;
  if (/^\s*[∑∫√∏]\s*$/.test(value)) return false;
  const hasStructuredMath = /(?:\\(?:frac|sqrt|sum|int)|[A-Za-z0-9]\s*=\s*[A-Za-z0-9]|[∑∫√∏])/.test(value);
  const hasSymbolicRelation = /[≤≥≈≠×±∈]/.test(value) && /[A-Za-zΑ-Ωα-ω]/.test(value);
  return hasStructuredMath || hasSymbolicRelation;
}

export function normalizePdfFormulaText(value: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/[∆Δ]/g, '\\Delta '], [/[ϵε]/g, '\\epsilon '], [/μ/g, '\\mu '], [/ν/g, '\\nu '],
    [/π/g, '\\pi '], [/Φ/g, '\\Phi '], [/φ/g, '\\phi '], [/θ/g, '\\theta '],
    [/λ/g, '\\lambda '], [/σ/g, '\\sigma '], [/ρ/g, '\\rho '], [/γ/g, '\\gamma '],
    [/≤/g, '\\le '], [/≥/g, '\\ge '], [/≈/g, '\\approx '], [/≠/g, '\\neq '],
    [/×/g, '\\times '], [/⊗/g, '\\otimes '], [/±/g, '\\pm '], [/∈/g, '\\in '],
    [/∑/g, '\\sum '], [/∫/g, '\\int '], [/∏/g, '\\prod '], [/⟨/g, '\\langle '],
    [/⟩/g, '\\rangle '], [/′/g, "'"], [/−/g, '-'],
  ];
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\band\b/gi, ' \\quad\\text{and}\\quad ')
    .replace(/\bfor\b/gi, ' \\quad\\text{for}\\quad ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

export function extractTextLayerFormulaCandidates(text: string): TextFormulaCandidate[] {
  const candidates: TextFormulaCandidate[] = [];
  const delimited = [...text.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$([^$\n]+)\$(?!\$)/g)];
  for (const match of delimited) {
    const latex = (match[1] ?? match[2]).trim();
    if (latex) candidates.push({ latex: normalizePdfFormulaText(latex), source: 'text-layer', confidence: 'exact-delimiter', requiresVisualReview: false });
  }
  if (candidates.length === 0) {
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && looksLikeFormulaLine(trimmed)) {
        candidates.push({ latex: normalizePdfFormulaText(trimmed), source: 'text-layer', confidence: 'heuristic', requiresVisualReview: true });
      }
    }
  }
  return candidates;
}
