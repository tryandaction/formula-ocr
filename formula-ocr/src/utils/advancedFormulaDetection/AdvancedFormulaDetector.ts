/**
 * Advanced Formula Detector - 高级公式检测器
 * 主检测器，协调所有子模块完成公式检测
 */

import type { IAdvancedFormulaDetector } from './interfaces';
import type {
  DetectionOptions,
  PageImage,
  EnhancedFormulaRegion,
  ImageRegion,
  RegionContext,
  DetectionCandidate,
} from './types';
import { PagePreprocessor } from './PagePreprocessor';
import { FeatureExtractor } from './FeatureExtractor';
import { ContentClassifier } from './ContentClassifier';
import { FormulaTypeClassifier } from './FormulaTypeClassifier';
import { BoundaryDetector } from './BoundaryDetector';
import { ConfidenceScorer } from './ConfidenceScorer';
import { DetectionCacheManager } from './DetectionCacheManager';
import { DEFAULT_DETECTION_OPTIONS } from './constants';

export class AdvancedFormulaDetector implements IAdvancedFormulaDetector {
  private preprocessor: PagePreprocessor;
  private featureExtractor: FeatureExtractor;
  private contentClassifier: ContentClassifier;
  private formulaTypeClassifier: FormulaTypeClassifier;
  private boundaryDetector: BoundaryDetector;
  private confidenceScorer: ConfidenceScorer;
  private cacheManager: DetectionCacheManager;

  constructor() {
    this.preprocessor = new PagePreprocessor();
    this.featureExtractor = new FeatureExtractor();
    this.contentClassifier = new ContentClassifier();
    this.formulaTypeClassifier = new FormulaTypeClassifier();
    this.boundaryDetector = new BoundaryDetector();
    this.confidenceScorer = new ConfidenceScorer();
    this.cacheManager = new DetectionCacheManager();
  }

  /**
   * 检测页面中的所有公式
   */
  async detectFormulas(
    pageImage: string,
    pageNumber: number,
    options?: DetectionOptions
  ): Promise<EnhancedFormulaRegion[]> {
    const opts = { ...DEFAULT_DETECTION_OPTIONS, ...options };
    
    // 检查缓存
    const imageHash = DetectionCacheManager.computeImageHash(pageImage);
    const cached = this.cacheManager.get(pageNumber, imageHash);
    if (cached) {
      return this.filterByOptions(cached, opts);
    }
    
    try {
      // 1. 加载图像
      const imageData = await this.loadImage(pageImage);
      
      // 2. 预处理
      const processedImage = this.preprocessor.preprocess(imageData, {
        targetDPI: opts.resolution,
        denoise: opts.enablePreprocessing,
        enhanceContrast: opts.enablePreprocessing,
        binarizationMethod: 'adaptive',
      });
      
      // 3. 查找候选区域
      const candidates = this.findCandidateRegions(processedImage);
      
      // 4. 处理每个候选区域
      const detections: EnhancedFormulaRegion[] = [];
      
      for (const candidate of candidates) {
        const detection = await this.processCandidate(
          candidate,
          processedImage,
          pageNumber
        );
        
        if (detection && detection.confidence.overall >= opts.minConfidence!) {
          detections.push(detection);
        }
      }
      
      // 5. 缓存结果
      this.cacheManager.set(pageNumber, detections, imageHash);
      
      // 6. 根据选项过滤
      return this.filterByOptions(detections, opts);
    } catch (error) {
      console.error('Formula detection failed:', error);
      return [];
    }
  }

  /**
   * 批量检测多个页面
   */
  async detectMultiplePages(
    pages: PageImage[],
    onProgress?: (progress: number) => void
  ): Promise<Map<number, EnhancedFormulaRegion[]>> {
    const results = new Map<number, EnhancedFormulaRegion[]>();
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const formulas = await this.detectFormulas(page.imageData, page.pageNumber);
      results.set(page.pageNumber, formulas);
      
      if (onProgress) {
        onProgress(((i + 1) / pages.length) * 100);
      }
    }
    
    return results;
  }

  /**
   * 加载图像
   */
  private async loadImage(base64Data: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`;
    });
  }

  /**
   * 查找候选区域
   */
  private findCandidateRegions(processedImage: any): ImageRegion[] {
    // 简化实现：将整个图像作为一个候选区域
    // 实际应该使用连通域分析找到所有可能的公式区域
    const regions: ImageRegion[] = [];
    
    // TODO: 实现真正的连通域分析
    // 这里返回一个示例区域
    regions.push({
      x: 0,
      y: 0,
      width: processedImage.width,
      height: processedImage.height,
      imageData: processedImage.imageData,
      binaryData: processedImage.binaryData,
    });
    
    return regions;
  }

  /**
   * 处理单个候选区域
   */
  private async processCandidate(
    region: ImageRegion,
    processedImage: any,
    pageNumber: number
  ): Promise<EnhancedFormulaRegion | null> {
    // 1. 提取特征
    const context: RegionContext = {
      pageWidth: processedImage.width,
      pageHeight: processedImage.height,
      surroundingRegions: [],
      textLines: [],
    };
    
    const features = this.featureExtractor.extractFeatures(region, context);
    
    // 2. 分类内容类型
    const classification = this.contentClassifier.classify(region, features);
    
    // 如果不是公式，跳过
    if (classification.type !== 'formula') {
      return null;
    }
    
    // 3. 判断公式类型
    const formulaType = this.formulaTypeClassifier.classifyFormulaType(region, context);
    
    // 4. 精化边界
    const boundary = this.boundaryDetector.refineBoundary(region, processedImage);
    
    // 5. 创建检测候选
    const candidate: DetectionCandidate = {
      region,
      boundary,
      formulaType,
    };
    
    // 6. 计算置信度
    const confidence = this.confidenceScorer.calculateConfidence(
      candidate,
      features,
      classification
    );
    
    // 7. 构建结果
    const result: EnhancedFormulaRegion = {
      id: `formula_${pageNumber}_${Date.now()}`,
      imageData: '', // Will be filled by caller if needed
      pageNumber,
      position: {
        x: boundary.x,
        y: boundary.y,
        width: boundary.width,
        height: boundary.height,
      },
      originalPosition: {
        x: boundary.x,
        y: boundary.y,
        width: boundary.width,
        height: boundary.height,
      },
      contentType: classification.type,
      formulaType: formulaType.type,
      confidence,
      features,
      classification,
    };
    
    return result;
  }

  /**
   * 根据选项过滤结果
   */
  private filterByOptions(
    detections: EnhancedFormulaRegion[],
    options: DetectionOptions
  ): EnhancedFormulaRegion[] {
    return detections.filter(detection => {
      // 过滤置信度
      if (detection.confidence.overall < options.minConfidence!) {
        return false;
      }
      
      // 过滤公式类型
      if (!options.includeInline && detection.formulaType === 'inline') {
        return false;
      }
      
      if (!options.includeDisplay && detection.formulaType === 'display') {
        return false;
      }
      
      return true;
    });
  }

  /**
   * 清除缓存
   */
  clearCache(pageNumber?: number): void {
    this.cacheManager.clear(pageNumber);
  }
}
