/**
 * 整页公式识别系统 - 接口定义
 * 
 * 本文件定义了系统各组件的接口契约。
 * 这些接口描述了组件应该提供的功能和方法签名。
 */

import type {
  PageData,
  ProcessingOptions,
  FormulaInstance,
  DetectionRegion,
  RawDetection,
  DetectionOptions,
  BoundingBox,
  DetectionContext,
  ConversionOptions,
} from './types';

/**
 * 整页处理器接口
 * 负责协调整页公式检测流程
 */
export interface IWholePageProcessor {
  /**
   * 处理整个PDF页面，返回所有检测到的公式
   * @param pageData - PDF页面数据（包含图像和文本层）
   * @param options - 处理选项（置信度阈值、性能模式等）
   * @returns 公式实例数组
   */
  processWholePage(
    pageData: PageData,
    options?: Partial<ProcessingOptions>
  ): Promise<FormulaInstance[]>;

  /**
   * 取消正在进行的处理任务
   */
  cancelProcessing(): void;

  /**
   * 获取处理进度（0-100）
   */
  getProgress(): number;
}

/**
 * 批处理管理器接口
 * 负责管理批量检测任务
 */
export interface IBatchProcessingManager {
  /**
   * 将页面划分为多个检测区域
   * @param pageData - 页面数据
   * @returns 检测区域数组
   */
  divideIntoRegions(pageData: PageData): DetectionRegion[];

  /**
   * 并行处理多个区域
   * @param regions - 检测区域数组
   * @param processor - 处理函数
   * @returns 处理结果数组
   */
  processRegionsInParallel<T>(
    regions: DetectionRegion[],
    processor: (region: DetectionRegion) => Promise<T>
  ): Promise<T[]>;

  /**
   * 合并重叠区域的检测结果
   * @param results - 各区域的检测结果
   * @returns 去重后的公式实例数组
   */
  mergeResults(results: FormulaInstance[][]): FormulaInstance[];
}

/**
 * 检测优化器接口
 * 负责封装优化后的检测算法
 */
export interface IDetectionOptimizer {
  /**
   * 在指定区域检测公式
   * @param region - 检测区域
   * @param options - 检测选项
   * @returns 初步检测结果
   */
  detectFormulas(
    region: DetectionRegion,
    options?: Partial<DetectionOptions>
  ): Promise<RawDetection[]>;

  /**
   * 验证检测结果，过滤误检
   * @param detections - 初步检测结果
   * @returns 验证后的检测结果
   */
  validateDetections(detections: RawDetection[]): RawDetection[];

  /**
   * 增强检测以减少漏检
   * @param region - 检测区域
   * @param initialDetections - 初步检测结果
   * @returns 增强后的检测结果
   */
  enhanceDetection(
    region: DetectionRegion,
    initialDetections: RawDetection[]
  ): Promise<RawDetection[]>;
}

/**
 * 边界定位器接口
 * 负责精确定位公式边界
 */
export interface IBoundaryLocator {
  /**
   * 精炼公式边界框
   * @param detection - 初步检测结果
   * @param imageData - 原始图像数据
   * @returns 精炼后的边界框
   */
  refineBoundary(
    detection: RawDetection,
    imageData: ImageData
  ): BoundingBox;

  /**
   * 批量精炼多个边界框
   * @param detections - 初步检测结果数组
   * @param imageData - 原始图像数据
   * @returns 精炼后的边界框数组
   */
  refineBoundariesBatch(
    detections: RawDetection[],
    imageData: ImageData
  ): BoundingBox[];

  /**
   * 检测并修正边界框重叠
   * @param boundingBoxes - 边界框数组
   * @returns 修正后的边界框数组
   */
  resolveOverlaps(boundingBoxes: BoundingBox[]): BoundingBox[];
}

/**
 * 置信度评分器接口
 * 负责计算检测结果的置信度
 */
export interface IConfidenceScorer {
  /**
   * 计算单个检测的置信度
   * @param detection - 检测结果
   * @param context - 上下文信息
   * @returns 置信度分数（0-1）
   */
  calculateConfidence(
    detection: RawDetection,
    context: DetectionContext
  ): number;

