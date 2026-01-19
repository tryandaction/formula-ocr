/**
 * Formula Type Classifier - 公式类型分类器
 * 判断公式类型：行内公式 (inline) 或独立公式 (display)
 */

import type { IFormulaTypeClassifier } from './interfaces';
import type { ImageRegion, RegionContext, FormulaTypeResult } from './types';

export class FormulaTypeClassifier implements IFormulaTypeClassifier {
  /**
   * 判断公式类型 (行内/独立)
   */
  classifyFormulaType(region: ImageRegion, context: RegionContext): FormulaTypeResult {
    const displayScore = this.calculateDisplayScore(region, context);
    const inlineScore = this.calculateInlineScore(region, context);
    
    const type = displayScore > inlineScore ? 'display' : 'inline';
    const confidence = Math.max(displayScore, inlineScore) / (displayScore + inlineScore);
    
    return {
      type,
      confidence,
      reasoning: this.generateReasoning(type, region, context),
    };
  }

  /**
   * 计算独立公式得分
   */
  private calculateDisplayScore(region: ImageRegion, context: RegionContext): number {
    let score = 0;
    
    // 检查垂直隔离（上下有空白）
    if (this.hasVerticalIsolation(region, context)) {
      score += 0.4;
    }
    
    // 检查水平居中
    if (this.isHorizontallyCentered(region, context)) {
      score += 0.3;
    }
    
    // 检查较大尺寸
    if (this.isLargerSize(region, context)) {
      score += 0.2;
    }
    
    // 检查同行无文本
    if (this.hasNoInlineText(region, context)) {
      score += 0.1;
    }
    
    return score;
  }

  /**
   * 计算行内公式得分
   */
  private calculateInlineScore(region: ImageRegion, context: RegionContext): number {
    let score = 0;
    
    // 检查与文本对齐
    if (this.isAlignedWithText(region, context)) {
      score += 0.4;
    }
    
    // 检查较小高度
    if (this.hasSmallerHeight(region, context)) {
      score += 0.3;
    }
    
    // 检查被文本包围
    if (this.isSurroundedByText(region, context)) {
      score += 0.2;
    }
    
    // 检查相同基线
    if (this.hasSameBaseline(region, context)) {
      score += 0.1;
    }
    
    return score;
  }

  /**
   * 检查垂直隔离
   */
  private hasVerticalIsolation(region: ImageRegion, context: RegionContext): boolean {
    const { textLines } = context;
    
    if (textLines.length === 0) {
      return true; // 没有文本行，认为是隔离的
    }
    
    // 检查上方空白
    const hasSpaceAbove = !textLines.some(line => {
      const lineBottom = line.y + line.height;
      return lineBottom > region.y - region.height * 0.5 && lineBottom < region.y;
    });
    
    // 检查下方空白
    const hasSpaceBelow = !textLines.some(line => {
      const lineTop = line.y;
      return lineTop > region.y + region.height && lineTop < region.y + region.height * 1.5;
    });
    
    return hasSpaceAbove && hasSpaceBelow;
  }

  /**
   * 检查水平居中
   */
  private isHorizontallyCentered(region: ImageRegion, context: RegionContext): boolean {
    const regionCenterX = region.x + region.width / 2;
    const pageCenterX = context.pageWidth / 2;
    
    // 允许 20% 的偏差
    const tolerance = context.pageWidth * 0.2;
    
    return Math.abs(regionCenterX - pageCenterX) < tolerance;
  }

  /**
   * 检查较大尺寸
   */
  private isLargerSize(region: ImageRegion, context: RegionContext): boolean {
    const { textLines } = context;
    
    if (textLines.length === 0) {
      // 没有文本行参考，使用绝对尺寸判断
      return region.height > 40;
    }
    
    // 计算平均文本行高度
    const avgTextHeight = textLines.reduce((sum, line) => sum + line.height, 0) / textLines.length;
    
    // 公式高度大于平均文本高度的 1.5 倍
    return region.height > avgTextHeight * 1.5;
  }

  /**
   * 检查同行无文本
   */
  private hasNoInlineText(region: ImageRegion, context: RegionContext): boolean {
    const { textLines } = context;
    
    // 检查是否有文本行与公式在同一垂直范围内
    const hasOverlappingText = textLines.some(line => {
      const regionTop = region.y;
      const regionBottom = region.y + region.height;
      const lineTop = line.y;
      const lineBottom = line.y + line.height;
      
      // 检查垂直重叠
      return !(regionBottom < lineTop || regionTop > lineBottom);
    });
    
    return !hasOverlappingText;
  }

