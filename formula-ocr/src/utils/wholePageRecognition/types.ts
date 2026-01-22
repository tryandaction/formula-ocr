/**
 * 整页公式识别系统 - 核心类型定义
 * 
 * 本文件定义了整页公式识别系统的所有核心类型和接口。
 * 这些类型用于在系统各组件之间传递数据和定义契约。
 */

/**
 * 边界框
 * 定义公式在页面中的位置和大小
 */
export interface BoundingBox {
  /** 左上角X坐标（像素） */
  x: number;
  /** 左上角Y坐标（像素） */
  y: number;
  /** 宽度（像素） */
  width: number;
  /** 高度（像素） */
  height: number;
  /** 旋转角度（度，0-360） */
  rotation: number;
}

/**
 * 公式类型
 */
export type FormulaType = 'inline' | 'display' | 'numbered';

/**
 * 公式元数据
 * 描述公式的结构特征
 */
export interface FormulaMetadata {
  /** 是否包含下标 */
  hasSubscript: boolean;
  /** 是否包含上标 */
  hasSuperscript: boolean;
  /** 是否包含分式 */
  hasFraction: boolean;
  /** 是否包含积分 */
  hasIntegral: boolean;
  /** 是否包含求和 */
  hasSummation: boolean;
  /** 是否包含矩阵 */
  hasMatrix: boolean;
  /** 是否包含希腊字母 */
  hasGreekLetters: boolean;
  /** 复杂度等级 */
  complexity: 'simple' | 'medium' | 'complex';
}

/**
 * 公式实例
 * 表示检测到的单个公式及其所有相关信息
 */
export interface FormulaInstance {
  /** 唯一标识符 */
  id: string;
  /** 边界框 */
  boundingBox: BoundingBox;
  /** 置信度（0-1） */
  confidence: number;
  /** 公式类型 */
  type: FormulaType;
  /** 公式图像数据（base64） */
  imageData: string;
  /** LaTeX表示（如果已转换） */
  latexContent?: string;
  /** Markdown表示（如果已转换） */
  markdownContent?: string;
  /** 所在页码 */
  pageNumber: number;
  /** 检测时间戳 */
  detectionTimestamp: number;
  /** 元数据 */
  metadata: FormulaMetadata;
}

/**
 * PDF文本层数据
 * 从PDF提取的文本信息
 */
export interface TextLayerData {
  /** 文本项数组 */
  items: TextItem[];
  /** 文本样式信息 */
  styles: Record<string, TextStyle>;
}

/**
 * 文本项
 */
export interface TextItem {
  /** 文本内容 */
  str: string;
  /** 变换矩阵 */
  transform: number[];
  /** 宽度 */
  width: number;
  /** 高度 */
  height: number;
  /** 字体名称 */
  fontName: string;
}

/**
 * 文本样式
 */
export interface TextStyle {
  /** 字体族 */
  fontFamily: string;
  /** 是否为数学字体 */
  isMathFont: boolean;
}

/**
 * 页面数据
 * 包含PDF页面的所有必要信息
 */
export interface PageData {
  /** 页面图像数据 */
  imageData: ImageData;
  /** PDF文本层数据 */
  textLayer: TextLayerData;
  /** 页面宽度（像素） */
  width: number;
  /** 页面高度（像素） */
  height: number;
  /** 页码 */
  pageNumber: number;
}

/**
 * 性能模式
 */
export type PerformanceMode = 'fast' | 'balanced' | 'accurate';

/**
 * 处理选项
 * 控制整页处理的行为
 */
export interface ProcessingOptions {
  /** 置信度阈值（0-1） */
  confidenceThreshold: number;
  /** 性能模式 */
  performanceMode: PerformanceMode;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 最大检测公式数（防止过度检测） */
  maxFormulas: number;
}

/**
 * 检测区域
 * 用于批处理的页面子区域
 */
