/**
 * Integration Tests for Advanced Formula Detection
 * 测试完整的公式检测流程
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdvancedFormulaDetector } from '../../utils/advancedFormulaDetection';
import { DetectionCacheManager } from '../../utils/advancedFormulaDetection';

describe('Advanced Formula Detection Integration', () => {
  let detector: AdvancedFormulaDetector;

  beforeEach(() => {
    detector = new AdvancedFormulaDetector();
  });

  describe('Basic Detection', () => {
    it('should create detector instance', () => {
      expect(detector).toBeDefined();
      expect(detector).toBeInstanceOf(AdvancedFormulaDetector);
    });

    it('should have clearCache method', () => {
      expect(typeof detector.clearCache).toBe('function');
    });

    it('should have detectFormulas method', () => {
      expect(typeof detector.detectFormulas).toBe('function');
    });

    it('should have detectMultiplePages method', () => {
      expect(typeof detector.detectMultiplePages).toBe('function');
    });
  });

  describe('Cache Management', () => {
    it('should clear cache for specific page', () => {
      expect(() => {
        detector.clearCache(1);
      }).not.toThrow();
    });

    it('should clear all cache', () => {
      expect(() => {
        detector.clearCache();
      }).not.toThrow();
    });
  });

  describe('DetectionCacheManager', () => {
    it('should compute image hash', () => {
      const hash1 = DetectionCacheManager.computeImageHash('test-image-data');
      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe('string');
    });

    it('should handle empty image data', () => {
      const hash = DetectionCacheManager.computeImageHash('');
      expect(hash).toBe('empty');
    });

    it('should compute different hashes for different images', () => {
      const hash1 = DetectionCacheManager.computeImageHash('image1');
      const hash2 = DetectionCacheManager.computeImageHash('image2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Module Exports', () => {
    it('should export all required components', async () => {
      const module = await import('../../utils/advancedFormulaDetection');
      
      expect(module.AdvancedFormulaDetector).toBeDefined();
      expect(module.PagePreprocessor).toBeDefined();
      expect(module.FeatureExtractor).toBeDefined();
      expect(module.ContentClassifier).toBeDefined();
      expect(module.FormulaTypeClassifier).toBeDefined();
      expect(module.BoundaryDetector).toBeDefined();
      expect(module.ConfidenceScorer).toBeDefined();
      expect(module.DetectionCacheManager).toBeDefined();
    });

    it('should export all required types', async () => {
      const module = await import('../../utils/advancedFormulaDetection');
      
      expect(module.DEFAULT_DETECTION_OPTIONS).toBeDefined();
      expect(module.CONFIDENCE_THRESHOLDS).toBeDefined();
      expect(module.CONFIDENCE_WEIGHTS).toBeDefined();
    });
  });
});
