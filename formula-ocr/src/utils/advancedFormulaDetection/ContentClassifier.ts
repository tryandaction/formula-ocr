/**
 * Content Classifier - 内容分类器（深度优化版）
 * 区分公式、图片、表格、文本四类内容
 * 
 * 优化重点：
 * 1. 排除明显的非公式内容（标题、作者、图片说明等）
 * 2. 更严格的公式判定标准
 * 3. 减少误检率，提高准确率
 */

import type { IContentClassifier } from './interfaces';
import type { ImageRegion, MathFeatures, ClassificationResult } from './types';

export class ContentClassifier implements IContentClassifier {
  /**
   * 分类图像区域的内容类型
   * 使用更严格的规则避免误检
   */
  classify(region: ImageRegion, features: MathFeatures): ClassificationResult {
    // 第一步：排除明显的非公式内容
    const exclusionResult = this.excludeNonFormula(region, features);
    if (exclusionResult) {
      return exclusionResult;
    }
    
    // 第二步：计算各类型得分
    const scores = {
      formula: this.calculateFormulaScore(features),
      image: this.calculateImageScore(region, features),
      table: this.calculateTableScore(region, features),
      text: this.calculateTextScore(features),
    };
    
    // 归一化分数
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(scores).forEach(key => {
        scores[key as keyof typeof scores] /= total;
      });
    }
    
    // 选择最高分类
    const type = Object.entries(scores).reduce((a, b) => 
      b[1] > a[1] ? b : a
    )[0] as ClassificationResult['type'];
    
