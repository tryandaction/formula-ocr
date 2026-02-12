/**
 * 统一识别引擎
 * 整合检测和识别，提供完整的端到端公式识别能力
 */

import type { PageData, FormulaInstance, ProcessingOptions } from './types';
import type { ProviderType } from '../providers/types';
import { WholePageProcessor } from './WholePageProcessor';
import { recognizeWithProvider } from '../providers';
import { DetectionError } from './errors';

/**
 * 识别结果
 */
export interface RecognizedFormula extends FormulaInstance {
  /** LaTeX内容 */
  latexContent: string;
  /** Markdown内容 */
  markdownContent: string;
  /** 识别是否成功 */
  recognitionSuccess: boolean;
  /** 识别错误信息 */
  recognitionError?: string;
  /** 识别耗时（毫秒） */
  recognitionTime?: number;
}

/**
 * 识别进度回调
 */
export interface RecognitionProgress {
  /** 总数 */
  total: number;
  /** 已完成 */
  completed: number;
  /** 当前识别的公式 */
  current?: RecognizedFormula;
  /** 进度百分比 */
  percentage: number;
}

/**
 * 识别选项
 */
export interface RecognitionOptions extends ProcessingOptions {
  /** 识别服务商 */
  provider: ProviderType;
  /** API密钥（可选，使用存储的密钥） */
  apiKey?: string;
  /** 并发识别数量 */
  concurrency?: number;
  /** 是否跳过低置信度公式 */
  skipLowConfidence?: boolean;
  /** 低置信度阈值 */
  lowConfidenceThreshold?: number;
}

/**
 * 统一识别引擎
 */
export class RecognitionEngine {
  private detector: WholePageProcessor;
  private recognitionCache: Map<string, RecognizedFormula>;

  constructor() {
    this.detector = new WholePageProcessor();
    this.recognitionCache = new Map();
  }

