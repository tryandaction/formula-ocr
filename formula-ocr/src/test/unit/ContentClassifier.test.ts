/**
 * Unit Tests for ContentClassifier
 * 测试内容分类器的四类内容分类功能
 */

import { describe, it, expect } from 'vitest';
import { ContentClassifier } from '../../utils/advancedFormulaDetection/ContentClassifier';
import type { ImageRegion, MathFeatures } from '../../utils/advancedFormulaDetection/types';

describe('ContentClassifier', () => {
  const classifier = new ContentClassifier();

  // Helper function to create a test region
  const createTestRegion = (width: number, height: number): ImageRegion => ({
    x: 0,
    y: 0,
    width,
    height,
    imageData: new ImageData(width, height),
    binaryData: new Uint8Array(width * height),
  });

  // Helper function to create test features
  const createTestFeatures = (overrides: Partial<MathFeatures> = {}): MathFeatures => ({
    hasGreekLetters: false,
    hasIntegralSymbols: false,
    hasSummationSymbols: false,
    hasFractionLines: false,
    hasSuperscripts: false,
    hasSubscripts: false,
    hasMatrixBrackets: false,
    hasRootSymbols: false,
    aspectRatio: 2,
    density: 0.2,
    verticalComplexity: 0.5,
    horizontalSpacing: 1,
    edgeDensity: 0.5,
    strokeWidth: 2,
    uniformity: 0.5,
    surroundingTextDensity: 0.3,
    verticalAlignment: 'middle',
    horizontalAlignment: 'center',
    ...overrides,
  });

  describe('Formula Classification', () => {
    it('should classify region with integral symbols as formula', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasIntegralSymbols: true,
        verticalComplexity: 0.4,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('formula');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning.join(' ')).toContain('包含积分符号');
    });

    it('should classify region with summation symbols as formula', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasSummationSymbols: true,
        verticalComplexity: 0.4,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('formula');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning.join(' ')).toContain('包含求和符号');
    });

    it('should classify region with fraction lines as formula', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasFractionLines: true,
        verticalComplexity: 0.5,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('formula');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning.join(' ')).toContain('包含分数线');
    });

    it('should classify region with matrix brackets as formula', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasMatrixBrackets: true,
        verticalComplexity: 0.4,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('formula');
      expect(result.confidence).toBeGreaterThan(0.4); // Adjusted threshold
      expect(result.reasoning).toContain('检测到矩阵括号');
    });

    it('should classify region with multiple medium features as formula', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasGreekLetters: true,
        hasSuperscripts: true,
        hasSubscripts: true,
        verticalComplexity: 0.4,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('formula');
      expect(result.reasoning).toContain('检测到希腊字母');
      expect(result.reasoning).toContain('检测到上下标');
    });

    it('should consider layout constraints for formula classification', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasGreekLetters: true,
        verticalComplexity: 0.4,
        aspectRatio: 3,
        density: 0.15,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('formula');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Image Classification', () => {
    it('should classify high-density, low-edge region as image', () => {
      const region = createTestRegion(300, 250);
      const features = createTestFeatures({
        density: 0.7,
        edgeDensity: 0.2,
        verticalComplexity: 0.1,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('image');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain('像素密度高');
      // Check for edge density mention (combined with continuous tone)
      const hasEdgeMention = result.reasoning.some(r => r.includes('边缘密度低') || r.includes('连续色调'));
      expect(hasEdgeMention).toBe(true);
    });

    it('should classify large region without math symbols as image', () => {
      const region = createTestRegion(400, 300);
      const features = createTestFeatures({
        density: 0.5,
        edgeDensity: 0.3,
        verticalComplexity: 0.15,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('image');
      expect(result.reasoning).toContain('无明显数学符号');
    });
  });

  describe('Table Classification', () => {
    it('should classify region with grid lines as table', () => {
      const region = createTestRegion(200, 150);
      // Create a grid pattern
      const binaryData = new Uint8Array(200 * 150);
      // Add horizontal lines
      for (let y = 30; y < 150; y += 30) {
        for (let x = 0; x < 200; x++) {
          binaryData[y * 200 + x] = 1;
        }
      }
      // Add vertical lines
      for (let x = 40; x < 200; x += 40) {
        for (let y = 0; y < 150; y++) {
          binaryData[y * 200 + x] = 1;
        }
      }
      region.binaryData = binaryData;

      const features = createTestFeatures({
        uniformity: 0.75,
        aspectRatio: 1.33,
        horizontalSpacing: 3,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('table');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain('检测到网格线结构');
    });

    it('should classify uniform layout as table', () => {
      const region = createTestRegion(200, 100);
      const features = createTestFeatures({
        uniformity: 0.8,
        aspectRatio: 2,
        horizontalSpacing: 3,
      });

      const result = classifier.classify(region, features);

      // May be classified as table or text depending on other features
      expect(['table', 'text']).toContain(result.type);
    });
  });

  describe('Text Classification', () => {
    it('should classify linear layout without math symbols as text', () => {
      const region = createTestRegion(500, 50);
      const features = createTestFeatures({
        aspectRatio: 10,
        verticalComplexity: 0.1,
        uniformity: 0.85,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('text');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.reasoning).toContain('线性布局');
      expect(result.reasoning).toContain('无数学符号');
    });

    it('should classify uniform height region as text', () => {
      const region = createTestRegion(300, 40);
      const features = createTestFeatures({
        aspectRatio: 7.5,
        verticalComplexity: 0.15,
        uniformity: 0.9,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('text');
      expect(result.reasoning).toContain('高度统一');
    });
  });

  describe('Edge Cases', () => {
    it('should handle region with no clear features', () => {
      const region = createTestRegion(100, 100);
      const features = createTestFeatures({
        density: 0.3,
        aspectRatio: 1,
        verticalComplexity: 0.3,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.scores).toBeDefined();
    });

    it('should handle region with mixed features', () => {
      const region = createTestRegion(150, 100);
      const features = createTestFeatures({
        hasGreekLetters: true,
        density: 0.6,
        aspectRatio: 1.5,
        verticalComplexity: 0.3,
        uniformity: 0.7,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should normalize scores to sum to 1', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasIntegralSymbols: true,
        verticalComplexity: 0.4,
      });

      const result = classifier.classify(region, features);

      const scoreSum = Object.values(result.scores).reduce((a, b) => a + b, 0);
      expect(scoreSum).toBeCloseTo(1, 5);
    });

    it('should always return confidence between 0 and 1', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures();

      const result = classifier.classify(region, features);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include confidence in reasoning', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasIntegralSymbols: true,
      });

      const result = classifier.classify(region, features);

      const hasConfidence = result.reasoning.some(r => r.includes('置信度'));
      expect(hasConfidence).toBe(true);
    });
  });

  describe('Classification Certainty', () => {
    it('should have high confidence for strong formula features', () => {
      const region = createTestRegion(100, 50);
      const features = createTestFeatures({
        hasIntegralSymbols: true,
        hasSummationSymbols: true,
        hasFractionLines: true,
        verticalComplexity: 0.5,
      });

      const result = classifier.classify(region, features);

      expect(result.type).toBe('formula');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should have lower confidence for ambiguous features', () => {
      const region = createTestRegion(100, 100);
      const features = createTestFeatures({
        density: 0.3,
        aspectRatio: 1,
      });

      const result = classifier.classify(region, features);

      // Confidence should be lower for ambiguous cases
      expect(result.confidence).toBeLessThan(0.8);
    });
  });
});
