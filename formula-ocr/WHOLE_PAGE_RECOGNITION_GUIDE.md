# 整页公式识别系统 - 使用指南

## 概述

整页公式识别系统是一个强大的PDF公式检测工具，能够一次性识别整个页面的所有公式，提供精确的边界定位和独立操作功能。

## 核心特性

✅ **整页批量识别** - 无需切片，一次处理整个页面  
✅ **精准边界定位** - 误差≤5像素  
✅ **智能优化** - 误检率≤5%，漏检率≤3%  
✅ **高性能** - 标准页面≤2秒，复杂页面≤5秒  
✅ **独立操作** - 每个公式可单独复制/编辑  
✅ **多格式支持** - LaTeX、Markdown、JSON导出  

## 快速开始

### 1. 基础API使用

```typescript
import { WholePageProcessor, PageData } from '@/utils/wholePageRecognition';

// 创建处理器
const processor = new WholePageProcessor();

// 准备页面数据
const pageData: PageData = {
  imageData: canvasImageData,  // Canvas ImageData对象
  textLayer: pdfTextLayer,      // PDF文本层数据
  width: 1000,
  height: 1500,
  pageNumber: 1,
};

// 处理整页
const formulas = await processor.processWholePage(pageData, {
  confidenceThreshold: 0.75,    // 置信度阈值
  performanceMode: 'balanced',  // 性能模式
  enableCache: true,            // 启用缓存
  maxFormulas: 100,             // 最大公式数
});

// 使用检测结果
formulas.forEach(formula => {
  console.log(`公式 ${formula.id}:`);
  console.log(`  位置: (${formula.boundingBox.x}, ${formula.boundingBox.y})`);
  console.log(`  尺寸: ${formula.boundingBox.width}x${formula.boundingBox.height}`);
  console.log(`  置信度: ${(formula.confidence * 100).toFixed(1)}%`);
  console.log(`  类型: ${formula.type}`);
});
```

### 2. React组件使用

```tsx
import React, { useState } from 'react';
import { WholePageFormulaDetector } from '@/components/wholePageRecognition';
import type { PageData, FormulaInstance } from '@/utils/wholePageRecognition';

function PDFViewer() {
  const [pageData, setPageData] = useState<PageData | null>(null);

  const handleDetectionComplete = (formulas: FormulaInstance[]) => {
    console.log(`检测到 ${formulas.length} 个公式`);
    
    // 统计信息
    const avgConfidence = formulas.reduce((sum, f) => sum + f.confidence, 0) / formulas.length;
    console.log(`平均置信度: ${(avgConfidence * 100).toFixed(1)}%`);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* PDF渲染区域 */}
      <canvas id="pdf-canvas" />
      
      {/* 公式检测覆盖层 */}
      <WholePageFormulaDetector
        pageData={pageData}
        autoDetect={true}
        options={{
          confidenceThreshold: 0.75,
          performanceMode: 'balanced',
        }}
        onDetectionComplete={handleDetectionComplete}
      />
    </div>
  );
}
```

### 3. 操作管理

```typescript
import { OperationManager } from '@/utils/wholePageRecognition';

const manager = new OperationManager();

// 复制为LaTeX
const success = await manager.copyAsLatex(formula);
if (success) {
  console.log('LaTeX已复制到剪贴板');
}

// 复制为Markdown
await manager.copyAsMarkdown(formula);

// 编辑公式
const newContent = '\\frac{a}{b} + c^2';
const updatedFormula = await manager.editFormula(formula, newContent);

// 批量导出
const latexDoc = manager.exportFormulas(formulas, 'latex');
const markdownDoc = manager.exportFormulas(formulas, 'markdown');
const jsonData = manager.exportFormulas(formulas, 'json');
```

## 高级功能

### 进度跟踪

```typescript
const processor = new WholePageProcessor();

// 启动处理
const processingPromise = processor.processWholePage(pageData);

// 监控进度
const progressInterval = setInterval(() => {
  const progress = processor.getProgress();
  console.log(`处理进度: ${progress}%`);
  
  if (progress === 100) {
    clearInterval(progressInterval);
  }
}, 100);

// 等待完成
const formulas = await processingPromise;
```

### 取消处理

```typescript
const processor = new WholePageProcessor();

// 启动处理
const processingPromise = processor.processWholePage(pageData);

// 用户取消
setTimeout(() => {
  processor.cancelProcessing();
  console.log('处理已取消');
}, 2000);

try {
  await processingPromise;
} catch (error) {
  console.log('处理被中断');
}
```

### 缓存管理

```typescript
import { CacheManager } from '@/utils/wholePageRecognition';

const cache = new CacheManager();

// 保存到缓存
cache.saveToCache(pageNumber, formulas, pageHash);

// 从缓存加载
const cached = cache.loadFromCache(pageNumber, pageHash);
if (cached) {
  console.log('使用缓存结果');
  return cached;
}

// 清除缓存
cache.clearCache(pageNumber);  // 清除特定页面
cache.clearCache();            // 清除所有缓存
```

