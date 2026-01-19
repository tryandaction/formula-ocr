/**
 * Feature Extractor - 数学符号特征提取器
 * 提取图像区域的数学特征，用于公式识别
 */

import type { IFeatureExtractor } from './interfaces';
import type { ImageRegion, MathFeatures, RegionContext } from './types';

export class FeatureExtractor implements IFeatureExtractor {
  /**
   * 提取区域的数学特征
   */
  extractFeatures(region: ImageRegion, context: RegionContext): MathFeatures {
    // 检测符号特征
    const hasGreekLetters = this.detectGreekLetters(region);
    const hasIntegralSymbols = this.detectIntegralSymbols(region);
    const hasSummationSymbols = this.detectSummationSymbols(region);
    const hasFractionLines = this.detectFractionLines(region);
    const { hasSuperscripts, hasSubscripts } = this.detectScripts(region);
    const hasMatrixBrackets = this.detectMatrixBrackets(region);
    const hasRootSymbols = this.detectRootSymbols(region);
    
    // 计算布局特征
    const aspectRatio = region.width / region.height;
    const density = this.calculateDensity(region);
    const verticalComplexity = this.calculateVerticalComplexity(region);
    const horizontalSpacing = this.calculateHorizontalSpacing(region);
    
    // 计算纹理特征
    const edgeDensity = this.calculateEdgeDensity(region);
    const strokeWidth = this.calculateStrokeWidth(region);
    const uniformity = this.calculateUniformity(region);
    
    // 计算上下文特征
    const surroundingTextDensity = this.calculateSurroundingTextDensity(region, context);
    const verticalAlignment = this.determineVerticalAlignment(region, context);
    const horizontalAlignment = this.determineHorizontalAlignment(region, context);
    
    return {
      hasGreekLetters,
      hasIntegralSymbols,
      hasSummationSymbols,
      hasFractionLines,
      hasSuperscripts,
      hasSubscripts,
      hasMatrixBrackets,
      hasRootSymbols,
      aspectRatio,
      density,
      verticalComplexity,
      horizontalSpacing,
      edgeDensity,
      strokeWidth,
      uniformity,
      surroundingTextDensity,
      verticalAlignment,
      horizontalAlignment,
    };
  }

  /**
   * 检测希腊字母
   * 通过形状特征匹配（曲线、环形等）
   */
  detectGreekLetters(region: ImageRegion): boolean {
    const { binaryData, width, height } = region;
    
    // 检测曲线特征
    const hasCurves = this.detectCurves(binaryData, width, height);
    
    // 检测环形结构（如 α, β, θ）
    const hasLoops = this.detectLoops(binaryData, width, height);
    
    // 检测特殊形状（如 π 的横线加两竖线）
    const hasPiShape = this.detectPiShape(binaryData, width, height);
    
    // 检测三角形状（如 Δ）
    const hasTriangularShape = this.detectTriangularShape(binaryData, width, height);
    
    return hasCurves || hasLoops || hasPiShape || hasTriangularShape;
  }

  /**
   * 检测积分符号
   * 检测 S 形曲线和垂直拉伸特征
   */
  detectIntegralSymbols(region: ImageRegion): boolean {
    const { binaryData, width, height } = region;
    
    // 积分符号通常是垂直拉伸的 S 形
    if (height < width * 1.5) {
      return false; // 积分符号应该是高的
    }
    
    // 检测 S 形曲线
    const hasSCurve = this.detectSCurve(binaryData, width, height);
    
    // 检测垂直拉伸特征
    const isVerticallyElongated = height / width > 2;
    
    return hasSCurve && isVerticallyElongated;
  }

  /**
   * 检测求和/乘积符号
   * 检测 Z 字形和 Π 形状
   */
  detectSummationSymbols(region: ImageRegion): boolean {
    const { binaryData, width, height } = region;
    
    // 检测 Σ 的 Z 字形
    const hasZigzag = this.detectZigzagShape(binaryData, width, height);
    
    // 检测 Π 形状
    const hasPiShape = this.detectPiShape(binaryData, width, height);
    
    return hasZigzag || hasPiShape;
  }

