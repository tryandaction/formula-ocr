/**
 * Advanced Formula Detection - Core Interfaces
 * 高级公式检测 - 核心接口定义
 */

import type {
  DetectionOptions,
  PageImage,
  EnhancedFormulaRegion,
  PreprocessOptions,
  ProcessedImage,
  ImageRegion,
  MathFeatures,
  RegionContext,
  ClassificationResult,
  FormulaTypeResult,
  RefinedBoundary,
  ConfidenceScore,
  DetectionCandidate,
  DetectionCache,
} from './types';

// ============================================================================
// Main Detector Interface
// ============================================================================

export interface IAdvancedFormulaDetector {
  /**
   * 检测页面中的所有公式
   * @param pageImage - 页面图像的 base64 数据
   * @param pageNumber - 页面编号
   * @param options - 检测选项
   * @returns 检测到的公式列表
   */
  detectFormulas(
    pageImage: string,
    pageNumber: number,
    options?: DetectionOptions
  ): Promise<EnhancedFormulaRegion[]>;

  /**
   * 批量检测多个页面
   * @param pages - 页面图像数组
   * @param onProgress - 进度回调
   * @returns 所有页面的检测结果
   */
  detectMultiplePages(
    pages: PageImage[],
    onProgress?: (progress: number) => void
  ): Promise<Map<number, EnhancedFormulaRegion[]>>;
}

// ============================================================================
// Page Preprocessor Interface
// ============================================================================

export interface IPagePreprocessor {
  /**
   * 预处理页面图像
   * @param imageData - 原始图像数据
   * @param options - 预处理选项
   * @returns 处理后的图像数据
   */
  preprocess(
    imageData: ImageData,
    options?: PreprocessOptions
  ): ProcessedImage;

  /**
   * 提升图像分辨率
   * @param imageData - 原始图像数据
   * @param targetDPI - 目标 DPI
   * @returns 提升后的图像数据
   */
  upscaleImage(imageData: ImageData, targetDPI: number): ImageData;

  /**
   * 去噪处理
   * @param imageData - 图像数据
   * @returns 去噪后的图像数据
   */
  denoiseImage(imageData: ImageData): ImageData;

  /**
   * 增强对比度
   * @param imageData - 图像数据
   * @returns 增强后的图像数据
   */
  enhanceContrast(imageData: ImageData): ImageData;

  /**
   * 二值化处理
   * @param imageData - 图像数据
   * @param method - 二值化方法
   * @returns 二值化数据
   */
  binarize(
    imageData: ImageData,
    method: 'otsu' | 'adaptive' | 'simple'
  ): Uint8Array;
}

// ============================================================================
// Feature Extractor Interface
// ============================================================================

export interface IFeatureExtractor {
  /**
   * 提取区域的数学特征
   * @param region - 图像区域
   * @param context - 上下文信息
   * @returns 提取的特征
   */
  extractFeatures(
    region: ImageRegion,
    context: RegionContext
  ): MathFeatures;

  /**
   * 检测希腊字母
   * @param region - 图像区域
   * @returns 是否包含希腊字母
   */
  detectGreekLetters(region: ImageRegion): boolean;

  /**
   * 检测积分符号
   * @param region - 图像区域
   * @returns 是否包含积分符号
   */
  detectIntegralSymbols(region: ImageRegion): boolean;

  /**
   * 检测求和符号
   * @param region - 图像区域
   * @returns 是否包含求和符号
   */
  detectSummationSymbols(region: ImageRegion): boolean;

  /**
   * 检测分数线
   * @param region - 图像区域
   * @returns 是否包含分数线
   */
  detectFractionLines(region: ImageRegion): boolean;

  /**
   * 检测上下标
   * @param region - 图像区域
   * @returns 上下标检测结果
   */
  detectScripts(region: ImageRegion): {
    hasSuperscripts: boolean;
    hasSubscripts: boolean;
  };

  /**
   * 检测矩阵括号
   * @param region - 图像区域
   * @returns 是否包含矩阵括号
   */
  detectMatrixBrackets(region: ImageRegion): boolean;

  /**
   * 检测根号
   * @param region - 图像区域
   * @returns 是否包含根号
   */
  detectRootSymbols(region: ImageRegion): boolean;
}

// ============================================================================
// Content Classifier Interface
// ============================================================================

export interface IContentClassifier {
  /**
   * 分类图像区域的内容类型
   * @param region - 图像区域
   * @param features - 提取的特征
   * @returns 分类结果
   */
  classify(
    region: ImageRegion,
    features: MathFeatures
  ): ClassificationResult;

  /**
   * 检测网格线（用于表格识别）
   * @param region - 图像区域
   * @returns 是否包含网格线
   */
  detectGridLines(region: ImageRegion): boolean;

  /**
   * 生成分类推理
   * @param classification - 分类结果
   * @returns 人类可读的分类依据
   */
  generateReasoning(classification: ClassificationResult): string[];
}

// ============================================================================
// Formula Type Classifier Interface
// ============================================================================

export interface IFormulaTypeClassifier {
  /**
   * 判断公式类型 (行内/独立)
   * @param region - 公式区域
   * @param context - 上下文信息
   * @returns 公式类型
   */
  classifyFormulaType(
    region: ImageRegion,
    context: RegionContext
  ): FormulaTypeResult;
}

// ============================================================================
// Boundary Detector Interface
// ============================================================================

export interface IBoundaryDetector {
  /**
   * 精确检测公式边界
   * @param region - 初步检测的区域
   * @param processedImage - 预处理后的图像
   * @returns 精确的边界
   */
  refineBoundary(
    region: ImageRegion,
    processedImage: ProcessedImage
  ): RefinedBoundary;
}

// ============================================================================
// Confidence Scorer Interface
// ============================================================================

export interface IConfidenceScorer {
  /**
   * 计算检测结果的置信度
   * @param detection - 检测结果
   * @param features - 特征
   * @param classification - 分类结果
   * @returns 置信度分数
   */
  calculateConfidence(
    detection: DetectionCandidate,
    features: MathFeatures,
    classification: ClassificationResult
  ): ConfidenceScore;
}

// ============================================================================
// Detection Cache Manager Interface
// ============================================================================

export interface IDetectionCacheManager {
  /**
   * 设置缓存
   * @param pageNumber - 页码
   * @param results - 检测结果
   * @param imageHash - 图像哈希
   */
  set(
    pageNumber: number,
    results: EnhancedFormulaRegion[],
    imageHash: string
  ): void;

  /**
   * 获取缓存
   * @param pageNumber - 页码
   * @param imageHash - 图像哈希
   * @returns 缓存的检测结果，如果不存在或失效则返回 null
   */
  get(
    pageNumber: number,
    imageHash: string
  ): EnhancedFormulaRegion[] | null;

  /**
   * 清除指定页面的缓存
   * @param pageNumber - 页码（可选，不传则清除所有）
   */
  clear(pageNumber?: number): void;

  /**
   * 清除所有缓存
   */
  clearAll(): void;

  /**
   * 获取所有缓存
   * @returns 所有缓存数据
   */
  getAll(): DetectionCache[];
}
