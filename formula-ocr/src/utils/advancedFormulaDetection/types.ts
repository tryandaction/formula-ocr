/**
 * Advanced Formula Detection - Core Type Definitions
 * 高级公式检测 - 核心类型定义
 */

import type { FormulaRegion } from '../documentParser';

// ============================================================================
// Detection Options
// ============================================================================

export interface DetectionOptions {
  minConfidence?: number;        // 最小置信度阈值 (默认 0.75，提高以减少误检)
  includeInline?: boolean;       // 是否包含行内公式 (默认 true)
  includeDisplay?: boolean;      // 是否包含独立公式 (默认 true)
  resolution?: number;           // 渲染分辨率 DPI (默认 300)
  enablePreprocessing?: boolean; // 是否启用预处理 (默认 true)
  useDeepOptimization?: boolean; // 使用深度优化分类器 (默认 true)
}

export interface PageImage {
  pageNumber: number;
  imageData: string;
  width: number;
  height: number;
}

// ============================================================================
// Image Processing
// ============================================================================

export interface PreprocessOptions {
  targetDPI?: number;           // 目标分辨率 (默认 300)
  denoise?: boolean;            // 是否去噪 (默认 true)
  enhanceContrast?: boolean;    // 是否增强对比度 (默认 true)
  binarizationMethod?: 'otsu' | 'adaptive' | 'simple'; // 二值化方法
}

export interface ProcessedImage {
  imageData: ImageData;         // 处理后的图像
  binaryData: Uint8Array;       // 二值化数据
  width: number;
  height: number;
  scaleFactor: number;          // 缩放因子
}

export interface ImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: ImageData;
  binaryData: Uint8Array;
}

// ============================================================================
// Feature Extraction
// ============================================================================

export interface MathFeatures {
  // 符号特征
  hasGreekLetters: boolean;      // 是否包含希腊字母
  hasIntegralSymbols: boolean;   // 是否包含积分符号
  hasSummationSymbols: boolean;  // 是否包含求和符号
  hasFractionLines: boolean;     // 是否包含分数线
  hasSuperscripts: boolean;      // 是否包含上标
  hasSubscripts: boolean;        // 是否包含下标
  hasMatrixBrackets: boolean;    // 是否包含矩阵括号
  hasRootSymbols: boolean;       // 是否包含根号
  
  // 布局特征
  aspectRatio: number;           // 宽高比
  density: number;               // 像素密度
  verticalComplexity: number;    // 垂直复杂度 (多层结构)
  horizontalSpacing: number;     // 水平间距特征
  
  // 纹理特征
  edgeDensity: number;           // 边缘密度
  strokeWidth: number;           // 平均笔画宽度
  uniformity: number;            // 均匀性
  
  // 上下文特征
  surroundingTextDensity: number; // 周围文本密度
  verticalAlignment: 'top' | 'middle' | 'bottom' | 'isolated';
  horizontalAlignment: 'left' | 'center' | 'right';
}

export interface RegionContext {
  pageWidth: number;
  pageHeight: number;
  surroundingRegions: ImageRegion[];
  textLines: TextLine[];
}

export interface TextLine {
  y: number;
  height: number;
  text?: string;
}

// ============================================================================
// Classification
// ============================================================================

export type ContentType = 'formula' | 'image' | 'table' | 'text';

export interface ClassificationResult {
  type: ContentType;
  confidence: number;           // 0-1
  scores: {                     // 各类型的得分
    formula: number;
    image: number;
    table: number;
    text: number;
  };
  reasoning: string[];          // 分类依据
}

export type FormulaType = 'display' | 'inline';

export interface FormulaTypeResult {
  type: FormulaType;
  confidence: number;
  reasoning: string[];
}

// ============================================================================
// Boundary Detection
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface RefinedBoundary {
  x: number;
  y: number;
  width: number;
  height: number;
  contour: Point[];             // 精确轮廓点
  tightness: number;            // 边界紧密度 (0-1)
}

// ============================================================================
// Confidence Scoring
// ============================================================================

export interface ConfidenceScore {
  overall: number;              // 总体置信度 (0-1)
  breakdown: {
    featureMatch: number;       // 特征匹配度
    classificationCertainty: number; // 分类确定性
    boundaryClarity: number;    // 边界清晰度
    contextConsistency: number; // 上下文一致性
  };
  level: 'high' | 'medium' | 'low'; // 置信度等级
}

export interface DetectionCandidate {
  region: ImageRegion;
  boundary: RefinedBoundary;
  formulaType: FormulaTypeResult;
}

// ============================================================================
// Enhanced Formula Region
// ============================================================================

export interface EnhancedFormulaRegion extends FormulaRegion {
  // 新增字段
  contentType: ContentType;
  formulaType: FormulaType;
  confidence: ConfidenceScore;
  features: MathFeatures;
  classification: ClassificationResult;
  
  // 用户反馈
  userVerified?: boolean;
  userCorrected?: boolean;
  originalDetection?: EnhancedFormulaRegion; // 修正前的检测结果
}

// ============================================================================
// Detection Cache
// ============================================================================

export interface DetectionCache {
  pageNumber: number;
  detectionResults: EnhancedFormulaRegion[];
  timestamp: number;
  imageHash: string;            // 图像哈希，用于验证缓存有效性
  detectionOptions: DetectionOptions;
}

// ============================================================================
// Error Types
// ============================================================================

export type DetectionError = 
  | 'PREPROCESSING_FAILED'
  | 'FEATURE_EXTRACTION_FAILED'
  | 'CLASSIFICATION_FAILED'
  | 'BOUNDARY_DETECTION_FAILED'
  | 'INSUFFICIENT_QUALITY';

export interface DetectionErrorInfo {
  type: DetectionError;
  message: string;
  pageNumber?: number;
  recoverable: boolean;
}