  /**
   * 检测分数线
   * 检测水平线及其上下内容
   */
  detectFractionLines(region: ImageRegion): boolean {
    const { binaryData, width, height } = region;
    
    // 扫描每一行，寻找水平线
    for (let y = Math.floor(height * 0.3); y < Math.floor(height * 0.7); y++) {
      let linePixels = 0;
      
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          linePixels++;
        }
      }
      
      // 如果这一行有足够多的像素（至少 60% 的宽度）
      if (linePixels > width * 0.6) {
        // 检查上方和下方是否有内容
        const hasContentAbove = this.hasContentInRegion(binaryData, width, 0, y - 1, 0, width);
        const hasContentBelow = this.hasContentInRegion(binaryData, width, y + 1, height - 1, 0, width);
        
        if (hasContentAbove && hasContentBelow) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 检测上下标
   * 分析垂直位置和尺寸差异
   */
  detectScripts(region: ImageRegion): { hasSuperscripts: boolean; hasSubscripts: boolean } {
    const { binaryData, width, height } = region;
    
    // 计算每行的像素密度
    const rowDensities: number[] = [];
    for (let y = 0; y < height; y++) {
      let count = 0;
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          count++;
        }
      }
      rowDensities.push(count);
    }
    
    // 找到主要内容区域（密度最高的连续区域）
    const mainContentY = this.findMainContentRegion(rowDensities);
    
    // 检查上方是否有小内容（上标）
    const hasSuperscripts = this.hasSmallContentAbove(rowDensities, mainContentY);
    
    // 检查下方是否有小内容（下标）
    const hasSubscripts = this.hasSmallContentBelow(rowDensities, mainContentY, height);
    
