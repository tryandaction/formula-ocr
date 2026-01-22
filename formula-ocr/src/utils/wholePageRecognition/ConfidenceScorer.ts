/**
 * 置信度评分器
 * 负责为每个检测结果计算置信度分数
 */

import type { RawDetection, DetectionContext } from './types';

/**
 * 置信度评分器实现
 */
export class ConfidenceScorer {
  /** 权重系数 */
  private readonly FEATURE_WEIGHT = 0.4;
  private readonly STRUCTURE_WEIGHT = 0.3;
  private readonly CONTEXT_WEIGHT = 0.2;
  private readonly BOUNDARY_WEIGHT = 0.1;

  /** 数学符号集合 */
  private readonly MATH_SYMBOLS = new Set([
    '∫', '∑', '∏', '√', '∂', '∇', '∞', '≈', '≠', '≤', '≥',
    '±', '×', '÷', '∈', '∉', '⊂', '⊃', '∪', '∩', '∧', '∨',
    '→', '←', '↔', '⇒', '⇐', '⇔', '∀', '∃', '∄', '∅'
  ]);

  /** 希腊字母集合 */
  private readonly GREEK_LETTERS = new Set([
    'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ',
    'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω',
    'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ',
    'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'
  ]);

  /**
   * 计算单个检测的置信度
   * 
   * @param detection - 检测结果
   * @param context - 上下文信息
   * @returns 置信度分数（0-1）
   */
  calculateConfidence(
    detection: RawDetection,
    context: DetectionContext
  ): number {
    const featureScore = this.calculateFeatureScore(detection);
    const structureScore = this.calculateStructureScore(detection);
    const contextScore = this.calculateContextScore(detection, context);
    const boundaryScore = this.calculateBoundaryScore(detection);

    const confidence =
      this.FEATURE_WEIGHT * featureScore +
      this.STRUCTURE_WEIGHT * structureScore +
      this.CONTEXT_WEIGHT * contextScore +
      this.BOUNDARY_WEIGHT * boundaryScore;

    // 确保在0-1范围内
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 批量计算置信度
   * 
   * @param detections - 检测结果数组
   * @param context - 上下文信息
   * @returns 置信度分数数组
   */
  calculateConfidenceBatch(
    detections: RawDetection[],
    context: DetectionContext
  ): number[] {
    return detections.map(detection =>
      this.calculateConfidence(detection, context)
    );
  }

  /**
   * 计算特征分数
   * 基于数学符号、数学字体、希腊字母等特征
   */
  private calculateFeatureScore(detection: RawDetection): number {
    const { features } = detection;
    let score = 0;

    // 数学符号数量（每个+0.1分，最多0.5分）
    score += Math.min(0.5, features.mathSymbolCount * 0.1);

    // 数学字体使用（+0.2分）
    if (features.usesMathFont) {
      score += 0.2;
    }

    // 希腊字母（每个+0.05分，最多0.3分）
    score += Math.min(0.3, features.greekLetterCount * 0.05);

    // 归一化到0-1范围
    return Math.min(1, score);
  }

  /**
   * 计算结构分数
   * 基于分式、上下标、根号、积分等数学结构
   */
  private calculateStructureScore(detection: RawDetection): number {
    const { features } = detection;
    let score = 0;

    // 分式结构（+0.3分）
    if (features.hasFractionStructure) {
      score += 0.3;
    }

    // 上下标（+0.2分）
    if (features.hasScripts) {
      score += 0.2;
    }

    // 根号/积分/求和（+0.3分）
    if (features.hasRoots || features.hasLargeOperators) {
      score += 0.3;
    }

    // 括号配对（+0.2分）
    if (features.hasBracketPairs) {
      score += 0.2;
    }

    // 归一化到0-1范围
    return Math.min(1, score);
  }

  /**
   * 计算上下文分数
   * 基于公式类型、位置、周围环境等
   */
  private calculateContextScore(
    detection: RawDetection,
    context: DetectionContext
  ): number {
    let score = 0;

    // 根据页面类型调整
    if (context.pageType === 'academic' || context.pageType === 'textbook') {
      score += 0.2;
    }

    // 根据公式类型
    if (detection.type === 'display') {
      score += 0.3; // 独立公式通常更可靠
    } else if (detection.type === 'inline') {
      score += 0.2; // 行内公式
    } else if (detection.type === 'numbered') {
      score += 0.3; // 编号公式
    }

    // 根据公式密度（高密度页面更可能包含公式）
    if (context.formulaDensity > 0.1) {
      score += 0.2;
    }

    // 根据文本质量
    score += context.textQuality * 0.3;

    // 归一化到0-1范围
    return Math.min(1, score);
  }

  /**
   * 计算边界分数
   * 基于边界清晰度、完整性、尺寸合理性
   */
  private calculateBoundaryScore(detection: RawDetection): number {
    const { boundingBox } = detection;
    let score = 0;

    // 尺寸合理性（20-500px）
    const width = boundingBox.width;
    const height = boundingBox.height;

    if (width >= 20 && width <= 500 && height >= 10 && height <= 200) {
      score += 0.3;
    } else if (width < 20 || height < 10) {
      score -= 0.2; // 过小
    } else if (width > 500 || height > 200) {
      score -= 0.1; // 过大
    }

    // 宽高比合理性（公式通常宽度>高度）
    const aspectRatio = width / height;
    if (aspectRatio >= 1 && aspectRatio <= 10) {
      score += 0.4;
    }

    // 边界完整性（假设初步检测已经提供了基本的完整性）
    score += 0.3;

    // 归一化到0-1范围
    return Math.max(0, Math.min(1, score));
  }
}
