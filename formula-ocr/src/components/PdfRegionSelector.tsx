import { useRef, useState } from 'react';
import { extractRegionAsFormula } from '../utils/documentParser';

interface Point { x: number; y: number }

export function PdfRegionSelector({ image, pageNumber, onExtract }: {
  image: string;
  pageNumber: number;
  onExtract: (formula: Awaited<ReturnType<typeof extractRegionAsFormula>>) => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const point = (event: React.PointerEvent): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) };
  };
  const finish = async (event: React.PointerEvent) => {
    if (!start || !ref.current) return;
    const last = point(event);
    setEnd(last);
    const width = Math.abs(last.x - start.x);
    const height = Math.abs(last.y - start.y);
    if (width < 8 || height < 8) { setStart(null); setEnd(null); return; }
    const scaleX = ref.current.naturalWidth / ref.current.clientWidth;
    const scaleY = ref.current.naturalHeight / ref.current.clientHeight;
    const formula = await extractRegionAsFormula(image, pageNumber, {
      x: Math.min(start.x, last.x) * scaleX,
      y: Math.min(start.y, last.y) * scaleY,
      width: width * scaleX,
      height: height * scaleY,
    });
    formula.detectionStatus = 'manual';
    formula.sourceMethod = 'manual';
    onExtract(formula);
    setStart(null); setEnd(null);
  };
  const selection = start && end ? {
    left: Math.min(start.x, end.x), top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y),
  } : null;
  return <div className="pdf-region" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); setStart(p); setEnd(p); }} onPointerMove={e => start && setEnd(point(e))} onPointerUp={finish}>
    <img ref={ref} src={image} alt={`PDF 第 ${pageNumber} 页`} draggable={false} loading="lazy" decoding="async" />
    {selection && <span className="pdf-selection" style={selection} />}
  </div>;
}
