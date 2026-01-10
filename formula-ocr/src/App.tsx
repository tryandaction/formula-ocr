import { useState, useEffect, useCallback } from 'react';
import { ImageUploader, type ImageItem } from './components/ImageUploader';
import { FormulaResults } from './components/FormulaResults';
import { ProviderSelector } from './components/ProviderSelector';
import { ActivationModal } from './components/ActivationModal';
import { DonationButton } from './components/DonationButton';
import { 
  type ProviderType, 
  recognizeWithProvider, 
  getRecommendedProvider,
  PROVIDER_CONFIGS
} from './utils/providers';
import { getActivationStatus } from './utils/activation';
import { isBackendEnabled, checkQuota, type QuotaInfo } from './utils/api';
import './index.css';

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(getRecommendedProvider());
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // 加载额度信息
  useEffect(() => {
    if (isBackendEnabled()) {
      checkQuota().then(setQuota).catch(console.error);
    }
  }, []);

  // 处理单张图片识别
  const processImage = useCallback(async (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (!image || image.status === 'processing') return;

    // 更新状态为处理中
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, status: 'processing' as const } : img
    ));

    try {
      const latex = await recognizeWithProvider(image.base64, selectedProvider);
      
      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, status: 'done' as const, latex } : img
      ));

      // 刷新额度
      if (isBackendEnabled()) {
        checkQuota().then(setQuota).catch(console.error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '识别失败';
      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, status: 'error' as const, error: errorMessage } : img
      ));
    }
  }, [images, selectedProvider]);

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

  // 获取已完成的图片
  const completedImages = images.filter(img => img.status === 'done' && img.latex);

  // 获取激活状态
  const activationStatus = getActivationStatus();

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
              {/* 额度显示 */}
              {quota && (
                <div className="text-sm text-gray-600">
                  今日: {quota.todayRemaining}/{quota.todayLimit}
                  {quota.isPaid && <span className="ml-2 text-green-600">✓ 付费用户</span>}
                </div>
              )}
              
              {/* Provider 选择按钮 */}
              <button
                onClick={() => setShowProviderSelector(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                <span>🔧</span>
                <span className="hidden sm:inline">{PROVIDER_CONFIGS[selectedProvider].name}</span>
              </button>

              {/* 激活按钮 */}
              {!activationStatus.isValid && (
                <button
                  onClick={() => setShowActivationModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm hover:from-purple-600 hover:to-indigo-600 transition-all"
                >
                  <span>🔑</span>
                  <span className="hidden sm:inline">激活</span>
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
        {/* 上传区域 */}
        <section className="mb-8">
          <ImageUploader
            images={images}
            onImagesChange={setImages}
            onProcessImage={processImage}
            disabled={false}
          />
        </section>

        {/* 识别结果 */}
        {completedImages.length > 0 && (
          <section>
            <FormulaResults
              images={completedImages}
              onLatexChange={handleLatexChange}
              onRemove={handleRemoveResult}
              onClearAll={handleClearAll}
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
          onProviderChange={setSelectedProvider}
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
    </div>
  );
}

export default App;
