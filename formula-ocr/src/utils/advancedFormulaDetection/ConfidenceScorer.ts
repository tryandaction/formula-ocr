/**
 * Confidence Scorer - 置信度评分器
 * 计算检测结果的置信度分数
 */

import type { IConfidenceScorer } from './interfaces';
import type { DetectionCandidate, MathFeatures, ClassificationResult, ConfidenceScore } from './types';
import { CONFIDENCE_WEIGHTS, CONFIDENCE_THRESHOLDS } from './constants';

export class ConfidenceScorer implements IConfidenceScorer {
  /**
   * 计算检测结果的置信度
   */
  calculateConfidence(
    detection: DetectionCandidate,
    features: MathFeatures,
    classification: ClassificationResult
  ): ConfidenceScore {
    const breakdown = {
      featureMatch: this.calculateFeatureMatch(features, classification),
      classificationCertainty: this.calculateClassificationCertainty(classification),
      boundaryClarity: this.calculateBoundaryClarity(detection.boundary),
      contextConsistency: this.calculateContextConsistency(detection, features),
    };
    
    const overall = this.calculateOverallConfidence(breakdown);
    const level = this.determineConfidenceLevel(overall);
    
    return {
      overall,
      breakdown,
      level,
    };
  }

  /**
   * 计算特征匹配度
   */
  private calculateFeatureMatch(features: MathFeatures, classification: ClassificationResult): number {
    if (classification.type !== 'formula') {
      return 0.5; // 非公式类型，中等匹配度
    }
    
    let score = 0;
    let totalFeatures = 0;
    
    // 强特征
    const strongFeatures = [
      features.hasIntegralSymbols,
      features.hasSummationSymbols,
      features.hasFractionLines,
      features.hasMatrixBrackets,
    ];
    
    for (const hasFeature of strongFeatures) {
      totalFeatures++;
      if (hasFeature) {
        score += 0.25; // 每个强特征贡献 25%
      }
    }
    
    // 中等特征
    const mediumFeatures = [
      features.hasGreekLetters,
      features.hasSuperscripts,
      features.hasSubscripts,
      features.hasRootSymbols,
    ];
    
    for (const hasFeature of mediumFeatures) {
      totalFeatures++;
      if (hasFeature) {
        score += 0.125; // 每个中等特征贡献 12.5%
      }
    }
    
    // 布局特征
    if (features.verticalComplexity > 0.3) {
      score += 0.1;
    }
    if (features.density > 0.05 && features.density < 0.5) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * 计算分类确定性
   */
  private calculateClassificationCertainty(classification: ClassificationResult): number {
    // 使用分类置信度作为确定性
    return classification.confidence;
  }

  /**
   * 计算边界清晰度
   */
  private calculateBoundaryClarity(boundary: DetectionCandidate['boundary']): number {
    // 使用边界紧密度作为清晰度指标
    return boundary.tightness;
  }

  /**
   * 计算上下文一致性
   */
  private calculateContextConsistency(detection: DetectionCandidate, features: MathFeatures): number {
    let score = 0.5; // 基础分数
    
    // 检查公式类型与特征的一致性
    if (detection.formulaType.type === 'display') {
      // 独立公式应该有较大尺寸
      if (detection.region.height > 30) {
        score += 0.2;
      }
      // 独立公式可能有更复杂的结构
      if (features.verticalComplexity > 0.3) {
        score += 0.15;
      }
    } else {
      // 行内公式应该有较小尺寸
      if (detection.region.height < 30) {
        score += 0.2;
      }
      // 行内公式通常结构简单
      if (features.verticalComplexity < 0.5) {
        score += 0.15;
      }
    }
    
    // 检查公式类型置信度
    score += detection.formulaType.confidence * 0.15;
    
    return Math.min(1, score);
  }

  /**
   * 计算总体置信度
   */
  private calculateOverallConfidence(breakdown: ConfidenceScore['breakdown']): number {
    const weights = CONFIDENCE_WEIGHTS;
    
    return (
      breakdown.featureMatch * weights.featureMatch +
      breakdown.classificationCertainty * weights.classificationCertainty +
      breakdown.boundaryClarity * weights.boundaryClarity +
      breakdown.contextConsistency * weights.contextConsistency
    );
  }

  /**
   * 确定置信度等级
   */
  private determineConfidenceLevel(overall: number): 'high' | 'medium' | 'low' {
    const thresholds = CONFIDENCE_THRESHOLDS;
    
    if (overall >= thresholds.HIGH) {
      return 'high';
    } else if (overall >= thresholds.LOW) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}
