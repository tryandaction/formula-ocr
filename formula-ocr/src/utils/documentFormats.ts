export interface DocumentFormulaSource {
  id: string;
  fileName: string;
  format: 'markdown' | 'docx';
  sourceType: 'markdown-source' | 'omml' | 'embedded-image';
  location: { line?: number; paragraph?: number; node?: string };
  raw: string;
  latex: string;
  editable: boolean;
  status: 'success' | 'needs_review';
}

export interface DocumentParseResult {
  status: 'success' | 'no_formulas' | 'parse_error' | 'unsupported';
  formulas: DocumentFormulaSource[];
  errorClass?: 'invalid_syntax' | 'parser_unsupported' | 'corrupt_file';
  error?: string;
}

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor--) backslashes++;
  return backslashes % 2 === 1;
}

export function parseMarkdownSource(source: string, fileName = 'document.md'): DocumentParseResult {
  const formulas: DocumentFormulaSource[] = [];
  // Mask code while preserving offsets and line numbers.
  const mask = (s: string) => s.replace(/[^\n]/g, ' ');
  let text = source.replace(/^[ \t]*(```+|~~~+)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, mask);
  text = text.replace(/(`+)[^\n]*?\1/g, mask);
  let index = 0;
  let error: string | undefined;
  while (index < text.length) {
    const delimiters: Array<[string, string]> = [['$$', '$$'], ['\\[', '\\]'], ['\\(', '\\)'], ['$', '$']];
    const pair = delimiters.find(([open]) => text.startsWith(open, index) && !isEscaped(text, index));
    if (!pair) { index++; continue; }
    const [open, close] = pair;
    let end = index + open.length;
    while (end < text.length && !(text.startsWith(close, end) && !isEscaped(text, end))) end++;
    const line = source.slice(0, index).split('\n').length;
    if (end >= text.length || (open === '$' && text.slice(index, end).includes('\n'))) {
      error = '未闭合公式分隔符（第 ' + line + ' 行）';
      index += open.length;
      continue;
    }
    const latex = source.slice(index + open.length, end).trim();
    if (latex) formulas.push({
      id: 'md_' + (formulas.length + 1), fileName, format: 'markdown',
      sourceType: 'markdown-source', location: { line },
      raw: source.slice(index, end + close.length), latex, editable: true, status: 'success',
    });
    index = end + close.length;
  }
  return { status: error ? 'parse_error' : formulas.length ? 'success' : 'no_formulas', formulas, ...(error ? { error, errorClass: 'invalid_syntax' as const } : {}) };
}

export function parseDocxSource(fileName: string): DocumentParseResult {
  return {
    status: 'unsupported',
    formulas: [],
    errorClass: 'parser_unsupported',
    error: `DOCX 暂不支持解析: ${fileName}`,
  };
}
