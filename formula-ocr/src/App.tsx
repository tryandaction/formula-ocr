import { useState } from 'react';
import { FormulaWorkbench } from './components/FormulaWorkbench';
import { ProviderSelector } from './components/ProviderSelector';
import type { FormulaType } from './components/FormulaTypeSelector';
import { getRecommendedProvider, getSelectedProvider, setSelectedProvider, type ProviderType } from './utils/providers';
import './index.css';

function App() {
  const [provider, setProvider] = useState<ProviderType>(() => getSelectedProvider() || getRecommendedProvider());
  const [formulaType, setFormulaType] = useState<FormulaType>('auto');
  const [providerOpen, setProviderOpen] = useState(false);
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand-mark" aria-hidden="true">ƒ</div>
      <div><h1>Formula OCR</h1><p>文献与图片公式工作台</p></div>
      <div className="privacy-note"><span />原文件仅在当前浏览器处理；视觉 OCR 按所选服务发送裁剪区域</div>
    </header>
    <main><FormulaWorkbench provider={provider} formulaType={formulaType} onFormulaTypeChange={setFormulaType} onOpenProvider={() => setProviderOpen(true)} /></main>
    {providerOpen && <ProviderSelector selectedProvider={provider} onProviderChange={next => { setProvider(next); setSelectedProvider(next); }} onClose={() => setProviderOpen(false)} />}
  </div>;
}

export default App;
