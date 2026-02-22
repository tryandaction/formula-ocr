/**
 * Detection Cache Manager - 检测缓存管理器
 * 管理公式检测结果的缓存，避免重复检测
 */

import type { IDetectionCacheManager } from './interfaces';
import type { EnhancedFormulaRegion, DetectionCache, DetectionOptions } from './types';
import { CACHE_KEY_PREFIX, CACHE_MAX_AGE, CACHE_MAX_ENTRIES } from './constants';

export class DetectionCacheManager implements IDetectionCacheManager {
  private cache: Map<string, DetectionCache> = new Map();

  /**
   * 设置缓存
   */
  set(
    pageNumber: number,
    results: EnhancedFormulaRegion[],
    imageHash: string,
    detectionOptions: DetectionOptions
  ): void {
    const key = this.getCacheKey(pageNumber, detectionOptions);
    
    const cacheEntry: DetectionCache = {
      pageNumber,
      detectionResults: results,
      timestamp: Date.now(),
      imageHash,
      detectionOptions,
    };
    
    this.cache.set(key, cacheEntry);
    
    // 清理过期缓存
    this.cleanupExpiredCache();
    
    // 限制缓存大小
    this.limitCacheSize();
  }

  /**
   * 获取缓存
   */
  get(
    pageNumber: number,
    imageHash: string,
    detectionOptions: DetectionOptions
  ): EnhancedFormulaRegion[] | null {
    const key = this.getCacheKey(pageNumber, detectionOptions);
    const cacheEntry = this.cache.get(key);
    
    if (!cacheEntry) {
      return null;
    }
    
    // 检查图像哈希是否匹配
    if (cacheEntry.imageHash !== imageHash) {
      this.cache.delete(key);
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - cacheEntry.timestamp > CACHE_MAX_AGE) {
      this.cache.delete(key);
      return null;
    }
    
    return cacheEntry.detectionResults;
  }

  /**
   * 清除指定页面的缓存
   */
  clear(pageNumber?: number): void {
    if (pageNumber !== undefined) {
      const prefix = `${CACHE_KEY_PREFIX}${pageNumber}_`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.clearAll();
    }
  }

  /**
   * 清除所有缓存
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * 获取所有缓存
   */
  getAll(): DetectionCache[] {
    return Array.from(this.cache.values());
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(pageNumber: number, detectionOptions: DetectionOptions): string {
    const optionsKey = this.getOptionsKey(detectionOptions);
    return `${CACHE_KEY_PREFIX}${pageNumber}_${optionsKey}`;
  }

  private getOptionsKey(detectionOptions: DetectionOptions): string {
    const minConfidence = detectionOptions.minConfidence ?? 0;
    const includeInline = detectionOptions.includeInline ? 1 : 0;
    const includeDisplay = detectionOptions.includeDisplay ? 1 : 0;
    const resolution = Math.round(detectionOptions.resolution ?? 0);
    const sourceDPI = Math.round(detectionOptions.sourceDPI ?? 0);
    const enablePreprocessing = detectionOptions.enablePreprocessing ? 1 : 0;
    const useDeepOptimization = detectionOptions.useDeepOptimization ? 1 : 0;

    return [
      `mc:${minConfidence}`,
      `in:${includeInline}`,
      `ds:${includeDisplay}`,
      `res:${resolution}`,
      `src:${sourceDPI}`,
      `pre:${enablePreprocessing}`,
      `deep:${useDeepOptimization}`,
    ].join('|');
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CACHE_MAX_AGE) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 限制缓存大小
   */
  private limitCacheSize(): void {
    if (this.cache.size <= CACHE_MAX_ENTRIES) {
      return;
    }
    
    // 删除最旧的缓存项
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toDelete = entries.slice(0, entries.length - CACHE_MAX_ENTRIES);
    for (const [key] of toDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 计算图像哈希（简单实现）
   */
  static computeImageHash(imageData: string): string {
    if (!imageData) {
      return 'empty';
    }
    // 简单的哈希实现：取前100个字符和长度
    const sample = imageData.substring(0, 100);
    return `${sample}_${imageData.length}`;
  }
}
