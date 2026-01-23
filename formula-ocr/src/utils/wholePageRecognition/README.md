# 整页公式识别深度优化系统

## 概述

本系统实现了PDF公式识别工具的整页公式识别深度优化功能，旨在提升现有高级检测系统的性能，实现整页批量识别、精准边界定位、单个公式独立操作，并显著减少误检和漏检。

## 核心特性

- ✅ **整页批量处理**：一次性识别整个页面的所有公式，无需切片
- ✅ **精准边界定位**：边距误差≤5像素
- ✅ **智能区域划分**：大型页面自动划分为重叠区域
- ✅ **并行处理**：多区域并行检测，提升性能
- ✅ **置信度评分**：多维度评估检测结果可靠性
- ✅ **误检/漏检优化**：目标误检率≤5%，漏检率≤3%
- ✅ **Web Workers并行**：使用Worker池实现真正的并行处理
- ✅ **渐进式渲染**：优先显示高置信度结果
- ✅ **内存优化**：懒加载、资源管理、自动清理
- ✅ **UI优化**：React.memo、虚拟滚动、requestAnimationFrame

## 架构组件

### 核心处理层

#### 1. WholePageProcessor（整页处理器）
协调整页公式检测流程的核心组件。

```typescript
import { WholePageProcessor } from './wholePageRecognition';

const processor = new WholePageProcessor();
const formulas = await processor.processWholePage(pageData, {
  confidenceThreshold: 0.75,
  performanceMode: 'balanced',
  enableCache: true,
  maxFormulas: 100,
});
```

#### 2. BatchProcessingManager（批处理管理器）
管理批量检测任务，优化内存和性能。

**功能**：
- 智能区域划分（标准页面不划分，大型页面划分为4-9个重叠区域）
- 并行处理多个区域
- 结果合并和去重（基于IoU算法）

#### 3. BoundaryLocator（边界定位器）
精确定位公式边界，实现≤5像素误差。

**算法**：
- 边缘检测和像素密度分析
- 紧密贴合算法
- 垂直扩展处理（上下标、分式、根号）
- 重叠解决（IoU>30%自动合并）

#### 4. ConfidenceScorer（置信度评分器）
为每个检测结果计算置信度分数（0-1）。

**评分维度**：
- 特征分数（40%）：数学符号、字体、希腊字母
- 结构分数（30%）：分式、上下标、根号、积分
- 上下文分数（20%）：页面类型、公式类型、密度
- 边界分数（10%）：尺寸合理性、宽高比

#### 5. DetectionOptimizer（检测优化器）
封装优化后的检测算法，减少误检和漏检。

**优化策略**：
- 特征验证
- 尺寸过滤
- 多尺度检测
- 文本层分析

### 性能优化层

#### 6. WorkerPool（Worker池）
管理多个Web Workers，实现真正的并行处理。

```typescript
import { WorkerPool } from './wholePageRecognition';

const pool = new WorkerPool({ workerCount: 4 });
await pool.initialize();

const results = await pool.detectBatch(regions, options);
```

#### 7. ProgressiveRenderer（渐进式渲染器）
优先显示高置信度的检测结果。

```typescript
import { ProgressiveRenderer } from './wholePageRecognition';

const renderer = new ProgressiveRenderer({
  batchCount: 3,
  batchInterval: 100,
});

await renderer.render(formulas, (batch) => {
  // 渲染当前批次
  renderBatch(batch);
});
```

#### 8. OptimizedPreprocessor（优化预处理器）
高效的图像预处理算法。

```typescript
import { OptimizedPreprocessor } from './wholePageRecognition';

const preprocessor = new OptimizedPreprocessor();
const processed = preprocessor.preprocess(imageData, {
  binarize: true,
  denoise: true,
  enhanceContrast: true,
});
```

### 内存管理层

#### 9. LazyImageLoader（懒加载管理器）
按需加载图像数据，减少内存占用。

```typescript
import { LazyImageLoader } from './wholePageRecognition';

const loader = new LazyImageLoader({
  maxCachedImages: 20,
  preloadDistance: 1000,
});

const imageData = await loader.loadImage(imageReference);
```

#### 10. ResourceManager（资源管理器）
统一管理系统资源，及时释放不再使用的资源。

```typescript
import { globalResourceManager } from './wholePageRecognition';

// 注册资源
globalResourceManager.register('canvas-1', 'canvas', canvas);

// 访问资源
const canvas = globalResourceManager.access('canvas-1');

// 释放资源
globalResourceManager.release('canvas-1');
```

#### 11. CacheManager（缓存管理器）
管理检测结果的缓存，提高重复访问的性能。

### 操作管理层

#### 12. FormatConverter（格式转换器）
将公式图像转换为LaTeX或Markdown格式。

#### 13. ClipboardManager（剪贴板管理器）
管理剪贴板操作，支持现代API和降级方案。

#### 14. OperationManager（操作管理器）
处理单个公式的复制、编辑和导出操作。

### UI组件层

#### 15. OptimizedFormulaOverlay（优化的公式覆盖层）
使用React.memo和虚拟化技术优化大量公式的渲染。

```typescript
import { OptimizedFormulaOverlay } from './components/wholePageRecognition';

<OptimizedFormulaOverlay
  formulas={formulas}
  pageWidth={pageWidth}
  pageHeight={pageHeight}
  viewport={viewport}
  onFormulaSelect={handleSelect}
/>
```

