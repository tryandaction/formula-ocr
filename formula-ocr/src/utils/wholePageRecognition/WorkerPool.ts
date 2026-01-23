/**
 * Worker池管理器
 * 管理多个Web Workers，实现高效的并行处理
 */

import type { DetectionRegion, RawDetection, DetectionOptions } from './types';
import type { WorkerMessage, WorkerResponse } from './DetectionWorker';

/**
 * Worker任务
 */
interface WorkerTask {
  region: DetectionRegion;
  options: DetectionOptions;
  resolve: (detections: RawDetection[]) => void;
  reject: (error: Error) => void;
}

/**
 * Worker池配置
 */
export interface WorkerPoolConfig {
  /** Worker数量（默认为CPU核心数-1） */
  workerCount?: number;
  /** 任务超时时间（毫秒） */
  taskTimeout?: number;
}

/**
 * Worker池
 * 管理多个Worker实例，分配任务并收集结果
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private workerCount: number;
  private taskTimeout: number;
  private workerPath: string;

  constructor(config: WorkerPoolConfig = {}) {
    // 默认使用CPU核心数-1个Worker（至少1个）
    this.workerCount = config.workerCount ?? Math.max(1, navigator.hardwareConcurrency - 1);
    this.taskTimeout = config.taskTimeout ?? 30000; // 30秒超时
    
    // Worker脚本路径（需要根据实际构建配置调整）
    this.workerPath = new URL('./DetectionWorker.ts', import.meta.url).href;
  }

  /**
   * 初始化Worker池
   */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.workerCount; i++) {
      try {
        const worker = new Worker(this.workerPath, { type: 'module' });
        this.workers.push(worker);
        this.availableWorkers.push(worker);
      } catch (error) {
        console.warn(`Failed to create worker ${i}:`, error);
      }
    }

    if (this.workers.length === 0) {
      throw new Error('Failed to create any workers');
    }

    console.log(`Worker pool initialized with ${this.workers.length} workers`);
  }

  /**
   * 执行检测任务
   * @param region - 检测区域
   * @param options - 检测选项
   * @returns 检测结果
   */
  async detect(
    region: DetectionRegion,
    options: DetectionOptions
  ): Promise<RawDetection[]> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = { region, options, resolve, reject };

      // 如果有可用Worker，立即执行
      if (this.availableWorkers.length > 0) {
        this.executeTask(task);
      } else {
        // 否则加入队列
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * 执行单个任务
   */
  private executeTask(task: WorkerTask): void {
    const worker = this.availableWorkers.pop();
    if (!worker) {
      // 没有可用Worker，加入队列
      this.taskQueue.push(task);
      return;
    }

    // 设置超时
    const timeoutId = setTimeout(() => {
      task.reject(new Error('Worker task timeout'));
      this.releaseWorker(worker);
    }, this.taskTimeout);

    // 监听Worker响应
    const messageHandler = (event: MessageEvent<WorkerResponse>) => {
      const { type, payload } = event.data;

      if (type === 'success' && payload?.detections) {
        clearTimeout(timeoutId);
        task.resolve(payload.detections);
        this.releaseWorker(worker);
        worker.removeEventListener('message', messageHandler);
      } else if (type === 'error') {
        clearTimeout(timeoutId);
        task.reject(new Error(payload?.error ?? 'Unknown worker error'));
        this.releaseWorker(worker);
        worker.removeEventListener('message', messageHandler);
      }
    };

    worker.addEventListener('message', messageHandler);

    // 发送任务到Worker
    const message: WorkerMessage = {
      type: 'detect',
      payload: {
        region: task.region,
        options: task.options,
      },
    };
    worker.postMessage(message);
  }

  /**
   * 释放Worker，使其可用于下一个任务
   */
  private releaseWorker(worker: Worker): void {
    this.availableWorkers.push(worker);

    // 如果队列中有任务，立即执行
    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift();
      if (nextTask) {
        this.executeTask(nextTask);
      }
    }
  }

  /**
   * 批量执行检测任务
   * @param regions - 检测区域数组
   * @param options - 检测选项
   * @returns 检测结果数组
   */
  async detectBatch(
    regions: DetectionRegion[],
    options: DetectionOptions
  ): Promise<RawDetection[][]> {
    const promises = regions.map(region => this.detect(region, options));
    return Promise.all(promises);
  }

  /**
   * 取消所有正在进行的任务
   */
  cancelAll(): void {
    // 清空任务队列
    this.taskQueue.forEach(task => {
      task.reject(new Error('Task cancelled'));
    });
    this.taskQueue = [];

    // 向所有Worker发送取消消息
    this.workers.forEach(worker => {
      const message: WorkerMessage = { type: 'cancel' };
      worker.postMessage(message);
    });
  }

  /**
   * 销毁Worker池
   */
  destroy(): void {
    this.cancelAll();
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
  }

  /**
   * 获取Worker池状态
   */
  getStatus(): {
    totalWorkers: number;
    availableWorkers: number;
    queuedTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
    };
  }
}
