/**
 * 格式转换工具
 * 支持 LaTeX 转换为 Markdown、MathML、Unicode 等格式
 */

// 输出格式类型
export type OutputFormat = 'latex' | 'markdown' | 'mathml' | 'unicode';

// 格式配置
export const FORMAT_CONFIGS: Record<OutputFormat, { name: string; extension: string; mimeType: string }> = {
  latex: { name: 'LaTeX', extension: 'tex', mimeType: 'text/x-latex' },
  markdown: { name: 'Markdown', extension: 'md', mimeType: 'text/markdown' },
  mathml: { name: 'MathML', extension: 'xml', mimeType: 'application/mathml+xml' },
  unicode: { name: 'Unicode', extension: 'txt', mimeType: 'text/plain' },
};

/**
 * LaTeX 转 Markdown
 * 将 LaTeX 公式包装为 Markdown 数学块
 */
export function latexToMarkdown(latex: string, inline: boolean = false): string {
  const trimmed = latex.trim();
  
  if (inline) {
    return `$${trimmed}$`;
  }
  
  return `$$\n${trimmed}\n$$`;
}

/**
 * LaTeX 转 MathML
 * 使用 KaTeX 进行转换（如果可用），否则返回基础包装
 */
export function latexToMathML(latex: string): string {
  try {
    // 尝试使用 KaTeX（如果已加载）
    if (typeof window !== 'undefined' && (window as any).katex) {
      const katex = (window as any).katex;
      return katex.renderToString(latex, {
        output: 'mathml',
        throwOnError: false,
      });
    }
  } catch (e) {
    console.warn('KaTeX MathML conversion failed:', e);
  }
  
  // 基础 MathML 包装（不进行实际转换）
  return `<math xmlns="http://www.w3.org/1998/Math/MathML">
  <annotation encoding="application/x-tex">${escapeXml(latex)}</annotation>
</math>`;
}

/**
 * LaTeX 转 Unicode（近似表示）
 * 将常见 LaTeX 符号转换为 Unicode 字符
 */
export function latexToUnicode(latex: string): string {
  let result = latex;
  
  // 常见符号映射
  const symbolMap: Record<string, string> = {
    // 希腊字母
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
    '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
    '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Alpha': 'Α', '\\Beta': 'Β', '\\Gamma': 'Γ', '\\Delta': 'Δ',
    '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ', '\\Pi': 'Π',
    '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
    
    // 运算符
    '\\times': '×', '\\div': '÷', '\\pm': '±', '\\mp': '∓',
    '\\cdot': '·', '\\ast': '∗', '\\star': '⋆',
    '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
    '\\equiv': '≡', '\\sim': '∼', '\\simeq': '≃',
    '\\ll': '≪', '\\gg': '≫', '\\subset': '⊂', '\\supset': '⊃',
    '\\subseteq': '⊆', '\\supseteq': '⊇', '\\in': '∈', '\\notin': '∉',
    '\\cup': '∪', '\\cap': '∩', '\\setminus': '∖',
    '\\land': '∧', '\\lor': '∨', '\\neg': '¬', '\\lnot': '¬',
    '\\forall': '∀', '\\exists': '∃', '\\nexists': '∄',
    
    // 箭头
    '\\to': '→', '\\rightarrow': '→', '\\leftarrow': '←',
    '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
    '\\mapsto': '↦', '\\uparrow': '↑', '\\downarrow': '↓',
    
    // 其他符号
    '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',
    '\\sum': '∑', '\\prod': '∏', '\\int': '∫',
    '\\oint': '∮', '\\sqrt': '√', '\\angle': '∠',
    '\\perp': '⊥', '\\parallel': '∥', '\\therefore': '∴',
    '\\because': '∵', '\\emptyset': '∅', '\\varnothing': '∅',
    '\\prime': '′', '\\circ': '∘', '\\bullet': '•',
    '\\ldots': '…', '\\cdots': '⋯', '\\vdots': '⋮', '\\ddots': '⋱',
    
    // 括号
    '\\langle': '⟨', '\\rangle': '⟩',
    '\\lceil': '⌈', '\\rceil': '⌉',
    '\\lfloor': '⌊', '\\rfloor': '⌋',
  };
  
  // 替换符号
  for (const [latex, unicode] of Object.entries(symbolMap)) {
    result = result.replace(new RegExp(escapeRegex(latex), 'g'), unicode);
  }
  
  // 处理上标
  result = result.replace(/\^{([^}]+)}/g, (_, content) => toSuperscript(content));
  result = result.replace(/\^(\d)/g, (_, digit) => toSuperscript(digit));
  
  // 处理下标
  result = result.replace(/_{([^}]+)}/g, (_, content) => toSubscript(content));
  result = result.replace(/_(\d)/g, (_, digit) => toSubscript(digit));
  
  // 处理分数 \frac{a}{b} -> a/b
  result = result.replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1)/($2)');
  
  // 移除剩余的 LaTeX 命令
  result = result.replace(/\\[a-zA-Z]+/g, '');
  
  // 清理多余的空格和括号
  result = result.replace(/[{}]/g, '');
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * 转换为指定格式
 */
export function convertLatex(latex: string, format: OutputFormat): string {
  switch (format) {
    case 'latex':
      return latex;
    case 'markdown':
      return latexToMarkdown(latex);
    case 'mathml':
      return latexToMathML(latex);
    case 'unicode':
      return latexToUnicode(latex);
    default:
      return latex;
  }
}

/**
 * 批量转换
 */
export function batchConvert(
  items: Array<{ id: string; latex: string }>,
  format: OutputFormat
): Array<{ id: string; content: string }> {
  return items.map(item => ({
    id: item.id,
    content: convertLatex(item.latex, format),
  }));
}

/**
 * 生成导出文件内容
 */
export function generateExportContent(
  items: Array<{ latex: string; index?: number }>,
  format: OutputFormat,
  includeNumbers: boolean = true
): string {
  const lines: string[] = [];
  
  items.forEach((item, i) => {
    const num = item.index ?? i + 1;
    const converted = convertLatex(item.latex, format);
    
    if (includeNumbers) {
      if (format === 'markdown') {
        lines.push(`### 公式 ${num}\n\n${converted}\n`);
      } else if (format === 'mathml') {
        lines.push(`<!-- 公式 ${num} -->\n${converted}\n`);
      } else {
        lines.push(`% 公式 ${num}\n${converted}\n`);
      }
    } else {
      lines.push(converted);
    }
  });
  
  return lines.join('\n');
}

/**
 * 下载导出文件
 */
export function downloadExport(
  content: string,
  filename: string,
  format: OutputFormat
): void {
  const config = FORMAT_CONFIGS[format];
  const blob = new Blob([content], { type: config.mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${config.extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 辅助函数

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Unicode 上标映射
const superscriptMap: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ',
};

// Unicode 下标映射
const subscriptMap: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
  'i': 'ᵢ', 'j': 'ⱼ', 'n': 'ₙ', 'm': 'ₘ',
};

function toSuperscript(str: string): string {
  return str.split('').map(c => superscriptMap[c] || c).join('');
}

function toSubscript(str: string): string {
  return str.split('').map(c => subscriptMap[c] || c).join('');
}
