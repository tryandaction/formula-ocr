import { useState, useCallback } from 'react';
import { ImageUploader, type ImageItem } from './components/ImageUploader';
import { FormulaResults } from './components/FormulaResults';
import { ProviderSelector } from './components/ProviderSelector';
import { ActivationModal } from './components/ActivationModal';
import { PaymentModal } from './components/PaymentModal';
import { AuthModal } from './components/AuthModal';
import { DonationButton } from './components/DonationButton';
import { UserStatusBadge, QuotaExhaustedPrompt } from './components/UserStatusBadge';
import { HistoryPanel } from './components/HistoryPanel';
import { DocumentUploader } from './components/DocumentUploader';
import { FormulaTypeSelector, type FormulaType } from './components/FormulaTypeSelector';
import {
  type ProviderType,
  recognizeWithProvider,
  getRecommendedProvider,
  getSelectedProvider,
  setSelectedProvider,
  PROVIDER_CONFIGS
} from './utils/providers';
import { getActivationStatus } from './utils/activation';
import { isBackendEnabled, checkQuota, setSimulateMode, type QuotaInfo, type SimulateMode } from './utils/api';
import { addHistory, type HistoryItem } from './utils/historyService';
import type { FormulaRegion } from './utils/documentParser';
import { buildRecognitionRequest } from './utils/ocrContract';
import type { DocumentFormulaSource } from './utils/documentFormats';
import './index.css';

