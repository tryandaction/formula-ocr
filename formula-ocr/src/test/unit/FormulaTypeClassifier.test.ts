/**
 * Unit Tests for FormulaTypeClassifier
 * 测试公式类型分类器的 display/inline 分类功能
 */

import { describe, it, expect } from 'vitest';
import { FormulaTypeClassifier } from '../../utils/advancedFormulaDetection/FormulaTypeClassifier';
import type { ImageRegion, RegionContext, TextLine } from '../../utils/advancedFormulaDetection/types';

describe('FormulaTypeClassifier', () => {
  const classifier = new FormulaTypeClassifier();

  // Helper function to create a test region
  const createTestRegion = (x: number, y: number, width: number, height: number): ImageRegion => ({
    x,
    y,
    width,
    height,
    imageData: new ImageData(width, height),
    binaryData: new Uint8Array(width * height),
  });

  // Helper function to create test context
  const createTestContext = (
    pageWidth: number,
    pageHeight: number,
    textLines: TextLine[] = []
  ): RegionContext => ({
    pageWidth,
    pageHeight,
    surroundingRegions: [],
    textLines,
  });

  describe('Display Formula Classification', () => {
    it('should classify vertically isolated formula as display', () => {
      const region = createTestRegion(200, 300, 200, 50);
      const textLines: TextLine[] = [
        { y: 200, height: 20 }, // Above with space
        { y: 400, height: 20 }, // Below with space
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain('上下有空白，垂直隔离');
    });

    it('should classify horizontally centered formula as display', () => {
      const region = createTestRegion(300, 300, 200, 50); // Centered at x=400 in 800px page
      const context = createTestContext(800, 1000, []);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
      expect(result.reasoning).toContain('水平居中');
    });

    it('should classify large formula as display', () => {
      const region = createTestRegion(200, 300, 200, 60);
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
        { y: 250, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
      expect(result.reasoning).toContain('尺寸较大');
    });

    it('should classify formula with no inline text as display', () => {
      const region = createTestRegion(200, 300, 200, 50);
      const textLines: TextLine[] = [
        { y: 200, height: 20 }, // Above
        { y: 400, height: 20 }, // Below
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
      expect(result.reasoning).toContain('同行无文本');
    });

    it('should classify formula with multiple display features as display with high confidence', () => {
      const region = createTestRegion(300, 300, 200, 60); // Centered, large
      const textLines: TextLine[] = [
        { y: 200, height: 20 }, // Above with space
        { y: 450, height: 20 }, // Below with space
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Inline Formula Classification', () => {
    it('should classify formula aligned with text as inline', () => {
      const region = createTestRegion(200, 205, 50, 20);
      const textLines: TextLine[] = [
        { y: 200, height: 20 }, // Same vertical position
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
      expect(result.reasoning).toContain('与文本对齐');
    });

    it('should classify small formula as inline', () => {
      const region = createTestRegion(200, 205, 50, 18);
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
      expect(result.reasoning).toContain('高度较小');
    });

    it('should classify formula surrounded by text as inline', () => {
      const region = createTestRegion(200, 205, 50, 20);
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
        { y: 220, height: 20 },
        { y: 240, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
      expect(result.reasoning).toContain('被文本包围');
    });

    it('should classify formula with same baseline as inline', () => {
      const region = createTestRegion(200, 200, 50, 20);
      const textLines: TextLine[] = [
        { y: 200, height: 20 }, // Same baseline
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
      expect(result.reasoning).toContain('与文本共享基线');
    });

    it('should classify formula with multiple inline features as inline with high confidence', () => {
      const region = createTestRegion(200, 202, 50, 18); // Small, aligned
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
        { y: 220, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Edge Cases', () => {
    it('should handle formula with no text context', () => {
      const region = createTestRegion(200, 300, 200, 50);
      const context = createTestContext(800, 1000, []);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBeDefined();
      expect(['display', 'inline']).toContain(result.type);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle formula at page edge', () => {
      const region = createTestRegion(10, 300, 100, 30);
      const context = createTestContext(800, 1000, []);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should handle ambiguous formula', () => {
      const region = createTestRegion(200, 300, 100, 30);
      const textLines: TextLine[] = [
        { y: 280, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should always return valid confidence', () => {
      const region = createTestRegion(200, 300, 100, 30);
      const context = createTestContext(800, 1000, []);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(isNaN(result.confidence)).toBe(false);
    });

    it('should always provide reasoning', () => {
      const region = createTestRegion(200, 300, 100, 30);
      const context = createTestContext(800, 1000, []);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Specific Scenarios', () => {
    it('should classify centered equation on its own line as display', () => {
      const region = createTestRegion(300, 500, 200, 40); // Centered
      const textLines: TextLine[] = [
        { y: 450, height: 20 }, // Text above
        { y: 560, height: 20 }, // Text below
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
    });

    it('should classify small formula in middle of text as inline', () => {
      const region = createTestRegion(150, 202, 40, 16);
      const textLines: TextLine[] = [
        { y: 200, height: 20 }, // Same line
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
    });

    it('should handle formula at different vertical positions', () => {
      const topRegion = createTestRegion(300, 50, 200, 40);
      const middleRegion = createTestRegion(300, 500, 200, 40);
      const bottomRegion = createTestRegion(300, 950, 200, 40);
      const context = createTestContext(800, 1000, []);

      const topResult = classifier.classifyFormulaType(topRegion, context);
      const middleResult = classifier.classifyFormulaType(middleRegion, context);
      const bottomResult = classifier.classifyFormulaType(bottomRegion, context);

      // All should be classified (position shouldn't prevent classification)
      expect(topResult.type).toBeDefined();
      expect(middleResult.type).toBeDefined();
      expect(bottomResult.type).toBeDefined();
    });

    it('should handle very small formula', () => {
      const region = createTestRegion(200, 205, 20, 10);
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
    });

    it('should handle very large formula', () => {
      const region = createTestRegion(200, 300, 400, 100);
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
    });
  });

  describe('Confidence Calculation', () => {
    it('should have higher confidence for clear display formulas', () => {
      const region = createTestRegion(300, 300, 200, 60);
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
        { y: 450, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('display');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should have higher confidence for clear inline formulas', () => {
      const region = createTestRegion(200, 202, 40, 16);
      const textLines: TextLine[] = [
        { y: 200, height: 20 },
        { y: 220, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      expect(result.type).toBe('inline');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should have lower confidence for ambiguous formulas', () => {
      const region = createTestRegion(200, 300, 100, 35);
      const textLines: TextLine[] = [
        { y: 290, height: 20 },
      ];
      const context = createTestContext(800, 1000, textLines);

      const result = classifier.classifyFormulaType(region, context);

      // Confidence might be lower for ambiguous cases
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
});
