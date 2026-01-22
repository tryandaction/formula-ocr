/**
 * 边界定位器
 * 负责精确定位公式边界，实现≤5像素误差
 */

import type { RawDetection, BoundingBox } from './types';

/**
 * 边界定位器实现
 */
export class BoundaryLocator {
  /** 安全边距（像素） */
  private readonly SAFETY_MARGIN = 2;
  
  /** 边界扩展比例（用于初步扫描） */
  private readonly EXPANSION_RATIO = 0.2;
  
  /** 像素密度阈值（用于判断是否为内容） */
  private readonly DENSITY_THRESHOLD = 0.1;

  /**
   * 精炼公式边界框
   * 使用边缘检测和像素密度分析实现精准定位
   * 
   * @param detection - 初步检测结果
   * @param imageData - 原始图像数据
   * @returns 精炼后的边界框
   */
  refineBoundary(detection: RawDetection, imageData: ImageData): BoundingBox {
    const { boundingBox } = detection;
    
    // 扩展搜索区域
    const expandedBox = this.expandBoundingBox(
      boundingBox,
      imageData.width,
      imageData.height
    );
    
    // 提取扩展区域的图像数据
    const regionData = this.extractRegion(imageData, expandedBox);
    
    // 计算每行和每列的像素密度
    const rowDensities = this.calculateRowDensities(regionData);
    const colDensities = this.calculateColumnDensities(regionData);
    
    // 找到内容边界
    let top = this.findTopBoundary(rowDensities);
    let bottom = this.findBottomBoundary(rowDensities);
    const left = this.findLeftBoundary(colDensities);
    const right = this.findRightBoundary(colDensities);
    
    // 应用垂直扩展处理（检测上下标、分式、根号等）
    const verticalExpansion = this.detectVerticalExtensions(
      regionData,
      { top, bottom, left, right },
      detection.features
    );
    
    top = Math.max(0, top - verticalExpansion.top);
    bottom = Math.min(regionData.height - 1, bottom + verticalExpansion.bottom);
    
    // 转换回原始坐标系并添加安全边距
    return {
      x: expandedBox.x + left - this.SAFETY_MARGIN,
      y: expandedBox.y + top - this.SAFETY_MARGIN,
      width: right - left + this.SAFETY_MARGIN * 2,
      height: bottom - top + this.SAFETY_MARGIN * 2,
      rotation: boundingBox.rotation,
    };
  }

  /**
   * 批量精炼多个边界框
   * 
   * @param detections - 初步检测结果数组
   * @param imageData - 原始图像数据
   * @returns 精炼后的边界框数组
   */
  refineBoundariesBatch(
    detections: RawDetection[],
    imageData: ImageData
  ): BoundingBox[] {
    return detections.map(detection => this.refineBoundary(detection, imageData));
  }

  /**
   * 检测并修正边界框重叠
   * 如果两个边界框重叠>30%，判断是否为同一公式
   * 
   * @param boundingBoxes - 边界框数组
   * @returns 修正后的边界框数组
   */
  resolveOverlaps(boundingBoxes: BoundingBox[]): BoundingBox[] {
    if (boundingBoxes.length <= 1) {
      return boundingBoxes;
    }

    const resolved: BoundingBox[] = [];
    const merged = new Set<number>();

    for (let i = 0; i < boundingBoxes.length; i++) {
      if (merged.has(i)) continue;

      let currentBox = boundingBoxes[i];
      const toMerge: number[] = [i];

      // 查找需要合并的边界框
      for (let j = i + 1; j < boundingBoxes.length; j++) {
        if (merged.has(j)) continue;

        const overlapRatio = this.calculateOverlapRatio(
          currentBox,
          boundingBoxes[j]
        );

        // 如果重叠>30%，认为是同一公式
        if (overlapRatio > 0.3) {
          toMerge.push(j);
          merged.add(j);
        }
      }

      // 如果有多个边界框需要合并，合并它们
      if (toMerge.length > 1) {
        currentBox = this.mergeBoundingBoxes(
          toMerge.map(idx => boundingBoxes[idx])
        );
      }

      resolved.push(currentBox);
      merged.add(i);
    }

    return resolved;
  }

