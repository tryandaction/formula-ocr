/**
 * 整页公式识别系统 - 主导出文件
 */

// 核心组件
export { WholePageProcessor } from './WholePageProcessor';
export { BatchProcessingManager } from './BatchProcessingManager';
export { DetectionOptimizer } from './DetectionOptimizer';
export { BoundaryLocator } from './BoundaryLocator';
export { ConfidenceScorer } from './ConfidenceScorer';
export { ClipboardManager } from './ClipboardManager';
export { OperationManager } from './OperationManager';
export { CacheManager } from './CacheManager';
export { FormatConverter } from './FormatConverter';

// 类型定义
export type {
  PageData,
  ProcessingOptions,
  FormulaInstance,
  DetectionRegion,
  RawDetection,
  DetectionOptions,
  BoundingBox,
  DetectionContext,
  ConversionOptions,
  FormulaType,
  FormulaMetadata,
  FormulaFeatures,
  TextLayerData,
  TextItem,
  TextStyle,
  DetectionCache,
  PartialResult,
  PerformanceMode,
} from './types';

// 默认配置
export {
  DEFAULT_PROCESSING_OPTIONS,
  DEFAULT_DETECTION_OPTIONS,
  DEFAULT_CONVERSION_OPTIONS,
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
} from './errors';

export type {
  FallbackChain,
  PerformanceErrorType,
} from './errors';
