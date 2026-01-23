/**
 * 资源管理器
 * 统一管理系统资源，及时释放不再使用的资源
 */

import { monitorMemory } from './errors';

/**
 * 资源类型
 */
export type ResourceType = 'imageData' | 'canvas' | 'worker' | 'cache' | 'other';

/**
 * 资源引用
 */
export interface ResourceReference {
  /** 资源ID */
  id: string;
  /** 资源类型 */
  type: ResourceType;
  /** 资源对象 */
  resource: any;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 引用计数 */
  refCount: number;
}

/**
 * 资源管理器配置
 */
export interface ResourceManagerConfig {
  /** 内存限制（MB） */
  memoryLimitMB?: number;
  /** 资源过期时间（毫秒） */
  resourceTTL?: number;
  /** 自动清理间隔（毫秒） */
  cleanupInterval?: number;
}

/**
 * 资源管理器
 * 跟踪和管理系统中的所有资源
 */
export class ResourceManager {
  private resources: Map<string, ResourceReference> = new Map();
  private config: Required<ResourceManagerConfig>;
  private cleanupTimer: number | null = null;

  constructor(config: ResourceManagerConfig = {}) {
    this.config = {
      memoryLimitMB: config.memoryLimitMB ?? 500,
      resourceTTL: config.resourceTTL ?? 60000, // 1分钟
      cleanupInterval: config.cleanupInterval ?? 10000, // 10秒
    };

    // 启动自动清理
    this.startAutoCleanup();
  }

  /**
   * 注册资源
   * @param id - 资源ID
   * @param type - 资源类型
   * @param resource - 资源对象
   */
  register(id: string, type: ResourceType, resource: any): void {
    const now = Date.now();
    
    if (this.resources.has(id)) {
      // 增加引用计数
      const ref = this.resources.get(id)!;
      ref.refCount++;
      ref.lastAccessedAt = now;
    } else {
      // 创建新引用
      this.resources.set(id, {
        id,
        type,
        resource,
        createdAt: now,
        lastAccessedAt: now,
        refCount: 1,
      });
    }
  }

  /**
   * 访问资源
   * @param id - 资源ID
   * @returns 资源对象或null
   */
  access(id: string): any | null {
    const ref = this.resources.get(id);
    if (ref) {
      ref.lastAccessedAt = Date.now();
      return ref.resource;
    }
    return null;
  }

  /**
   * 释放资源
   * @param id - 资源ID
   */
  release(id: string): void {
    const ref = this.resources.get(id);
    if (!ref) return;

    ref.refCount--;

    // 如果引用计数为0，删除资源
    if (ref.refCount <= 0) {
      this.disposeResource(ref);
      this.resources.delete(id);
    }
  }

  /**
   * 强制释放资源
   * @param id - 资源ID
   */
  forceRelease(id: string): void {
    const ref = this.resources.get(id);
    if (ref) {
      this.disposeResource(ref);
      this.resources.delete(id);
    }
  }

  /**
   * 释放特定类型的所有资源
   * @param type - 资源类型
   */
  releaseByType(type: ResourceType): void {
    const toRelease: string[] = [];
    
    this.resources.forEach((ref, id) => {
      if (ref.type === type) {
        toRelease.push(id);
      }
    });

    toRelease.forEach(id => this.forceRelease(id));
  }

  /**
   * 清理过期资源
   */
  cleanupExpired(): void {
    const now = Date.now();
    const toRelease: string[] = [];

    this.resources.forEach((ref, id) => {
      const age = now - ref.lastAccessedAt;
      if (age > this.config.resourceTTL && ref.refCount === 0) {
        toRelease.push(id);
      }
    });

    toRelease.forEach(id => this.forceRelease(id));

    if (toRelease.length > 0) {
      console.log(`Cleaned up ${toRelease.length} expired resources`);
    }
  }

  /**
   * 检查内存使用并清理
   */
  checkMemoryAndCleanup(): void {
    monitorMemory(this.config.memoryLimitMB, () => {
      console.warn('Memory limit exceeded, performing aggressive cleanup');
      this.aggressiveCleanup();
    });
  }

  /**
   * 激进清理（释放所有引用计数为0的资源）
   */
  private aggressiveCleanup(): void {
    const toRelease: string[] = [];

    this.resources.forEach((ref, id) => {
      if (ref.refCount === 0) {
        toRelease.push(id);
      }
    });

    toRelease.forEach(id => this.forceRelease(id));

    console.log(`Aggressive cleanup released ${toRelease.length} resources`);
  }

  /**
   * 处理资源（调用清理方法）
   */
  private disposeResource(ref: ResourceReference): void {
    try {
      const resource = ref.resource;

      // 根据资源类型执行清理
      switch (ref.type) {
        case 'canvas':
          if (resource instanceof HTMLCanvasElement) {
            const ctx = resource.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, resource.width, resource.height);
            }
            resource.width = 0;
            resource.height = 0;
          }
          break;

        case 'worker':
          if (resource && typeof resource.terminate === 'function') {
            resource.terminate();
          }
          break;

        case 'imageData':
          // ImageData会被垃圾回收器自动处理
          break;

        default:
          // 尝试调用dispose方法
          if (resource && typeof resource.dispose === 'function') {
            resource.dispose();
          }
      }
    } catch (error) {
      console.error(`Error disposing resource ${ref.id}:`, error);
    }
  }

  /**
   * 启动自动清理
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = window.setInterval(() => {
      this.cleanupExpired();
      this.checkMemoryAndCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 清空所有资源
   */
  clear(): void {
    this.resources.forEach((ref, id) => {
      this.disposeResource(ref);
    });
    this.resources.clear();
  }

  /**
   * 获取资源统计
   */
  getStats(): {
    totalResources: number;
    byType: Record<ResourceType, number>;
    totalRefCount: number;
  } {
    const byType: Record<ResourceType, number> = {
      imageData: 0,
      canvas: 0,
      worker: 0,
      cache: 0,
      other: 0,
    };

    let totalRefCount = 0;

    this.resources.forEach(ref => {
      byType[ref.type]++;
      totalRefCount += ref.refCount;
    });

    return {
      totalResources: this.resources.size,
      byType,
      totalRefCount,
    };
  }

  /**
   * 销毁资源管理器
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}

/**
 * 全局资源管理器实例
 */
export const globalResourceManager = new ResourceManager();
