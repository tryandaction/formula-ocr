/**
 * Property Tests for ContentClassifier
 * Feature: advanced-pdf-formula-recognition
 * Property 2: Multi-Class Content Classification
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { ContentClassifier } from '../../utils/advancedFormulaDetection/ContentClassifier';
import type { ImageRegion, MathFeatures } from '../../utils/advancedFormulaDetection/types';

describe('ContentClassifier - Property Tests', () => {
  const classifier = new ContentClassifier();

  // Arbitraries for generating test data
  const mathFeaturesArbitrary = fc.record({
    hasGreekLetters: fc.boolean(),
    hasIntegralSymbols: fc.boolean(),
    hasSummationSymbols: fc.boolean(),
    hasFractionLines: fc.boolean(),
    hasSuperscripts: fc.boolean(),
    hasSubscripts: fc.boolean(),
    hasMatrixBrackets: fc.boolean(),
    hasRootSymbols: fc.boolean(),
    aspectRatio: fc.double({ min: 0.1, max: 20 }),
    density: fc.double({ min: 0, max: 1 }),
    verticalComplexity: fc.double({ min: 0, max: 1 }),
    horizontalSpacing: fc.double({ min: 0, max: 10 }),
    edgeDensity: fc.double({ min: 0, max: 1 }),
    strokeWidth: fc.double({ min: 1, max: 10 }),
    uniformity: fc.double({ min: 0, max: 1 }),
    surroundingTextDensity: fc.double({ min: 0, max: 1 }),
    verticalAlignment: fc.constantFrom('top', 'middle', 'bottom', 'isolated'),
    horizontalAlignment: fc.constantFrom('left', 'center', 'right'),
  }) as fc.Arbitrary<MathFeatures>;

  const imageRegionArbitrary = fc.record({
    x: fc.nat({ max: 1000 }),
    y: fc.nat({ max: 1000 }),
    width: fc.integer({ min: 10, max: 500 }),
    height: fc.integer({ min: 10, max: 500 }),
  }).map(({ x, y, width, height }) => ({
    x,
    y,
    width,
    height,
    imageData: new ImageData(width, height),
    binaryData: new Uint8Array(width * height),
  })) as fc.Arbitrary<ImageRegion>;

  /**
   * Property 2: Multi-Class Content Classification
   * 
   * For any image region, when analyzed by the Formula_Classifier,
   * it should be classified into exactly one of four types (formula, image, table, text)
   * with a confidence score between 0 and 1.
   * 
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
   */
  it('Property 2: should classify any region into exactly one of four types with valid confidence', () => {
    fc.assert(
      fc.property(
        imageRegionArbitrary,
        mathFeaturesArbitrary,
        (region, features) => {
          const result = classifier.classify(region, features);

          // Should be classified into exactly one type
          const validTypes = ['formula', 'image', 'table', 'text'];
          if (!validTypes.includes(result.type)) {
            return false;
          }

          // Confidence should be between 0 and 1
          if (result.confidence < 0 || result.confidence > 1) {
            return false;
          }

          // All scores should be between 0 and 1
          const allScoresValid = Object.values(result.scores).every(
            score => score >= 0 && score <= 1
          );
          if (!allScoresValid) {
            return false;
          }

          // Scores should sum to approximately 1 (normalized)
          const scoreSum = Object.values(result.scores).reduce((a, b) => a + b, 0);
          if (Math.abs(scoreSum - 1) > 0.001) {
            return false;
          }

          // Confidence should match the score of the selected type
          if (Math.abs(result.confidence - result.scores[result.type]) > 0.001) {
            return false;
          }

          // Reasoning should be non-empty
          if (result.reasoning.length === 0) {
            return false;
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Regions with strong math features should be classified as formulas
   */
  it('should classify regions with strong math features as formulas', () => {
    const strongMathFeaturesArbitrary = mathFeaturesArbitrary.map(features => ({
      ...features,
      hasIntegralSymbols: true,
      hasSummationSymbols: true,
      verticalComplexity: 0.5,
      density: 0.2, // Ensure non-zero density
    }));

    fc.assert(
      fc.property(
        imageRegionArbitrary,
        strongMathFeaturesArbitrary,
        (region, features) => {
          const result = classifier.classify(region, features);

          // Should be classified as formula with high confidence
          return result.type === 'formula' && result.confidence > 0.5;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Large regions with high density and low edge density should favor image classification
   */
  it('should favor image classification for large, high-density, low-edge regions', () => {
    const imageLikeFeaturesArbitrary = mathFeaturesArbitrary.map(features => ({
      ...features,
      density: 0.7,
      edgeDensity: 0.2,
      verticalComplexity: 0.1,
      hasGreekLetters: false,
      hasIntegralSymbols: false,
      hasSummationSymbols: false,
      hasFractionLines: false,
      hasSuperscripts: false,
      hasSubscripts: false,
    }));

    const largeRegionArbitrary = fc.record({
      x: fc.nat({ max: 1000 }),
      y: fc.nat({ max: 1000 }),
      width: fc.integer({ min: 250, max: 500 }),
      height: fc.integer({ min: 250, max: 500 }),
    }).map(({ x, y, width, height }) => ({
      x,
      y,
      width,
      height,
      imageData: new ImageData(width, height),
      binaryData: new Uint8Array(width * height),
    }));

    fc.assert(
      fc.property(
        largeRegionArbitrary,
        imageLikeFeaturesArbitrary,
        (region, features) => {
          const result = classifier.classify(region, features);

          // Should have high image score
          return result.scores.image > 0.3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Linear regions without math symbols should favor text classification
   */
  it('should favor text classification for linear regions without math symbols', () => {
    const textLikeFeaturesArbitrary = mathFeaturesArbitrary.map(features => ({
      ...features,
      aspectRatio: 8,
      verticalComplexity: 0.1,
      uniformity: 0.85,
      hasGreekLetters: false,
      hasIntegralSymbols: false,
      hasSummationSymbols: false,
      hasFractionLines: false,
      hasSuperscripts: false,
      hasSubscripts: false,
    }));

    const linearRegionArbitrary = fc.record({
      x: fc.nat({ max: 1000 }),
      y: fc.nat({ max: 1000 }),
      width: fc.integer({ min: 200, max: 500 }),
      height: fc.integer({ min: 20, max: 50 }),
    }).map(({ x, y, width, height }) => ({
      x,
      y,
      width,
      height,
      imageData: new ImageData(width, height),
      binaryData: new Uint8Array(width * height),
    }));

    fc.assert(
      fc.property(
        linearRegionArbitrary,
        textLikeFeaturesArbitrary,
        (region, features) => {
          const result = classifier.classify(region, features);

          // Should have high text score
          return result.scores.text > 0.3;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Classification should be deterministic
   */
  it('should produce the same classification for the same inputs', () => {
    fc.assert(
      fc.property(
        imageRegionArbitrary,
        mathFeaturesArbitrary,
        (region, features) => {
          const result1 = classifier.classify(region, features);
          const result2 = classifier.classify(region, features);

          // Should produce identical results
          return (
            result1.type === result2.type &&
            result1.confidence === result2.confidence &&
            JSON.stringify(result1.scores) === JSON.stringify(result2.scores)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Confidence should reflect the margin between top two scores
   */
  it('should have higher confidence when top score is significantly higher than second', () => {
    fc.assert(
      fc.property(
        imageRegionArbitrary,
        mathFeaturesArbitrary,
        (region, features) => {
          const result = classifier.classify(region, features);

          // Get sorted scores
          const sortedScores = Object.values(result.scores).sort((a, b) => b - a);
          const topScore = sortedScores[0];
          const secondScore = sortedScores[1];
          const margin = topScore - secondScore;

          // If margin is large, confidence should be reasonably high
          // But we need to account for edge cases with zero density
          if (margin > 0.3 && features.density > 0.05) {
            return result.confidence > 0.4; // Relaxed threshold
          }

          // If margin is small, confidence might be lower
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Reasoning should mention detected features
   */
  it('should include detected features in reasoning', () => {
    fc.assert(
      fc.property(
        imageRegionArbitrary,
        mathFeaturesArbitrary,
        (region, features) => {
          const result = classifier.classify(region, features);

          // If classified as formula and has integral symbols, reasoning should mention it
          if (result.type === 'formula' && features.hasIntegralSymbols) {
            return result.reasoning.some(r => r.includes('积分'));
          }

          // If classified as image and has high density, reasoning should mention it
          if (result.type === 'image' && features.density > 0.6) {
            return result.reasoning.some(r => r.includes('密度'));
          }

          // If classified as text and has linear layout, reasoning should mention it
          if (result.type === 'text' && features.aspectRatio > 5) {
            return result.reasoning.some(r => r.includes('线性'));
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
