/**
 * FeatureExtractor Unit Tests
 * 特征提取器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureExtractor } from '../../utils/advancedFormulaDetection/FeatureExtractor';
import type { ImageRegion, RegionContext } from '../../utils/advancedFormulaDetection/types';

describe('FeatureExtractor', () => {
  let extractor: FeatureExtractor;
  
  beforeEach(() => {
    extractor = new FeatureExtractor();
  });

  /**
   * Helper function to create a test image region
   */
  function createTestRegion(
    width: number,
    height: number,
    pattern?: (x: number, y: number) => boolean
  ): ImageRegion {
    const binaryData = new Uint8Array(width * height);
    const imageData = new ImageData(width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const value = pattern ? (pattern(x, y) ? 1 : 0) : 0;
        binaryData[idx] = value;
        
        // Set image data
        const pixelIdx = idx * 4;
        const color = value === 1 ? 0 : 255;
        imageData.data[pixelIdx] = color;
        imageData.data[pixelIdx + 1] = color;
        imageData.data[pixelIdx + 2] = color;
        imageData.data[pixelIdx + 3] = 255;
      }
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
   * Helper function to create a test context
   */
  function createTestContext(): RegionContext {
    return {
      pageWidth: 800,
      pageHeight: 1000,
      surroundingRegions: [],
      textLines: [],
    };
  }

  describe('detectFractionLines', () => {
    it('should detect horizontal line with content above and below', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Content above (y < 12)
        if (y >= 5 && y < 12 && x >= 10 && x < 20) return true;
        // Horizontal line (y = 15)
        if (y === 15 && x >= 5 && x < 25) return true;
        // Content below (y > 18)
        if (y >= 18 && y < 25 && x >= 10 && x < 20) return true;
        return false;
      });
      
      const result = extractor.detectFractionLines(region);
      expect(result).toBe(true);
    });

    it('should not detect line without content above', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Only horizontal line and content below
        if (y === 15 && x >= 5 && x < 25) return true;
        if (y >= 18 && y < 25 && x >= 10 && x < 20) return true;
        return false;
      });
      
      const result = extractor.detectFractionLines(region);
      expect(result).toBe(false);
    });

    it('should not detect line without content below', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Only content above and horizontal line
        if (y >= 5 && y < 12 && x >= 10 && x < 20) return true;
        if (y === 15 && x >= 5 && x < 25) return true;
        return false;
      });
      
      const result = extractor.detectFractionLines(region);
      expect(result).toBe(false);
    });
  });

  describe('detectScripts', () => {
    it('should detect superscripts', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Main content in middle
        if (y >= 12 && y < 20 && x >= 5 && x < 15) return true;
        // Small content above (superscript)
        if (y >= 5 && y < 10 && x >= 16 && x < 20) return true;
        return false;
      });
      
      const result = extractor.detectScripts(region);
      expect(result.hasSuperscripts).toBe(true);
    });

    it('should detect subscripts', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Main content in middle
        if (y >= 10 && y < 18 && x >= 5 && x < 15) return true;
        // Small content below (subscript)
        if (y >= 20 && y < 25 && x >= 16 && x < 20) return true;
        return false;
      });
      
      const result = extractor.detectScripts(region);
      expect(result.hasSubscripts).toBe(true);
    });

    it('should detect both superscripts and subscripts', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Main content in middle
        if (y >= 12 && y < 18 && x >= 5 && x < 15) return true;
        // Superscript
        if (y >= 5 && y < 10 && x >= 16 && x < 20) return true;
        // Subscript
        if (y >= 20 && y < 25 && x >= 16 && x < 20) return true;
        return false;
      });
      
      const result = extractor.detectScripts(region);
      expect(result.hasSuperscripts).toBe(true);
      expect(result.hasSubscripts).toBe(true);
    });
  });

  describe('detectMatrixBrackets', () => {
    it('should detect paired brackets with content', () => {
      const region = createTestRegion(40, 30, (x, y) => {
        // Left bracket
        if (x >= 2 && x < 4 && y >= 5 && y < 25) return true;
        // Right bracket
        if (x >= 36 && x < 38 && y >= 5 && y < 25) return true;
        // Inner content
        if (x >= 15 && x < 25 && y >= 12 && y < 18) return true;
        return false;
      });
      
      const result = extractor.detectMatrixBrackets(region);
      expect(result).toBe(true);
    });

    it('should not detect brackets without content', () => {
      const region = createTestRegion(40, 30, (x, y) => {
        // Left bracket
        if (x >= 2 && x < 4 && y >= 5 && y < 25) return true;
        // Right bracket
        if (x >= 36 && x < 38 && y >= 5 && y < 25) return true;
        // No inner content
        return false;
      });
      
      const result = extractor.detectMatrixBrackets(region);
      expect(result).toBe(false);
    });
  });

  describe('detectIntegralSymbols', () => {
    it('should detect vertically elongated S-curve', () => {
      const region = createTestRegion(20, 50, (x, y) => {
        // Create an S-curve pattern
        const centerX = 10;
        const amplitude = 5;
        const frequency = 0.1;
        const expectedX = centerX + amplitude * Math.sin(y * frequency);
        return Math.abs(x - expectedX) < 2;
      });
      
      const result = extractor.detectIntegralSymbols(region);
      expect(result).toBe(true);
    });

    it('should not detect short regions', () => {
      const region = createTestRegion(20, 20, (x, y) => {
        return x === 10; // Vertical line
      });
      
      const result = extractor.detectIntegralSymbols(region);
      expect(result).toBe(false);
    });
  });

  describe('detectRootSymbols', () => {
    it('should detect checkmark with horizontal top', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Left descending part (bottom half, left third)
        // x < 10 (33% of 30), y >= 15 (50% of 30)
        if (x >= 2 && x < 9 && y >= 16 && y < 28) return true;
        // Right ascending part (top half, beyond left third)
        // x >= 10, y < 15 (50% of 30)
        if (x >= 10 && x < 18 && y >= 2 && y < 14) return true;
        // Horizontal top line (in top 30% of image, at least 60% width)
        // y < 9 (30% of 30), x covers > 60% of width (> 18 pixels)
        if (y >= 1 && y < 3 && x >= 8 && x < 28) return true; // 20 pixels = 67% of width
        return false;
      });
      
      const result = extractor.detectRootSymbols(region);
      expect(result).toBe(true);
    });
    
    it('should not detect without horizontal top', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        // Only checkmark, no horizontal top
        if (x >= 2 && x < 9 && y >= 16 && y < 28) return true;
        if (x >= 10 && x < 18 && y >= 2 && y < 14) return true;
        return false;
      });
      
      const result = extractor.detectRootSymbols(region);
      expect(result).toBe(false);
    });
  });

  describe('extractFeatures', () => {
    it('should extract all features from a region', () => {
      const region = createTestRegion(40, 40, (x, y) => {
        // Create a pattern with a clear horizontal line
        // Content above
        if (y >= 8 && y < 16 && x >= 10 && x < 30) return true;
        // Strong horizontal line in the middle
        if (y >= 18 && y <= 20 && x >= 5 && x < 35) return true;
        // Content below
        if (y >= 24 && y < 32 && x >= 10 && x < 30) return true;
        return false;
      });
      
      const context = createTestContext();
      const features = extractor.extractFeatures(region, context);
      
      // Check that all feature fields exist
      expect(features).toHaveProperty('hasGreekLetters');
      expect(features).toHaveProperty('hasIntegralSymbols');
      expect(features).toHaveProperty('hasSummationSymbols');
      expect(features).toHaveProperty('hasFractionLines');
      expect(features).toHaveProperty('hasSuperscripts');
      expect(features).toHaveProperty('hasSubscripts');
      expect(features).toHaveProperty('hasMatrixBrackets');
      expect(features).toHaveProperty('hasRootSymbols');
      
      // Layout features
      expect(features.aspectRatio).toBeGreaterThan(0);
      expect(features.density).toBeGreaterThanOrEqual(0);
      expect(features.density).toBeLessThanOrEqual(1);
      expect(features.verticalComplexity).toBeGreaterThanOrEqual(0);
      expect(features.horizontalSpacing).toBeGreaterThanOrEqual(0);
      
      // Texture features
      expect(features.edgeDensity).toBeGreaterThanOrEqual(0);
      expect(features.edgeDensity).toBeLessThanOrEqual(1);
      expect(features.strokeWidth).toBeGreaterThanOrEqual(0);
      expect(features.uniformity).toBeGreaterThanOrEqual(0);
      expect(features.uniformity).toBeLessThanOrEqual(1);
      
      // Context features
      expect(features.surroundingTextDensity).toBeGreaterThanOrEqual(0);
      expect(features.surroundingTextDensity).toBeLessThanOrEqual(1);
      expect(['top', 'middle', 'bottom', 'isolated']).toContain(features.verticalAlignment);
      expect(['left', 'center', 'right']).toContain(features.horizontalAlignment);
      
      // This pattern should detect a fraction line
      expect(features.hasFractionLines).toBe(true);
    });

    it('should calculate correct aspect ratio', () => {
      const wideRegion = createTestRegion(60, 20);
      const tallRegion = createTestRegion(20, 60);
      const context = createTestContext();
      
      const wideFeatures = extractor.extractFeatures(wideRegion, context);
      const tallFeatures = extractor.extractFeatures(tallRegion, context);
      
      expect(wideFeatures.aspectRatio).toBeGreaterThan(1);
      expect(tallFeatures.aspectRatio).toBeLessThan(1);
    });

    it('should calculate correct density', () => {
      const sparseRegion = createTestRegion(20, 20, (x, y) => {
        return x === 10 && y === 10; // Single pixel
      });
      
      const denseRegion = createTestRegion(20, 20, () => true); // All pixels
      
      const context = createTestContext();
      const sparseFeatures = extractor.extractFeatures(sparseRegion, context);
      const denseFeatures = extractor.extractFeatures(denseRegion, context);
      
      expect(sparseFeatures.density).toBeLessThan(denseFeatures.density);
      expect(denseFeatures.density).toBeCloseTo(1, 1);
    });
  });

  describe('layout features', () => {
    it('should calculate vertical complexity', () => {
      // Simple region with single horizontal line
      const simpleRegion = createTestRegion(30, 30, (x, y) => {
        return y === 15;
      });
      
      // Complex region with multiple layers
      const complexRegion = createTestRegion(30, 30, (x, y) => {
        return y === 5 || y === 15 || y === 25;
      });
      
      const context = createTestContext();
      const simpleFeatures = extractor.extractFeatures(simpleRegion, context);
      const complexFeatures = extractor.extractFeatures(complexRegion, context);
      
      expect(complexFeatures.verticalComplexity).toBeGreaterThan(simpleFeatures.verticalComplexity);
    });
  });

  describe('context features', () => {
    it('should determine vertical alignment correctly', () => {
      const region = createTestRegion(20, 20);
      region.y = 100;
      
      const context: RegionContext = {
        pageWidth: 800,
        pageHeight: 1000,
        surroundingRegions: [],
        textLines: [
          { y: 95, height: 20 }, // Text line at similar position
        ],
      };
      
      const features = extractor.extractFeatures(region, context);
      expect(['top', 'middle', 'bottom']).toContain(features.verticalAlignment);
    });

    it('should determine horizontal alignment correctly', () => {
      const leftRegion = createTestRegion(20, 20);
      leftRegion.x = 50;
      
      const centerRegion = createTestRegion(20, 20);
      centerRegion.x = 400;
      
      const rightRegion = createTestRegion(20, 20);
      rightRegion.x = 750;
      
      const context = createTestContext();
      
      const leftFeatures = extractor.extractFeatures(leftRegion, context);
      const centerFeatures = extractor.extractFeatures(centerRegion, context);
      const rightFeatures = extractor.extractFeatures(rightRegion, context);
      
      expect(leftFeatures.horizontalAlignment).toBe('left');
      expect(centerFeatures.horizontalAlignment).toBe('center');
      expect(rightFeatures.horizontalAlignment).toBe('right');
    });

    it('should detect isolated regions', () => {
      const region = createTestRegion(20, 20);
      region.y = 500;
      
      const context: RegionContext = {
        pageWidth: 800,
        pageHeight: 1000,
        surroundingRegions: [],
        textLines: [], // No text lines nearby
      };
      
      const features = extractor.extractFeatures(region, context);
      expect(features.verticalAlignment).toBe('isolated');
    });
  });

  describe('edge cases', () => {
    it('should handle empty region', () => {
      const region = createTestRegion(10, 10);
      const context = createTestContext();
      
      const features = extractor.extractFeatures(region, context);
      
      expect(features.density).toBe(0);
      expect(features.hasGreekLetters).toBe(false);
      expect(features.hasIntegralSymbols).toBe(false);
    });

    it('should handle very small region', () => {
      const region = createTestRegion(3, 3, () => true);
      const context = createTestContext();
      
      const features = extractor.extractFeatures(region, context);
      
      expect(features).toBeDefined();
      expect(features.density).toBeGreaterThan(0);
    });

    it('should handle very large region', () => {
      const region = createTestRegion(200, 200, (x, y) => {
        return (x + y) % 10 === 0;
      });
      const context = createTestContext();
      
      const features = extractor.extractFeatures(region, context);
      
      expect(features).toBeDefined();
      expect(features.aspectRatio).toBeCloseTo(1, 0);
    });
  });
});