  /**
   * 批量计算置信度
   * @param detections - 检测结果数组
   * @param context - 上下文信息
   * @returns 置信度分数数组
   */
  calculateConfidenceBatch(
    detections: RawDetection[],
    context: DetectionContext
  ): number[];
}

/**
 * 格式转换器接口
 * 负责将公式图像转换为LaTeX或Markdown格式
 */
export interface IFormatConverter {
  /**
   * 将公式图像转换为LaTeX
   * @param imageData - 公式图像数据
   * @param options - 转换选项
   * @returns LaTeX字符串
   */
  imageToLatex(
    imageData: string,
    options?: Partial<ConversionOptions>
  ): Promise<string>;

  /**
   * 将公式图像转换为Markdown
   * @param imageData - 公式图像数据
   * @param options - 转换选项
   * @returns Markdown字符串
   */
  imageToMarkdown(
    imageData: string,
    options?: Partial<ConversionOptions>
  ): Promise<string>;

  /**
   * 验证LaTeX语法
   * @param latex - LaTeX字符串
   * @returns 是否有效
   */
  validateLatex(latex: string): boolean;

  /**
   * 验证Markdown语法
   * @param markdown - Markdown字符串
   * @returns 是否有效
   */
  validateMarkdown(markdown: string): boolean;
}

/**
 * 剪贴板管理器接口
 * 负责管理剪贴板操作
 */
export interface IClipboardManager {
  /**
   * 复制文本到剪贴板
   * @param text - 要复制的文本
   * @returns 是否成功
   */
  copyText(text: string): Promise<boolean>;

  /**
   * 复制图像到剪贴板
   * @param imageData - 要复制的图像
   * @returns 是否成功
   */
  copyImage(imageData: string): Promise<boolean>;

  /**
   * 检查剪贴板API是否可用
   * @returns 是否可用
   */
  isAvailable(): boolean;
}

/**
 * 操作管理器接口
 * 负责处理单个公式的复制和编辑操作
 */
export interface IOperationManager {
  /**
   * 复制公式为LaTeX格式
   * @param formula - 公式实例
   * @returns 是否成功
   */
  copyAsLatex(formula: FormulaInstance): Promise<boolean>;

  /**
   * 复制公式为Markdown格式
   * @param formula - 公式实例
   * @returns 是否成功
   */
  copyAsMarkdown(formula: FormulaInstance): Promise<boolean>;

  /**
   * 编辑公式
   * @param formula - 公式实例
   * @param newContent - 新的LaTeX或Markdown内容
   * @returns 更新后的公式实例
   */
  editFormula(
    formula: FormulaInstance,
    newContent: string
  ): Promise<FormulaInstance>;

  /**
   * 批量导出公式
   * @param formulas - 公式实例数组
   * @param format - 导出格式
   * @returns 导出内容
   */
  exportFormulas(
    formulas: FormulaInstance[],
    format: 'latex' | 'markdown' | 'json'
  ): string;
}

/**
 * 缓存管理器接口
 * 负责管理检测结果的缓存
 */
export interface ICacheManager {
  /**
   * 保存检测结果到缓存
   * @param pageNumber - 页码
   * @param formulas - 公式实例数组
   * @param pageHash - 页面内容哈希
   */
  saveToCache(
    pageNumber: number,
    formulas: FormulaInstance[],
    pageHash: string
  ): void;

  /**
   * 从缓存加载检测结果
   * @param pageNumber - 页码
   * @param pageHash - 页面内容哈希
   * @returns 公式实例数组或null（如果缓存无效）
   */
  loadFromCache(
    pageNumber: number,
    pageHash: string
  ): FormulaInstance[] | null;

  /**
   * 清除缓存
   * @param pageNumber - 页码（可选，如果不提供则清除所有缓存）
   */
  clearCache(pageNumber?: number): void;

  /**
   * 验证缓存是否有效
   * @param pageNumber - 页码
   * @param pageHash - 页面内容哈希
   * @returns 是否有效
   */
  isCacheValid(pageNumber: number, pageHash: string): boolean;
}
