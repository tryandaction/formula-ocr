/**
 * Advanced Formula Detection - Main Export
 * 高级公式检测 - 主导出文件
 */

// Types
export type {
  DetectionOptions,
  PageImage,
  PreprocessOptions,
  ProcessedImage,
  ImageRegion,
  MathFeatures,
  RegionContext,
  TextLine,
  ContentType,
  ClassificationResult,
  FormulaType,
  FormulaTypeResult,
  Point,
  RefinedBoundary,
  ConfidenceScore,
  DetectionCandidate,
  EnhancedFormulaRegion,
  DetectionCache,
  DetectionError,
  DetectionErrorInfo,
} from './types';

// Interfaces
export type {
  IAdvancedFormulaDetector,
  IPagePreprocessor,
  IFeatureExtractor,
  IContentClassifier,
  IFormulaTypeClassifier,
  IBoundaryDetector,
  IConfidenceScorer,
  IDetectionCacheManager,
} from './interfaces';

// Constants
export {
  DEFAULT_DETECTION_OPTIONS,
  CONFIDENCE_THRESHOLDS,
  DEFAULT_PREPROCESS_OPTIONS,
  BINARIZATION_THRESHOLD,
  MIN_FORMULA_HEIGHT,
  MAX_FORMULA_HEIGHT,
  MIN_FORMULA_WIDTH,
  MIN_REGION_PIXELS,
  MIN_BLANK_HEIGHT,
  CLASSIFICATION_RULES,
  FORMULA_TYPE_RULES,
  CONFIDENCE_WEIGHTS,
  MATH_SYMBOL_PATTERNS,
  MERGE_THRESHOLD_X_SCALE,
  MERGE_THRESHOLD_Y_SCALE,
  CACHE_KEY_PREFIX,
  CACHE_MAX_AGE,
  CACHE_MAX_ENTRIES,
  MAX_DETECTION_TIME,
  WORKER_POOL_SIZE,
  BATCH_SIZE,
} from './constants';

// Implementations
export { PagePreprocessor } from './PagePreprocessor';
export { FeatureExtractor } from './FeatureExtractor';
export { ContentClassifier } from './ContentClassifier';
export { FormulaTypeClassifier } from './FormulaTypeClassifier';
export { BoundaryDetector } from './BoundaryDetector';
export { ConfidenceScorer } from './ConfidenceScorer';
export { DetectionCacheManager } from './DetectionCacheManager';
export { AdvancedFormulaDetector } from './AdvancedFormulaDetector';
