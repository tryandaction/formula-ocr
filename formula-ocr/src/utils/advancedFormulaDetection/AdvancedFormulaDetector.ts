/**
 * Advanced Formula Detector - 高级公式检测器
 * 主检测器，协调所有子模块完成公式检测
 */

import type { IAdvancedFormulaDetector } from './interfaces';
import type {
  DetectionOptions,
  PageImage,
  ProcessedImage,
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
import {
  DEFAULT_DETECTION_OPTIONS,
  MIN_FORMULA_HEIGHT,
  MAX_FORMULA_HEIGHT,
  MIN_FORMULA_WIDTH,
  MIN_REGION_PIXELS,
  MERGE_THRESHOLD_X_SCALE,
  MERGE_THRESHOLD_Y_SCALE,
  MAX_DETECTION_TIME,
} from './constants';

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
    this.contentClassifier = new ContentClassifier(); // 已升级为深度优化版本
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
   * 查找候选区域 — BFS 8-连通域分析 + 区域合并
   */
  private findCandidateRegions(processedImage: ProcessedImage): ImageRegion[] {
    const { binaryData, width, height, scaleFactor, imageData } = processedImage;
    const startTime = performance.now();

    // --- 1. BFS 连通域扫描 ---
    const visited = new Uint8Array(width * height);
    type RawRegion = { minX: number; maxX: number; minY: number; maxY: number; pixels: number };
    const rawRegions: RawRegion[] = [];

    const bfs = (sx: number, sy: number): RawRegion | null => {
      const queue: number[] = [sx, sy]; // flat pairs [x,y,x,y,...]
      let head = 0;
      let minX = sx, maxX = sx, minY = sy, maxY = sy;
      let pixels = 0;

      while (head < queue.length) {
        const x = queue[head++];
        const y = queue[head++];
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const idx = y * width + x;
        if (visited[idx] || binaryData[idx] === 0) continue;

        visited[idx] = 1;
        pixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        // 8-连通邻居
        queue.push(
          x - 1, y, x + 1, y, x, y - 1, x, y + 1,
          x - 1, y - 1, x + 1, y - 1, x - 1, y + 1, x + 1, y + 1,
        );
      }

      return pixels >= MIN_REGION_PIXELS ? { minX, maxX, minY, maxY, pixels } : null;
    };

    for (let y = 0; y < height; y++) {
      // 超时保护
      if ((y & 63) === 0 && performance.now() - startTime > MAX_DETECTION_TIME) break;
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (binaryData[idx] === 1 && !visited[idx]) {
          const region = bfs(x, y);
          if (region) rawRegions.push(region);
        }
      }
    }

    // --- 2. 合并相邻区域 ---
    rawRegions.sort((a, b) => a.minY - b.minY);
    const mergeX = Math.round(MERGE_THRESHOLD_X_SCALE * scaleFactor);
    const mergeY = Math.round(MERGE_THRESHOLD_Y_SCALE * scaleFactor);
    const used = new Uint8Array(rawRegions.length);
    const merged: RawRegion[] = [];

    for (let i = 0; i < rawRegions.length; i++) {
      if (used[i]) continue;
      const m = { ...rawRegions[i] };
      used[i] = 1;

      let changed = true;
      while (changed) {
        changed = false;
        for (let j = 0; j < rawRegions.length; j++) {
          if (used[j]) continue;
          const r = rawRegions[j];
          const hOverlap = !(r.maxX + mergeX < m.minX || r.minX - mergeX > m.maxX);
          const vClose =
            Math.abs(r.minY - m.maxY) < mergeY ||
            Math.abs(m.minY - r.maxY) < mergeY ||
            (r.minY <= m.maxY && r.maxY >= m.minY);
          if (hOverlap && vClose) {
            m.minX = Math.min(m.minX, r.minX);
            m.maxX = Math.max(m.maxX, r.maxX);
            m.minY = Math.min(m.minY, r.minY);
            m.maxY = Math.max(m.maxY, r.maxY);
            m.pixels += r.pixels;
            used[j] = 1;
            changed = true;
          }
        }
      }
      merged.push(m);
    }

    // --- 3. 尺寸过滤 + 提取子图像 ---
    const minH = Math.round(MIN_FORMULA_HEIGHT * scaleFactor);
    const maxH = Math.round(MAX_FORMULA_HEIGHT * scaleFactor);
    const minW = Math.round(MIN_FORMULA_WIDTH * scaleFactor);
    const results: ImageRegion[] = [];

    for (const r of merged) {
      const rw = r.maxX - r.minX + 1;
      const rh = r.maxY - r.minY + 1;
      if (rh < minH || rh > maxH || rw < minW) continue;

      // 提取子 ImageData
      const subImageData = new ImageData(rw, rh);
      const subBinary = new Uint8Array(rw * rh);
      for (let dy = 0; dy < rh; dy++) {
        for (let dx = 0; dx < rw; dx++) {
          const srcIdx = (r.minY + dy) * width + (r.minX + dx);
          const dstIdx = dy * rw + dx;
          const srcPixel = srcIdx * 4;
          const dstPixel = dstIdx * 4;
          subImageData.data[dstPixel] = imageData.data[srcPixel];
          subImageData.data[dstPixel + 1] = imageData.data[srcPixel + 1];
          subImageData.data[dstPixel + 2] = imageData.data[srcPixel + 2];
          subImageData.data[dstPixel + 3] = imageData.data[srcPixel + 3];
          subBinary[dstIdx] = binaryData[srcIdx];
        }
      }

      results.push({
        x: r.minX,
        y: r.minY,
        width: rw,
        height: rh,
        imageData: subImageData,
        binaryData: subBinary,
      });
    }

    // 按位置排序（上→下，左→右）
    results.sort((a, b) => {
      const yDiff = a.y - b.y;
      return Math.abs(yDiff) > 20 ? yDiff : a.x - b.x;
    });

    return results;
  }

  /**
   * 处理单个候选区域
   */
  private async processCandidate(
    region: ImageRegion,
    processedImage: ProcessedImage,
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
