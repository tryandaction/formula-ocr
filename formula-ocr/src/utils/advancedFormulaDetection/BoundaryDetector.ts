/**
 * Boundary Detector - 边界检测器
 * 精确检测公式边界，提取轮廓，去除粘连文本
 */

import type { IBoundaryDetector } from './interfaces';
import type { ImageRegion, ProcessedImage, RefinedBoundary, Point } from './types';

export class BoundaryDetector implements IBoundaryDetector {
  /**
   * 精确检测公式边界
   */
  refineBoundary(region: ImageRegion, processedImage: ProcessedImage): RefinedBoundary {
    // 1. 找到连通组件
    const components = this.findConnectedComponents(region);
    
    // 2. 合并相关组件
    const mergedBounds = this.mergeRelatedComponents(components);
    
    // 3. 提取轮廓
    const contour = this.extractContour(mergedBounds, region);
    
    // 4. 添加适当边距
    const paddedBounds = this.addPadding(mergedBounds, processedImage);
    
    // 5. 计算边界紧密度
    const tightness = this.calculateTightness(contour, paddedBounds);
    
    return {
      x: paddedBounds.x,
      y: paddedBounds.y,
      width: paddedBounds.width,
      height: paddedBounds.height,
      contour,
      tightness,
    };
  }

  /**
   * 找到连通组件
   */
  private findConnectedComponents(region: ImageRegion): Array<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pixels: Point[];
  }> {
    const { binaryData, width, height } = region;
    const visited = new Uint8Array(width * height);
    const components: Array<{
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      pixels: Point[];
    }> = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (binaryData[idx] === 1 && visited[idx] === 0) {
          const component = this.floodFill(binaryData, visited, width, height, x, y);
          
          if (component.pixels.length > 5) { // 过滤噪声
            components.push(component);
          }
        }
      }
    }
    
    return components;
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
  ): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pixels: Point[];
  } {
    const stack: Point[] = [{ x: startX, y: startY }];
    const pixels: Point[] = [];
    let minX = startX;
    let minY = startY;
    let maxX = startX;
    let maxY = startY;
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx] === 1 || binaryData[idx] === 0) continue;
      
      visited[idx] = 1;
      pixels.push({ x, y });
      
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      
      // 8-连通
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
      stack.push({ x: x + 1, y: y + 1 });
      stack.push({ x: x - 1, y: y - 1 });
      stack.push({ x: x + 1, y: y - 1 });
      stack.push({ x: x - 1, y: y + 1 });
    }
    
    return { minX, minY, maxX, maxY, pixels };
  }

  /**
   * 合并相关组件
   */
  private mergeRelatedComponents(
    components: Array<{
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
      pixels: Point[];
    }>
  ): { x: number; y: number; width: number; height: number } {
    if (components.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    // 找到所有组件的边界
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const comp of components) {
      minX = Math.min(minX, comp.minX);
      minY = Math.min(minY, comp.minY);
      maxX = Math.max(maxX, comp.maxX);
      maxY = Math.max(maxY, comp.maxY);
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  /**
   * 提取轮廓
   */
  private extractContour(
    bounds: { x: number; y: number; width: number; height: number },
    region: ImageRegion
  ): Point[] {
    const { binaryData, width } = region;
    const contour: Point[] = [];
    
    // 简化的轮廓提取：找到边界像素
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        const idx = y * width + x;
        
        if (binaryData[idx] === 1) {
          // 检查是否是边界像素（至少有一个相邻像素是背景）
          if (this.isBoundaryPixel(binaryData, width, region.height, x, y)) {
            contour.push({ x, y });
          }
        }
      }
    }
    
    return contour;
  }

  /**
   * 检查是否是边界像素
   */
  private isBoundaryPixel(
    binaryData: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number
  ): boolean {
    // 检查4-连通邻域
    const neighbors = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    
    for (const { dx, dy } of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return true; // 边界外
      }
      
      const nIdx = ny * width + nx;
      if (binaryData[nIdx] === 0) {
        return true; // 相邻背景
      }
    }
    
    return false;
  }

  /**
   * 添加适当边距
   */
  private addPadding(
    bounds: { x: number; y: number; width: number; height: number },
    processedImage: ProcessedImage
  ): { x: number; y: number; width: number; height: number } {
    const padding = 5; // 5像素边距
    
    return {
      x: Math.max(0, bounds.x - padding),
      y: Math.max(0, bounds.y - padding),
      width: Math.min(processedImage.width - bounds.x + padding, bounds.width + padding * 2),
      height: Math.min(processedImage.height - bounds.y + padding, bounds.height + padding * 2),
    };
  }

  /**
   * 计算边界紧密度
   */
  private calculateTightness(
    contour: Point[],
    bounds: { x: number; y: number; width: number; height: number }
  ): number {
    if (contour.length === 0 || bounds.width === 0 || bounds.height === 0) {
      return 0;
    }
    
    // 紧密度 = 轮廓像素数 / 边界框周长
    const perimeterApprox = 2 * (bounds.width + bounds.height);
    const tightness = Math.min(1, contour.length / perimeterApprox);
    
    return tightness;
  }
}
