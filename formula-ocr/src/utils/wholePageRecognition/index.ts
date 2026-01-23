/**
 * 整页公式识别系统 - 主入口
 * 
 * 导出所有公共接口、类型和工具函数
 */

// 类型定义
export type {
  BoundingBox,
  FormulaType,
  FormulaMetadata,
  FormulaInstance,
  TextLayerData,
  TextItem,
  TextStyle,
  PageData,
  PerformanceMode,
  ProcessingOptions,
  DetectionRegion,
  DetectionOptions,
  FormulaFeatures,
  RawDetection,
  DetectionContext,
  ConversionOptions,
  DetectionCache,
  PartialResult,
} from './types';

// 接口定义
export type {
  IWholePageProcessor,
  IBatchProcessingManager,
  IDetectionOptimizer,
  IBoundaryLocator,
  IConfidenceScorer,
  IFormatConverter,
  IClipboardManager,
  IOperationManager,
  ICacheManager,
} from './interfaces';

// 错误类
export {
  InvalidPageDataError,
  DetectionError,
  ConversionError,
  PerformanceError,
  ClipboardError,
  executeWithFallback,
  executeWithRetry,
  executeWithTimeout,
  monitorMemory,
  delay,
} from './errors';

export type { FallbackChain, PerformanceErrorType } from './errors';

// 默认配置
export {
  DEFAULT_PROCESSING_OPTIONS,
  DEFAULT_DETECTION_OPTIONS,
  DEFAULT_CONVERSION_OPTIONS,
} from './types';

// 性能优化组件
export { WorkerPool } from './WorkerPool';
export type { WorkerPoolConfig } from './WorkerPool';
export { ProgressiveRenderer, AnimationFrameScheduler } from './ProgressiveRenderer';
export type { RenderBatch, ProgressiveRenderConfig } from './ProgressiveRenderer';
export { OptimizedPreprocessor } from './OptimizedPreprocessor';
export type { PreprocessOptions } from './OptimizedPreprocessor';

// 内存优化组件
export { LazyImageLoader } from './LazyImageLoader';
export type { ImageReference, LazyLoadConfig } from './LazyImageLoader';
export { ResourceManager, globalResourceManager } from './ResourceManager';
export type { ResourceType, ResourceReference, ResourceManagerConfig } from './ResourceManager';

// 工具函数将在后续实现后导出
// export { WholePageProcessor } from './WholePageProcessor';
// export { BatchProcessingManager } from './BatchProcessingManager';
// export { DetectionOptimizer } from './DetectionOptimizer';
// export { BoundaryLocator } from './BoundaryLocator';
// export { ConfidenceScorer } from './ConfidenceScorer';
// export { FormatConverter } from './FormatConverter';
// export { ClipboardManager } from './ClipboardManager';
// export { OperationManager } from './OperationManager';
// export { CacheManager } from './CacheManager';
