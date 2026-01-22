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

  /**
   * 在指定区域检测公式
   * 
   * @param region - 检测区域
   * @param options - 检测选项
   * @returns 初步检测结果
   */
  async detectFormulas(
    _region: DetectionRegion,
    _options: Partial<DetectionOptions> = {}
  ): Promise<RawDetection[]> {
    
    // 模拟检测过程（实际应该调用现有的检测组件）
    const detections: RawDetection[] = [];
    
    // 这里应该集成现有的检测组件：
    // - PagePreprocessor: 预处理
    // - FeatureExtractor: 特征提取
    // - ContentClassifier: 内容分类
    // - AdvancedFormulaDetector: 高级检测
    
    // 暂时返回空数组，等待集成
    return detections;
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
}
