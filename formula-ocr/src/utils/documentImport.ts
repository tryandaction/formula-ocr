import { unzipSync, strFromU8 } from 'fflate';
import type { DocumentFormulaSource } from './documentFormats';

const MATH = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const descendants = (node: Element, ns: string, name: string) => Array.from(node.getElementsByTagNameNS(ns, name));

/** Conservative OMML conversion: unknown structures become explicit review items. */
function omml(node: Element): string {
  const child = (name: string) => Array.from(node.children).find(e => e.localName === name);
  const value = (name: string) => { const e = child(name); return e ? omml(e) : ''; };
  const all = () => Array.from(node.children).filter(e => !e.localName.endsWith('Pr')).map(omml).join('');
  switch (node.localName) {
    case 't': return (node.textContent || '').replace(/([#$%&_{}])/g, '\\$1');
    case 'r': case 'oMath': case 'e': case 'num': case 'den': case 'sup': case 'sub': case 'deg': case 'lim': case 'mr': return all();
    case 'f': return `\\frac{${value('num')}}{${value('den')}}`;
    case 'sSup': return `${value('e')}^{${value('sup')}}`;
    case 'sSub': return `${value('e')}_{${value('sub')}}`;
    case 'sSubSup': return `${value('e')}_{${value('sub')}}^{${value('sup')}}`;
    case 'rad': return `\\sqrt${value('deg') ? `[${value('deg')}]` : ''}{${value('e')}}`;
    case 'm': return `\\begin{matrix}${Array.from(node.children).filter(e => e.localName === 'mr').map(row => Array.from(row.children).filter(e => e.localName === 'e').map(omml).join(' & ')).join(' \\\\ ')}\\end{matrix}`;
    default: throw new Error(`尚不支持 OMML 结构 ${node.localName}`);
  }
}

export async function readDocx(bytes: Uint8Array, fileName: string) {
  let total = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: entry => {
      total += entry.originalSize;
      if (total > 64 * 1024 * 1024 || entry.originalSize > 20 * 1024 * 1024) throw new Error('DOCX 解压大小超过限制');
      return entry.name === 'word/document.xml' || entry.name === 'word/_rels/document.xml.rels' || /^word\/media\//.test(entry.name);
    } });
  } catch { throw new Error('DOCX 已损坏或解压大小超过限制'); }
  if (!entries['word/document.xml']) throw new Error('DOCX 缺少 document.xml');
  const xml = new DOMParser().parseFromString(strFromU8(entries['word/document.xml']), 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('DOCX XML 损坏');
  const formulas: DocumentFormulaSource[] = [];
  const warnings: string[] = [];
  const paragraphs = Array.from(xml.getElementsByTagNameNS(WORD, 'p'));
  paragraphs.forEach((p, i) => {
    descendants(p, MATH, 'oMath').forEach((equation, j) => {
      try {
        const latex = omml(equation);
        formulas.push({ id: `docx-${i}-${j}`, fileName, format: 'docx', sourceType: 'omml', location: { paragraph: i + 1 }, raw: equation.outerHTML, latex, editable: true, status: 'needs_review' });
      } catch (error) { warnings.push(`第 ${i + 1} 段：${error instanceof Error ? error.message : '公式解析失败'}`); }
    });
    if (descendants(p, WORD, 'object').length) warnings.push(`第 ${i + 1} 段包含旧式 OLE 公式，请转换为 PDF 或截图识别`);
  });
  const images: Array<{ image: string; name: string; paragraph: number }> = [];
  const rels = entries['word/_rels/document.xml.rels'];
  if (rels) {
    const doc = new DOMParser().parseFromString(strFromU8(rels), 'application/xml');
    for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
      if (rel.getAttribute('TargetMode') === 'External') continue;
      const target = rel.getAttribute('Target') || '';
      const path = target.startsWith('/word/') ? target.slice(1) : `word/${target}`;
      if (!/^word\/media\/[^/]+$/.test(path) || !entries[path]) continue;
      const blips = Array.from(xml.getElementsByTagNameNS('*', 'blip')).filter(b => b.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') === rel.getAttribute('Id'));
      if (!blips.length) continue;
      const ext = path.split('.').pop()?.toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : undefined;
      if (!mime) { warnings.push(`内嵌图片 ${ext} 暂不支持，请转换为 PNG`); continue; }
      let binary = '';
      for (const byte of entries[path]) binary += String.fromCharCode(byte);
      for (const blip of blips) {
        const paragraph = paragraphs.findIndex(p => p.contains(blip)) + 1;
        images.push({ image: `data:${mime};base64,${btoa(binary)}`, name: target, paragraph });
      }
    }
  }
  return { formulas, images, warnings };
}