  /**
   * 扩展边界框以进行搜索
   */
  private expandBoundingBox(
    box: BoundingBox,
    maxWidth: number,
    maxHeight: number
  ): BoundingBox {
    const expandX = Math.floor(box.width * this.EXPANSION_RATIO);
    const expandY = Math.floor(box.height * this.EXPANSION_RATIO);

    return {
      x: Math.max(0, box.x - expandX),
      y: Math.max(0, box.y - expandY),
      width: Math.min(maxWidth - box.x + expandX, box.width + expandX * 2),
      height: Math.min(maxHeight - box.y + expandY, box.height + expandY * 2),
      rotation: box.rotation,
    };
  }

  /**
   * 提取图像区域
   */
  private extractRegion(
    imageData: ImageData,
    box: BoundingBox
  ): ImageData {
    const regionData = new Uint8ClampedArray(box.width * box.height * 4);

    for (let y = 0; y < box.height; y++) {
      for (let x = 0; x < box.width; x++) {
        const sourceX = box.x + x;
        const sourceY = box.y + y;

        if (sourceX >= imageData.width || sourceY >= imageData.height) {
          continue;
        }

        const sourceIndex = (sourceY * imageData.width + sourceX) * 4;
        const targetIndex = (y * box.width + x) * 4;

        regionData[targetIndex] = imageData.data[sourceIndex];
        regionData[targetIndex + 1] = imageData.data[sourceIndex + 1];
        regionData[targetIndex + 2] = imageData.data[sourceIndex + 2];
        regionData[targetIndex + 3] = imageData.data[sourceIndex + 3];
      }
    }

    return new ImageData(regionData, box.width, box.height);
  }

  /**
   * 计算每行的像素密度
   */
  private calculateRowDensities(imageData: ImageData): number[] {
    const densities: number[] = [];

    for (let y = 0; y < imageData.height; y++) {
      let contentPixels = 0;

      for (let x = 0; x < imageData.width; x++) {
        const index = (y * imageData.width + x) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];

        // 计算灰度值
        const gray = (r + g + b) / 3;

        // 如果不是白色（阈值200），认为是内容
        if (gray < 200) {
          contentPixels++;
        }
      }

      densities.push(contentPixels / imageData.width);
    }

