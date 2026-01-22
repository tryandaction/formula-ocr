/**
 * 批处理管理器
 * 负责管理批量检测任务，优化内存和性能
 */

import type {
  PageData,
  DetectionRegion,
  FormulaInstance,
  TextLayerData,
} from './types';

/**
 * 批处理管理器实现
 */
export class BatchProcessingManager {
  /** 标准页面阈值（像素） */
  private readonly STANDARD_PAGE_THRESHOLD = 2000 * 3000;
  
  /** 区域大小（像素） */
  private readonly REGION_SIZE = 1000;
  
  /** 重叠边距（像素） */
  private readonly OVERLAP_MARGIN_MIN = 50;
  private readonly OVERLAP_MARGIN_MAX = 100;

  /**
   * 将页面划分为多个检测区域
   * 根据页面大小智能划分：
   * - 标准页面（<2000x3000px）：不划分，整页处理
   * - 大型页面（≥2000x3000px）：划分为4-9个重叠区域
   * 
   * @param pageData - 页面数据
   * @returns 检测区域数组
   */
  divideIntoRegions(pageData: PageData): DetectionRegion[] {
    const { width, height, imageData, textLayer } = pageData;
    const pageArea = width * height;

    // 标准页面不划分
    if (pageArea < this.STANDARD_PAGE_THRESHOLD) {
      return [this.createRegion(0, 0, width, height, imageData, textLayer, 0)];
    }

    // 大型页面划分为多个区域
    const regions: DetectionRegion[] = [];

    // 计算行列数
    const cols = Math.ceil(width / this.REGION_SIZE);
    const rows = Math.ceil(height / this.REGION_SIZE);
    
    // 计算重叠边距（根据区域数量动态调整）
    const overlapMargin = Math.min(
      this.OVERLAP_MARGIN_MAX,
      Math.max(this.OVERLAP_MARGIN_MIN, Math.floor(this.REGION_SIZE * 0.1))
    );

    // 创建重叠区域
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = Math.max(0, col * this.REGION_SIZE - overlapMargin);
        const y = Math.max(0, row * this.REGION_SIZE - overlapMargin);
        const regionWidth = Math.min(
          this.REGION_SIZE + overlapMargin * 2,
          width - x
        );
        const regionHeight = Math.min(
          this.REGION_SIZE + overlapMargin * 2,
          height - y
        );

        // 提取区域图像数据
        const regionImageData = this.extractImageRegion(
          imageData,
          x,
          y,
          regionWidth,
          regionHeight,
          width
        );

        // 提取区域文本数据
        const regionTextData = this.extractTextRegion(
          textLayer,
          x,
          y,
          regionWidth,
          regionHeight
        );

        regions.push(
          this.createRegion(
            x,
            y,
            regionWidth,
            regionHeight,
            regionImageData,
            regionTextData,
            overlapMargin
          )
        );
      }
    }

    return regions;
  }

  /**
   * 并行处理多个区域
   * 使用Promise.all实现并行处理，提升性能
   * 
   * @param regions - 检测区域数组
   * @param processor - 处理函数
   * @returns 处理结果数组
   */
  async processRegionsInParallel<T>(
    regions: DetectionRegion[],
    processor: (region: DetectionRegion) => Promise<T>
  ): Promise<T[]> {
    return Promise.all(regions.map(region => processor(region)));
  }

  /**
   * 合并重叠区域的检测结果
   * 使用IoU（Intersection over Union）算法识别重复检测
   * 保留置信度更高的检测结果
   * 
   * @param results - 各区域的检测结果
   * @returns 去重后的公式实例数组
   */
  mergeResults(results: FormulaInstance[][]): FormulaInstance[] {
    // 展平所有结果
    const allFormulas = results.flat();

    if (allFormulas.length === 0) {
      return [];
    }

    // 按置信度降序排序
    allFormulas.sort((a, b) => b.confidence - a.confidence);

    // 去重
    const merged: FormulaInstance[] = [];
    const used = new Set<number>();

    for (let i = 0; i < allFormulas.length; i++) {
      if (used.has(i)) continue;

      const current = allFormulas[i];
      merged.push(current);
      used.add(i);

      // 查找与当前公式重叠的其他检测
      for (let j = i + 1; j < allFormulas.length; j++) {
        if (used.has(j)) continue;

        const other = allFormulas[j];
        const iou = this.calculateIoU(
          current.boundingBox,
          other.boundingBox
        );

        // 如果IoU > 0.5，认为是同一个公式
        if (iou > 0.5) {
          used.add(j);
        }
      }
    }

    return merged;
  }

  /**
   * 创建检测区域
   */
  private createRegion(
    x: number,
    y: number,
    width: number,
    height: number,
    imageData: ImageData,
    textData: TextLayerData,
    overlapMargin: number
  ): DetectionRegion {
    return {
      x,
      y,
      width,
      height,
      imageData,
      textData,
      overlapMargin,
    };
  }

  /**
   * 提取图像区域
   * 从完整页面图像中提取指定区域的图像数据
   */
  private extractImageRegion(
    sourceImageData: ImageData,
    x: number,
    y: number,
    width: number,
    height: number,
    sourceWidth: number
  ): ImageData {
    const regionData = new Uint8ClampedArray(width * height * 4);
    
    for (let row = 0; row < height; row++) {
      const sourceY = y + row;
      if (sourceY >= sourceImageData.height) break;
      
      for (let col = 0; col < width; col++) {
        const sourceX = x + col;
        if (sourceX >= sourceWidth) break;
        
        const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
        const targetIndex = (row * width + col) * 4;
        
        regionData[targetIndex] = sourceImageData.data[sourceIndex];
        regionData[targetIndex + 1] = sourceImageData.data[sourceIndex + 1];
        regionData[targetIndex + 2] = sourceImageData.data[sourceIndex + 2];
        regionData[targetIndex + 3] = sourceImageData.data[sourceIndex + 3];
      }
    }
    
    return new ImageData(regionData, width, height);
  }

  /**
   * 提取文本区域
   * 从完整页面文本层中提取指定区域的文本数据
   */
  private extractTextRegion(
    sourceTextLayer: TextLayerData,
    x: number,
    y: number,
    width: number,
    height: number
  ): TextLayerData {
    const regionItems = sourceTextLayer.items.filter(item => {
      // 从变换矩阵中提取位置
      const itemX = item.transform[4];
      const itemY = item.transform[5];
      
      // 检查文本项是否在区域内
      return (
        itemX >= x &&
        itemX < x + width &&
        itemY >= y &&
        itemY < y + height
      );
    });

    return {
      items: regionItems,
      styles: sourceTextLayer.styles,
    };
  }

  /**
   * 计算两个边界框的IoU（Intersection over Union）
   * IoU = 交集面积 / 并集面积
   */
  private calculateIoU(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): number {
    // 计算交集
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 <= x1 || y2 <= y1) {
      return 0; // 无交集
    }

    const intersectionArea = (x2 - x1) * (y2 - y1);

    // 计算并集
    const box1Area = box1.width * box1.height;
    const box2Area = box2.width * box2.height;
    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / unionArea;
  }
}
