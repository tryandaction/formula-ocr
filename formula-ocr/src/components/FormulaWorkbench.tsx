import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { FormulaType } from './FormulaTypeSelector';
import { FormulaPreview } from './FormulaPreview';
import { PdfRegionSelector } from './PdfRegionSelector';
import { queueFailureMessage, TaskQueue } from '../utils/taskQueue';
import { convertToBase64 } from '../utils/fileHandler';
import { parseMarkdownSource } from '../utils/documentFormats';
import { readDocx } from '../utils/documentImport';
import { parsePdfDocument, type FormulaRegion } from '../utils/documentParser';
import { buildRecognitionRequest } from '../utils/ocrContract';
import { recognizeStructured, type ProviderType, PROVIDER_CONFIGS } from '../utils/providers';
import { sourceBadge, type FormulaItem, type SourceKind, type SourceTask } from '../types/workspace';

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const RESULT_PAGE_SIZE = 20;
const kindOf = (file: File): SourceKind | null => {
  const ext = file.name.toLowerCase().split('.').pop();
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) return 'image';
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (file.type.includes('wordprocessingml') || ext === 'docx') return 'docx';
  if (['text/markdown', 'text/x-markdown'].includes(file.type) || ['md', 'markdown'].includes(ext || '')) return 'markdown';
  return null;
};
const statusText: Record<FormulaItem['status'], string> = {
  queued: '待识别', recognizing: '识别中', success: '识别成功', needs_review: '需要复核',
  no_formula: '未检测到公式', failed: '识别失败', cancelled: '已取消',
};
const readText = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('文件读取失败'));
  reader.readAsText(file);
});

