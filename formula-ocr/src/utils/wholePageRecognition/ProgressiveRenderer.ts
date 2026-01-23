/**
 * 渐进式渲染器
 * 优先显示高置信度的检测结果，提升用户体验
 */

import type { FormulaInstance } from './types';

/**
 * 渲染批次
 */
export interface RenderBatch {
  /** 批次ID */
  id: number;
  /** 公式实例 */
  formulas: FormulaInstance[];
  /** 置信度阈值 */
  confidenceThreshold: number;
}

/**
 * 渐进式渲染配置
 */
export interface ProgressiveRenderConfig {
  /** 批次数量（默认3批：高、中、低置信度） */
  batchCount?: number;
  /** 批次间隔（毫秒） */
  batchInterval?: number;
  /** 最小置信度阈值 */
  minConfidence?: number;
}

/**
 * 渐进式渲染器
 * 将检测结果分批渲染，优先显示高置信度结果
 */
export class ProgressiveRenderer {
  private config: Required<ProgressiveRenderConfig>;
  private renderCallbacks: Map<number, (batch: RenderBatch) => void> = new Map();
  private currentBatchId = 0;

  constructor(config: ProgressiveRenderConfig = {}) {
    this.config = {
      batchCount: config.batchCount ?? 3,
      batchInterval: config.batchInterval ?? 100,
      minConfidence: config.minConfidence ?? 0.5,
    };
  }

  /**
   * 渐进式渲染公式
   * @param formulas - 所有检测到的公式
   * @param onBatchReady - 批次准备好时的回调
   */
  async render(
    formulas: FormulaInstance[],
    onBatchReady: (batch: RenderBatch) => void
  ): Promise<void> {
    // 按置信度排序
    const sortedFormulas = [...formulas].sort((a, b) => b.confidence - a.confidence);

    // 过滤低置信度结果
    const filteredFormulas = sortedFormulas.filter(
      f => f.confidence >= this.config.minConfidence
    );

    if (filteredFormulas.length === 0) {
      return;
    }

    // 计算每批的置信度阈值
    const thresholds = this.calculateThresholds(filteredFormulas);

    // 分批渲染
    for (let i = 0; i < thresholds.length; i++) {
      const threshold = thresholds[i];
      const nextThreshold = thresholds[i + 1] ?? this.config.minConfidence;

      // 获取当前批次的公式
      const batchFormulas = filteredFormulas.filter(
        f => f.confidence >= nextThreshold && f.confidence < threshold
      );

      if (batchFormulas.length > 0) {
        const batch: RenderBatch = {
          id: this.currentBatchId++,
          formulas: batchFormulas,
          confidenceThreshold: threshold,
        };

        // 调用回调
        onBatchReady(batch);

        // 等待间隔
        if (i < thresholds.length - 1) {
          await this.delay(this.config.batchInterval);
        }
      }
    }
  }

  /**
   * 计算置信度阈值
   * 将置信度范围划分为多个批次
   */
  private calculateThresholds(formulas: FormulaInstance[]): number[] {
    if (formulas.length === 0) {
      return [];
    }

    const maxConfidence = formulas[0].confidence;
    const minConfidence = this.config.minConfidence;
    const range = maxConfidence - minConfidence;
    const step = range / this.config.batchCount;

    const thresholds: number[] = [];
    for (let i = 0; i < this.config.batchCount; i++) {
      thresholds.push(maxConfidence - step * i);
    }

    return thresholds;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 取消渲染
   */
  cancel(): void {
    this.renderCallbacks.clear();
  }
}

/**
 * 使用requestAnimationFrame优化的渲染调度器
 */
export class AnimationFrameScheduler {
  private tasks: Array<() => void> = [];
  private isScheduled = false;

  /**
   * 调度任务
   * @param task - 要执行的任务
   */
  schedule(task: () => void): void {
    this.tasks.push(task);

    if (!this.isScheduled) {
      this.isScheduled = true;
      requestAnimationFrame(() => this.executeTasks());
    }
  }

  /**
   * 执行所有任务
   */
  private executeTasks(): void {
    const tasks = this.tasks;
    this.tasks = [];
    this.isScheduled = false;

    tasks.forEach(task => {
      try {
        task();
      } catch (error) {
        console.error('Task execution error:', error);
      }
    });
  }

  /**
   * 清空所有任务
   */
  clear(): void {
    this.tasks = [];
  }
}