export interface DetectionRegion {
  /** 区域左上角X坐标 */
  x: number;
  /** 区域左上角Y坐标 */
  y: number;
  /** 区域宽度 */
  width: number;
  /** 区域高度 */
  height: number;
  /** 区域图像数据 */
  imageData: ImageData;
  /** 区域文本数据 */
  textData: TextLayerData;
  /** 与相邻区域的重叠边距 */
  overlapMargin: number;
}

/**
 * 检测选项
 */
export interface DetectionOptions {
  /** 是否检测行内公式 */
  detectInline: boolean;
  /** 是否检测独立公式 */
  detectDisplay: boolean;
  /** 是否检测编号公式 */
  detectNumbered: boolean;
  /** 最小公式宽度（像素） */
  minFormulaWidth: number;
  /** 最小公式高度（像素） */
  minFormulaHeight: number;
}

/**
 * 公式特征
 * 用于检测和分类的特征
 */
export interface FormulaFeatures {
  /** 数学符号数量 */
  mathSymbolCount: number;
  /** 是否使用数学字体 */
  usesMathFont: boolean;
  /** 希腊字母数量 */
  greekLetterCount: number;
  /** 是否包含分式结构 */
  hasFractionStructure: boolean;
  /** 是否包含上下标 */
  hasScripts: boolean;
  /** 是否包含根号 */
  hasRoots: boolean;
  /** 是否包含积分/求和 */
  hasLargeOperators: boolean;
  /** 是否包含括号配对 */
  hasBracketPairs: boolean;
}

/**
 * 初步检测结果
 * 在优化和精炼之前的检测结果
 */
export interface RawDetection {
  /** 初步边界框 */
  boundingBox: BoundingBox;
  /** 初步置信度 */
  confidence: number;
  /** 提取的特征 */
  features: FormulaFeatures;
  /** 公式类型 */
  type: FormulaType;
}

/**
 * 检测上下文
 * 用于置信度计算的上下文信息
 */
export interface DetectionContext {
  /** 页面类型 */
  pageType: 'academic' | 'textbook' | 'general';
  /** 页面公式密度 */
  formulaDensity: number;
  /** 平均公式大小 */
  averageFormulaSize: number;
  /** 文本质量（0-1） */
  textQuality: number;
}

/**
 * 转换选项
 * 控制格式转换的行为
 */
export interface ConversionOptions {
  /** 是否使用行内数学模式（$...$） */
  useInlineMath: boolean;
  /** 是否使用独立数学模式（$$...$$） */
  useDisplayMath: boolean;
  /** 是否简化输出 */
  simplifyOutput: boolean;
  /** 是否保留空格 */
  preserveSpacing: boolean;
}

/**
 * 检测缓存
 * 用于缓存页面的检测结果
 */
export interface DetectionCache {
  /** 页码 */
  pageNumber: number;
  /** 公式实例数组 */
  formulas: FormulaInstance[];
  /** 缓存时间戳 */
  cacheTimestamp: number;
  /** 页面内容哈希（用于验证缓存有效性） */
  pageHash: string;
}

/**
 * 部分结果
 * 当部分检测失败时返回的结果
 */
export interface PartialResult<T> {
  /** 成功的数据 */
  data: T[];
  /** 错误列表 */
  errors: Error[];
  /** 完成率（0-1） */
  completionRate: number;
}

/**
 * 默认处理选项
 */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  confidenceThreshold: 0.75,
  performanceMode: 'balanced',
  enableCache: true,
  maxFormulas: 100,
};

/**
 * 默认检测选项
 */
export const DEFAULT_DETECTION_OPTIONS: DetectionOptions = {
  detectInline: true,
  detectDisplay: true,
  detectNumbered: true,
  minFormulaWidth: 20,
  minFormulaHeight: 10,
};

/**
 * 默认转换选项
 */
export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  useInlineMath: true,
  useDisplayMath: true,
  simplifyOutput: false,
  preserveSpacing: true,
};