export function FormulaWorkbench({ provider, formulaType, onFormulaTypeChange, onOpenProvider }: {
  provider: ProviderType;
  formulaType: FormulaType;
  onFormulaTypeChange: (type: FormulaType) => void;
  onOpenProvider: () => void;
}) {
  const [sources, setSources] = useState<SourceTask[]>([]);
  const [items, setItems] = useState<FormulaItem[]>([]);
  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<'all' | 'review' | 'failed'>('all');
  const [visibleLimit, setVisibleLimit] = useState(RESULT_PAGE_SIZE);
  const [isPending, startTransition] = useTransition();
  const [sourceQueue] = useState(() => new TaskQueue(2));
  const [ocrQueue] = useState(() => new TaskQueue(3));
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sourceQueue.cancelAll();
      ocrQueue.cancelAll();
    };
  }, [ocrQueue, sourceQueue]);
  const updateSource = useCallback((sourceId: string, patch: Partial<SourceTask>) => {
    if (mountedRef.current) setSources(current => current.map(source => source.id === sourceId ? { ...source, ...patch } : source));
  }, []);
  const addFormulas = useCallback((incoming: FormulaItem[]) => {
    if (mountedRef.current) setItems(current => {
      const existingIds = new Set(current.map(item => item.id));
      return [...current, ...incoming.filter(item => !existingIds.has(item.id))];
    });
  }, []);
  const addFormula = useCallback((item: FormulaItem) => addFormulas([item]), [addFormulas]);
  const fromRegion = useCallback((source: SourceTask, formula: FormulaRegion): FormulaItem => ({
    id: formula.id || id('formula'), sourceId: source.id, sourceName: source.name, sourceKind: source.kind,
    image: formula.imageData, mime: 'image/png', pageNumber: formula.pageNumber, position: formula.originalPosition,
    latex: '', status: 'queued', confidence: formula.confidence, uncertainties: [], selected: true,
  }), []);

  const processSource = useCallback(async (file: File, source: SourceTask, signal: AbortSignal) => {
    updateSource(source.id, { status: 'parsing', progress: 4, message: '正在读取文件' });
    if (source.kind === 'image') {
      const image = await convertToBase64(file, false);
      signal.throwIfAborted();
      addFormula({ id: id('image'), sourceId: source.id, sourceName: file.name, sourceKind: 'image', image, mime: file.type || 'image/png', latex: '', status: 'queued', uncertainties: [], selected: true });
      updateSource(source.id, { status: 'ready', progress: 100, message: '图片已就绪', formulaCount: 1 });
      return;
    }
    if (source.kind === 'markdown') {
      const parsed = parseMarkdownSource(await readText(file), file.name);
      signal.throwIfAborted();
      addFormulas(parsed.formulas.map(formula => ({ id: id('source'), sourceId: source.id, sourceName: file.name, sourceKind: 'markdown', latex: formula.latex, originalLatex: formula.latex, status: formula.status === 'needs_review' ? 'needs_review' : 'success', uncertainties: [], selected: true })));
      updateSource(source.id, { status: parsed.status === 'parse_error' ? 'failed' : 'ready', progress: 100, message: parsed.error || (parsed.formulas.length ? '已保留源码公式' : '文件中没有公式'), formulaCount: parsed.formulas.length });
      return;
    }
    if (source.kind === 'docx') {
      const parsed = await readDocx(new Uint8Array(await file.arrayBuffer()), file.name);
      signal.throwIfAborted();
      addFormulas([
        ...parsed.formulas.map((formula): FormulaItem => ({ id: id('omml'), sourceId: source.id, sourceName: file.name, sourceKind: 'docx', latex: formula.latex, originalLatex: formula.latex, status: 'needs_review', pageNumber: formula.location.paragraph, uncertainties: ['OMML 转换结果需要核对'], selected: true })),
        ...parsed.images.map((image): FormulaItem => ({ id: id('docx-image'), sourceId: source.id, sourceName: file.name, sourceKind: 'docx', image: image.image, mime: image.image.slice(5, image.image.indexOf(';')), pageNumber: image.paragraph, latex: '', status: 'queued', uncertainties: [], selected: true })),
      ]);
      updateSource(source.id, { status: 'ready', progress: 100, message: parsed.formulas.length || parsed.images.length ? 'DOCX 解析完成' : '未发现可处理公式', formulaCount: parsed.formulas.length + parsed.images.length, warnings: parsed.warnings });
      return;
    }
    updateSource(source.id, { status: 'detecting', progress: 8, message: '正在渲染 PDF 页面' });
    let detected = 0;
    const document = await parsePdfDocument(file, (progress, message) => updateSource(source.id, { progress: Math.round(progress * .7), message }), { signal, awaitDetection: true }, formulas => {
      if (signal.aborted) return false;
      detected += formulas.length;
      addFormulas(formulas.map(formula => fromRegion(source, formula)));
      updateSource(source.id, { status: 'detecting', formulaCount: detected, message: `已检测 ${detected} 个候选公式` });
      return true;
    });
    signal.throwIfAborted();
    let sourceCount = 0;
    const textItems = document.textLayerFormulas.flatMap(page => page.candidates.map((candidate): FormulaItem => ({ id: id('pdf-text'), sourceId: source.id, sourceName: file.name, sourceKind: 'pdf', pageNumber: page.pageNumber, latex: candidate.latex, originalLatex: candidate.latex, status: candidate.requiresVisualReview ? 'needs_review' : 'success', uncertainties: candidate.requiresVisualReview ? ['PDF 文本层候选需要核对'] : [], selected: true })));
    sourceCount = textItems.length;
    addFormulas(textItems);
    updateSource(source.id, { status: 'ready', progress: 100, message: `PDF 已就绪，可在页面预览中拖框补漏`, formulaCount: detected + sourceCount, pageImages: document.pageImages });
  }, [addFormula, addFormulas, fromRegion, updateSource]);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    for (const file of files) {
      const kind = kindOf(file);
      if (!kind) {
        const source: SourceTask = { id: id('source'), name: file.name, kind: 'image', status: 'failed', progress: 0, message: '不支持的文件格式', formulaCount: 0, warnings: [] };
        setSources(current => [...current, source]);
        continue;
      }
      const max = kind === 'pdf' ? 50 : kind === 'docx' ? 20 : kind === 'markdown' ? 5 : 10;
      const source: SourceTask = { id: id('source'), name: file.name, kind, status: file.size > max * 1024 * 1024 ? 'failed' : 'queued', progress: 0, message: file.size > max * 1024 * 1024 ? `文件超过 ${max}MB` : '等待处理', formulaCount: 0, warnings: [] };
      setSources(current => [...current, source]);
      if (source.status === 'failed') continue;
      void sourceQueue.add(source.id, signal => processSource(file, source, signal)).then(result => {
        if (result.status === 'cancelled') updateSource(source.id, { status: 'cancelled', message: '已取消' });
        if (result.status === 'error') updateSource(source.id, { status: 'failed', message: result.error instanceof Error ? result.error.message : '文件处理失败' });
        const queueMessage = queueFailureMessage(result);
        if (queueMessage) updateSource(source.id, { status: 'failed', message: queueMessage });
      });
    }
  }, [processSource, sourceQueue, updateSource]);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
      if (files.length) { event.preventDefault(); addFiles(files); }
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
  }, [addFiles]);

  const recognize = useCallback((itemId: string) => {
    const snapshot = items.find(item => item.id === itemId);
    if (!snapshot?.image || snapshot.status === 'recognizing' || snapshot.userEdited) return;
    setItems(current => current.map(item => item.id === itemId ? { ...item, status: 'recognizing', error: undefined } : item));
    void ocrQueue.add(itemId, async signal => {
      const result = await recognizeStructured(buildRecognitionRequest({ image: snapshot.image!, mime: snapshot.mime || 'image/png', formulaType, mode, source: { kind: snapshot.sourceKind, fileName: snapshot.sourceName, pageNumber: snapshot.pageNumber, regionId: snapshot.id } }), provider, signal);
      if (signal.aborted) return result;
      startTransition(() => setItems(current => {
        const index = current.findIndex(item => item.id === itemId);
        if (index < 0 || current[index].userEdited) return current;
        const next = [...current];
        const formulas = result.formulas?.length ? result.formulas : result.latex ? [{ latex: result.latex }] : [];
        next[index] = { ...next[index], latex: formulas[0]?.latex || '', originalLatex: formulas[0]?.latex, status: result.status === 'no_formula' ? 'no_formula' : result.success ? result.status === 'uncertain' ? 'needs_review' : 'success' : 'failed', provider, confidence: result.confidence, uncertainties: result.uncertainties, processingTime: result.processingTime, errorClass: result.errorClass, error: result.error };
        if (formulas.length > 1) next.splice(index + 1, 0, ...formulas.slice(1).map((formula, offset): FormulaItem => ({ ...next[index], id: `${itemId}-${offset + 2}`, latex: formula.latex, originalLatex: formula.latex })));
        return next;
      }));
      return result;
    }).then(outcome => {
      if (outcome.status === 'cancelled') setItems(current => current.map(item => item.id === itemId ? { ...item, status: 'cancelled' } : item));
      if (outcome.status === 'error') setItems(current => current.map(item => item.id === itemId ? { ...item, status: 'failed', error: outcome.error instanceof Error ? outcome.error.message : '识别失败' } : item));
      const queueMessage = queueFailureMessage(outcome);
      if (queueMessage) setItems(current => current.map(item => item.id === itemId ? { ...item, status: 'failed', errorClass: outcome.status, error: queueMessage } : item));
    });
  }, [formulaType, items, mode, ocrQueue, provider]);

  const recognizeAll = useCallback(() => items.filter(item => item.image && ['queued', 'failed', 'cancelled'].includes(item.status) && !item.userEdited).forEach(item => recognize(item.id)), [items, recognize]);
  const cancel = (itemId: string) => { ocrQueue.cancel(itemId); setItems(current => current.map(item => item.id === itemId ? { ...item, status: 'cancelled' } : item)); };
  const edit = (itemId: string, latex: string) => setItems(current => current.map(item => item.id === itemId ? { ...item, latex, status: 'needs_review', userEdited: true, uncertainties: ['人工修改'] } : item));
  const visible = useMemo(() => items.filter(item => filter === 'all' || filter === 'review' && item.status === 'needs_review' || filter === 'failed' && ['failed', 'no_formula'].includes(item.status)), [filter, items]);
  const displayed = visible.slice(0, visibleLimit);
  const selected = items.filter(item => item.selected && item.latex);
  const exportResults = (format: 'markdown' | 'latex' | 'json') => {
    if (!selected.length) return;
    const content = format === 'json' ? JSON.stringify(selected.map(item => ({ ...item, image: undefined })), null, 2) : selected.map((item, index) => format === 'markdown' ? `<!-- ${item.sourceName}${item.pageNumber ? ` · 第${item.pageNumber}页` : ''} -->\n\n$$\n${item.latex}\n$$` : `% ${index + 1}. ${item.sourceName}${item.pageNumber ? ` · page ${item.pageNumber}` : ''}\n${item.latex}`).join('\n\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `formula-ocr.${format === 'latex' ? 'tex' : format === 'markdown' ? 'md' : 'json'}`; anchor.click(); URL.revokeObjectURL(url);
  };
  const counters = useMemo(() => ({ total: items.length, success: items.filter(i => i.status === 'success').length, review: items.filter(i => i.status === 'needs_review').length, failed: items.filter(i => ['failed', 'no_formula'].includes(i.status)).length }), [items]);

  return <div className="workbench">
    <section className="control-bar" aria-label="识别设置">
      <div className="segmented" aria-label="识别模式"><button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>单公式</button><button className={mode === 'multiple' ? 'active' : ''} onClick={() => setMode('multiple')}>多公式</button></div>
      <label>类型<select value={formulaType} onChange={event => onFormulaTypeChange(event.target.value as FormulaType)}><option value="auto">自动</option><option value="math">数学</option><option value="physics">物理</option><option value="chemistry">化学</option></select></label>
      <button className="provider-button" onClick={onOpenProvider}>服务 · {PROVIDER_CONFIGS[provider].name}</button>
      <button className="primary" disabled={!items.some(item => item.image && item.status !== 'recognizing')} onClick={recognizeAll}>识别全部</button>
    </section>

    <section className={`drop-surface ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} onClick={() => inputRef.current?.click()}>
      <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,.pdf,.docx,.md,.markdown" onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} />
      <strong>添加图片或文献</strong><span>PNG / JPG / WebP · PDF · DOCX · Markdown</span><small>可拖拽、粘贴或选择多个文件</small>
    </section>

    {sources.length > 0 && <section className="source-strip" aria-label="文件任务">{sources.map(source => <article key={source.id} className={`source-row ${source.status}`}>
      <div><strong>{source.name}</strong><span>{source.message === '不支持的文件格式' ? 'FILE' : source.kind.toUpperCase()} · {source.message}</span></div><progress value={source.progress} max="100" />
      <span>{source.formulaCount} 公式</span>{['queued', 'parsing', 'detecting'].includes(source.status) && <button title="取消文件处理" onClick={() => { sourceQueue.cancel(source.id); updateSource(source.id, { status: 'cancelled', message: '已取消' }); }}>×</button>}
      {source.warnings.map(warning => <small key={warning}>{warning}</small>)}
    </article>)}</section>}

    {sources.flatMap(source => source.pageImages?.map((image, index) => ({ source, image, page: index + 1 })) || []).length > 0 && <details className="pdf-review"><summary>PDF 页面补漏 · 拖动框选遗漏公式</summary><div className="pdf-pages">{sources.flatMap(source => source.pageImages?.map((image, index) => <PdfRegionSelector key={`${source.id}-${index}`} image={image} pageNumber={index + 1} onExtract={formula => addFormula(fromRegion(source, formula))} />) || [])}</div></details>}

    <section className="result-head"><div><h2>公式结果</h2><p>{counters.total} 条 · {counters.success} 成功 · {counters.review} 待复核 · {counters.failed} 失败 · 已选 {selected.length}</p></div><div className="result-actions"><select aria-label="结果筛选" value={filter} onChange={e => { setFilter(e.target.value as typeof filter); setVisibleLimit(RESULT_PAGE_SIZE); }}><option value="all">全部结果</option><option value="review">待复核</option><option value="failed">失败</option></select><button onClick={() => setItems(current => current.map(item => ({ ...item, selected: true })))}>全选</button><button onClick={() => setItems(current => current.map(item => ({ ...item, selected: false })))}>取消选择</button><button disabled={!selected.length} onClick={() => exportResults('markdown')}>导出 MD</button><button disabled={!selected.length} onClick={() => exportResults('latex')}>导出 TeX</button><button disabled={!selected.length} onClick={() => exportResults('json')}>导出 JSON</button></div></section>
    {isPending && <div className="updating">正在整理识别结果…</div>}
    <section className="result-list">{visible.length === 0 ? <div className="empty-result">上传文件后，解析出的公式会显示在这里。</div> : displayed.map(item => <article key={item.id} className={`result-row ${item.status}`}>
      <input type="checkbox" aria-label="选择公式" checked={item.selected} onChange={e => setItems(current => current.map(x => x.id === item.id ? { ...x, selected: e.target.checked } : x))} />
      <div className="source-preview">{item.image ? <img src={item.image} alt="公式原图" loading="lazy" decoding="async" /> : <span>{sourceBadge(item.sourceKind)}</span>}</div>
      <div className="formula-main"><div className="formula-meta"><span className={`status-dot ${item.status}`}>{statusText[item.status]}</span><span>{item.sourceName}{item.pageNumber ? ` · 第 ${item.pageNumber} 页/段` : ''}</span>{item.provider && <span>{item.provider} · {item.processingTime ?? 0}ms</span>}{typeof item.confidence === 'number' && <span>检测置信度 {Math.round(item.confidence * (item.confidence <= 1 ? 100 : 1))}%</span>}</div>
        {item.latex ? <><FormulaPreview latex={item.latex} compact /><textarea aria-label="LaTeX 编辑器" value={item.latex} onChange={e => edit(item.id, e.target.value)} /></> : <p className="failure-copy">{item.error || (item.status === 'no_formula' ? '该区域未识别到公式，可重新框选后重试。' : '等待识别')}</p>}
        {item.uncertainties.length > 0 && <div className="uncertainties">{item.uncertainties.map(value => <span key={value}>{value}</span>)}</div>}
      </div>
      <div className="row-actions">{item.status === 'recognizing' ? <button onClick={() => cancel(item.id)}>取消</button> : item.image && !item.userEdited && <button onClick={() => recognize(item.id)}>{['failed', 'cancelled', 'no_formula'].includes(item.status) ? '重试' : '识别'}</button>}<button onClick={() => navigator.clipboard.writeText(item.latex)} disabled={!item.latex}>复制</button><button title="删除" onClick={() => setItems(current => current.filter(x => x.id !== item.id))}>×</button></div>
    </article>)}{visible.length > displayed.length && <button className="show-more" onClick={() => setVisibleLimit(visible.length)}>显示其余 {visible.length - displayed.length} 条</button>}</section>
  </div>;
}