    return { hasSuperscripts, hasSubscripts };
  }

  /**
   * 检测矩阵括号
   * 检测配对的方括号、圆括号、花括号
   */
  detectMatrixBrackets(region: ImageRegion): boolean {
    const { binaryData, width, height } = region;
    
    // 检测左右两侧的垂直线或曲线
    const hasLeftBracket = this.detectVerticalStructure(binaryData, width, height, 'left');
    const hasRightBracket = this.detectVerticalStructure(binaryData, width, height, 'right');
    
    // 矩阵括号应该是配对的
    if (!hasLeftBracket || !hasRightBracket) {
      return false;
    }
    
    // 检查括号之间是否有内容
    const hasInnerContent = this.hasContentInRegion(
      binaryData, width, 
      0, height - 1, 
      Math.floor(width * 0.2), Math.floor(width * 0.8)
    );
    
    return hasInnerContent;
  }

  /**
   * 检测根号
   * 检测勾形和水平顶部
   */
  detectRootSymbols(region: ImageRegion): boolean {
    const { binaryData, width, height } = region;
    
    // 检测勾形（checkmark）在左侧
    const hasCheckmark = this.detectCheckmarkShape(binaryData, width, height);
    
    // 检测水平顶部线
    const hasHorizontalTop = this.detectHorizontalLine(binaryData, width, height, 'top');
    
    return hasCheckmark && hasHorizontalTop;
  }

  // ============================================================================
  // Helper Methods - Shape Detection
  // ============================================================================

  /**
   * 检测曲线
   */
  private detectCurves(binaryData: Uint8Array, width: number, height: number): boolean {
    let curveCount = 0;
    
    // 扫描每一列，检测方向变化
    for (let x = 0; x < width; x++) {
      let directionChanges = 0;
      let lastDirection = 0;
      
      for (let y = 1; y < height; y++) {
        const curr = binaryData[y * width + x];
        const prev = binaryData[(y - 1) * width + x];
        
        if (curr !== prev) {
          const direction = curr > prev ? 1 : -1;
          if (direction !== lastDirection && lastDirection !== 0) {
            directionChanges++;
          }
          lastDirection = direction;
        }
      }
      
      if (directionChanges >= 2) {
        curveCount++;
      }
    }
    
    return curveCount > width * 0.3;
  }

  /**
   * 检测环形结构
   */
  private detectLoops(binaryData: Uint8Array, width: number, height: number): boolean {
    // 简化的环形检测：寻找封闭区域
    const visited = new Uint8Array(width * height);
    let loopCount = 0;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // 如果是白色像素且未访问
        if (binaryData[idx] === 0 && visited[idx] === 0) {
          const regionSize = this.floodFill(binaryData, visited, width, height, x, y);
          
          // 如果是小的封闭区域，可能是环
          if (regionSize > 5 && regionSize < width * height * 0.3) {
            loopCount++;
          }
        }
      }
    }
    
    return loopCount > 0;
  }

  /**
   * 检测 π 形状
   */
  private detectPiShape(binaryData: Uint8Array, width: number, height: number): boolean {
    // 检测顶部水平线
    const hasTopLine = this.detectHorizontalLine(binaryData, width, height, 'top');
    
    if (!hasTopLine) return false;
    
    // 检测两条垂直线
    let verticalLines = 0;
    
    for (let x = 0; x < width; x++) {
      let verticalPixels = 0;
      for (let y = Math.floor(height * 0.2); y < height; y++) {
        if (binaryData[y * width + x] === 1) {
          verticalPixels++;
        }
      }
      
      if (verticalPixels > height * 0.5) {
        verticalLines++;
      }
    }
    
    return verticalLines >= 2;
  }

  /**
   * 检测三角形状
   */
  private detectTriangularShape(binaryData: Uint8Array, width: number, height: number): boolean {
    // 检测宽度从上到下逐渐增加
    const topWidth = this.getRowWidth(binaryData, width, Math.floor(height * 0.2));
    const midWidth = this.getRowWidth(binaryData, width, Math.floor(height * 0.5));
    const bottomWidth = this.getRowWidth(binaryData, width, Math.floor(height * 0.8));
    
    return topWidth < midWidth && midWidth < bottomWidth;
  }

  /**
   * 检测 S 形曲线
   */
  private detectSCurve(binaryData: Uint8Array, width: number, height: number): boolean {
    // 在垂直方向上，检测中心线的左右摆动
    const centerX: number[] = [];
    
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          sum += x;
          count++;
        }
      }
      
      if (count > 0) {
        centerX.push(sum / count);
      }
    }
    
    if (centerX.length < 3) return false;
    
    // 检测方向变化（S 形应该有至少一次方向变化）
    let directionChanges = 0;
    let lastDirection = 0;
    
    for (let i = 1; i < centerX.length; i++) {
      const diff = centerX[i] - centerX[i - 1];
      if (Math.abs(diff) > 0.5) {
        const direction = diff > 0 ? 1 : -1;
        if (direction !== lastDirection && lastDirection !== 0) {
          directionChanges++;
        }
        lastDirection = direction;
      }
    }
    
    return directionChanges >= 1;
  }

  /**
   * 检测 Z 字形
   */
  private detectZigzagShape(binaryData: Uint8Array, width: number, height: number): boolean {
    // 检测顶部、中间、底部的水平线
    const hasTopLine = this.detectHorizontalLine(binaryData, width, height, 'top');
    const hasBottomLine = this.detectHorizontalLine(binaryData, width, height, 'bottom');
    
    if (!hasTopLine || !hasBottomLine) return false;
    
    // 检测中间的对角线
    let diagonalPixels = 0;
    for (let y = Math.floor(height * 0.3); y < Math.floor(height * 0.7); y++) {
      const expectedX = Math.floor(width * (1 - (y - height * 0.3) / (height * 0.4)));
      const x = Math.max(0, Math.min(width - 1, expectedX));
      
      if (binaryData[y * width + x] === 1) {
        diagonalPixels++;
      }
    }
    
    return diagonalPixels > height * 0.2;
  }

  /**
   * 检测勾形
   */
  private detectCheckmarkShape(binaryData: Uint8Array, width: number, height: number): boolean {
    // 勾形：左下到中间上升，然后右上延伸
    const leftThird = Math.floor(width * 0.33);
    
    // 检测左侧下降线
    let leftLinePixels = 0;
    for (let y = Math.floor(height * 0.5); y < height; y++) {
      for (let x = 0; x < leftThird; x++) {
        if (binaryData[y * width + x] === 1) {
          leftLinePixels++;
          break;
        }
      }
    }
    
    // 检测右侧上升线
    let rightLinePixels = 0;
    for (let y = 0; y < Math.floor(height * 0.5); y++) {
      for (let x = leftThird; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          rightLinePixels++;
          break;
        }
      }
    }
    
    return leftLinePixels > height * 0.2 && rightLinePixels > height * 0.2;
  }

  /**
   * 检测水平线
   */
  private detectHorizontalLine(
    binaryData: Uint8Array, 
    width: number, 
    height: number, 
    position: 'top' | 'bottom' | 'middle'
  ): boolean {
    let startY: number, endY: number;
    
    switch (position) {
      case 'top':
        startY = 0;
        endY = Math.floor(height * 0.3);
        break;
      case 'bottom':
        startY = Math.floor(height * 0.7);
        endY = height;
        break;
      case 'middle':
        startY = Math.floor(height * 0.4);
        endY = Math.floor(height * 0.6);
        break;
    }
    
    for (let y = startY; y < endY; y++) {
      let linePixels = 0;
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          linePixels++;
        }
      }
      
      if (linePixels > width * 0.6) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检测垂直结构
   */
  private detectVerticalStructure(
    binaryData: Uint8Array, 
    width: number, 
    height: number, 
    side: 'left' | 'right'
  ): boolean {
    const startX = side === 'left' ? 0 : Math.floor(width * 0.8);
    const endX = side === 'left' ? Math.floor(width * 0.2) : width;
    
    for (let x = startX; x < endX; x++) {
      let verticalPixels = 0;
      for (let y = 0; y < height; y++) {
        if (binaryData[y * width + x] === 1) {
          verticalPixels++;
        }
      }
      
      if (verticalPixels > height * 0.6) {
        return true;
      }
    }
    
    return false;
  }

  // ============================================================================
  // Helper Methods - Layout and Texture Features
  // ============================================================================

  /**
   * 计算像素密度
   */
  private calculateDensity(region: ImageRegion): number {
    const { binaryData } = region;
    let blackPixels = 0;
    
    for (let i = 0; i < binaryData.length; i++) {
      if (binaryData[i] === 1) {
        blackPixels++;
      }
    }
    
    return blackPixels / binaryData.length;
  }

  /**
   * 计算垂直复杂度
   */
  private calculateVerticalComplexity(region: ImageRegion): number {
    const { binaryData, width, height } = region;
    
    // 计算每列的像素分布
    let complexity = 0;
    
    for (let x = 0; x < width; x++) {
      const segments: number[] = [];
      let inSegment = false;
      let segmentLength = 0;
      
      for (let y = 0; y < height; y++) {
        if (binaryData[y * width + x] === 1) {
          if (!inSegment) {
            inSegment = true;
            segmentLength = 1;
          } else {
            segmentLength++;
          }
        } else {
          if (inSegment) {
            segments.push(segmentLength);
            inSegment = false;
          }
        }
      }
      
      if (inSegment) {
        segments.push(segmentLength);
      }
      
      // 多个分段表示垂直复杂度高
      complexity += segments.length;
    }
    
    return complexity / width;
  }

  /**
   * 计算水平间距特征
   */
  private calculateHorizontalSpacing(region: ImageRegion): number {
    const { binaryData, width, height } = region;
    
    // 计算每行的间隙数量
    let totalGaps = 0;
    
    for (let y = 0; y < height; y++) {
      let gaps = 0;
      let inGap = false;
      
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 0) {
          if (!inGap) {
            inGap = true;
            gaps++;
          }
        } else {
          inGap = false;
        }
      }
      
      totalGaps += gaps;
    }
    
    return totalGaps / height;
  }

  /**
   * 计算边缘密度
   */
  private calculateEdgeDensity(region: ImageRegion): number {
    const { binaryData, width, height } = region;
    let edgePixels = 0;
    
    // Sobel 边缘检测
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const gx = 
          -binaryData[(y - 1) * width + (x - 1)] + binaryData[(y - 1) * width + (x + 1)] +
          -2 * binaryData[y * width + (x - 1)] + 2 * binaryData[y * width + (x + 1)] +
          -binaryData[(y + 1) * width + (x - 1)] + binaryData[(y + 1) * width + (x + 1)];
        
        const gy = 
          -binaryData[(y - 1) * width + (x - 1)] - 2 * binaryData[(y - 1) * width + x] - binaryData[(y - 1) * width + (x + 1)] +
          binaryData[(y + 1) * width + (x - 1)] + 2 * binaryData[(y + 1) * width + x] + binaryData[(y + 1) * width + (x + 1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        if (magnitude > 2) {
          edgePixels++;
        }
      }
    }
    
    return edgePixels / (width * height);
  }

  /**
   * 计算平均笔画宽度
   */
  private calculateStrokeWidth(region: ImageRegion): number {
    const { binaryData, width, height } = region;
    const widths: number[] = [];
    
    // 对每一行，计算连续黑色像素的宽度
    for (let y = 0; y < height; y++) {
      let currentWidth = 0;
      
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          currentWidth++;
        } else {
          if (currentWidth > 0) {
            widths.push(currentWidth);
            currentWidth = 0;
          }
        }
      }
      
      if (currentWidth > 0) {
        widths.push(currentWidth);
      }
    }
    
    if (widths.length === 0) return 0;
    
    // 返回中位数
    widths.sort((a, b) => a - b);
    return widths[Math.floor(widths.length / 2)];
  }

  /**
   * 计算均匀性
   */
  private calculateUniformity(region: ImageRegion): number {
    const { binaryData, width, height } = region;
    
    // 计算每行的密度
    const rowDensities: number[] = [];
    for (let y = 0; y < height; y++) {
      let count = 0;
      for (let x = 0; x < width; x++) {
        if (binaryData[y * width + x] === 1) {
          count++;
        }
      }
      rowDensities.push(count / width);
    }
    
    // 计算标准差
    const mean = rowDensities.reduce((a, b) => a + b, 0) / rowDensities.length;
    const variance = rowDensities.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / rowDensities.length;
    const stdDev = Math.sqrt(variance);
    
    // 均匀性 = 1 - 标准差（标准差越小，越均匀）
    return Math.max(0, 1 - stdDev);
  }

  /**
   * 计算周围文本密度
   */
  private calculateSurroundingTextDensity(_region: ImageRegion, context: RegionContext): number {
    // 简化实现：基于周围区域的数量
    return Math.min(1, context.surroundingRegions.length / 10);
  }

  /**
   * 确定垂直对齐方式
   */
  private determineVerticalAlignment(
    region: ImageRegion, 
    context: RegionContext
  ): 'top' | 'middle' | 'bottom' | 'isolated' {
    const { textLines } = context;
    
    if (textLines.length === 0) {
      return 'isolated';
    }
    
    const regionCenterY = region.y + region.height / 2;
    
    // 找到最近的文本行
    let minDistance = Infinity;
    let nearestLine: typeof textLines[0] | null = null;
    
    for (const line of textLines) {
      const lineCenterY = line.y + line.height / 2;
      const distance = Math.abs(regionCenterY - lineCenterY);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestLine = line;
      }
    }
    
    if (!nearestLine || minDistance > nearestLine.height * 2) {
      return 'isolated';
    }
    
    const lineCenterY = nearestLine.y + nearestLine.height / 2;
    
    if (regionCenterY < lineCenterY - nearestLine.height * 0.3) {
      return 'top';
    } else if (regionCenterY > lineCenterY + nearestLine.height * 0.3) {
      return 'bottom';
    } else {
      return 'middle';
    }
  }

  /**
   * 确定水平对齐方式
   */
  private determineHorizontalAlignment(
    region: ImageRegion, 
    context: RegionContext
  ): 'left' | 'center' | 'right' {
    const regionCenterX = region.x + region.width / 2;
    const relativePosition = regionCenterX / context.pageWidth;
    
    if (relativePosition < 0.33) {
      return 'left';
    } else if (relativePosition > 0.67) {
      return 'right';
    } else {
      return 'center';
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * 检查区域内是否有内容
   */
  private hasContentInRegion(
    binaryData: Uint8Array,
    width: number,
    startY: number,
    endY: number,
    startX: number,
    endX: number
  ): boolean {
    let pixelCount = 0;
    
    for (let y = Math.max(0, startY); y <= Math.min(endY, Math.floor(binaryData.length / width) - 1); y++) {
      for (let x = Math.max(0, startX); x <= Math.min(endX, width - 1); x++) {
        if (binaryData[y * width + x] === 1) {
          pixelCount++;
        }
      }
    }
    
    return pixelCount > 5;
  }

  /**
   * 获取某一行的宽度
   */
  private getRowWidth(binaryData: Uint8Array, width: number, y: number): number {
    let minX = width;
    let maxX = 0;
    
    for (let x = 0; x < width; x++) {
      if (binaryData[y * width + x] === 1) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    
    return maxX - minX + 1;
  }

  /**
   * 洪水填充算法
   */
  private floodFill(
    binaryData: Uint8Array,
    visited: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number
  ): number {
    const stack: Array<[number, number]> = [[startX, startY]];
    let size = 0;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx] === 1 || binaryData[idx] === 1) continue;
      
      visited[idx] = 1;
      size++;
      
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
    
    return size;
  }

  /**
   * 找到主要内容区域
   */
  private findMainContentRegion(rowDensities: number[]): { start: number; end: number } {
    let maxSum = 0;
    let maxStart = 0;
    let maxEnd = 0;
    
    // 使用滑动窗口找到密度最高的连续区域
    const windowSize = Math.min(5, Math.floor(rowDensities.length / 3));
    
    for (let i = 0; i <= rowDensities.length - windowSize; i++) {
      let sum = 0;
      for (let j = i; j < i + windowSize; j++) {
        sum += rowDensities[j];
      }
      
      if (sum > maxSum) {
        maxSum = sum;
        maxStart = i;
        maxEnd = i + windowSize - 1;
      }
    }
    
    return { start: maxStart, end: maxEnd };
  }

  /**
   * 检查上方是否有小内容
   */
  private hasSmallContentAbove(rowDensities: number[], mainContent: { start: number; end: number }): boolean {
    if (mainContent.start === 0) return false;
    
    // 检查主内容上方是否有密度较低的内容
    for (let y = 0; y < mainContent.start; y++) {
      if (rowDensities[y] > 0 && rowDensities[y] < rowDensities[mainContent.start] * 0.5) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检查下方是否有小内容
   */
  private hasSmallContentBelow(
    rowDensities: number[], 
    mainContent: { start: number; end: number },
    height: number
  ): boolean {
    if (mainContent.end >= height - 1) return false;
    
    // 检查主内容下方是否有密度较低的内容
    for (let y = mainContent.end + 1; y < height; y++) {
      if (rowDensities[y] > 0 && rowDensities[y] < rowDensities[mainContent.end] * 0.5) {
        return true;
      }
    }
    
    return false;
  }
}
