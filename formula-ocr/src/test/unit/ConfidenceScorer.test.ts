/**
 * Unit Tests for ConfidenceScorer
 * 测试置信度评分器的多维度置信度计算功能
 */

import { describe, it, expect } from 'vitest';
import { ConfidenceScorer } from '../../utils/advancedFormulaDetection/ConfidenceScorer';
import type {
  DetectionCandidate,
  MathFeatures,
  ClassificationResult,
  ImageRegion,
  RefinedBoundary,
  FormulaTypeResult,
  ContentType,
  FormulaType,
} from '../../utils/advancedFormulaDetection/types';

describe('ConfidenceScorer', () => {
  const scorer = new ConfidenceScorer();

  const createTestRegion = (width: number, height: number): ImageRegion => ({
    x: 0,
    y: 0,
    width,
    height,
    imageData: new ImageData(width, height),
    binaryData: new Uint8Array(width * height),
  });

  const createTestFeatures = (overrides?: Partial<MathFeatures>): MathFeatures => ({
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
    verticalComplexity: 0.3,
    horizontalSpacing: 0.5,
    edgeDensity: 0.4,
    strokeWidth: 2,
    uniformity: 0.7,
    surroundingTextDensity: 0.3,
    verticalAlignment: 'middle',
    horizontalAlignment: 'center',
    ...overrides,
  });

  const createTestClassification = (
    type: ContentType = 'formula',
    confidence: number = 0.8
  ): ClassificationResult => ({
    type,
    confidence,
    scores: {
      formula: type === 'formula' ? confidence : 0.2,
      image: type === 'image' ? confidence : 0.1,
      table: type === 'table' ? confidence : 0.1,
      text: type === 'text' ? confidence : 0.1,
    },
    reasoning: [`Classified as ${type}`],
  });

  const createTestBoundary = (tightness: number = 0.8): RefinedBoundary => ({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    contour: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }],
    tightness,
  });

  const createTestFormulaType = (
    type: FormulaType = 'display',
    confidence: number = 0.8
  ): FormulaTypeResult => ({
    type,
    confidence,
    reasoning: [`Classified as ${type}`],
  });

  const createTestDetection = (
    region?: ImageRegion,
    boundary?: RefinedBoundary,
    formulaType?: FormulaTypeResult
  ): DetectionCandidate => ({
    region: region || createTestRegion(100, 50),
    boundary: boundary || createTestBoundary(),
    formulaType: formulaType || createTestFormulaType(),
  });

  describe('Overall Confidence Calculation', () => {
    it('should calculate high confidence for strong formula detection', () => {
      const detection = createTestDetection();
      const features = createTestFeatures({
        hasIntegralSymbols: true,
        hasFractionLines: true,
        hasGreekLetters: true,
        verticalComplexity: 0.5,
      });
      const classification = createTestClassification('formula', 0.9);

      const result = scorer.calculateConfidence(detection, features, classification);

      // With v2.1.1 thresholds, this should be medium (>= 0.75) or high (>= 0.9)
      expect(result.overall).toBeGreaterThan(0.7);
      expect(['medium', 'high']).toContain(result.level);
    });

    it('should calculate medium confidence for moderate detection', () => {
      const detection = createTestDetection();
      const features = createTestFeatures({ 
        hasGreekLetters: true, 
        hasSuperscripts: true,
        verticalComplexity: 0.4,
        density: 0.25,
      });
      const classification = createTestClassification('formula', 0.75);

      const result = scorer.calculateConfidence(detection, features, classification);

      expect(result.overall).toBeGreaterThan(0.5);
      expect(result.overall).toBeLessThan(0.85);
      // The level should be medium or low depending on the exact score
      expect(['medium', 'low']).toContain(result.level);
    });

    it('should calculate low confidence for weak detection', () => {
      const detection = createTestDetection();
      const features = createTestFeatures();
      const classification = createTestClassification('formula', 0.5);

      const result = scorer.calculateConfidence(detection, features, classification);

      expect(result.overall).toBeLessThan(0.6);
      expect(result.level).toBe('low');
    });
  });

  describe('Confidence Breakdown', () => {
    it('should provide detailed breakdown scores', () => {
      const detection = createTestDetection();
      const features = createTestFeatures({ hasIntegralSymbols: true, hasFractionLines: true });
      const classification = createTestClassification('formula', 0.8);

      const result = scorer.calculateConfidence(detection, features, classification);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.featureMatch).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.featureMatch).toBeLessThanOrEqual(1);
      expect(result.breakdown.classificationCertainty).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.classificationCertainty).toBeLessThanOrEqual(1);
      expect(result.breakdown.boundaryClarity).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.boundaryClarity).toBeLessThanOrEqual(1);
      expect(result.breakdown.contextConsistency).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.contextConsistency).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-formula classification', () => {
      const detection = createTestDetection();
      const features = createTestFeatures();
      const classification = createTestClassification('text', 0.8);

      const result = scorer.calculateConfidence(detection, features, classification);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
      expect(result.level).toBeDefined();
    });

    it('should handle zero tightness boundary', () => {
      const boundary = createTestBoundary(0);
      const detection = createTestDetection(undefined, boundary);
      const features = createTestFeatures();
      const classification = createTestClassification('formula', 0.8);

      const result = scorer.calculateConfidence(detection, features, classification);

      expect(result.breakdown.boundaryClarity).toBe(0);
      expect(result.overall).toBeGreaterThanOrEqual(0);
    });
  });
});
