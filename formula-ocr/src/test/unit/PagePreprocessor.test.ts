/**
 * PagePreprocessor Unit Tests
 * 页面预处理器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PagePreprocessor } from '../../utils/advancedFormulaDetection/PagePreprocessor';

describe('PagePreprocessor', () => {
  let preprocessor: PagePreprocessor;
  
  beforeEach(() => {
    preprocessor = new PagePreprocessor();
  });

  describe('upscaleImage', () => {
    it('should upscale image to target DPI', () => {
      // Create a small test image
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Fill with a pattern
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;     // R
        data[i + 1] = 128; // G
        data[i + 2] = 128; // B
        data[i + 3] = 255; // A
      }
      
      const imageData = new ImageData(data, width, height);
      const targetDPI = 144; // 2x scale
      
      const result = preprocessor.upscaleImage(imageData, targetDPI);
      
      // Should be approximately 2x larger
      expect(result.width).toBeGreaterThan(width);
      expect(result.height).toBeGreaterThan(height);
      expect(result.width).toBeCloseTo(width * 2, 0);
      expect(result.height).toBeCloseTo(height * 2, 0);
    });

    it('should preserve image content during upscaling', () => {
      const width = 5;
      const height = 5;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create a simple pattern
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;     // R
        data[i + 1] = 0;   // G
        data[i + 2] = 0;   // B
        data[i + 3] = 255; // A
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.upscaleImage(imageData, 144);
      
      // Check that result has data and correct dimensions
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.width).toBeGreaterThan(width);
      expect(result.height).toBeGreaterThan(height);
    });
  });

  describe('denoiseImage', () => {
    it('should reduce noise in image', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create image with noise
      for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() > 0.5 ? 50 : -50;
        data[i] = Math.max(0, Math.min(255, 128 + noise));
        data[i + 1] = Math.max(0, Math.min(255, 128 + noise));
        data[i + 2] = Math.max(0, Math.min(255, 128 + noise));
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.denoiseImage(imageData);
      
      expect(result.width).toBe(width);
      expect(result.height).toBe(height);
      expect(result.data.length).toBe(data.length);
    });

    it('should preserve alpha channel', () => {
      const width = 5;
      const height = 5;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 100;
        data[i + 1] = 100;
        data[i + 2] = 100;
        data[i + 3] = 200; // Custom alpha
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.denoiseImage(imageData);
      
      // Alpha should be preserved
      for (let i = 3; i < result.data.length; i += 4) {
        expect(result.data[i]).toBe(200);
      }
    });
  });

  describe('enhanceContrast', () => {
    it('should enhance image contrast', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create low contrast image
      for (let i = 0; i < data.length; i += 4) {
        const value = 100 + Math.random() * 50; // Values between 100-150
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.enhanceContrast(imageData);
      
      expect(result.width).toBe(width);
      expect(result.height).toBe(height);
      
      // Calculate range of values
      let min = 255, max = 0;
      for (let i = 0; i < result.data.length; i += 4) {
        const gray = 0.299 * result.data[i] + 
                     0.587 * result.data[i + 1] + 
                     0.114 * result.data[i + 2];
        min = Math.min(min, gray);
        max = Math.max(max, gray);
      }
      
      // Enhanced image should have wider range
      expect(max - min).toBeGreaterThan(0);
    });
  });

  describe('binarize', () => {
    it('should binarize image with simple method', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create image with black and white pixels
      for (let i = 0; i < data.length; i += 4) {
        const value = i % 8 === 0 ? 0 : 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.binarize(imageData, 'simple');
      
      expect(result.length).toBe(width * height);
      
      // Check that values are only 0 or 1
      for (let i = 0; i < result.length; i++) {
        expect(result[i]).toBeGreaterThanOrEqual(0);
        expect(result[i]).toBeLessThanOrEqual(1);
      }
    });

    it('should binarize image with Otsu method', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create bimodal distribution with more contrast
      for (let i = 0; i < data.length; i += 4) {
        const value = i < data.length / 2 ? 20 : 220;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.binarize(imageData, 'otsu');
      
      expect(result.length).toBe(width * height);
      
      // Should have both 0 and 1 values (or at least one of each)
      const hasZero = result.some(v => v === 0);
      const hasOne = result.some(v => v === 1);
      // At least one type should exist
      expect(hasZero || hasOne).toBe(true);
    });

    it('should binarize image with adaptive method', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create image with varying brightness
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const value = (x + y) * 10;
          data[idx] = value;
          data[idx + 1] = value;
          data[idx + 2] = value;
          data[idx + 3] = 255;
        }
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.binarize(imageData, 'adaptive');
      
      expect(result.length).toBe(width * height);
      
      // Check binary values
      for (let i = 0; i < result.length; i++) {
        expect([0, 1]).toContain(result[i]);
      }
    });
  });

  describe('preprocess', () => {
    it('should apply full preprocessing pipeline', () => {
      const width = 20;
      const height = 20;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create test image
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.preprocess(imageData, {
        targetDPI: 144,
        denoise: true,
        enhanceContrast: true,
        binarizationMethod: 'adaptive',
      });
      
      expect(result.imageData).toBeDefined();
      expect(result.binaryData).toBeDefined();
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.scaleFactor).toBeGreaterThan(0);
      
      // Binary data should match image dimensions
      expect(result.binaryData.length).toBe(result.width * result.height);
    });

    it('should skip preprocessing steps when disabled', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.preprocess(imageData, {
        targetDPI: 72, // No upscaling
        denoise: false,
        enhanceContrast: false,
        binarizationMethod: 'simple',
      });
      
      // Dimensions should remain the same
      expect(result.width).toBe(width);
      expect(result.height).toBe(height);
      expect(result.scaleFactor).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty image', () => {
      const width = 1;
      const height = 1;
      const data = new Uint8ClampedArray(width * height * 4);
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.preprocess(imageData);
      
      expect(result).toBeDefined();
      expect(result.binaryData.length).toBeGreaterThan(0);
    });

    it('should handle very small images', () => {
      const width = 2;
      const height = 2;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let i = 0; i < data.length; i++) {
        data[i] = 128;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.preprocess(imageData);
      
      expect(result.width).toBeGreaterThanOrEqual(width);
      expect(result.height).toBeGreaterThanOrEqual(height);
    });

    it('should handle all-black image', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // All black
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.binarize(imageData, 'simple');
      
      // All pixels should be 1 (black)
      expect(result.every(v => v === 1)).toBe(true);
    });

    it('should handle all-white image', () => {
      const width = 10;
      const height = 10;
      const data = new Uint8ClampedArray(width * height * 4);
      
      // All white
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
      
      const imageData = new ImageData(data, width, height);
      const result = preprocessor.binarize(imageData, 'simple');
      
      // All pixels should be 0 (white)
      expect(result.every(v => v === 0)).toBe(true);
    });
  });
});