    return {
      type,
      confidence: scores[type],
      scores,
      reasoning: this.generateReasoning(type, features, scores),
    };
  }

  /**
   * 排除明显的非公式内容
   * 这是关键优化：避免把标题、作者、图片说明当成公式
   */
  private excludeNonFormula(region: ImageRegion, features: MathFeatures): ClassificationResult | null {
    // 规则1: 标题检测 - 太宽且只有一行文本
    if (this.isTitle(region, features)) {
      return {
        type: 'text',
        confidence: 0.95,
        scores: { formula: 0.01, image: 0.01, table: 0.01, text: 0.97 },
        reasoning: ['检测为标题：宽度过大，高度较小，无数学符号特征'],
      };
    }
    
    // 规则2: 作者信息检测 - 短文本，无数学符号
    if (this.isAuthorInfo(region, features)) {
      return {
        type: 'text',
        confidence: 0.9,
        scores: { formula: 0.02, image: 0.02, table: 0.02, text: 0.94 },
        reasoning: ['检测为作者信息：短文本，无数学符号'],
      };
    }
    
    // 规则3: 图片说明检测 - 位于图片下方的文本
    if (this.isImageCaption(region, features)) {
      return {
        type: 'text',
        confidence: 0.85,
        scores: { formula: 0.03, image: 0.02, table: 0.05, text: 0.9 },
        reasoning: ['检测为图片说明：文本特征明显，无复杂数学结构'],
      };
    }
    
    // 规则4: 纯文本段落 - 宽度大，无数学符号
    if (this.isTextParagraph(region, features)) {
      return {
        type: 'text',
        confidence: 0.8,
        scores: { formula: 0.05, image: 0.05, table: 0.05, text: 0.85 },
        reasoning: ['检测为文本段落：宽度大，无明显数学特征'],
      };
    }
    
    // 规则5: 图片检测 - 高密度，大尺寸，无文本结构
    if (this.isImage(region, features)) {
      return {
        type: 'image',
        confidence: 0.9,
        scores: { formula: 0.02, image: 0.94, table: 0.02, text: 0.02 },
        reasoning: ['检测为图片：高密度，大尺寸，无文本结构'],
      };
    }
    
    return null;
  }

  /**
   * 判断是否为标题
   * 特征：宽度大，高度小，无数学符号，居中或左对齐
   */
  private isTitle(region: ImageRegion, features: MathFeatures): boolean {
    const aspectRatio = region.width / region.height;
    
    // 标题通常很宽但不高
    if (aspectRatio < 3) return false;
    
    // 标题高度通常较小 (< 50 pixels)
    if (region.height > 50) return false;
    
    // 标题不应该有复杂的数学符号
    const hasMathSymbols = features.hasIntegralSymbols || 
                          features.hasSummationSymbols || 
                          features.hasFractionLines ||
                          features.hasMatrixBrackets;
    
    if (hasMathSymbols) return false;
    
    // 标题密度通常较低 (文字间距大)
    if (features.density > 0.3) return false;
    
    return true;
  }

  /**
   * 判断是否为作者信息
   * 特征：短文本，无数学符号，可能包含邮箱、机构名
   */
  private isAuthorInfo(region: ImageRegion, features: MathFeatures): boolean {
    // 作者信息通常较短
    if (region.width > 400) return false;
    
    // 高度较小
    if (region.height > 40) return false;
    
    // 不应该有数学符号
    const hasMathSymbols = features.hasIntegralSymbols || 
                          features.hasSummationSymbols || 
                          features.hasFractionLines ||
                          features.hasMatrixBrackets ||
                          features.hasRootSymbols;
    
    if (hasMathSymbols) return false;
    
    // 密度较低
    if (features.density > 0.25) return false;
    
    return true;
  }

  /**
   * 判断是否为图片说明
   * 特征：文本行，可能包含 "Figure", "Fig.", "图" 等关键词
   */
  private isImageCaption(region: ImageRegion, features: MathFeatures): boolean {
    const aspectRatio = region.width / region.height;
    
    // 图片说明通常是横向文本
    if (aspectRatio < 2) return false;
    
    // 高度较小
    if (region.height > 60) return false;
    
    // 不应该有复杂数学结构
    const hasComplexMath = features.hasFractionLines || 
                          features.hasMatrixBrackets ||
                          (features.hasSuperscripts && features.hasSubscripts);
    
    if (hasComplexMath) return false;
    
    // 垂直复杂度低 (单行文本)
    if (features.verticalComplexity > 0.3) return false;
    
    return true;
  }

  /**
   * 判断是否为文本段落
   * 特征：宽度大，无明显数学符号，密度适中
   */
  private isTextParagraph(region: ImageRegion, features: MathFeatures): boolean {
    // 文本段落通常较宽
    if (region.width < 200) return false;
    
    const aspectRatio = region.width / region.height;
    
    // 宽高比较大 (横向文本)
    if (aspectRatio < 2) return false;
    
    // 不应该有强数学特征
    const hasStrongMathFeatures = features.hasIntegralSymbols || 
                                  features.hasSummationSymbols || 
                                  features.hasFractionLines ||
                                  features.hasMatrixBrackets;
    
    if (hasStrongMathFeatures) return false;
    
    // 垂直复杂度低 (文本行)
    if (features.verticalComplexity > 0.4) return false;
    
    return true;
  }

  /**
   * 判断是否为图片
   * 特征：大尺寸，高密度，无文本结构
   */
  private isImage(region: ImageRegion, features: MathFeatures): boolean {
    // 图片通常较大
    if (region.width < 150 || region.height < 150) return false;
    
    // 高密度 (连续色调)
    if (features.density < 0.5) return false;
    
    // 低边缘密度 (不是文字)
    if (features.edgeDensity > 0.4) return false;
    
    // 无文本特征
    const hasTextFeatures = features.hasGreekLetters || 
                           features.hasSuperscripts || 
                           features.hasSubscripts;
    
    if (hasTextFeatures) return false;
    
    return true;
  }

  /**
   * 计算公式得分 - 更严格的标准
   */
  private calculateFormulaScore(features: MathFeatures): number {
    let score = 0;
    
    // 必须有至少一个强数学特征
    const hasStrongFeature = features.hasIntegralSymbols || 
                            features.hasSummationSymbols || 
                            features.hasFractionLines ||
                            features.hasMatrixBrackets ||
                            features.hasRootSymbols;
    
    if (!hasStrongFeature) {
      // 如果没有强特征，需要多个中等特征
      let mediumCount = 0;
      if (features.hasGreekLetters) mediumCount++;
      if (features.hasSuperscripts) mediumCount++;
      if (features.hasSubscripts) mediumCount++;
      
      // 至少需要2个中等特征才可能是公式
      if (mediumCount < 2) {
        return 0.1; // 很低的分数
      }
      
      score = mediumCount * 0.15;
    } else {
      // 有强特征，基础分数高
      score = 0.5;
      
      // 额外的强特征加分
      if (features.hasIntegralSymbols) score += 0.15;
      if (features.hasSummationSymbols) score += 0.15;
      if (features.hasFractionLines) score += 0.1;
      if (features.hasMatrixBrackets) score += 0.1;
      if (features.hasRootSymbols) score += 0.1;
    }
    
    // 布局特征加分
    if (features.verticalComplexity >= 0.3) {
      score += 0.15;
    }
    
    // 上下标同时存在 (典型的数学公式)
    if (features.hasSuperscripts && features.hasSubscripts) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * 计算图片得分
   */
  private calculateImageScore(region: ImageRegion, features: MathFeatures): number {
    let score = 0;
    
    // 高密度、低边缘
    if (features.density > 0.6 && features.edgeDensity < 0.3) {
      score += 0.5;
    }
    
    // 大尺寸
    if (region.width > 200 && region.height > 200) {
      score += 0.3;
    }
    
    // 无文本结构
    if (!features.hasGreekLetters && !features.hasSuperscripts && 
        !features.hasSubscripts && !features.hasFractionLines) {
      score += 0.2;
    }
    
    return Math.min(1, score);
  }

  /**
   * 计算表格得分
   */
  private calculateTableScore(region: ImageRegion, features: MathFeatures): number {
    let score = 0;
    
    // 检测网格线
    const hasGridLines = this.detectGridLines(region);
    if (hasGridLines) {
      score += 0.6;
    }
    
    // 规则布局
    if (features.verticalComplexity > 0.5 && features.aspectRatio > 1) {
      score += 0.2;
    }
    
    // 中等密度
    if (features.density > 0.2 && features.density < 0.5) {
      score += 0.2;
    }
    
    return Math.min(1, score);
  }

  /**
   * 计算文本得分
   */
  private calculateTextScore(features: MathFeatures): number {
    let score = 0;
    
    // 线性布局
    if (features.verticalComplexity < 0.3) {
      score += 0.4;
    }
    
    // 适中的宽高比
    if (features.aspectRatio > 2 && features.aspectRatio < 10) {
      score += 0.3;
    }
    
    // 无复杂数学符号
    if (!features.hasIntegralSymbols && !features.hasSummationSymbols && 
        !features.hasFractionLines && !features.hasMatrixBrackets) {
      score += 0.3;
    }
    
    return Math.min(1, score);
  }

  /**
   * 检测网格线
   */
  private detectGridLines(region: ImageRegion): boolean {
    // 简化实现 - 实际应该分析图像数据
    return false;
  }

  /**
   * 生成分类推理
   */
  private generateReasoning(
    type: string,
    features: MathFeatures,
    scores: Record<string, number>
  ): string[] {
    const reasons: string[] = [];
    
    if (type === 'formula') {
      if (features.hasIntegralSymbols) reasons.push('包含积分符号');
      if (features.hasSummationSymbols) reasons.push('包含求和符号');
      if (features.hasFractionLines) reasons.push('包含分数线');
      if (features.hasMatrixBrackets) reasons.push('包含矩阵括号');
      if (features.hasRootSymbols) reasons.push('包含根号');
      if (features.hasGreekLetters) reasons.push('包含希腊字母');
      if (features.hasSuperscripts && features.hasSubscripts) reasons.push('包含上下标');
      if (features.verticalComplexity >= 0.3) reasons.push('垂直结构复杂');
    } else if (type === 'text') {
      if (features.verticalComplexity < 0.3) reasons.push('线性布局');
      if (features.aspectRatio > 2) reasons.push('横向文本');
      if (!features.hasIntegralSymbols && !features.hasSummationSymbols) {
        reasons.push('无复杂数学符号');
      }
    } else if (type === 'image') {
      if (features.density > 0.6) reasons.push('高密度');
      if (features.edgeDensity < 0.3) reasons.push('低边缘密度');
      reasons.push('连续色调');
    } else if (type === 'table') {
      reasons.push('规则布局');
      if (features.verticalComplexity > 0.5) reasons.push('多行结构');
    }
    
    const confidence = (scores[type] * 100).toFixed(0);
    return [`${type} (${confidence}%): ${reasons.join(', ')}`];
  }
}
