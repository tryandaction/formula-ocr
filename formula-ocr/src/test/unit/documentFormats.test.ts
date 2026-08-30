import { describe, expect, it } from 'vitest';
import { parseMarkdownSource, parseDocxSource } from '../../utils/documentFormats';

describe('document formula sources', () => {
  it('extracts Markdown inline and display formulas but skips fenced code', () => {
    const result = parseMarkdownSource('text $x^2$\n\n$$\nE = mc^2\n$$\n```latex\n$ignored$\n```\n\\$literal');
    expect(result.status).toBe('success');
    expect(result.formulas.map(formula => formula.latex)).toEqual(['x^2', 'E = mc^2']);
    expect(result.formulas.every(formula => formula.sourceType === 'markdown-source')).toBe(true);
  });

  it('reports unclosed delimiters as parse errors without inventing LaTeX', () => {
    const result = parseMarkdownSource('before $x + 1');
    expect(result.status).toBe('parse_error');
    expect(result.formulas).toHaveLength(0);
    expect(result.errorClass).toBe('invalid_syntax');
  });

  it('marks DOCX as explicitly unsupported rather than successful', () => {
    const result = parseDocxSource('lesson.docx');
    expect(result).toMatchObject({ status: 'unsupported', errorClass: 'parser_unsupported' });
    expect(result.formulas).toHaveLength(0);
  });
});
