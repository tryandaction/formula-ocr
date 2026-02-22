import { writeFile } from 'node:fs/promises';

const outputPath = new URL('./dense-formulas.pdf', import.meta.url);
const pageWidth = 595;
const pageHeight = 842;
const margin = 40;
const gapX = 180;
const gapY = 110;
const lineWidth = 70;

const formulas = [
  { top: 'a+b', bottom: 'c+d', inline: 'x^2 + y^2 = z^2' },
  { top: 'sin(x)', bottom: 'cos(x)', inline: 'E = mc^2' },
  { top: 'f(x)', bottom: 'g(x)', inline: 'x^3 + 2x + 1' },
  { top: 'm+n', bottom: 'p+q', inline: 'F = ma' },
  { top: 'u+v', bottom: 'w+t', inline: 'PV = nRT' },
  { top: 'p^2', bottom: 'q^2', inline: 'a^2 + b^2 = c^2' }
];

function escapeText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function pdfText(x, y, size, text) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${escapeText(text)}) Tj ET`;
}

function pdfLine(x1, y1, x2, y2, width = 1) {
  return `${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function buildPageContent(pageIndex) {
  const lines = [];
  lines.push('0 0 0 RG');
  lines.push('0 0 0 rg');
  lines.push(pdfText(margin, pageHeight - margin, 14, `Dense Formula Page ${pageIndex + 1}`));

  let idx = 0;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const x = margin + col * gapX;
      const baseY = pageHeight - margin - 80 - row * gapY;
      const formula = formulas[idx % formulas.length];

      lines.push(pdfText(x, baseY + 18, 10, formula.top));
      lines.push(pdfLine(x, baseY + 10, x + lineWidth, baseY + 10, 1));
      lines.push(pdfText(x, baseY - 2, 10, formula.bottom));
      lines.push(pdfText(x, baseY - 24, 12, formula.inline));
      lines.push(pdfText(x + 90, baseY + 24, 8, 'x2'));
      idx++;
    }
  }

  const blockBase = margin + 80;
  lines.push(pdfText(margin, blockBase + 50, 12, 'Display Block'));
  lines.push(pdfLine(margin, blockBase + 40, margin + 140, blockBase + 40, 1.5));
  lines.push(pdfText(margin, blockBase + 55, 10, 'n+1'));
  lines.push(pdfText(margin, blockBase + 20, 10, 'n-1'));
  lines.push(pdfText(margin + 10, blockBase - 5, 12, 'x^2 + y^2 = z^2'));

  return lines.join('\n');
}

function buildObject(id, body) {
  return `${id} 0 obj\n${body}\nendobj\n`;
}

const page1Content = buildPageContent(0);
const page2Content = buildPageContent(1);

const objects = [];
objects[1] = buildObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
objects[2] = buildObject(2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>');
objects[3] = buildObject(
  3,
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>`
);
objects[4] = buildObject(
  4,
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 7 0 R /Resources << /Font << /F1 6 0 R >> >> >>`
);
objects[5] = buildObject(5, `<< /Length ${page1Content.length} >>\nstream\n${page1Content}\nendstream`);
objects[6] = buildObject(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
objects[7] = buildObject(7, `<< /Length ${page2Content.length} >>\nstream\n${page2Content}\nendstream`);

const parts = [];
parts.push('%PDF-1.4\n');
const offsets = [0];
let offset = parts[0].length;

for (let i = 1; i < objects.length; i++) {
  offsets[i] = offset;
  parts.push(objects[i]);
  offset += objects[i].length;
}

const xrefStart = offset;
let xref = `xref\n0 ${objects.length}\n`;
xref += '0000000000 65535 f \n';
for (let i = 1; i < objects.length; i++) {
  const off = String(offsets[i]).padStart(10, '0');
  xref += `${off} 00000 n \n`;
}

const trailer = `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
parts.push(xref);
parts.push(trailer);

const pdfContent = parts.join('');
await writeFile(outputPath, pdfContent, 'utf8');

console.log(`Generated: ${outputPath.pathname}`);
