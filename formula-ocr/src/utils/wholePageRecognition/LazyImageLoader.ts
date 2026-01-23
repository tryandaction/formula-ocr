/**
 * 懒加载图像管理器
 * 按需加载图像数据，减少内存占用
 */

/**
 * 图像引用
 * 存储图像的元数据，而不是完整的图像数据
 */
export interface ImageReference {
  /** 图像ID */
  id: string;
  /** 图像URL或数据源 */
  source: string;
  /** 图像宽度 */
  width: number;
  /** 图像高度 */
  height: number;
  /** 是否已加载 */
  loaded: boolean;
}

/**
 * 懒加载配置
 */
export interface LazyLoadConfig {
  /** 最大缓存图像数量 */
  maxCachedImages?: number;
  /** 预加载距离（像素） */
  preloadDistance?: number;
  /** 卸载延迟（毫秒） */
  unloadDelay?: number;
}

/**
 * 懒加载图像管理器
 * 管理图像的加载和卸载，优化内存使用
 */
export class LazyImageLoader {
  private imageCache: Map<string, ImageData> = new Map();
  private loadingPromises: Map<string, Promise<ImageData>> = new Map();
  private accessTimestamps: Map<string, number> = new Map();
  private config: Required<LazyLoadConfig>;

  constructor(config: LazyLoadConfig = {}) {
    this.config = {
      maxCachedImages: config.maxCachedImages ?? 20,
      preloadDistance: config.preloadDistance ?? 1000,
      unloadDelay: config.unloadDelay ?? 5000,
    };
  }

  /**
   * 加载图像
   * @param reference - 图像引用
   * @returns 图像数据
   */
  async loadImage(reference: ImageReference): Promise<ImageData> {
    // 如果已缓存，直接返回
    if (this.imageCache.has(reference.id)) {
      this.accessTimestamps.set(reference.id, Date.now());
      return this.imageCache.get(reference.id)!;
    }

    // 如果正在加载，返回现有Promise
    if (this.loadingPromises.has(reference.id)) {
      return this.loadingPromises.get(reference.id)!;
    }

    // 开始加载
    const loadPromise = this.loadImageData(reference);
    this.loadingPromises.set(reference.id, loadPromise);

    try {
      const imageData = await loadPromise;
      
      // 检查缓存大小，必要时清理
      if (this.imageCache.size >= this.config.maxCachedImages) {
        this.evictLeastRecentlyUsed();
      }

      // 缓存图像
      this.imageCache.set(reference.id, imageData);
      this.accessTimestamps.set(reference.id, Date.now());
      
      return imageData;
    } finally {
      this.loadingPromises.delete(reference.id);
    }
  }

  /**
   * 实际加载图像数据
   */
  private async loadImageData(reference: ImageReference): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          // 创建canvas并绘制图像
          const canvas = document.createElement('canvas');
          canvas.width = reference.width;
          canvas.height = reference.height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, reference.width, reference.height);
          const imageData = ctx.getImageData(0, 0, reference.width, reference.height);
          
          resolve(imageData);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load image: ${reference.source}`));
      };

      img.src = reference.source;
    });
  }

  /**
   * 预加载图像
   * @param references - 图像引用数组
   */
  async preloadImages(references: ImageReference[]): Promise<void> {
    const promises = references.map(ref => this.loadImage(ref));
    await Promise.all(promises);
  }

  /**
   * 卸载图像
   * @param imageId - 图像ID
   */
  unloadImage(imageId: string): void {
    this.imageCache.delete(imageId);
    this.accessTimestamps.delete(imageId);
  }

  /**
   * 延迟卸载图像
   * @param imageId - 图像ID
   */
  scheduleUnload(imageId: string): void {
    setTimeout(() => {
      // 检查是否在延迟期间被访问
      const lastAccess = this.accessTimestamps.get(imageId) ?? 0;
      const now = Date.now();
      
      if (now - lastAccess >= this.config.unloadDelay) {
        this.unloadImage(imageId);
      }
    }, this.config.unloadDelay);
  }

  /**
   * 驱逐最近最少使用的图像
   */
  private evictLeastRecentlyUsed(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    this.accessTimestamps.forEach((time, id) => {
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    });

    if (oldestId) {
      this.unloadImage(oldestId);
    }
  }

  /**
   * 清空所有缓存
   */
  clearCache(): void {
    this.imageCache.clear();
    this.accessTimestamps.clear();
    this.loadingPromises.clear();
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus(): {
    cachedImages: number;
    maxCachedImages: number;
    loadingImages: number;
  } {
    return {
      cachedImages: this.imageCache.size,
      maxCachedImages: this.config.maxCachedImages,
      loadingImages: this.loadingPromises.size,
    };
  }
}
