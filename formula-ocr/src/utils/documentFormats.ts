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
  let index = 0;
  let line = 1;
  let inFence = false;
  while (index < source.length) {
    if (source.startsWith('```', index)) {
      inFence = !inFence;
      index += 3;
      continue;
    }
    if (source[index] === '\n') line++;
    if (!inFence && source[index] === '$' && !isEscaped(source, index)) {
      const display = source.startsWith('$$', index);
      const delimiter = display ? '$$' : '$';
      const end = source.indexOf(delimiter, index + delimiter.length);
      if (end < 0) {
        return { status: 'parse_error', formulas: [], errorClass: 'invalid_syntax', error: `未闭合公式分隔符 (line ${line})` };
      }
      const latex = source.slice(index + delimiter.length, end).trim();
      if (latex) {
        formulas.push({
          id: `md_${formulas.length + 1}`,
          fileName,
          format: 'markdown',
          sourceType: 'markdown-source',
          location: { line },
          raw: source.slice(index, end + delimiter.length),
          latex,
          editable: true,
          status: 'success',
        });
      }
      index = end + delimiter.length;
      continue;
    }
    index++;
  }
  return formulas.length > 0 ? { status: 'success', formulas } : { status: 'no_formulas', formulas };
}

export function parseDocxSource(fileName: string): DocumentParseResult {
  return {
    status: 'unsupported',
    formulas: [],
    errorClass: 'parser_unsupported',
    error: `DOCX 暂不支持解析: ${fileName}`,
  };
}
