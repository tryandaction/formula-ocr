import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 as encode } from 'fflate';
import { parseMarkdownSource } from '../../utils/documentFormats';
import { readDocx } from '../../utils/documentImport';
// jsdom and Node have distinct typed-array realms; ZIP inputs must use one realm.
const strToU8 = (text: string) => new Uint8Array(encode(text));

describe('source document import', () => {
  it('ignores inline/fenced code and escaped delimiters, tracks real line numbers', () => {
    const result = parseMarkdownSource('`$skip$`\n~~~tex\n$skip$\n~~~\n$$\nx=1\n$$\n$y=2$\nprice \\$5');
    expect(result.formulas.map(f => [f.latex, f.location.line])).toEqual([['x=1', 5], ['y=2', 8]]);
  });
  it('retains valid formulas when a later formula is unclosed', () => {
    const result = parseMarkdownSource('$x=1$\n$broken');
    expect(result.formulas.map(f => f.latex)).toEqual(['x=1']);
    expect(result.status).toBe('parse_error');
  });
  it('extracts OMML fraction and superscript from an actual DOCX archive', async () => {
    const bytes = zipSync({ 'word/document.xml': strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body><w:p><m:oMath><m:f><m:num><m:r><m:t>a</m:t></m:r></m:num><m:den><m:sSup><m:e><m:r><m:t>b</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup></m:den></m:f></m:oMath></w:p></w:body></w:document>') });
    const result = await readDocx(bytes, 'fixture.docx');
    expect(result.formulas[0]).toMatchObject({ latex: '\\frac{a}{b^{2}}', location: { paragraph: 1 } });
  });
  it('reports corrupt documents as file errors', async () => {
    await expect(readDocx(new Uint8Array([1, 2, 3]), 'bad.docx')).rejects.toThrow(/DOCX/);
  });
});
