/**
 * Property Tests for ConfidenceScorer
 * Property 11: Confidence Score Validity and Thresholding
 * 验证置信度分数的有效性和阈值判断
 */

import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { ConfidenceScorer } from '../../utils/advancedFormulaDetection/ConfidenceScorer';
import type {
  DetectionCandidate,
  MathFeatures,
  ClassificationResult,
  ContentType,
  FormulaType,
} from '../../utils/advancedFormulaDetection/types';

describe('ConfidenceScorer Property Tests', () => {
  const scorer = new ConfidenceScorer();

  // Arbitraries for generating test data
  const mathFeaturesArb = fc.record({
    hasGreekLetters: fc.boolean(),
    hasIntegralSymbols: fc.boolean(),
    hasSummationSymbols: fc.boolean(),
    hasFractionLines: fc.boolean(),
    hasSuperscripts: fc.boolean(),
    hasSubscripts: fc.boolean(),
    hasMatrixBrackets: fc.boolean(),
    hasRootSymbols: fc.boolean(),
    aspectRatio: fc.double({ min: 0.1, max: 10 }),
    density: fc.double({ min: 0, max: 1 }),
    verticalComplexity: fc.double({ min: 0, max: 1 }),
    horizontalSpacing: fc.double({ min: 0, max: 1 }),
    edgeDensity: fc.double({ min: 0, max: 1 }),
    strokeWidth: fc.double({ min: 1, max: 10 }),
    uniformity: fc.double({ min: 0, max: 1 }),
    surroundingTextDensity: fc.double({ min: 0, max: 1 }),
    verticalAlignment: fc.constantFrom('top', 'middle', 'bottom', 'isolated'),
    horizontalAlignment: fc.constantFrom('left', 'center', 'right'),
  });

  const contentTypeArb = fc.constantFrom<ContentType>('formula', 'image', 'table', 'text');

  const classificationArb = fc.record({
    type: contentTypeArb,
    confidence: fc.double({ min: 0, max: 1 }),
  }).map(({ type, confidence }) => ({
    type,
    confidence,
    scores: {
      formula: type === 'formula' ? confidence : fc.sample(fc.double({ min: 0, max: 0.5 }), 1)[0],
      image: type === 'image' ? confidence : fc.sample(fc.double({ min: 0, max: 0.5 }), 1)[0],
      table: type === 'table' ? confidence : fc.sample(fc.double({ min: 0, max: 0.5 }), 1)[0],
      text: type === 'text' ? confidence : fc.sample(fc.double({ min: 0, max: 0.5 }), 1)[0],
    },
    reasoning: ['Generated classification'],
  }));

  const detectionCandidateArb = fc.record({
    width: fc.integer({ min: 10, max: 200 }),
    height: fc.integer({ min: 10, max: 100 }),
    tightness: fc.double({ min: 0, max: 1 }),
    formulaType: fc.constantFrom<FormulaType>('display', 'inline'),
    formulaConfidence: fc.double({ min: 0, max: 1 }),
  }).map(({ width, height, tightness, formulaType, formulaConfidence }) => ({
    region: {
      x: 0,
      y: 0,
      width,
      height,
      imageData: new ImageData(width, height),
      binaryData: new Uint8Array(width * height),
    },
    boundary: {
      x: 0,
      y: 0,
      width,
      height,
      contour: [{ x: 0, y: 0 }],
      tightness,
    },
    formulaType: {
      type: formulaType,
      confidence: formulaConfidence,
      reasoning: ['Generated formula type'],
    },
  }));

  it('should always return confidence scores in [0, 1] range', () => {
    fc.assert(
      fc.property(
        detectionCandidateArb,
        mathFeaturesArb,
        classificationArb,
        (detection, features, classification) => {
          const result = scorer.calculateConfidence(detection, features, classification);
          
          // Overall confidence should be in [0, 1]
          expect(result.overall).toBeGreaterThanOrEqual(0);
          expect(result.overall).toBeLessThanOrEqual(1);
          expect(isNaN(result.overall)).toBe(false);
          
          // All breakdown scores should be in [0, 1]
          expect(result.breakdown.featureMatch).toBeGreaterThanOrEqual(0);
          expect(result.breakdown.featureMatch).toBeLessThanOrEqual(1);
          expect(result.breakdown.classificationCertainty).toBeGreaterThanOrEqual(0);
          expect(result.breakdown.classificationCertainty).toBeLessThanOrEqual(1);
          expect(result.breakdown.boundaryClarity).toBeGreaterThanOrEqual(0);
          expect(result.breakdown.boundaryClarity).toBeLessThanOrEqual(1);
          expect(result.breakdown.contextConsistency).toBeGreaterThanOrEqual(0);
          expect(result.breakdown.contextConsistency).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly classify confidence levels', () => {
    fc.assert(
      fc.property(
        detectionCandidateArb,
        mathFeaturesArb,
        classificationArb,
        (detection, features, classification) => {
          const result = scorer.calculateConfidence(detection, features, classification);
          
          // Verify level matches overall score
          if (result.overall >= 0.85) {
            expect(result.level).toBe('high');
          } else if (result.overall >= 0.6) {
            expect(result.level).toBe('medium');
          } else {
            expect(result.level).toBe('low');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have higher confidence for formulas with more features', () => {
    fc.assert(
      fc.property(
        detectionCandidateArb,
        classificationArb,
        (detection, classification) => {
          // Create features with no math symbols
          const noFeatures: MathFeatures = {
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
            verticalComplexity: 0.2,
            horizontalSpacing: 0.5,
            edgeDensity: 0.3,
            strokeWidth: 2,
            uniformity: 0.7,
            surroundingTextDensity: 0.3,
            verticalAlignment: 'middle',
            horizontalAlignment: 'center',
          };
          
          // Create features with many math symbols
          const manyFeatures: MathFeatures = {
            ...noFeatures,
            hasGreekLetters: true,
            hasIntegralSymbols: true,
            hasSummationSymbols: true,
            hasFractionLines: true,
            hasSuperscripts: true,
            hasSubscripts: true,
            hasMatrixBrackets: true,
            hasRootSymbols: true,
            verticalComplexity: 0.6,
          };
          
          const result1 = scorer.calculateConfidence(detection, noFeatures, classification);
          const result2 = scorer.calculateConfidence(detection, manyFeatures, classification);
          
          // More features should generally lead to higher feature match score
          expect(result2.breakdown.featureMatch).toBeGreaterThanOrEqual(result1.breakdown.featureMatch);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reflect classification confidence in breakdown', () => {
    fc.assert(
      fc.property(
        detectionCandidateArb,
        mathFeaturesArb,
        fc.double({ min: 0, max: 1 }),
        (detection, features, classificationConfidence) => {
          const classification: ClassificationResult = {
            type: 'formula',
            confidence: classificationConfidence,
            scores: {
              formula: classificationConfidence,
              image: 0.1,
              table: 0.1,
              text: 0.1,
            },
            reasoning: ['Test'],
          };
          
          const result = scorer.calculateConfidence(detection, features, classification);
          
          // Classification certainty should match the input confidence
          expect(result.breakdown.classificationCertainty).toBe(classificationConfidence);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reflect boundary tightness in breakdown', () => {
    fc.assert(
      fc.property(
        mathFeaturesArb,
        classificationArb,
        fc.double({ min: 0, max: 1 }),
        (features, classification, tightness) => {
          const detection: DetectionCandidate = {
            region: {
              x: 0,
              y: 0,
              width: 100,
              height: 50,
              imageData: new ImageData(100, 50),
              binaryData: new Uint8Array(5000),
            },
            boundary: {
              x: 0,
              y: 0,
              width: 100,
              height: 50,
              contour: [{ x: 0, y: 0 }],
              tightness,
            },
            formulaType: {
              type: 'display',
              confidence: 0.8,
              reasoning: ['Test'],
            },
          };
          
          const result = scorer.calculateConfidence(detection, features, classification);
          
          // Boundary clarity should match the tightness
          expect(result.breakdown.boundaryClarity).toBe(tightness);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always return a valid level', () => {
    fc.assert(
      fc.property(
        detectionCandidateArb,
        mathFeaturesArb,
        classificationArb,
        (detection, features, classification) => {
          const result = scorer.calculateConfidence(detection, features, classification);
          
          // Level should be one of the three valid values
          expect(['high', 'medium', 'low']).toContain(result.level);
        }
      ),
      { numRuns: 100 }
    );
  });
});