### 格式转换

```typescript
import { FormatConverter } from '@/utils/wholePageRecognition';

const converter = new FormatConverter();

// 图像转LaTeX
const latex = await converter.imageToLatex(formula.imageData, {
  useInlineMath: true,
  simplifyOutput: false,
});

// 图像转Markdown
const markdown = await converter.imageToMarkdown(formula.imageData, {
  useDisplayMath: true,
  preserveSpacing: true,
});

// 验证语法
const isValidLatex = converter.validateLatex(latex);
const isValidMarkdown = converter.validateMarkdown(markdown);
```

## 配置选项详解

### ProcessingOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `confidenceThreshold` | number | 0.75 | 置信度阈值（0-1），低于此值的检测结果将被过滤 |
| `performanceMode` | string | 'balanced' | 性能模式：'fast'（快速）、'balanced'（平衡）、'accurate'（精确） |
| `enableCache` | boolean | true | 是否启用缓存，启用后相同页面的检测结果会被缓存 |
| `maxFormulas` | number | 100 | 最大检测公式数，防止过度检测 |

### DetectionOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `detectInline` | boolean | true | 是否检测行内公式 |
| `detectDisplay` | boolean | true | 是否检测独立公式 |
| `detectNumbered` | boolean | true | 是否检测编号公式 |
| `minFormulaWidth` | number | 20 | 最小公式宽度（像素） |
| `minFormulaHeight` | number | 10 | 最小公式高度（像素） |

### ConversionOptions

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `useInlineMath` | boolean | true | 是否使用行内数学模式（$...$） |
| `useDisplayMath` | boolean | true | 是否使用独立数学模式（$$...$$） |
| `simplifyOutput` | boolean | false | 是否简化输出 |
| `preserveSpacing` | boolean | true | 是否保留空格 |

## 性能优化建议

### 1. 选择合适的性能模式

```typescript
// 快速模式 - 适合实时预览
const formulas = await processor.processWholePage(pageData, {
  performanceMode: 'fast',
  confidenceThreshold: 0.6,
});

// 平衡模式 - 推荐用于一般场景
const formulas = await processor.processWholePage(pageData, {
  performanceMode: 'balanced',
  confidenceThreshold: 0.75,
});

// 精确模式 - 适合高质量要求
const formulas = await processor.processWholePage(pageData, {
  performanceMode: 'accurate',
  confidenceThreshold: 0.85,
});
```

### 2. 启用缓存

```typescript
// 启用缓存可以显著提升重复处理的速度
const formulas = await processor.processWholePage(pageData, {
  enableCache: true,
});
```

### 3. 调整置信度阈值

```typescript
// 降低阈值可以检测更多公式，但可能增加误检
const formulas = await processor.processWholePage(pageData, {
  confidenceThreshold: 0.6,  // 更宽松
});

// 提高阈值可以减少误检，但可能增加漏检
const formulas = await processor.processWholePage(pageData, {
  confidenceThreshold: 0.9,  // 更严格
});
```

## 错误处理

```typescript
import { 
  executeWithFallback, 
  executeWithRetry,
  DetectionError 
} from '@/utils/wholePageRecognition';

// 使用降级策略
try {
  const formulas = await executeWithFallback([
    () => processor.processWholePage(pageData),
    () => fallbackProcessor.processWholePage(pageData),
  ]);
} catch (error) {
  console.error('所有检测方法都失败了', error);
}

// 使用重试机制
try {
  const formulas = await executeWithRetry(
    () => processor.processWholePage(pageData),
    { maxRetries: 3, delay: 1000 }
  );
} catch (error) {
  if (error instanceof DetectionError) {
    console.error('检测失败:', error.message);
  }
}
```

## 常见问题

### Q: 如何提高检测准确率？

A: 
1. 使用 `performanceMode: 'accurate'`
2. 提高 `confidenceThreshold` 到 0.85-0.9
3. 确保PDF质量良好（清晰、无扭曲）

### Q: 检测速度太慢怎么办？

A:
1. 使用 `performanceMode: 'fast'`
2. 启用缓存 `enableCache: true`
3. 降低 `confidenceThreshold` 到 0.6-0.7

### Q: 如何处理大型PDF文档？

A:
1. 分页处理，避免一次加载所有页面
2. 使用缓存避免重复处理
3. 考虑使用Web Workers进行后台处理

### Q: 如何自定义公式边界框样式？

A:
参考 `FormulaOverlay` 组件的实现，可以通过修改 `getBoundingBoxStyle` 方法来自定义样式。

## 技术支持

如有问题或建议，请：
1. 查看项目README和技术文档
2. 提交Issue到GitHub仓库
3. 联系开发团队

## 更新日志

### v1.0.0 (2026-01-22)
- ✅ 初始版本发布
- ✅ 整页批量识别功能
- ✅ 精准边界定位
- ✅ 多格式导出支持
- ✅ React UI组件集成
- ✅ 完整的错误处理机制
