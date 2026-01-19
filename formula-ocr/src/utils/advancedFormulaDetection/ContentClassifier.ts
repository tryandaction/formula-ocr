/**
 * Content Classifier - 内容分类器
 * 区分公式、图片、表格、文本四类内容
 */

import type { IContentClassifier } from './interfaces';
import type { ImageRegion, MathFeatures, ClassificationResult } from './types';
import { CLASSIFICATION_RULES } from './constants';

export class ContentClassifier implements IContentClassifier {
  /**
   * 分类图像区域的内容类型
   */
  classify(region: ImageRegion, features: MathFeatures): ClassificationResult {
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
   * 计算公式得分
   */
  private calculateFormulaScore(features: MathFeatures): number {
    let score = 0;
    const rules = CLASSIFICATION_RULES.formula;
    
    // 强特征 (任一满足即高概率)
    if (features.hasIntegralSymbols || features.hasSummationSymbols) {
      score += 0.4;
    }
    if (features.hasFractionLines || features.hasMatrixBrackets) {
      score += 0.3;
    }
    
    // 中等特征 (多个满足提升概率)
    let mediumFeatureCount = 0;
    if (features.hasGreekLetters) mediumFeatureCount++;
    if (features.hasSuperscripts) mediumFeatureCount++;
    if (features.hasSubscripts) mediumFeatureCount++;
    if (features.hasRootSymbols) mediumFeatureCount++;
    
    score += mediumFeatureCount * 0.1;
    
    // 布局特征
    if (features.verticalComplexity >= rules.layoutConstraints.minVerticalComplexity) {
      score += 0.15;
    }
    if (features.aspectRatio <= rules.layoutConstraints.maxAspectRatio) {
      score += 0.1;
    }
    if (features.density >= rules.layoutConstraints.minDensity && 
        features.density <= rules.layoutConstraints.maxDensity) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * 计算图片得分
   */
  private calculateImageScore(region: ImageRegion, features: MathFeatures): number {
    let score = 0;
    
    // 高密度、低边缘 (连续色调)
    if (features.density > 0.6 && features.edgeDensity < 0.3) {
      score += 0.5;
    }
    
    // 较大尺寸
    if (region.width > 200 && region.height > 200) {
      score += 0.2;
    }
    
    // 无文本结构 (无数学符号)
    if (!features.hasGreekLetters && !features.hasSuperscripts && 
        !features.hasSubscripts && !features.hasFractionLines) {
      score += 0.3;
    }
    
    // 低垂直复杂度 (不像公式)
    if (features.verticalComplexity < 0.2) {
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
    
    // 规则布局 (高均匀性)
    if (features.uniformity > 0.7) {
      score += 0.2;
    }
    
    // 矩形形状
    if (features.aspectRatio > 1.2 && features.aspectRatio < 5) {
      score += 0.1;
    }
    
    // 对齐内容
    if (features.horizontalSpacing > 2) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * 计算文本得分
   */
  private calculateTextScore(features: MathFeatures): number {
    let score = 0;
    
    // 线性布局 (高宽高比、低垂直复杂度)
    if (features.aspectRatio > 5 && features.verticalComplexity < 0.2) {
      score += 0.5;
    }
    
    // 无数学符号
    if (!features.hasGreekLetters && !features.hasSuperscripts && 
        !features.hasSubscripts && !features.hasFractionLines &&
        !features.hasIntegralSymbols && !features.hasSummationSymbols) {
      score += 0.3;
    }
    
    // 统一高度
    if (features.uniformity > 0.8) {
      score += 0.2;
    }
    
    return Math.min(1, score);
  }

  /**
   * 检测网格线
   */
  private detectGridLines(region: ImageRegion): boolean {
    const { binaryData, width, height } = region;
    
    // 检测水平线
    let horizontalLines = 0;
    for (let y = 0; y < height; y++) {
      let linePixels = 0;
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          linePixels++;
        }
      }
      
      if (linePixels > width * 0.7) {
        horizontalLines++;
      }
    }
    
    // 检测垂直线
    let verticalLines = 0;
    for (let x = 0; x < width; x++) {
      let linePixels = 0;
      for (let y = 0; y < height; y++) {
        if (binaryData[y * width + x] === 1) {
          linePixels++;
        }
      }
      
      if (linePixels > height * 0.7) {
        verticalLines++;
      }
    }
    
    // 表格应该有多条水平和垂直线
    return horizontalLines >= 2 && verticalLines >= 2;
  }

  /**
   * 生成分类依据
   */
  private generateReasoning(
    type: ClassificationResult['type'],
    features: MathFeatures,
    scores: ClassificationResult['scores']
  ): string[] {
    const reasoning: string[] = [];
    
    switch (type) {
      case 'formula':
        if (features.hasIntegralSymbols) reasoning.push('检测到积分符号');
        if (features.hasSummationSymbols) reasoning.push('检测到求和符号');
        if (features.hasFractionLines) reasoning.push('检测到分数线');
        if (features.hasMatrixBrackets) reasoning.push('检测到矩阵括号');
        if (features.hasGreekLetters) reasoning.push('检测到希腊字母');
        if (features.hasSuperscripts || features.hasSubscripts) reasoning.push('检测到上下标');
        if (features.verticalComplexity > 0.3) reasoning.push('垂直结构复杂');
        break;
      
      case 'image':
        if (features.density > 0.6) reasoning.push('像素密度高');
        if (features.edgeDensity < 0.3) reasoning.push('边缘密度低（连续色调）');
        reasoning.push('无明显数学符号');
        break;
      
      case 'table':
        reasoning.push('检测到网格线结构');
        if (features.uniformity > 0.7) reasoning.push('布局规则均匀');
        break;
      
      case 'text':
        if (features.aspectRatio > 5) reasoning.push('线性布局');
        reasoning.push('无数学符号');
        if (features.uniformity > 0.8) reasoning.push('高度统一');
        break;
    }
    
    // 添加置信度信息
    reasoning.push(`置信度: ${(scores[type] * 100).toFixed(1)}%`);
    
    return reasoning;
  }
}
