/**
 * 检测优化器
 * 封装优化后的检测算法，减少误检和漏检
 */

import type { DetectionRegion, RawDetection, DetectionOptions, FormulaFeatures } from './types';
import { DEFAULT_DETECTION_OPTIONS } from './types';

/**
 * 检测优化器实现
 */
export class DetectionOptimizer {
  /** 最小公式尺寸 */
  private readonly MIN_FORMULA_SIZE = 20;
  
  /** 最大公式尺寸（相对于页面） */
  private readonly MAX_FORMULA_RATIO: number = 0.5;
  
  /** 大区域像素阈值（超过则优先文本层检测，避免重计算） */
  private readonly LARGE_REGION_PIXELS = 1_200_000;
  
  /** 文本层检测 padding */
  private readonly TEXT_PADDING = 6;

  /**
   * 在指定区域检测公式
   * 
   * @param region - 检测区域
   * @param options - 检测选项
   * @returns 初步检测结果
   */
  async detectFormulas(
    region: DetectionRegion,
    options: Partial<DetectionOptions> = {}
  ): Promise<RawDetection[]> {
    const opts = { ...DEFAULT_DETECTION_OPTIONS, ...options };
    
    try {
      // 大区域优先用文本层快速检测，避免图像级重计算
      const regionPixels = region.width * region.height;
      const textDetections = this.detectFromTextLayer(region);
      if (textDetections.length > 0 && regionPixels > this.LARGE_REGION_PIXELS) {
        return textDetections;
      }
      if (textDetections.length === 0 && this.isLikelyBlank(region.imageData)) {
        return [];
      }

      // 集成高级公式检测器
      const { AdvancedFormulaDetector } = await import('../advancedFormulaDetection');
      const detector = new AdvancedFormulaDetector();
      
      // 从区域图像数据创建canvas
      const canvas = document.createElement('canvas');
      canvas.width = region.width;
      canvas.height = region.height;
      const ctx = canvas.getContext('2d')!;
      
      // 绘制区域图像
      if (region.imageData) {
        ctx.putImageData(region.imageData, 0, 0);
      }
      
      // 转换为base64
      const imageBase64 = canvas.toDataURL('image/png');
      
      // 调用高级检测器
      const detectedRegions = await detector.detectFormulas(imageBase64, 1);
      
      // 转换为RawDetection格式
      const detections: RawDetection[] = detectedRegions.map((detected, idx) => ({
        id: `detection_${region.x}_${region.y}_${idx}`,
        boundingBox: {
          x: region.x + detected.position.x,
          y: region.y + detected.position.y,
          width: detected.position.width,
          height: detected.position.height,
          rotation: 0,
        },
        confidence: typeof detected.confidence === 'number' ? detected.confidence : detected.confidence.overall,
        type: detected.formulaType === 'display' ? 'display' : 'inline',
        features: {
          mathSymbolCount: detected.features?.hasIntegralSymbols || detected.features?.hasSummationSymbols ? 5 : 0,
          greekLetterCount: detected.features?.hasGreekLetters ? 3 : 0,
          operatorCount: detected.features?.hasIntegralSymbols || detected.features?.hasSummationSymbols ? 2 : 0,
          usesMathFont: detected.features?.hasGreekLetters || false,
          hasFractionStructure: detected.features?.hasFractionLines || false,
          hasScripts: detected.features?.hasSuperscripts || detected.features?.hasSubscripts || false,
          hasRoots: detected.features?.hasRootSymbols || false,
          hasLargeOperators: detected.features?.hasIntegralSymbols || detected.features?.hasSummationSymbols || false,
          hasBracketPairs: detected.features?.hasMatrixBrackets || false,
        },
      }));
      
      if (detections.length === 0 && textDetections.length > 0) {
        return textDetections;
      }

      return detections;
    } catch (error) {
      console.error('Detection failed:', error);
      // 如果高级检测失败，返回空数组
      return [];
    }
  }

  /**
   * 验证检测结果，过滤误检
   * 
   * @param detections - 初步检测结果
   * @returns 验证后的检测结果
   */
  validateDetections(detections: RawDetection[]): RawDetection[] {
    return detections.filter(detection => {
      // 1. 特征验证：检查是否包含数学符号或公式特征
      if (!this.hasFormulaFeatures(detection.features)) {
        return false;
      }

      // 2. 尺寸过滤：过滤过小或过大的检测
      if (!this.isValidSize(detection)) {
        return false;
      }

      // 3. 置信度过滤：过滤低置信度检测
      if (detection.confidence < 0.3) {
        return false;
      }

      return true;
    });
  }