  /**
   * 检查与文本对齐
   */
  private isAlignedWithText(region: ImageRegion, context: RegionContext): boolean {
    const { textLines } = context;
    
    if (textLines.length === 0) {
      return false;
    }
    
    // 找到最近的文本行
    const nearestLine = this.findNearestTextLine(region, textLines);
    
    if (!nearestLine) {
      return false;
    }
    
    // 检查垂直位置是否接近
    const regionCenterY = region.y + region.height / 2;
    const lineCenterY = nearestLine.y + nearestLine.height / 2;
    
    return Math.abs(regionCenterY - lineCenterY) < nearestLine.height;
  }

  /**
   * 检查较小高度
   */
  private hasSmallerHeight(region: ImageRegion, context: RegionContext): boolean {
    const { textLines } = context;
    
    if (textLines.length === 0) {
      // 没有文本行参考，使用绝对尺寸判断
      return region.height < 30;
    }
    
    // 计算平均文本行高度
    const avgTextHeight = textLines.reduce((sum, line) => sum + line.height, 0) / textLines.length;
    
    // 公式高度小于或接近平均文本高度的 1.2 倍
    return region.height < avgTextHeight * 1.2;
  }

  /**
   * 检查被文本包围
   */
  private isSurroundedByText(region: ImageRegion, context: RegionContext): boolean {
    const { textLines } = context;
    
    if (textLines.length < 2) {
      return false;
    }
    
    // 简化判断：如果有多个文本行在附近，认为被包围
    const nearbyLines = textLines.filter(line => {
      const regionCenterY = region.y + region.height / 2;
      const lineCenterY = line.y + line.height / 2;
      return Math.abs(regionCenterY - lineCenterY) < line.height * 2;
    });
    
    return nearbyLines.length >= 2;
  }

  /**
   * 检查相同基线
   */
  private hasSameBaseline(region: ImageRegion, context: RegionContext): boolean {
    const { textLines } = context;
    
    if (textLines.length === 0) {
      return false;
    }
    
    // 找到最近的文本行
    const nearestLine = this.findNearestTextLine(region, textLines);
    
    if (!nearestLine) {
      return false;
    }
    
    // 检查底部对齐（基线）
    const regionBottom = region.y + region.height;
    const lineBottom = nearestLine.y + nearestLine.height;
    
    return Math.abs(regionBottom - lineBottom) < nearestLine.height * 0.3;
  }

  /**
   * 找到最近的文本行
   */
  private findNearestTextLine(
    region: ImageRegion,
    textLines: RegionContext['textLines']
  ): RegionContext['textLines'][0] | null {
    if (textLines.length === 0) {
      return null;
    }
    
    const regionCenterY = region.y + region.height / 2;
    
    let minDistance = Infinity;
    let nearestLine = textLines[0];
    
    for (const line of textLines) {
      const lineCenterY = line.y + line.height / 2;
      const distance = Math.abs(regionCenterY - lineCenterY);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestLine = line;
      }
    }
    
    return nearestLine;
  }

  /**
   * 生成分类依据
   */
  private generateReasoning(
    type: 'display' | 'inline',
    region: ImageRegion,
    context: RegionContext
  ): string[] {
    const reasoning: string[] = [];
    
    if (type === 'display') {
      if (this.hasVerticalIsolation(region, context)) {
        reasoning.push('上下有空白，垂直隔离');
      }
      if (this.isHorizontallyCentered(region, context)) {
        reasoning.push('水平居中');
      }
      if (this.isLargerSize(region, context)) {
        reasoning.push('尺寸较大');
      }
      if (this.hasNoInlineText(region, context)) {
        reasoning.push('同行无文本');
      }
    } else {
      if (this.isAlignedWithText(region, context)) {
        reasoning.push('与文本对齐');
      }
      if (this.hasSmallerHeight(region, context)) {
        reasoning.push('高度较小');
      }
      if (this.isSurroundedByText(region, context)) {
        reasoning.push('被文本包围');
      }
      if (this.hasSameBaseline(region, context)) {
        reasoning.push('与文本共享基线');
      }
    }
    
    if (reasoning.length === 0) {
      reasoning.push('基于默认规则判断');
    }
    
    return reasoning;
  }
}
