/**
 * BatchProcessingManager 单元测试
 */

import { describe, it, expect } from 'vitest';
import { BatchProcessingManager } from '../../utils/wholePageRecognition/BatchProcessingManager';
import type { PageData, FormulaInstance, BoundingBox } from '../../utils/wholePageRecognition/types';

// 辅助函数：创建模拟页面数据
function createMockPageData(width: number, height: number): PageData {
  const imageData = new ImageData(width, height);
  
  return {
    imageData,
    textLayer: {
      items: [],
      styles: {},
    },
    width,
    height,
    pageNumber: 1,
  };
}

// 辅助函数：创建模拟公式实例
function createMockFormula(
  id: string,
  boundingBox: BoundingBox,
  confidence: number
): FormulaInstance {
  return {
    id,
    boundingBox,
    confidence,
    type: 'display',
    imageData: '',
    pageNumber: 1,
    detectionTimestamp: Date.now(),
    metadata: {
      hasSubscript: false,
      hasSuperscript: false,
      hasFraction: false,
      hasIntegral: false,
      hasSummation: false,
      hasMatrix: false,
      hasGreekLetters: false,
      complexity: 'simple',
    },
  };
}

describe('BatchProcessingManager', () => {
  describe('divideIntoRegions', () => {

    it('should not divide standard page', () => {
      const manager = new BatchProcessingManager();
      const pageData = createMockPageData(1000, 1500);
      
      const regions = manager.divideIntoRegions(pageData);
      
      expect(regions).toHaveLength(1);
      expect(regions[0].x).toBe(0);
      expect(regions[0].y).toBe(0);
      expect(regions[0].width).toBe(1000);
      expect(regions[0].height).toBe(1500);
    });

    it('should divide large page into multiple regions', () => {
      const manager = new BatchProcessingManager();
      const pageData = createMockPageData(2500, 3500);
      
      const regions = manager.divideIntoRegions(pageData);
      
      // 应该划分为多个区域
      expect(regions.length).toBeGreaterThan(1);
      
      // 每个区域应该有重叠边距
      regions.forEach(region => {
        expect(region.overlapMargin).toBeGreaterThan(0);
      });
    });

    it('should create overlapping regions', () => {
      const manager = new BatchProcessingManager();
      const pageData = createMockPageData(2500, 2500);
      
      const regions = manager.divideIntoRegions(pageData);
      
      // 检查相邻区域是否有重叠
      if (regions.length > 1) {
        const region1 = regions[0];
        const region2 = regions[1];
        
        // 如果是水平相邻，应该有X方向的重叠
        if (region1.y === region2.y) {
          const overlap = (region1.x + region1.width) - region2.x;
          expect(overlap).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('processRegionsInParallel', () => {
    it('should process all regions in parallel', async () => {
      const manager = new BatchProcessingManager();
      const pageData = createMockPageData(2500, 2500);
      const regions = manager.divideIntoRegions(pageData);
      
      const processedCount: number[] = [];
      const processor = async (region: any) => {
        processedCount.push(1);
        return region.x + region.y;
      };
      
      const results = await manager.processRegionsInParallel(regions, processor);
      
      expect(results).toHaveLength(regions.length);
      expect(processedCount).toHaveLength(regions.length);
    });
  });

  describe('mergeResults', () => {
    it('should handle empty results', () => {
      const manager = new BatchProcessingManager();
      const merged = manager.mergeResults([]);
      
      expect(merged).toEqual([]);
    });

    it('should handle no overlapping detections', () => {
      const manager = new BatchProcessingManager();
      
      const formula1 = createMockFormula(
        '1',
        { x: 100, y: 100, width: 50, height: 20, rotation: 0 },
        0.9
      );
      
      const formula2 = createMockFormula(
        '2',
        { x: 200, y: 200, width: 50, height: 20, rotation: 0 },
        0.85
      );
      
      const merged = manager.mergeResults([[formula1], [formula2]]);
      
      expect(merged).toHaveLength(2);
    });

    it('should remove duplicate detections with high IoU', () => {
      const manager = new BatchProcessingManager();
      
      // 两个几乎完全重叠的检测
      const formula1 = createMockFormula(
        '1',
        { x: 100, y: 100, width: 50, height: 20, rotation: 0 },
        0.9
      );
      
      const formula2 = createMockFormula(
        '2',
        { x: 102, y: 101, width: 50, height: 20, rotation: 0 },
        0.85
      );
      
      const merged = manager.mergeResults([[formula1], [formula2]]);
      
      // 应该只保留一个（置信度更高的）
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('1'); // 保留置信度更高的
    });

    it('should keep detections with low IoU', () => {
      const manager = new BatchProcessingManager();
      
      // 两个部分重叠但IoU较低的检测
      const formula1 = createMockFormula(
        '1',
        { x: 100, y: 100, width: 50, height: 20, rotation: 0 },
        0.9
      );
      
      const formula2 = createMockFormula(
        '2',
        { x: 130, y: 100, width: 50, height: 20, rotation: 0 },
        0.85
      );
      
      const merged = manager.mergeResults([[formula1], [formula2]]);
      
      // IoU较低，应该保留两个
      expect(merged).toHaveLength(2);
    });

    it('should sort by confidence before merging', () => {
      const manager = new BatchProcessingManager();
      
      const lowConfidence = createMockFormula(
        'low',
        { x: 100, y: 100, width: 50, height: 20, rotation: 0 },
        0.7
      );
      
      const highConfidence = createMockFormula(
        'high',
        { x: 102, y: 101, width: 50, height: 20, rotation: 0 },
        0.95
      );
      
      // 低置信度在前
      const merged = manager.mergeResults([[lowConfidence], [highConfidence]]);
      
      // 应该保留高置信度的
      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('high');
    });
  });
});
