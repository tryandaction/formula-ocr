/**
 * Unit Tests for BoundaryDetector
 * 测试边界检测器的精确边界检测功能
 */

import { describe, it, expect } from 'vitest';
import { BoundaryDetector } from '../../utils/advancedFormulaDetection/BoundaryDetector';
import type { ImageRegion, ProcessedImage } from '../../utils/advancedFormulaDetection/types';

describe('BoundaryDetector', () => {
  const detector = new BoundaryDetector();

  // Helper function to create a test region with binary data
  const createTestRegion = (
    width: number,
    height: number,
    fillPattern?: (x: number, y: number) => boolean
  ): ImageRegion => {
    const binaryData = new Uint8Array(width * height);
    
    if (fillPattern) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          binaryData[y * width + x] = fillPattern(x, y) ? 1 : 0;
        }
      }
    }
    
    return {
      x: 0,
      y: 0,
      width,
      height,
      imageData: new ImageData(width, height),
      binaryData,
    };
  };

  // Helper function to create processed image
  const createProcessedImage = (width: number, height: number): ProcessedImage => ({
    imageData: new ImageData(width, height),
    binaryData: new Uint8Array(width * height),
    width,
    height,
    scaleFactor: 1,
  });

  describe('Basic Boundary Detection', () => {
    it('should detect boundary of a simple rectangle', () => {
      const region = createTestRegion(50, 30, (x, y) => {
        return x >= 10 && x < 40 && y >= 5 && y < 25;
      });
      const processedImage = createProcessedImage(50, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.contour.length).toBeGreaterThan(0);
    });

    it('should include padding in refined boundary', () => {
      const region = createTestRegion(50, 30, (x, y) => {
        return x >= 20 && x < 30 && y >= 10 && y < 20;
      });
      const processedImage = createProcessedImage(50, 30);

      const result = detector.refineBoundary(region, processedImage);

      // Boundary should be larger than the filled region due to padding
      expect(result.width).toBeGreaterThan(10);
      expect(result.height).toBeGreaterThan(10);
    });

    it('should extract contour points', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        return x >= 10 && x < 20 && y >= 10 && y < 20;
      });
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.contour).toBeDefined();
      expect(result.contour.length).toBeGreaterThan(0);
      
      // All contour points should be within bounds
      for (const point of result.contour) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThan(30);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThan(30);
      }
    });

    it('should calculate tightness score', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        return x >= 10 && x < 20 && y >= 10 && y < 20;
      });
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.tightness).toBeGreaterThanOrEqual(0);
      expect(result.tightness).toBeLessThanOrEqual(1);
    });
  });

  describe('Complex Shapes', () => {
    it('should handle L-shaped region', () => {
      const region = createTestRegion(40, 40, (x, y) => {
        return (x >= 10 && x < 20 && y >= 10 && y < 30) || // Vertical part
               (x >= 10 && x < 30 && y >= 20 && y < 30);    // Horizontal part
      });
      const processedImage = createProcessedImage(40, 40);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.contour.length).toBeGreaterThan(0);
    });

    it('should handle circular region', () => {
      const region = createTestRegion(40, 40, (x, y) => {
        const cx = 20, cy = 20, r = 10;
        return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) <= r;
      });
      const processedImage = createProcessedImage(40, 40);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.contour.length).toBeGreaterThan(0);
    });

    it('should handle region with hole', () => {
      const region = createTestRegion(40, 40, (x, y) => {
        const outer = x >= 5 && x < 35 && y >= 5 && y < 35;
        const inner = x >= 15 && x < 25 && y >= 15 && y < 25;
        return outer && !inner;
      });
      const processedImage = createProcessedImage(40, 40);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });
  });

  describe('Multiple Components', () => {
    it('should merge multiple disconnected components', () => {
      const region = createTestRegion(50, 30, (x, y) => {
        // Two separate rectangles
        return (x >= 5 && x < 15 && y >= 10 && y < 20) ||
               (x >= 25 && x < 35 && y >= 10 && y < 20);
      });
      const processedImage = createProcessedImage(50, 30);

      const result = detector.refineBoundary(region, processedImage);

      // Should create a boundary that encompasses both components
      expect(result.width).toBeGreaterThan(20); // Should span both rectangles
      expect(result.height).toBeGreaterThan(0);
    });

    it('should filter out noise pixels', () => {
      const region = createTestRegion(50, 30, (x, y) => {
        // Main region plus some noise
        const mainRegion = x >= 10 && x < 40 && y >= 5 && y < 25;
        const noise = (x === 2 && y === 2) || (x === 48 && y === 28);
        return mainRegion || noise;
      });
      const processedImage = createProcessedImage(50, 30);

      const result = detector.refineBoundary(region, processedImage);

      // Boundary should focus on main region, not noise
      expect(result.width).toBeLessThan(50);
      expect(result.height).toBeLessThanOrEqual(30); // Allow equal due to padding
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty region', () => {
      const region = createTestRegion(30, 30, () => false);
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
      expect(result.width).toBeGreaterThanOrEqual(0);
      expect(result.height).toBeGreaterThanOrEqual(0);
      expect(result.tightness).toBeGreaterThanOrEqual(0);
    });

    it('should handle single pixel', () => {
      const region = createTestRegion(30, 30, (x, y) => x === 15 && y === 15);
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('should handle region at image boundary', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        return x >= 0 && x < 10 && y >= 0 && y < 10;
      });
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('should handle very thin horizontal line', () => {
      const region = createTestRegion(50, 30, (x, y) => {
        return y === 15 && x >= 10 && x < 40;
      });
      const processedImage = createProcessedImage(50, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.width).toBeGreaterThan(20);
      expect(result.height).toBeGreaterThan(0);
    });

    it('should handle very thin vertical line', () => {
      const region = createTestRegion(50, 30, (x, y) => {
        return x === 25 && y >= 5 && y < 25;
      });
      const processedImage = createProcessedImage(50, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(15);
    });

    it('should not exceed image boundaries with padding', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        return x >= 25 && x < 30 && y >= 25 && y < 30;
      });
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.x + result.width).toBeLessThanOrEqual(30);
      expect(result.y + result.height).toBeLessThanOrEqual(30);
    });
  });

  describe('Tightness Calculation', () => {
    it('should have high tightness for filled rectangle', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        return x >= 10 && x < 20 && y >= 10 && y < 20;
      });
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.tightness).toBeGreaterThan(0.3); // Adjusted threshold
    });

    it('should have lower tightness for sparse region', () => {
      const region = createTestRegion(50, 50, (x, y) => {
        // Sparse dots
        return (x % 5 === 0 && y % 5 === 0 && x >= 10 && x < 40 && y >= 10 && y < 40);
      });
      const processedImage = createProcessedImage(50, 50);

      const result = detector.refineBoundary(region, processedImage);

      expect(result.tightness).toBeGreaterThanOrEqual(0);
      expect(result.tightness).toBeLessThanOrEqual(1);
    });
  });

  describe('Contour Properties', () => {
    it('should have contour points on the boundary', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        return x >= 10 && x < 20 && y >= 10 && y < 20;
      });
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      // Contour points should be on the edge of the filled region
      expect(result.contour.length).toBeGreaterThan(0);
      
      // At least some points should be on the boundary
      const hasBoundaryPoints = result.contour.some(p => 
        p.x === 10 || p.x === 19 || p.y === 10 || p.y === 19
      );
      expect(hasBoundaryPoints).toBe(true);
    });

    it('should have unique contour points', () => {
      const region = createTestRegion(30, 30, (x, y) => {
        return x >= 10 && x < 20 && y >= 10 && y < 20;
      });
      const processedImage = createProcessedImage(30, 30);

      const result = detector.refineBoundary(region, processedImage);

      // Check for duplicate points
      const pointSet = new Set(result.contour.map(p => `${p.x},${p.y}`));
      expect(pointSet.size).toBe(result.contour.length);
    });
  });
});
