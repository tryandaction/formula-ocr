/**
 * PDF Integration Module for Advanced Formula Detection
 * Bridges the advanced detection engine with the existing PDF viewer
 */

import { AdvancedFormulaDetector } from './AdvancedFormulaDetector';
import { MAX_DETECTION_PIXELS, MIN_DETECTION_DPI } from './constants';
import type { EnhancedFormulaRegion, DetectionOptions } from './types';
import type { FormulaRegion } from '../documentParser';

/**
 * Configuration for PDF formula detection
 */
export interface PDFDetectionConfig {
  /** Use advanced detection (true) or fallback to basic (false) */
  useAdvancedDetection: boolean;
  /** Minimum confidence threshold (0-1) */
  minConfidence: number;
  /** Filter by formula type */
  formulaTypeFilter?: 'display' | 'inline' | 'both';
  /** Enable caching */
  enableCache: boolean;
  /** Enable parallel processing */
  enableParallel: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_PDF_CONFIG: PDFDetectionConfig = {
  useAdvancedDetection: true,
  minConfidence: 0.6, // 对齐前端默认阈值，覆盖小公式
  formulaTypeFilter: 'both',
  enableCache: true,
  enableParallel: false, // Will be enabled in Task 11
};

const sharedDetector = new AdvancedFormulaDetector();

/**
 * Convert EnhancedFormulaRegion to FormulaRegion for backward compatibility
 */
function convertToFormulaRegion(
  enhanced: EnhancedFormulaRegion,
  pageNumber: number,
  imageData: string,
  renderScale: number
): FormulaRegion {
  const safeScale = renderScale > 0 ? renderScale : 1;
  return {
    id: `formula_${pageNumber}_${enhanced.id}`,
    pageNumber,
    imageData,
    position: {
      x: enhanced.position.x,
      y: enhanced.position.y,
      width: enhanced.position.width,
      height: enhanced.position.height,
    },
    originalPosition: {
      x: enhanced.position.x / safeScale,
      y: enhanced.position.y / safeScale,
      width: enhanced.position.width / safeScale,
      height: enhanced.position.height / safeScale,
    },
    confidence: enhanced.confidence.overall,
    type: enhanced.formulaType === 'display' ? 'display' : 'inline',
    formulaType: enhanced.formulaType,
    confidenceLevel: enhanced.confidence.level,
  };
}

/**
 * Detect formulas in a single PDF page using advanced detection
 */
export async function detectFormulasInPage(
  pageImageData: string,
  pageNumber: number,
  config: Partial<PDFDetectionConfig> = DEFAULT_PDF_CONFIG,
  pageDimension?: { width: number; height: number }
): Promise<FormulaRegion[]> {
  const mergedConfig: PDFDetectionConfig = { ...DEFAULT_PDF_CONFIG, ...config };
  const img = await loadImage(pageImageData);
  const { renderScale, sourceDPI } = computeRenderScale(img, pageDimension);
  const targetDPI = computeTargetDPI(img.width, img.height, sourceDPI);
  const pageArea = Math.max(1, img.width * img.height);
  const maxRegionArea = pageArea * 0.6;

  if (!mergedConfig.useAdvancedDetection) {
    // Fallback to basic detection
    const { detectMultipleFormulas } = await import('../formulaDetection');
    const result = await detectMultipleFormulas(pageImageData);
    return result.formulas
      .filter(f => f.bounds.width * f.bounds.height <= maxRegionArea)
      .map(f => ({
        id: f.id,
        pageNumber,
        imageData: f.imageData,
        position: {
          x: f.bounds.x,
          y: f.bounds.y,
          width: f.bounds.width,
          height: f.bounds.height,
        },
        originalPosition: {
          x: f.bounds.x / renderScale,
          y: f.bounds.y / renderScale,
          width: f.bounds.width / renderScale,
          height: f.bounds.height / renderScale,
        },
        confidence: f.confidence,
      }));
  }

  try {
    // Use advanced detection
    const options: DetectionOptions = {
      minConfidence: mergedConfig.minConfidence,
      includeInline: mergedConfig.formulaTypeFilter !== 'display',
      includeDisplay: mergedConfig.formulaTypeFilter !== 'inline',
      resolution: targetDPI,
      sourceDPI,
    };

    let enhancedRegions: EnhancedFormulaRegion[] = [];

    try {
      enhancedRegions = await sharedDetector.detectFormulas(pageImageData, pageNumber, options);
    } catch (error) {
      if (error instanceof Error && error.message === 'DETECTION_TIMEOUT') {
        const degradedOptions: DetectionOptions = {
          ...options,
          resolution: Math.max(MIN_DETECTION_DPI, Math.round(targetDPI * 0.7)),
          minConfidence: Math.max(0.6, (options.minConfidence ?? 0.75) - 0.1),
          enablePreprocessing: false,
          useDeepOptimization: false,
        };
        try {
          enhancedRegions = await sharedDetector.detectFormulas(pageImageData, pageNumber, degradedOptions);
        } catch (fallbackError) {
          console.warn('Advanced detection degraded pass failed:', fallbackError);
          enhancedRegions = [];
        }
      } else {
        throw error;
      }
    }
    
    // Extract formula images and convert to FormulaRegion
    if (enhancedRegions.length === 0) {
      const { detectMultipleFormulas } = await import('../formulaDetection');
      const result = await detectMultipleFormulas(pageImageData);
      return result.formulas
        .filter(f => f.bounds.width * f.bounds.height <= maxRegionArea)
        .map(f => ({
          id: f.id,
          pageNumber,
          imageData: f.imageData,
          position: {
            x: f.bounds.x,
            y: f.bounds.y,
            width: f.bounds.width,
            height: f.bounds.height,
          },
          originalPosition: {
            x: f.bounds.x / renderScale,
            y: f.bounds.y / renderScale,
            width: f.bounds.width / renderScale,
            height: f.bounds.height / renderScale,
          },
          confidence: f.confidence,
        }));
    }

    const formulas: FormulaRegion[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    for (const region of enhancedRegions) {
      // Extract formula image with padding and upscaling for better OCR
      const FORMULA_UPSCALE = 1.5;
      const padding = 10;
      const x = Math.max(0, Math.floor(region.position.x - padding));
      const y = Math.max(0, Math.floor(region.position.y - padding));
      const width = Math.min(canvas.width - x, Math.ceil(region.position.width + padding * 2));
      const height = Math.min(canvas.height - y, Math.ceil(region.position.height + padding * 2));

      if (width <= 0 || height <= 0) continue;

      const regionCanvas = document.createElement('canvas');
      const regionCtx = regionCanvas.getContext('2d')!;

      regionCanvas.width = Math.round(width * FORMULA_UPSCALE);
      regionCanvas.height = Math.round(height * FORMULA_UPSCALE);

      // White background
      regionCtx.fillStyle = 'white';
      regionCtx.fillRect(0, 0, regionCanvas.width, regionCanvas.height);

      // High-quality upscale
      regionCtx.imageSmoothingEnabled = true;
      regionCtx.imageSmoothingQuality = 'high';

      // Draw region with upscaling
      regionCtx.drawImage(
        canvas,
        x, y, width, height,
        0, 0, regionCanvas.width, regionCanvas.height
      );
      
      const imageData = regionCanvas.toDataURL('image/png');
      formulas.push(convertToFormulaRegion(region, pageNumber, imageData, renderScale));
    }
    
    return formulas.filter(f => f.position.width * f.position.height <= maxRegionArea);
  } catch (error) {
    console.error('Advanced detection failed, falling back to basic:', error);
    
    // Fallback to basic detection
    const { detectMultipleFormulas } = await import('../formulaDetection');
    const result = await detectMultipleFormulas(pageImageData);
    return result.formulas
      .filter(f => f.bounds.width * f.bounds.height <= maxRegionArea)
      .map(f => ({
        id: f.id,
        pageNumber,
        imageData: f.imageData,
        position: {
          x: f.bounds.x,
          y: f.bounds.y,
          width: f.bounds.width,
          height: f.bounds.height,
        },
        originalPosition: {
          x: f.bounds.x / renderScale,
          y: f.bounds.y / renderScale,
          width: f.bounds.width / renderScale,
          height: f.bounds.height / renderScale,
        },
        confidence: f.confidence,
      }));
  }
}

/**
 * Detect formulas in multiple PDF pages
 */
export async function detectFormulasInPages(
  pageImages: string[],
  config: Partial<PDFDetectionConfig> = DEFAULT_PDF_CONFIG,
  pageDimensions?: { width: number; height: number }[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, FormulaRegion[]>> {
  const results = new Map<number, FormulaRegion[]>();
  
  for (let i = 0; i < pageImages.length; i++) {
    const pageNumber = i + 1;
    const formulas = await detectFormulasInPage(
      pageImages[i],
      pageNumber,
      config,
      pageDimensions ? pageDimensions[i] : undefined
    );
    results.set(pageNumber, formulas);
    
    if (onProgress) {
      onProgress(i + 1, pageImages.length);
    }
  }
  
  return results;
}

/**
 * Load image from base64
 */
function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}

function computeRenderScale(
  img: HTMLImageElement,
  pageDimension?: { width: number; height: number }
): { renderScale: number; sourceDPI: number } {
  if (!pageDimension || !pageDimension.width || !pageDimension.height) {
    return { renderScale: 1, sourceDPI: 72 };
  }

  const scaleX = img.width / pageDimension.width;
  const scaleY = img.height / pageDimension.height;
  const validX = Number.isFinite(scaleX) && scaleX > 0;
  const validY = Number.isFinite(scaleY) && scaleY > 0;
  const renderScale = validX && validY ? (scaleX + scaleY) / 2 : (validX ? scaleX : (validY ? scaleY : 1));
  const safeScale = renderScale > 0 ? renderScale : 1;
  return { renderScale: safeScale, sourceDPI: safeScale * 72 };
}

function computeTargetDPI(
  width: number,
  height: number,
  sourceDPI: number
): number {
  const pixelCount = Math.max(1, width * height);
  if (pixelCount <= MAX_DETECTION_PIXELS) {
    return sourceDPI;
  }
  const scale = Math.sqrt(MAX_DETECTION_PIXELS / pixelCount);
  const target = sourceDPI * scale;
  const clamped = Math.min(sourceDPI, Math.max(MIN_DETECTION_DPI, target));
  return clamped;
}

/**
 * Get detection statistics
 */
export interface DetectionStats {
  totalFormulas: number;
  displayFormulas: number;
  inlineFormulas: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  averageConfidence: number;
}

/**
 * Calculate detection statistics (for enhanced regions)
 */
export function calculateStats(regions: EnhancedFormulaRegion[]): DetectionStats {
  const stats: DetectionStats = {
    totalFormulas: regions.length,
    displayFormulas: 0,
    inlineFormulas: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    averageConfidence: 0,
  };
  
  if (regions.length === 0) return stats;
  
  let totalConfidence = 0;
  
  for (const region of regions) {
    // Count by type
    if (region.formulaType === 'display') {
      stats.displayFormulas++;
    } else {
      stats.inlineFormulas++;
    }
    
    // Count by confidence level
    if (region.confidence.level === 'high') {
      stats.highConfidence++;
    } else if (region.confidence.level === 'medium') {
      stats.mediumConfidence++;
    } else {
      stats.lowConfidence++;
    }
    
    totalConfidence += region.confidence.overall;
  }
  
  stats.averageConfidence = totalConfidence / regions.length;
  
  return stats;
}
