import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';

export function FormulaPreview({ latex, compact = false }: { latex: string; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.replaceChildren();
    if (!latex.trim()) return;
    try {
      katex.render(latex.replaceAll('[unclear]', '\\square'), ref.current, { displayMode: !compact, throwOnError: true, trust: false, strict: 'ignore' });
    } catch {
      ref.current.textContent = latex;
      ref.current.dataset.renderError = 'true';
    }
  }, [compact, latex]);
  return <div ref={ref} className="formula-preview" aria-label="公式预览" />;
}
