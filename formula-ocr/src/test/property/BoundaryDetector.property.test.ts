/**
 * Property Tests for BoundaryDetector
 * Property 3: Valid Boundary Coordinates
 * 验证边界坐标的有效性
 */

import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';
import { BoundaryDetector } from '../../utils/advancedFormulaDetection/BoundaryDetector';
import type { ImageRegion, ProcessedImage } from '../../utils/advancedFormulaDetection/types';

describe('BoundaryDetector Property Tests', () => {
  const detector = new BoundaryDetector();

  // Helper to create test region
  const createRegion = (
    x: number,
    y: number,
    width: number,
    height: number,
    pageWidth: number,
    pageHeight: number
  ): ImageRegion => {
    const binaryData = new Uint8Array(width * height);
    // Fill with some pattern
    for (let i = 0; i < binaryData.length; i++) {
      binaryData[i] = Math.random() > 0.5 ? 1 : 0;
    }
    
    return {
      x: Math.max(0, Math.min(x, pageWidth - width)),
      y: Math.max(0, Math.min(y, pageHeight - height)),
      width,
      height,
      imageData: new ImageData(width, height),
      binaryData,
    };
  };

  const createProcessedImage = (width: number, height: number): ProcessedImage => ({
    imageData: new ImageData(width, height),
    binaryData: new Uint8Array(width * height),
    width,
    height,
    scaleFactor: 1,
  });

  it('should always return boundaries within page bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }), // pageWidth
        fc.integer({ min: 100, max: 1000 }), // pageHeight
        fc.integer({ min: 10, max: 100 }),   // regionWidth
        fc.integer({ min: 10, max: 100 }),   // regionHeight
        fc.integer({ min: 0, max: 900 }),    // x
        fc.integer({ min: 0, max: 900 }),    // y
        (pageWidth, pageHeight, regionWidth, regionHeight, x, y) => {
          const region = createRegion(x, y, regionWidth, regionHeight, pageWidth, pageHeight);
          const processedImage = createProcessedImage(pageWidth, pageHeight);
          
          const boundary = detector.refineBoundary(region, processedImage);
          
          // Boundary should be within page bounds
          expect(boundary.x).toBeGreaterThanOrEqual(0);
          expect(boundary.y).toBeGreaterThanOrEqual(0);
          expect(boundary.x + boundary.width).toBeLessThanOrEqual(pageWidth);
          expect(boundary.y + boundary.height).toBeLessThanOrEqual(pageHeight);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return valid boundary dimensions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 500 }), // pageWidth
        fc.integer({ min: 100, max: 500 }), // pageHeight
        fc.integer({ min: 10, max: 50 }),   // regionWidth
        fc.integer({ min: 10, max: 50 }),   // regionHeight
        (pageWidth, pageHeight, regionWidth, regionHeight) => {
          const region = createRegion(50, 50, regionWidth, regionHeight, pageWidth, pageHeight);
          const processedImage = createProcessedImage(pageWidth, pageHeight);
          
          const boundary = detector.refineBoundary(region, processedImage);
          
          // Boundary dimensions should be positive
          expect(boundary.width).toBeGreaterThan(0);
          expect(boundary.height).toBeGreaterThan(0);
          
          // Boundary should have reasonable size (not too small or too large)
          expect(boundary.width).toBeLessThanOrEqual(pageWidth);
          expect(boundary.height).toBeLessThanOrEqual(pageHeight);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return valid tightness score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 100 }), // regionWidth
        fc.integer({ min: 20, max: 100 }), // regionHeight
        (regionWidth, regionHeight) => {
          const region = createRegion(10, 10, regionWidth, regionHeight, 200, 200);
          const processedImage = createProcessedImage(200, 200);
          
          const boundary = detector.refineBoundary(region, processedImage);
          
          // Tightness should be between 0 and 1
          expect(boundary.tightness).toBeGreaterThanOrEqual(0);
          expect(boundary.tightness).toBeLessThanOrEqual(1);
          expect(isNaN(boundary.tightness)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return valid contour points', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 80 }), // regionWidth
        fc.integer({ min: 20, max: 80 }), // regionHeight
        (regionWidth, regionHeight) => {
          const region = createRegion(10, 10, regionWidth, regionHeight, 200, 200);
          const processedImage = createProcessedImage(200, 200);
          
          const boundary = detector.refineBoundary(region, processedImage);
          
          // Contour should be an array
          expect(Array.isArray(boundary.contour)).toBe(true);
          
          // All contour points should be within bounds
          for (const point of boundary.contour) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThan(200);
            expect(point.y).toBeLessThan(200);
          }
        }
      ),
      { numRuns: 100 }
    );
  }, 20000);

  it('should handle multiple regions with valid boundaries', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 400 }),
            y: fc.integer({ min: 0, max: 400 }),
            width: fc.integer({ min: 20, max: 50 }),
            height: fc.integer({ min: 20, max: 50 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (regions) => {
          const pageWidth = 500;
          const pageHeight = 500;
          const processedImage = createProcessedImage(pageWidth, pageHeight);

          const boundaries = regions.map(r => {
            const region = createRegion(r.x, r.y, r.width, r.height, pageWidth, pageHeight);
            return detector.refineBoundary(region, processedImage);
          });

          // All boundaries should be valid and within page bounds
          for (const boundary of boundaries) {
            expect(boundary.x).toBeGreaterThanOrEqual(0);
            expect(boundary.y).toBeGreaterThanOrEqual(0);
            expect(boundary.width).toBeGreaterThan(0);
            expect(boundary.height).toBeGreaterThan(0);
            expect(boundary.x + boundary.width).toBeLessThanOrEqual(pageWidth);
            expect(boundary.y + boundary.height).toBeLessThanOrEqual(pageHeight);
            expect(boundary.tightness).toBeGreaterThanOrEqual(0);
            expect(boundary.tightness).toBeLessThanOrEqual(1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