  /**
   * 识别整页公式（完整流程）
   * 
   * @param pageData - 页面数据
   * @param options - 识别选项
   * @param onProgress - 进度回调
   * @returns 识别结果数组
   */
  async recognizeWholePage(
    pageData: PageData,
    options: RecognitionOptions,
    onProgress?: (progress: RecognitionProgress) => void
  ): Promise<RecognizedFormula[]> {
    try {
      // 1. 检测公式位置
      const detectedFormulas = await this.detector.processWholePage(pageData, options);

      if (detectedFormulas.length === 0) {
        return [];
      }

      // 2. 过滤低置信度公式（如果启用）
      const formulasToRecognize = options.skipLowConfidence
        ? detectedFormulas.filter(
            (f) => f.confidence >= (options.lowConfidenceThreshold || 0.5)
          )
        : detectedFormulas;

      // 3. 批量识别
      const recognizedFormulas = await this.batchRecognize(
        formulasToRecognize,
        pageData,
        options,
        onProgress
      );

      return recognizedFormulas;
    } catch (error) {
      throw new DetectionError(
        `Failed to recognize whole page: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 批量识别公式
   * 
   * @param formulas - 检测到的公式数组
   * @param pageData - 页面数据
   * @param options - 识别选项
   * @param onProgress - 进度回调
   * @returns 识别结果数组
   */
  async batchRecognize(
    formulas: FormulaInstance[],
    pageData: PageData,
    options: RecognitionOptions,
    onProgress?: (progress: RecognitionProgress) => void
  ): Promise<RecognizedFormula[]> {
    const total = formulas.length;
    const results: RecognizedFormula[] = [];
    const concurrency = options.concurrency || 2;

    // 分组处理
    for (let i = 0; i < formulas.length; i += concurrency) {
      const batch = formulas.slice(i, Math.min(i + concurrency, formulas.length));

      // 并行识别当前批次
      const batchResults = await Promise.all(
        batch.map((formula) => this.recognizeSingleFormula(formula, pageData, options))
      );

      results.push(...batchResults);

      // 更新进度
      if (onProgress) {
        onProgress({
          total,
          completed: results.length,
          current: batchResults[batchResults.length - 1],
          percentage: (results.length / total) * 100,
        });
      }

      // 避免请求过快，添加延迟
      if (i + concurrency < formulas.length) {
        await this.delay(500);
      }
    }

    return results;
  }

  /**
   * 识别单个公式
   * 
   * @param formula - 公式实例
   * @param pageData - 页面数据
   * @param options - 识别选项
   * @returns 识别结果
   */
  private async recognizeSingleFormula(
    formula: FormulaInstance,
    pageData: PageData,
    options: RecognitionOptions
  ): Promise<RecognizedFormula> {
    const startTime = Date.now();

    try {
      // 1. 裁剪公式图像
      const formulaImage = this.cropFormulaImage(pageData.imageData, formula.boundingBox);

      // 2. 检查缓存
      const cacheKey = this.generateCacheKey(formulaImage);
      const cached = this.recognitionCache.get(cacheKey);
      if (cached) {
        return { ...cached, id: formula.id };
      }

      // 3. 调用识别API
      const latex = await recognizeWithProvider(
        formulaImage,
        options.provider,
        options.apiKey
      );

      // 4. 生成Markdown
      const markdown = this.latexToMarkdown(latex, formula.type);

      // 5. 创建识别结果
      const recognized: RecognizedFormula = {
        ...formula,
        latexContent: latex,
        markdownContent: markdown,
        recognitionSuccess: true,
        recognitionTime: Date.now() - startTime,
      };

      // 6. 缓存结果
      this.recognitionCache.set(cacheKey, recognized);

      return recognized;
    } catch (error) {
      // 识别失败，返回带错误信息的结果
      return {
        ...formula,
        latexContent: '',
        markdownContent: '',
        recognitionSuccess: false,
        recognitionError: error instanceof Error ? error.message : 'Recognition failed',
        recognitionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 从整页图像中裁剪公式区域
   * 
   * @param pageImageData - 页面图像数据
   * @param boundingBox - 边界框
   * @returns Base64编码的公式图像
   */
  private cropFormulaImage(
    pageImageData: ImageData,
    boundingBox: FormulaInstance['boundingBox']
  ): string {
    // 创建临时canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // 添加边距（10像素）
    const padding = 10;
    const cropX = Math.max(0, boundingBox.x - padding);
    const cropY = Math.max(0, boundingBox.y - padding);
    const cropWidth = Math.min(
      boundingBox.width + padding * 2,
      pageImageData.width - cropX
    );
    const cropHeight = Math.min(
      boundingBox.height + padding * 2,
      pageImageData.height - cropY
    );

    // 设置canvas尺寸
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // 创建临时canvas用于绘制完整页面
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) {
      throw new Error('Failed to get temp canvas context');
    }

    tempCanvas.width = pageImageData.width;
    tempCanvas.height = pageImageData.height;

    // 将ImageData绘制到临时canvas
    tempCtx.putImageData(pageImageData, 0, 0);

    // 裁剪区域到目标canvas
    ctx.drawImage(
      tempCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    // 转换为base64
    return canvas.toDataURL('image/png');
  }

  /**
   * LaTeX转Markdown
   * 
   * @param latex - LaTeX内容
   * @param formulaType - 公式类型
   * @returns Markdown内容
   */
  private latexToMarkdown(latex: string, formulaType: string): string {
    // 行内公式
    if (formulaType === 'inline') {
      return `$${latex}$`;
    }

    // 独立公式
    return `$$\n${latex}\n$$`;
  }

  /**
   * 生成缓存键
   * 
   * @param imageData - 图像数据
   * @returns 缓存键
   */
  private generateCacheKey(imageData: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < imageData.length; i++) {
      const char = imageData.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * 延迟函数
   * 
   * @param ms - 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.recognitionCache.clear();
  }

  /**
   * 取消识别
   */
  cancel(): void {
    this.detector.cancelProcessing();
  }
}
