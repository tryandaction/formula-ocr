/**
 * 缓存管理器
 * 负责管理检测结果的缓存，提高重复访问的性能
 */

import type { FormulaInstance, DetectionCache } from './types';

/**
 * 缓存管理器实现
 */
export class CacheManager {
  private cache: Map<number, DetectionCache>;
  private maxCacheSize: number;
  private maxCacheAge: number; // 毫秒

  constructor(maxCacheSize = 50, maxCacheAge = 3600000) { // 默认1小时
    this.cache = new Map();
    this.maxCacheSize = maxCacheSize;
    this.maxCacheAge = maxCacheAge;
  }

  /**
   * 保存检测结果到缓存
   * 
   * @param pageNumber - 页码
   * @param formulas - 公式实例数组
   * @param pageHash - 页面内容哈希
   */
  saveToCache(
    pageNumber: number,
    formulas: FormulaInstance[],
    pageHash: string
  ): void {
    // 检查缓存大小，如果超过限制则清理旧缓存
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestCache();
    }

    const cacheEntry: DetectionCache = {
      pageNumber,
      formulas,
      cacheTimestamp: Date.now(),
      pageHash,
    };

    this.cache.set(pageNumber, cacheEntry);
  }

  /**
   * 从缓存加载检测结果
   * 
   * @param pageNumber - 页码
   * @param pageHash - 页面内容哈希
   * @returns 公式实例数组或null（如果缓存无效）
   */
  loadFromCache(
    pageNumber: number,
    pageHash: string
  ): FormulaInstance[] | null {
    const cacheEntry = this.cache.get(pageNumber);

    if (!cacheEntry) {
      return null;
    }

    // 验证缓存有效性
    if (!this.isCacheValid(pageNumber, pageHash)) {
      this.cache.delete(pageNumber);
      return null;
    }

    return cacheEntry.formulas;
  }

  /**
   * 清除缓存
   * 
   * @param pageNumber - 页码（可选，如果不提供则清除所有缓存）
   */
  clearCache(pageNumber?: number): void {
    if (pageNumber !== undefined) {
      this.cache.delete(pageNumber);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 验证缓存是否有效
   * 
   * @param pageNumber - 页码
   * @param pageHash - 页面内容哈希
   * @returns 是否有效
   */
  isCacheValid(pageNumber: number, pageHash: string): boolean {
    const cacheEntry = this.cache.get(pageNumber);

    if (!cacheEntry) {
      return false;
    }

    // 检查页面哈希是否匹配
    if (cacheEntry.pageHash !== pageHash) {
      return false;
    }

    // 检查缓存是否过期
    const age = Date.now() - cacheEntry.cacheTimestamp;
    if (age > this.maxCacheAge) {
      return false;
    }

    return true;
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    const expiredPages: number[] = [];

    for (const [pageNumber, cacheEntry] of this.cache.entries()) {
      const age = now - cacheEntry.cacheTimestamp;
      if (age > this.maxCacheAge) {
        expiredPages.push(pageNumber);
      }
    }

    expiredPages.forEach(pageNumber => this.cache.delete(pageNumber));
  }

  /**
   * 驱逐最旧的缓存条目
   */
  private evictOldestCache(): void {
    let oldestPage: number | null = null;
    let oldestTimestamp = Infinity;

    for (const [pageNumber, cacheEntry] of this.cache.entries()) {
      if (cacheEntry.cacheTimestamp < oldestTimestamp) {
        oldestTimestamp = cacheEntry.cacheTimestamp;
        oldestPage = pageNumber;
      }
    }

    if (oldestPage !== null) {
      this.cache.delete(oldestPage);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number | null;
  } {
    let oldestTimestamp = Infinity;
    let oldestPage: number | null = null;

    for (const [pageNumber, cacheEntry] of this.cache.entries()) {
      if (cacheEntry.cacheTimestamp < oldestTimestamp) {
        oldestTimestamp = cacheEntry.cacheTimestamp;
        oldestPage = pageNumber;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: 0, // 需要额外跟踪命中率
      oldestEntry: oldestPage,
    };
  }

  /**
   * 计算页面内容哈希
   * 
   * @param pageData - 页面数据（图像或文本）
   * @returns 哈希字符串
   */
  static calculatePageHash(pageData: string | ImageData): string {
    // 简化的哈希实现
    let hash = 0;
    const str = typeof pageData === 'string' 
      ? pageData 
      : `${pageData.width}x${pageData.height}`;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return hash.toString(36);
  }

  /**
   * 获取内存使用估算（字节）
   */
  getMemoryUsage(): number {
    let totalSize = 0;

    for (const cacheEntry of this.cache.values()) {
      // 估算每个公式实例的大小
      for (const formula of cacheEntry.formulas) {
        // 图像数据（base64）是主要的内存占用
        totalSize += formula.imageData.length;
        // LaTeX和Markdown内容
        totalSize += (formula.latexContent?.length || 0);
        totalSize += (formula.markdownContent?.length || 0);
        // 其他字段的估算
        totalSize += 200; // 元数据和其他字段
      }
    }

    return totalSize;
  }

  /**
   * 检查内存使用并在必要时清理
   * 
   * @param maxMemoryBytes - 最大内存限制（字节）
   */
  checkAndCleanMemory(maxMemoryBytes: number): void {
    const currentUsage = this.getMemoryUsage();

    if (currentUsage > maxMemoryBytes) {
      // 清理最旧的缓存直到内存使用降低
      while (this.cache.size > 0 && this.getMemoryUsage() > maxMemoryBytes * 0.8) {
        this.evictOldestCache();
      }
    }
  }
}