  /**
   * 增强检测以减少漏检
   * 
   * @param region - 检测区域
   * @param initialDetections - 初步检测结果
   * @returns 增强后的检测结果
   */
  async enhanceDetection(
    _region: DetectionRegion,
    initialDetections: RawDetection[]
  ): Promise<RawDetection[]> {
    const enhanced = [...initialDetections];
    
    // 1. 多尺度检测（在不同缩放级别检测）
    // 2. 文本层分析（从PDF文本层提取数学符号密集区域）
    // 3. 模式匹配（使用正则表达式匹配常见公式模式）
    // 4. 边缘增强（对低对比度区域进行增强）
    // 5. 二次扫描（对空白区域精细扫描）
    
    // 暂时返回原始检测结果
    return enhanced;
  }

  /**
   * 检查是否包含公式特征
   */
  private hasFormulaFeatures(features: FormulaFeatures): boolean {
    // 至少满足以下条件之一：
    // 1. 包含数学符号
    if (features.mathSymbolCount > 0) return true;
    
    // 2. 使用数学字体
    if (features.usesMathFont) return true;
    
    // 3. 包含希腊字母
    if (features.greekLetterCount > 0) return true;
    
    // 4. 包含数学结构
    if (features.hasFractionStructure || 
        features.hasScripts || 
        features.hasRoots || 
        features.hasLargeOperators) {
      return true;
    }
    
    return false;
  }

  /**
   * 检查尺寸是否合理
   */
  private isValidSize(detection: RawDetection): boolean {
    const { width, height } = detection.boundingBox;
    
    // 过小
    if (width < this.MIN_FORMULA_SIZE || height < this.MIN_FORMULA_SIZE / 2) {
      return false;
    }
    
    // 过大（相对于页面）
    // 注意：这里需要页面尺寸信息，暂时使用绝对值
    if (width > 1000 || height > 500) {
      return false;
    }
    
    return true;
  }

  private detectFromTextLayer(region: DetectionRegion): RawDetection[] {
    const items = region.textData?.items ?? [];
    if (items.length === 0) {
      return [];
    }

    const detections: RawDetection[] = [];
    for (const item of items) {
      const text = item.str || '';
      const style = region.textData.styles[item.fontName];
      const hasMathFont = Boolean(style?.isMathFont);
      const mathSymbolCount = this.countMathSymbols(text);
      const greekLetterCount = this.countGreekLetters(text);
      const isMathText = hasMathFont || mathSymbolCount > 0 || greekLetterCount > 0;

      if (!isMathText) {
        continue;
      }

      const baseWidth = Math.max(item.width, this.MIN_FORMULA_SIZE);
      const baseHeight = Math.max(item.height, this.MIN_FORMULA_SIZE / 2);
      const rawX = item.transform[4];
      const rawY = item.transform[5] - baseHeight;
      const x = Math.max(region.x, Math.floor(rawX - this.TEXT_PADDING));
      const y = Math.max(region.y, Math.floor(rawY - this.TEXT_PADDING));
      const width = Math.min(
        region.x + region.width - x,
        Math.ceil(baseWidth + this.TEXT_PADDING * 2)
      );
      const height = Math.min(
        region.y + region.height - y,
        Math.ceil(baseHeight + this.TEXT_PADDING * 2)
      );

      detections.push({
        id: `text_${region.x}_${region.y}_${detections.length}`,
        boundingBox: {
          x,
          y,
          width,
          height,
          rotation: 0,
        },
        confidence: hasMathFont ? 0.85 : 0.7,
        type: 'inline',
        features: {
          mathSymbolCount,
          greekLetterCount,
          operatorCount: mathSymbolCount,
          usesMathFont: hasMathFont,
          hasFractionStructure: /[\/]/.test(text),
          hasScripts: /[_^]/.test(text),
          hasRoots: /√/.test(text),
          hasLargeOperators: /[∫∑]/.test(text),
          hasBracketPairs: /[()\\[\\]{\}]/.test(text),
        },
      });
    }

    return detections;
  }

  private countMathSymbols(text: string): number {
    const matches = text.match(/[=+\-*/^_]|\\[a-zA-Z]+|[∑∫∞≈≠≤≥√]/g);
    return matches ? matches.length : 0;
  }

  private countGreekLetters(text: string): number {
    const matches = text.match(/[α-ωΑ-Ω]/g);
    return matches ? matches.length : 0;
  }

  private isLikelyBlank(imageData: ImageData): boolean {
    const { data, width, height } = imageData;
    if (width === 0 || height === 0) {
      return true;
    }
    const total = width * height;
    const targetSamples = 4000;
    const step = Math.max(1, Math.floor(Math.sqrt(total / targetSamples)));

    let min = 255;
    let max = 0;
    let sum = 0;
    let count = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        min = Math.min(min, gray);
        max = Math.max(max, gray);
        sum += gray;
        count++;
      }
    }

    if (count === 0) {
      return true;
    }

    const avg = sum / count;
    const range = max - min;
    return range < 6 && (avg < 10 || avg > 245);
  }
}