#### 16. VirtualScrollContainer（虚拟滚动容器）
用于大量公式的高效渲染。

#### 17. OptimizedWholePageDetector（优化的主检测器）
使用React.memo、useMemo、useCallback等优化技术。

## 使用示例

### 基本用法

```typescript
import { WholePageProcessor, PageData } from './wholePageRecognition';

// 创建处理器
const processor = new WholePageProcessor();

// 准备页面数据
const pageData: PageData = {
  imageData: canvasImageData,
  textLayer: pdfTextLayer,
  width: 1000,
  height: 1500,
  pageNumber: 1,
};

// 处理整页
const formulas = await processor.processWholePage(pageData);

// 访问检测结果
formulas.forEach(formula => {
  console.log(`公式 ${formula.id}:`);
  console.log(`  位置: (${formula.boundingBox.x}, ${formula.boundingBox.y})`);
  console.log(`  尺寸: ${formula.boundingBox.width}x${formula.boundingBox.height}`);
  console.log(`  置信度: ${formula.confidence.toFixed(2)}`);
  console.log(`  类型: ${formula.type}`);
});
```

### 使用Worker池并行处理

```typescript
import { WorkerPool, BatchProcessingManager } from './wholePageRecognition';

// 创建Worker池
const pool = new WorkerPool({ workerCount: 4 });
await pool.initialize();

// 创建批处理管理器
const batchManager = new BatchProcessingManager();

// 划分区域
const regions = batchManager.divideIntoRegions(pageData);

// 并行处理
const results = await pool.detectBatch(regions, detectionOptions);

// 合并结果
const formulas = batchManager.mergeResults(results);

// 清理
pool.destroy();
```

### 渐进式渲染

```typescript
import { ProgressiveRenderer } from './wholePageRecognition';

const renderer = new ProgressiveRenderer({
  batchCount: 3,
  batchInterval: 100,
  minConfidence: 0.5,
});

await renderer.render(formulas, (batch) => {
  console.log(`Rendering batch ${batch.id} with ${batch.formulas.length} formulas`);
  // 渲染当前批次的公式
  renderFormulas(batch.formulas);
});
```

### 内存优化

```typescript
import { LazyImageLoader, globalResourceManager } from './wholePageRecognition';

// 懒加载图像
const loader = new LazyImageLoader({
  maxCachedImages: 20,
  unloadDelay: 5000,
});

const imageData = await loader.loadImage(imageReference);

// 资源管理
globalResourceManager.register('image-1', 'imageData', imageData);

// 检查内存并清理
globalResourceManager.checkMemoryAndCleanup();

// 获取统计信息
const stats = globalResourceManager.getStats();
console.log(`Total resources: ${stats.totalResources}`);
```

### React组件使用

```typescript
import { OptimizedWholePageDetector } from './components/wholePageRecognition';

function App() {
  const [pageData, setPageData] = useState<PageData | null>(null);

  return (
    <OptimizedWholePageDetector
      pageData={pageData}
      autoDetect={true}
      enableProgressiveRendering={true}
      onDetectionComplete={(formulas) => {
        console.log(`Detected ${formulas.length} formulas`);
      }}
    />
  );
}
```

## 性能指标

- **标准页面**（<2000x3000px，≤10个公式）：≤2秒
- **复杂页面**（≥2000x3000px，20-50个公式）：≤5秒
- **边界精度**：误差≤5像素
- **准确率**：误检率≤5%，漏检率≤3%
- **内存使用**：<500MB（自动清理）
- **UI响应性**：60fps（使用requestAnimationFrame）

## 技术栈

- **语言**：TypeScript
- **框架**：React 19
- **构建工具**：Vite
- **PDF解析**：PDF.js
- **测试框架**：Vitest + fast-check
- **并行处理**：Web Workers
- **性能优化**：React.memo、useMemo、useCallback、requestAnimationFrame

## 开发状态

### 已完成 ✅
- [x] 核心类型定义（types.ts, interfaces.ts, errors.ts）
- [x] BatchProcessingManager（批处理管理器）
- [x] BoundaryLocator（边界定位器）
- [x] ConfidenceScorer（置信度评分器）
- [x] DetectionOptimizer（检测优化器）
- [x] WholePageProcessor（整页处理器）
- [x] FormatConverter（格式转换器）
- [x] ClipboardManager（剪贴板管理器）
- [x] OperationManager（操作管理器）
- [x] CacheManager（缓存管理器）
- [x] React UI组件集成
- [x] 性能优化（Worker池、渐进式渲染、内存管理）
- [x] UI优化（React.memo、虚拟滚动、requestAnimationFrame）

### 进行中 🚧
- [ ] 完整测试套件优化
- [ ] 最终验收测试

### 待开始 📋
- [ ] 用户手册

## API文档

### 核心接口

详见 `interfaces.ts` 文件，包含所有组件的接口定义。

### 类型定义

详见 `types.ts` 文件，包含所有数据模型和配置类型。

### 错误处理

详见 `errors.ts` 文件，包含所有错误类和工具函数。

## 贡献指南

1. 遵循现有代码风格
2. 添加完整的TypeScript类型注解
3. 编写单元测试和属性测试
4. 更新相关文档

## 许可证

MIT
