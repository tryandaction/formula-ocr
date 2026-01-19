/**
 * FeatureExtractor Property-Based Tests
 * 特征提取器属性测试
 * 
 * Property 5: Mathematical Symbol Feature Detection
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { FeatureExtractor } from '../../utils/advancedFormulaDetection/FeatureExtractor';
import type { ImageRegion, RegionContext } from '../../utils/advancedFormulaDetection/types';

describe('FeatureExtractor - Property-Based Tests', () => {
  const extractor = new FeatureExtractor();

  /**
   * Helper to create an ImageRegion from binary data
   */
  function createRegionFromBinary(
    width: number,
    height: number,
    binaryData: Uint8Array
  ): ImageRegion {
    const imageData = new ImageData(width, height);
    
    for (let i = 0; i < binaryData.length; i++) {
      const pixelIdx = i * 4;
      const color = binaryData[i] === 1 ? 0 : 255;
      imageData.data[pixelIdx] = color;
      imageData.data[pixelIdx + 1] = color;
      imageData.data[pixelIdx + 2] = color;
      imageData.data[pixelIdx + 3] = 255;
    }
    
    return {
      x: 0,
      y: 0,
      width,
      height,
      imageData,
      binaryData,
    };
  }

  /**
   * Helper to create a test context
   */
  function createContext(
    pageWidth: number = 800,
    pageHeight: number = 1000
  ): RegionContext {
    return {
      pageWidth,
      pageHeight,
      surroundingRegions: [],
      textLines: [],
    };
  }

  /**
   * Arbitrary for generating valid image dimensions
   */
  const dimensionArb = fc.integer({ min: 10, max: 100 });

  /**
   * Arbitrary for generating binary image data
   */
  const binaryImageArb = fc.tuple(dimensionArb, dimensionArb).chain(([width, height]) =>
    fc.uint8Array({ minLength: width * height, maxLength: width * height }).map(arr => ({
      width,
      height,
      data: arr.map(v => (v > 127 ? 1 : 0) as 0 | 1),
    }))
  );

  describe('Property 5: Mathematical Symbol Feature Detection', () => {
    it('should always return valid MathFeatures structure', () => {
      fc.assert(
        fc.property(binaryImageArb, (img) => {
          const binaryData = new Uint8Array(img.data);
          const region = createRegionFromBinary(img.width, img.height, binaryData);
          const context = createContext();
          
          const features = extractor.extractFeatures(region, context);
          
          // All boolean feature flags must be boolean
          expect(typeof features.hasGreekLetters).toBe('boolean');
          expect(typeof features.hasIntegralSymbols).toBe('boolean');
          expect(typeof features.hasSummationSymbols).toBe('boolean');
          expect(typeof features.hasFractionLines).toBe('boolean');
          expect(typeof features.hasSuperscripts).toBe('boolean');
          expect(typeof features.hasSubscripts).toBe('boolean');
          expect(typeof features.hasMatrixBrackets).toBe('boolean');
          expect(typeof features.hasRootSymbols).toBe('boolean');
          
          // Layout features must be valid numbers
          expect(features.aspectRatio).toBeGreaterThan(0);
          expect(features.aspectRatio).toBeLessThan(Infinity);
          expect(features.density).toBeGreaterThanOrEqual(0);
          expect(features.density).toBeLessThanOrEqual(1);
          expect(features.verticalComplexity).toBeGreaterThanOrEqual(0);
          expect(features.horizontalSpacing).toBeGreaterThanOrEqual(0);
          
          // Texture features must be in valid ranges
          expect(features.edgeDensity).toBeGreaterThanOrEqual(0);
          expect(features.edgeDensity).toBeLessThanOrEqual(1);
          expect(features.strokeWidth).toBeGreaterThanOrEqual(0);
          expect(features.uniformity).toBeGreaterThanOrEqual(0);
          expect(features.uniformity).toBeLessThanOrEqual(1);
          
          // Context features must be valid
          expect(features.surroundingTextDensity).toBeGreaterThanOrEqual(0);
          expect(features.surroundingTextDensity).toBeLessThanOrEqual(1);
          expect(['top', 'middle', 'bottom', 'isolated']).toContain(features.verticalAlignment);
          expect(['left', 'center', 'right']).toContain(features.horizontalAlignment);
        }),
        { numRuns: 100 }
      );
    });

    it('should calculate aspect ratio correctly for any dimensions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 200 }),
          fc.integer({ min: 10, max: 200 }),
          (width, height) => {
            const binaryData = new Uint8Array(width * height);
            const region = createRegionFromBinary(width, height, binaryData);
            const context = createContext();
            
            const features = extractor.extractFeatures(region, context);
            
            const expectedRatio = width / height;
            expect(features.aspectRatio).toBeCloseTo(expectedRatio, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate density correctly for any binary pattern', () => {
      fc.assert(
        fc.property(binaryImageArb, (img) => {
          const binaryData = new Uint8Array(img.data);
          const region = createRegionFromBinary(img.width, img.height, binaryData);
          const context = createContext();
          
          const features = extractor.extractFeatures(region, context);
          
          // Calculate expected density
          const blackPixels = binaryData.filter(v => v === 1).length;
          const expectedDensity = blackPixels / binaryData.length;
          
          expect(features.density).toBeCloseTo(expectedDensity, 5);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle empty regions without errors', () => {
      fc.assert(
        fc.property(dimensionArb, dimensionArb, (width, height) => {
          const binaryData = new Uint8Array(width * height); // All zeros
          const region = createRegionFromBinary(width, height, binaryData);
          const context = createContext();
          
          const features = extractor.extractFeatures(region, context);
          
          // Empty region should have zero density
          expect(features.density).toBe(0);
          
          // Should not detect any symbols in empty region
          expect(features.hasGreekLetters).toBe(false);
          expect(features.hasIntegralSymbols).toBe(false);
          expect(features.hasSummationSymbols).toBe(false);
          expect(features.hasFractionLines).toBe(false);
          expect(features.hasMatrixBrackets).toBe(false);
          expect(features.hasRootSymbols).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle fully filled regions without errors', () => {
      fc.assert(
        fc.property(dimensionArb, dimensionArb, (width, height) => {
          const binaryData = new Uint8Array(width * height).fill(1); // All ones
          const region = createRegionFromBinary(width, height, binaryData);
          const context = createContext();
          
          const features = extractor.extractFeatures(region, context);
          
          // Fully filled region should have density of 1
          expect(features.density).toBeCloseTo(1, 5);
          
          // All features should be defined
          expect(features).toBeDefined();
          expect(typeof features.hasGreekLetters).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('should detect fraction lines when horizontal line exists with content above and below', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 30, max: 80 }),
          fc.integer({ min: 30, max: 80 }),
          (width, height) => {
            const binaryData = new Uint8Array(width * height);
            
            // Create content above middle
            const topStart = Math.floor(height * 0.2);
            const topEnd = Math.floor(height * 0.4);
            for (let y = topStart; y < topEnd; y++) {
              for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
                binaryData[y * width + x] = 1;
              }
            }
            
            // Create horizontal line in middle
            const lineY = Math.floor(height * 0.5);
            for (let x = 0; x < Math.floor(width * 0.8); x++) {
              binaryData[lineY * width + x] = 1;
            }
            
            // Create content below middle
            const bottomStart = Math.floor(height * 0.6);
            const bottomEnd = Math.floor(height * 0.8);
            for (let y = bottomStart; y < bottomEnd; y++) {
              for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
                binaryData[y * width + x] = 1;
              }
            }
            
            const region = createRegionFromBinary(width, height, binaryData);
            
            const result = extractor.detectFractionLines(region);
            
            // Should detect the fraction line
            expect(result).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect scripts without errors for various patterns', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 30, max: 80 }),
          fc.integer({ min: 30, max: 80 }),
          (width, height) => {
            const binaryData = new Uint8Array(width * height);
            
            // Create a random pattern with content in different vertical positions
            const hasTopContent = Math.random() > 0.5;
            const hasMiddleContent = Math.random() > 0.3;
            const hasBottomContent = Math.random() > 0.5;
            
            if (hasTopContent) {
              for (let y = 0; y < Math.floor(height * 0.3); y++) {
                for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
                  if (Math.random() > 0.5) binaryData[y * width + x] = 1;
                }
              }
            }
            
            if (hasMiddleContent) {
              for (let y = Math.floor(height * 0.35); y < Math.floor(height * 0.65); y++) {
                for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x++) {
                  if (Math.random() > 0.3) binaryData[y * width + x] = 1;
                }
              }
            }
            
            if (hasBottomContent) {
              for (let y = Math.floor(height * 0.7); y < height; y++) {
                for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x++) {
                  if (Math.random() > 0.5) binaryData[y * width + x] = 1;
                }
              }
            }
            
            const region = createRegionFromBinary(width, height, binaryData);
            
            const result = extractor.detectScripts(region);
            
            // Should return valid boolean values without crashing
            expect(typeof result.hasSuperscripts).toBe('boolean');
            expect(typeof result.hasSubscripts).toBe('boolean');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect matrix brackets when vertical structures exist on both sides', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 40, max: 80 }),
          fc.integer({ min: 30, max: 60 }),
          (width, height) => {
            const binaryData = new Uint8Array(width * height);
            
            // Left bracket
            const leftEnd = Math.floor(width * 0.15);
            for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.9); y++) {
              for (let x = 0; x < leftEnd; x++) {
                binaryData[y * width + x] = 1;
              }
            }
            
            // Right bracket
            const rightStart = Math.floor(width * 0.85);
            for (let y = Math.floor(height * 0.1); y < Math.floor(height * 0.9); y++) {
              for (let x = rightStart; x < width; x++) {
                binaryData[y * width + x] = 1;
              }
            }
            
            // Inner content
            for (let y = Math.floor(height * 0.4); y < Math.floor(height * 0.6); y++) {
              for (let x = Math.floor(width * 0.4); x < Math.floor(width * 0.6); x++) {
                binaryData[y * width + x] = 1;
              }
            }
            
            const region = createRegionFromBinary(width, height, binaryData);
            
            const result = extractor.detectMatrixBrackets(region);
            
            // Should detect brackets
            expect(result).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should determine horizontal alignment based on position', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 50 }),
          fc.integer({ min: 10, max: 50 }),
          fc.integer({ min: 0, max: 800 }),
          (width, height, xPos) => {
            const binaryData = new Uint8Array(width * height);
            const region = createRegionFromBinary(width, height, binaryData);
            region.x = xPos;
            
            const context = createContext(800, 1000);
            const features = extractor.extractFeatures(region, context);
            
            const centerX = xPos + width / 2;
            const relativePos = centerX / 800;
            
            if (relativePos < 0.33) {
              expect(features.horizontalAlignment).toBe('left');
            } else if (relativePos > 0.67) {
              expect(features.horizontalAlignment).toBe('right');
            } else {
              expect(features.horizontalAlignment).toBe('center');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency: same input produces same output', () => {
      fc.assert(
        fc.property(binaryImageArb, (img) => {
          const binaryData = new Uint8Array(img.data);
          const region1 = createRegionFromBinary(img.width, img.height, binaryData);
          const region2 = createRegionFromBinary(img.width, img.height, binaryData);
          const context = createContext();
          
          const features1 = extractor.extractFeatures(region1, context);
          const features2 = extractor.extractFeatures(region2, context);
          
          // Same input should produce identical output
          expect(features1.hasGreekLetters).toBe(features2.hasGreekLetters);
          expect(features1.hasIntegralSymbols).toBe(features2.hasIntegralSymbols);
          expect(features1.hasSummationSymbols).toBe(features2.hasSummationSymbols);
          expect(features1.hasFractionLines).toBe(features2.hasFractionLines);
          expect(features1.hasSuperscripts).toBe(features2.hasSuperscripts);
          expect(features1.hasSubscripts).toBe(features2.hasSubscripts);
          expect(features1.hasMatrixBrackets).toBe(features2.hasMatrixBrackets);
          expect(features1.hasRootSymbols).toBe(features2.hasRootSymbols);
          expect(features1.aspectRatio).toBeCloseTo(features2.aspectRatio, 5);
          expect(features1.density).toBeCloseTo(features2.density, 5);
        }),
        { numRuns: 100 }
      );
    });
  });
});