    return densities;
  }

  /**
   * 计算每列的像素密度
   */
  private calculateColumnDensities(imageData: ImageData): number[] {
    const densities: number[] = [];

    for (let x = 0; x < imageData.width; x++) {
      let contentPixels = 0;

      for (let y = 0; y < imageData.height; y++) {
        const index = (y * imageData.width + x) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];

        const gray = (r + g + b) / 3;

        if (gray < 200) {
          contentPixels++;
        }
      }

      densities.push(contentPixels / imageData.height);
    }

    return densities;
  }

  /**
   * 找到顶部边界
   */
  private findTopBoundary(rowDensities: number[]): number {
    for (let i = 0; i < rowDensities.length; i++) {
      if (rowDensities[i] > this.DENSITY_THRESHOLD) {
        return i;
      }
    }
    return 0;
  }

  /**
   * 找到底部边界
   */
  private findBottomBoundary(rowDensities: number[]): number {
    for (let i = rowDensities.length - 1; i >= 0; i--) {
      if (rowDensities[i] > this.DENSITY_THRESHOLD) {
        return i;
      }
    }
    return rowDensities.length - 1;
  }

  /**
   * 找到左边界
   */
  private findLeftBoundary(colDensities: number[]): number {
    for (let i = 0; i < colDensities.length; i++) {
      if (colDensities[i] > this.DENSITY_THRESHOLD) {
        return i;
      }
    }
    return 0;
  }

  /**
   * 找到右边界
   */
  private findRightBoundary(colDensities: number[]): number {
    for (let i = colDensities.length - 1; i >= 0; i--) {
      if (colDensities[i] > this.DENSITY_THRESHOLD) {
        return i;
      }
    }
    return colDensities.length - 1;
  }

  /**
   * 计算两个边界框的重叠比例
   */
  private calculateOverlapRatio(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 <= x1 || y2 <= y1) {
      return 0;
    }

    const intersectionArea = (x2 - x1) * (y2 - y1);
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const minArea = Math.min(box1Area, box2Area);

    return intersectionArea / minArea;
  }

  /**
   * 合并多个边界框
   */
  private mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
    if (boxes.length === 0) {
      throw new Error('Cannot merge empty array of bounding boxes');
    }

    if (boxes.length === 1) {
      return boxes[0];
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const box of boxes) {
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: boxes[0].rotation,
    };
  }

  /**
   * 检测垂直扩展（上下标、分式、根号等）
   * 
   * @param imageData - 区域图像数据
   * @param bounds - 当前边界
   * @param features - 公式特征
   * @returns 垂直扩展量（像素）
   */
  private detectVerticalExtensions(
    imageData: ImageData,
    bounds: { top: number; bottom: number; left: number; right: number },
    features: { hasScripts?: boolean; hasFractionStructure?: boolean; hasRoots?: boolean; hasLargeOperators?: boolean }
  ): { top: number; bottom: number } {
    let topExtension = 0;
    let bottomExtension = 0;

    // 如果特征表明有上下标，扩展搜索范围
    if (features.hasScripts) {
      const scriptExtension = this.detectScripts(imageData, bounds);
      topExtension = Math.max(topExtension, scriptExtension.top);
      bottomExtension = Math.max(bottomExtension, scriptExtension.bottom);
    }

    // 如果有分式结构，检测分数线上下的内容
    if (features.hasFractionStructure) {
      const fractionExtension = this.detectFractionBounds(imageData, bounds);
      topExtension = Math.max(topExtension, fractionExtension.top);
      bottomExtension = Math.max(bottomExtension, fractionExtension.bottom);
    }

    // 如果有根号或大型运算符（积分、求和），扩展边界
    if (features.hasRoots || features.hasLargeOperators) {
      const largeSymbolExtension = this.detectLargeSymbols(imageData, bounds);
      topExtension = Math.max(topExtension, largeSymbolExtension.top);
      bottomExtension = Math.max(bottomExtension, largeSymbolExtension.bottom);
    }

    return { top: topExtension, bottom: bottomExtension };
  }

  /**
   * 检测上下标
   */
  private detectScripts(
    imageData: ImageData,
    bounds: { top: number; bottom: number; left: number; right: number }
  ): { top: number; bottom: number } {
    const mainHeight = bounds.bottom - bounds.top;
    const searchRange = Math.floor(mainHeight * 0.5); // 搜索主体高度的50%

    let topExtension = 0;
    let bottomExtension = 0;

    // 检测上方的上标
    for (let y = bounds.top - 1; y >= Math.max(0, bounds.top - searchRange); y--) {
      if (this.hasContentInRow(imageData, y, bounds.left, bounds.right)) {
        topExtension = bounds.top - y;
      } else if (topExtension > 0) {
        break; // 遇到空行，停止搜索
      }
    }

    // 检测下方的下标
    for (let y = bounds.bottom + 1; y < Math.min(imageData.height, bounds.bottom + searchRange); y++) {
      if (this.hasContentInRow(imageData, y, bounds.left, bounds.right)) {
        bottomExtension = y - bounds.bottom;
      } else if (bottomExtension > 0) {
        break;
      }
    }

    return { top: topExtension, bottom: bottomExtension };
  }

  /**
   * 检测分式边界
   */
  private detectFractionBounds(
    imageData: ImageData,
    bounds: { top: number; bottom: number; left: number; right: number }
  ): { top: number; bottom: number } {
    // 寻找水平分数线
    const fractionLineY = this.findHorizontalLine(imageData, bounds);

    if (fractionLineY === -1) {
      return { top: 0, bottom: 0 };
    }

    // 从分数线向上搜索分子
    let topExtension = 0;
    for (let y = fractionLineY - 1; y >= Math.max(0, bounds.top - 20); y--) {
      if (this.hasContentInRow(imageData, y, bounds.left, bounds.right)) {
        topExtension = Math.max(topExtension, bounds.top - y);
      }
    }

    // 从分数线向下搜索分母
    let bottomExtension = 0;
    for (let y = fractionLineY + 1; y < Math.min(imageData.height, bounds.bottom + 20); y++) {
      if (this.hasContentInRow(imageData, y, bounds.left, bounds.right)) {
        bottomExtension = Math.max(bottomExtension, y - bounds.bottom);
      }
    }

    return { top: topExtension, bottom: bottomExtension };
  }

  /**
   * 检测大型符号（根号、积分、求和）
   */
  private detectLargeSymbols(
    imageData: ImageData,
    bounds: { top: number; bottom: number; left: number; right: number }
  ): { top: number; bottom: number } {
    const mainHeight = bounds.bottom - bounds.top;
    const searchRange = Math.floor(mainHeight * 0.3);

    let topExtension = 0;
    let bottomExtension = 0;

    // 向上搜索
    for (let y = bounds.top - 1; y >= Math.max(0, bounds.top - searchRange); y--) {
      if (this.hasContentInRow(imageData, y, bounds.left, bounds.right)) {
        topExtension = bounds.top - y;
      }
    }

    // 向下搜索
    for (let y = bounds.bottom + 1; y < Math.min(imageData.height, bounds.bottom + searchRange); y++) {
      if (this.hasContentInRow(imageData, y, bounds.left, bounds.right)) {
        bottomExtension = y - bounds.bottom;
      }
    }

    return { top: topExtension, bottom: bottomExtension };
  }

  /**
   * 检查某一行是否有内容
   */
  private hasContentInRow(
    imageData: ImageData,
    y: number,
    left: number,
    right: number
  ): boolean {
    if (y < 0 || y >= imageData.height) {
      return false;
    }

    let contentPixels = 0;
    const width = right - left;

    for (let x = left; x < right && x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const gray = (r + g + b) / 3;

      if (gray < 200) {
        contentPixels++;
      }
    }

    return contentPixels / width > this.DENSITY_THRESHOLD;
  }

  /**
   * 查找水平分数线
   */
  private findHorizontalLine(
    imageData: ImageData,
    bounds: { top: number; bottom: number; left: number; right: number }
  ): number {
    const centerY = Math.floor((bounds.top + bounds.bottom) / 2);
    const searchRange = Math.floor((bounds.bottom - bounds.top) / 3);

    // 在中心区域搜索水平线
    for (let y = centerY - searchRange; y < centerY + searchRange; y++) {
      if (this.isHorizontalLine(imageData, y, bounds.left, bounds.right)) {
        return y;
      }
    }

    return -1;
  }

  /**
   * 判断某一行是否为水平线
   */
  private isHorizontalLine(
    imageData: ImageData,
    y: number,
    left: number,
    right: number
  ): boolean {
    if (y < 0 || y >= imageData.height) {
      return false;
    }

    let darkPixels = 0;
    const width = right - left;

    for (let x = left; x < right && x < imageData.width; x++) {
      const index = (y * imageData.width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const gray = (r + g + b) / 3;

      if (gray < 150) {
        darkPixels++;
      }
    }

    // 如果超过80%的像素是深色，认为是水平线
    return darkPixels / width > 0.8;
  }
}
