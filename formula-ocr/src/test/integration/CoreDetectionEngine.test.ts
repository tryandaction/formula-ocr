/**
 * 核心检测引擎集成测试
 * 验证整个检测流程的正确性
 */

import { describe, it, expect } from 'vitest';
import {
  WholePageProcessor,
  BatchProcessingManager,
  BoundaryLocator,
  ConfidenceScorer,
  DetectionOptimizer,
  ClipboardManager,
} from '../../utils/wholePageRecognition';
import type { PageData } from '../../utils/wholePageRecognition';

// 创建模拟页面数据
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

describe('Core Detection Engine Integration', () => {
  describe('WholePageProcessor', () => {
    it('should process standard page successfully', async () => {
      const processor = new WholePageProcessor();
      const pageData = createMockPageData(1000, 1500);
      
      const formulas = await processor.processWholePage(pageData);
      
      expect(Array.isArray(formulas)).toBe(true);
      expect(processor.getProgress()).toBe(100);
    });

    it('should handle large pages with region division', async () => {
      const processor = new WholePageProcessor();
      const pageData = createMockPageData(2500, 3500);
      
      const formulas = await processor.processWholePage(pageData);
      
      expect(Array.isArray(formulas)).toBe(true);
      expect(processor.getProgress()).toBe(100);
    });

    it('should filter by confidence threshold', async () => {
      const processor = new WholePageProcessor();
      const pageData = createMockPageData(1000, 1500);
      
      const formulas = await processor.processWholePage(pageData, {
        confidenceThreshold: 0.9,
      });
      
      formulas.forEach(formula => {
        expect(formula.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });
  });

  describe('BatchProcessingManager', () => {
    it('should not divide standard pages', () => {
      const manager = new BatchProcessingManager();
      const pageData = createMockPageData(1000, 1500);
      
      const regions = manager.divideIntoRegions(pageData);
      
      expect(regions).toHaveLength(1);
      expect(regions[0].width).toBe(1000);
      expect(regions[0].height).toBe(1500);
    });

    it('should divide large pages into regions', () => {
      const manager = new BatchProcessingManager();
      const pageData = createMockPageData(2500, 3500);
      
      const regions = manager.divideIntoRegions(pageData);
      
      expect(regions.length).toBeGreaterThan(1);
      regions.forEach(region => {
        expect(region.overlapMargin).toBeGreaterThan(0);
      });
    });
  });

  describe('ClipboardManager', () => {
    it('should check API availability', () => {
      const manager = new ClipboardManager();
      const available = manager.isAvailable();
      
      expect(typeof available).toBe('boolean');
    });

    it('should handle text copy', async () => {
      const manager = new ClipboardManager();
      
      if (manager.isAvailable()) {
        const result = await manager.copyText('Test formula: E = mc²');
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Component Integration', () => {
    it('should work together seamlessly', async () => {
      // 创建所有组件
      const processor = new WholePageProcessor();
      const batchManager = new BatchProcessingManager();
      const boundaryLocator = new BoundaryLocator();
      const confidenceScorer = new ConfidenceScorer();
      const optimizer = new DetectionOptimizer();
      const clipboardManager = new ClipboardManager();
      
      // 验证所有组件都已创建
      expect(processor).toBeDefined();
      expect(batchManager).toBeDefined();
      expect(boundaryLocator).toBeDefined();
      expect(confidenceScorer).toBeDefined();
      expect(optimizer).toBeDefined();
      expect(clipboardManager).toBeDefined();
      
      // 测试完整流程
      const pageData = createMockPageData(1000, 1500);
      const formulas = await processor.processWholePage(pageData);
      
      expect(formulas).toBeDefined();
      expect(Array.isArray(formulas)).toBe(true);
    });
  });
});