type UploadMode = 'image' | 'document';

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedProvider, setSelectedProviderState] = useState<ProviderType>(
    getSelectedProvider() || getRecommendedProvider()
  );
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authReason, setAuthReason] = useState<'quota_exhausted' | 'upgrade' | 'manual'>('manual');
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('image');
  const [formulaType, setFormulaType] = useState<FormulaType>('auto');

  // 处理单张图片识别
  const processImage = useCallback(async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image || image.status === 'processing') return;

    // 更新状态为处理中
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, status: 'processing' as const, ocrStatus: 'pending' as const } : img
    ));

    const startedAt = Date.now();
    try {
      const request = buildRecognitionRequest({
        image: image.base64,
        mime: image.base64.match(/^data:([^;]+);/)?.[1] || 'image/png',
        formulaType,
        mode: 'single',
        source: { kind: 'image', fileName: image.fileName },
      });
      const latex = await recognizeWithProvider(request, selectedProvider);
      
      setImages(prev => prev.map(img => 
        img.id === imageId ? {
          ...img,
          status: 'done' as const,
          latex,
          ocrStatus: 'success' as const,
          provider: selectedProvider,
          processingTime: Date.now() - startedAt,
        } : img
      ));

      // 保存到历史记录
      try {
        await addHistory({
          imageBase64: image.base64,
          latex,
          source: image.fileName,
        });
      } catch (e) {
        console.error('Failed to save history:', e);
      }

      // 刷新额度
      if (isBackendEnabled()) {
        checkQuota().then(setQuota).catch(console.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '识别失败';
      setImages(prev => prev.map(img => 
        img.id === imageId ? {
          ...img,
          status: 'error' as const,
          ocrStatus: 'failed' as const,
          error: errorMessage,
          provider: selectedProvider,
          processingTime: Date.now() - startedAt,
        } : img
      ));
    }
  }, [images, selectedProvider, formulaType]);

  // 处理 LaTeX 编辑
  const handleLatexChange = useCallback((imageId: string, newLatex: string) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, latex: newLatex } : img
    ));
  }, []);

  // 删除单个结果
  const handleRemoveResult = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  }, []);

  // 清空所有结果
  const handleClearAll = useCallback(() => {
    setImages([]);
  }, []);

  // 重新排序结果
  const handleReorder = useCallback((newImages: ImageItem[]) => {
    setImages(newImages);
  }, []);

  // 从历史记录恢复
  const handleRestoreFromHistory = useCallback((historyItem: HistoryItem) => {
    const newImage: ImageItem = {
      id: `restored_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      base64: historyItem.imageBase64,
      status: 'done',
      latex: historyItem.latex,
      fileName: historyItem.source,
    };
    setImages(prev => [...prev, newImage]);
    setShowHistoryPanel(false);
  }, []);

  // 从文档提取公式
  const handleFormulasExtracted = useCallback((formulas: FormulaRegion[]) => {
    const newImages: ImageItem[] = formulas.map((formula, index) => ({
      id: `doc_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 11)}`,
      base64: formula.imageData,
      status: 'pending' as const,
      fileName: `公式 ${formula.pageNumber}-${index + 1}`,
      source: `PDF 第${formula.pageNumber}页`,
      pageNumber: formula.pageNumber,
      position: formula.originalPosition,
      ocrStatus: 'pending',
    }));
    setImages(prev => [...prev, ...newImages]);
    setUploadMode('image'); // 切换回图片模式查看结果
  }, []);

  const handleMarkdownFormulasExtracted = useCallback((formulas: DocumentFormulaSource[]) => {
    const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    const newImages: ImageItem[] = formulas.map((formula, index) => ({
      id: `md_${Date.now()}_${index}`,
      base64: placeholder,
      status: 'done' as const,
      latex: formula.latex,
      fileName: `${formula.fileName}:第${formula.location.line || 1}行`,
      source: formula.fileName,
    }));
    setImages(prev => [...prev, ...newImages]);
    setUploadMode('image');
  }, []);

  // 获取已完成的图片
  const completedImages = images.filter(img => img.status !== 'pending' || img.latex);

  // 获取激活状态
  const activationStatus = getActivationStatus();

  // 打开登录模态框
  const openAuthModal = useCallback((reason: 'quota_exhausted' | 'upgrade' | 'manual' = 'manual') => {
    setAuthReason(reason);
    setShowAuthModal(true);
  }, []);

  // 处理管理员模拟模式切换
  const handleSimulateModeChange = useCallback(async (mode: SimulateMode) => {
    try {
      const result = await setSimulateMode(mode);
      if (result.success) {
        // 刷新额度信息
        const newQuota = await checkQuota();
        setQuota(newQuota);
      } else {
        console.error('Failed to set simulate mode:', result.message);
      }
    } catch (error) {
      console.error('Error setting simulate mode:', error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📐</span>
              <div>
                <h1 className="text-xl font-bold text-gray-800">公式识别</h1>
                <p className="text-xs text-gray-500">Formula OCR - 图片转 LaTeX</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* 用户状态徽章 - 显示用户层级和额度 */}
              <UserStatusBadge 
                quota={quota} 
                onUpgradeClick={() => setShowPaymentModal(true)}
                onLoginClick={() => openAuthModal('manual')}
                onSimulateModeChange={handleSimulateModeChange}
              />

              {/* 历史记录按钮 */}
              <button
                onClick={() => setShowHistoryPanel(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                title="历史记录"
              >
                <span>📜</span>
                <span className="hidden sm:inline">历史</span>
              </button>
              
              {/* Provider 选择按钮 */}
              <button
                onClick={() => setShowProviderSelector(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                <span>🔧</span>
                <span className="hidden sm:inline">{PROVIDER_CONFIGS[selectedProvider].name}</span>
              </button>

              {/* 激活按钮 - 仅未激活时显示 */}
              {!activationStatus.isValid && (
                <button
                  onClick={() => setShowActivationModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm hover:from-purple-600 hover:to-indigo-600 transition-all"
                >
                  <span>🔑</span>
                  <span className="hidden sm:inline">激活码</span>
                </button>
              )}

              {/* 赞助按钮 */}
              <DonationButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 额度耗尽提示 */}
        {quota && quota.todayRemaining === 0 && (
          <QuotaExhaustedPrompt
            quota={quota}
            onUpgradeClick={() => setShowPaymentModal(true)}
            onLoginClick={() => openAuthModal('quota_exhausted')}
            onConfigApiKey={() => setShowProviderSelector(true)}
          />
        )}

        {/* 上传区域 */}
        <section className="mb-8">
          {/* 上传模式切换 */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() => setUploadMode('image')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                uploadMode === 'image'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>🖼️</span>
              图片上传
            </button>
            <button
              onClick={() => setUploadMode('document')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                uploadMode === 'document'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>📄</span>
              文档解析
              <span className="text-xs px-1.5 py-0.5 bg-white/20 rounded">Beta</span>
            </button>

            {/* 公式类型选择器 */}
            <div className="ml-auto">
              <FormulaTypeSelector
                value={formulaType}
                onChange={setFormulaType}
                compact
              />
            </div>
          </div>

          {uploadMode === 'image' ? (
            <ImageUploader
              images={images}
              onImagesChange={setImages}
              onProcessImage={processImage}
              disabled={false}
            />
          ) : (
            <DocumentUploader
              onFormulasExtracted={handleFormulasExtracted}
              onMarkdownFormulasExtracted={handleMarkdownFormulasExtracted}
              disabled={false}
            />
          )}
        </section>

        {/* 识别结果 */}
        {completedImages.length > 0 && (
          <section>
            <FormulaResults
              images={completedImages}
              onLatexChange={handleLatexChange}
              onRemove={handleRemoveResult}
              onClearAll={handleClearAll}
              onReorder={handleReorder}
            />
          </section>
        )}

        {/* 空状态提示 */}
        {images.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✨</div>
            <h2 className="text-xl font-medium text-gray-700 mb-2">
              开始识别公式
            </h2>
            <p className="text-gray-500 max-w-md mx-auto">
              上传包含数学公式的图片，自动转换为 LaTeX 代码。
              支持拖拽、粘贴或点击上传。
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>Formula OCR - 让公式识别更简单</p>
        </div>
      </footer>

      {/* Modals */}
      {showProviderSelector && (
        <ProviderSelector
          selectedProvider={selectedProvider}
          onProviderChange={(provider) => {
            setSelectedProviderState(provider);
            setSelectedProvider(provider);
          }}
          onClose={() => setShowProviderSelector(false)}
        />
      )}

      <ActivationModal
        isOpen={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        onActivationChange={(isActivated) => {
          if (isActivated) {
            // 刷新额度
            if (isBackendEnabled()) {
              checkQuota().then(setQuota).catch(console.error);
            }
          }
        }}
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={(paidDays) => {
          void paidDays;
          // 刷新额度（本地状态已在 PaymentModal 中更新）
          if (isBackendEnabled()) {
            checkQuota().then(setQuota).catch(console.error);
          }
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={(newQuota) => {
          setQuota(newQuota);
        }}
        reason={authReason}
      />

      <HistoryPanel
        isOpen={showHistoryPanel}
        onClose={() => setShowHistoryPanel(false)}
        onRestoreItem={handleRestoreFromHistory}
      />
    </div>
  );
}

export default App;
