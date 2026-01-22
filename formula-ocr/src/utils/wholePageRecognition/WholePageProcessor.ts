/**
 * 整页处理器
 * 协调整页公式检测流程，管理批处理任务
 */

import type { PageData, ProcessingOptions, FormulaInstance, DetectionContext } from './types';
import { DEFAULT_PROCESSING_OPTIONS } from './types';
import { BatchProcessingManager } from './BatchProcessingManager';
import { DetectionOptimizer } from './DetectionOptimizer';
import { BoundaryLocator } from './BoundaryLocator';
import { ConfidenceScorer } from './ConfidenceScorer';

/**
 * 整页处理器实现
 */
export class WholePageProcessor {
  private batchManager: BatchProcessingManager;
  private optimizer: DetectionOptimizer;
  private boundaryLocator: BoundaryLocator;
  private confidenceScorer: ConfidenceScorer;
  
  private progress: number = 0;
  private abortController: AbortController | null = null;

  constructor() {
    this.batchManager = new BatchProcessingManager();
    this.optimizer = new DetectionOptimizer();
    this.boundaryLocator = new BoundaryLocator();
    this.confidenceScorer = new ConfidenceScorer();
  }

  /**
   * 处理整个PDF页面，返回所有检测到的公式
   * 
   * @param pageData - PDF页面数据（包含图像和文本层）
   * @param options - 处理选项（置信度阈值、性能模式等）
   * @returns 公式实例数组
   */
  async processWholePage(
    pageData: PageData,
    options: Partial<ProcessingOptions> = {}
  ): Promise<FormulaInstance[]> {
    const opts = { ...DEFAULT_PROCESSING_OPTIONS, ...options };
    this.progress = 0;
    this.abortController = new AbortController();

    try {
      // 1. 预处理和区域划分
      this.updateProgress(10);
      const regions = this.batchManager.divideIntoRegions(pageData);

      // 2. 并行检测各区域
      this.updateProgress(20);
      const detectionResults = await this.batchManager.processRegionsInParallel(
        regions,
        async (region) => {
          if (this.abortController?.signal.aborted) {
            throw new Error('Processing cancelled');
          }
          return await this.optimizer.detectFormulas(region);
        }
      );

      // 3. 验证检测结果，过滤误检
      this.updateProgress(40);
      const validatedResults = detectionResults.map(detections =>
        this.optimizer.validateDetections(detections)
      );

      // 4. 精炼边界
      this.updateProgress(60);
      const refinedResults = validatedResults.map(detections =>
        this.boundaryLocator.refineBoundariesBatch(detections, pageData.imageData)
      );

      // 5. 转换为公式实例
      this.updateProgress(70);
      const formulas: FormulaInstance[][] = validatedResults.map((detections, regionIdx) => {
        return detections.map((detection, idx) => {
          const formulaId = `${pageData.pageNumber}-${regionIdx}-${idx}`;
          return this.createFormulaInstance(
            formulaId,
            detection,
            refinedResults[regionIdx][idx],
            pageData
          );
        });
      });

      // 6. 合并重叠区域的检测结果
      this.updateProgress(80);
      const merged = this.batchManager.mergeResults(formulas);

      // 7. 计算置信度
      this.updateProgress(85);
      const context = this.createDetectionContext(pageData, merged);
      const formulasWithConfidence = merged.map(formula => {
        const detection = {
          boundingBox: formula.boundingBox,
          confidence: formula.confidence,
          features: formula.metadata as any, // 简化处理
          type: formula.type,
        };
        const confidence = this.confidenceScorer.calculateConfidence(detection, context);
        return { ...formula, confidence };
      });

      // 8. 过滤低置信度结果
      this.updateProgress(90);
      const filtered = formulasWithConfidence.filter(
        formula => formula.confidence >= opts.confidenceThreshold
      );

      // 9. 限制最大公式数
      const limited = filtered.slice(0, opts.maxFormulas);

      this.updateProgress(100);
      return limited;
    } catch (error) {
      this.progress = 0;
      throw error;
    }
  }

  /**
   * 取消正在进行的处理任务
   */
  cancelProcessing(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.progress = 0;
  }

  /**
   * 获取处理进度（0-100）
   */
  getProgress(): number {
    return this.progress;
  }

  /**
   * 更新进度
   */
  private updateProgress(value: number): void {
    this.progress = Math.max(0, Math.min(100, value));
  }

  /**
   * 创建公式实例
   */
  private createFormulaInstance(
    id: string,
    detection: any,
    refinedBoundingBox: any,
    pageData: PageData
  ): FormulaInstance {
    return {
      id,
      boundingBox: refinedBoundingBox,
      confidence: detection.confidence,
      type: detection.type,
      imageData: '', // 需要从pageData中提取
      pageNumber: pageData.pageNumber,
      detectionTimestamp: Date.now(),
      metadata: {
        hasSubscript: detection.features?.hasScripts || false,
        hasSuperscript: detection.features?.hasScripts || false,
        hasFraction: detection.features?.hasFractionStructure || false,
        hasIntegral: detection.features?.hasLargeOperators || false,
        hasSummation: detection.features?.hasLargeOperators || false,
        hasMatrix: false,
        hasGreekLetters: detection.features?.greekLetterCount > 0,
        complexity: this.determineComplexity(detection.features),
      },
    };
  }

  /**
   * 创建检测上下文
   */
  private createDetectionContext(
    pageData: PageData,
    formulas: FormulaInstance[]
  ): DetectionContext {
    const pageArea = pageData.width * pageData.height;
    const formulaArea = formulas.reduce(
      (sum, f) => sum + f.boundingBox.width * f.boundingBox.height,
      0
    );

    return {
      pageType: 'general',
      formulaDensity: formulaArea / pageArea,
      averageFormulaSize: formulas.length > 0 
        ? formulaArea / formulas.length 
        : 0,
      textQuality: 0.8, // 简化处理
    };
  }

  /**
   * 判断公式复杂度
   */
  private determineComplexity(features: any): 'simple' | 'medium' | 'complex' {
    if (!features) return 'simple';

    let score = 0;
    if (features.hasFractionStructure) score++;
    if (features.hasScripts) score++;
    if (features.hasRoots) score++;
    if (features.hasLargeOperators) score++;
    if (features.hasBracketPairs) score++;

    if (score >= 3) return 'complex';
    if (score >= 1) return 'medium';
    return 'simple';
  }
}
