/**
 * PDF Integration Module for Advanced Formula Detection
 * Bridges the advanced detection engine with the existing PDF viewer
 */

import { AdvancedFormulaDetector } from './AdvancedFormulaDetector';
import type { DetectionOptions, EnhancedFormulaRegion } from './interfaces';
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
  minConfidence: 0.6,
  formulaTypeFilter: 'both',
  enableCache: true,
  enableParallel: false, // Will be enabled in Task 11
};

/**
 * Convert EnhancedFormulaRegion to FormulaRegion for backward compatibility
 */
function convertToFormulaRegion(
  enhanced: EnhancedFormulaRegion,
  pageNumber: number,
  imageData: string,
  scale: number
): FormulaRegion {
  return {
    id: `formula_${pageNumber}_${enhanced.id}`,
    pageNumber,
    imageData,
    position: {
      x: enhanced.boundary.x,
      y: enhanced.boundary.y,
      width: enhanced.boundary.width,
      height: enhanced.boundary.height,
    },
    originalPosition: {
      x: enhanced.boundary.x / scale,
      y: enhanced.boundary.y / scale,
      width: enhanced.boundary.width / scale,
      height: enhanced.boundary.height / scale,
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
  config: PDFDetectionConfig = DEFAULT_PDF_CONFIG
): Promise<FormulaRegion[]> {
  if (!config.useAdvancedDetection) {
    // Fallback to basic detection
    const { detectMultipleFormulas } = await import('../formulaDetection');
    const result = await detectMultipleFormulas(pageImageData);
    return result.formulas.map(f => ({
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
        x: f.bounds.x,
        y: f.bounds.y,
        width: f.bounds.width,
        height: f.bounds.height,
      },
      confidence: f.confidence,
    }));
  }

  try {
    // Use advanced detection
    const detector = new AdvancedFormulaDetector();
    
    const options: DetectionOptions = {
      minConfidence: config.minConfidence,
      formulaTypeFilter: config.formulaTypeFilter === 'both' ? undefined : config.formulaTypeFilter,
      targetDPI: 300,
      enableCache: config.enableCache,
    };

    const enhancedRegions = await detector.detectFormulas(pageImageData, options);
    
    // Extract formula images and convert to FormulaRegion
    const formulas: FormulaRegion[] = [];
    const img = await loadImage(pageImageData);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    // Calculate scale based on image dimensions
    const scale = Math.max(canvas.width / 800, canvas.height / 1000, 1);
    
    for (const region of enhancedRegions) {
      // Extract formula image with padding
      const padding = 10;
      const x = Math.max(0, region.boundary.x - padding);
      const y = Math.max(0, region.boundary.y - padding);
      const width = Math.min(canvas.width - x, region.boundary.width + padding * 2);
      const height = Math.min(canvas.height - y, region.boundary.height + padding * 2);
      
      const regionCanvas = document.createElement('canvas');
      const regionCtx = regionCanvas.getContext('2d')!;
      
      regionCanvas.width = width;
      regionCanvas.height = height;
      
      // White background
      regionCtx.fillStyle = 'white';
      regionCtx.fillRect(0, 0, width, height);
      
      // Draw region
      regionCtx.drawImage(
        canvas,
        x, y, width, height,
        0, 0, width, height
      );
      
      const imageData = regionCanvas.toDataURL('image/png');
      formulas.push(convertToFormulaRegion(region, pageNumber, imageData, scale));
    }
    
    return formulas;
  } catch (error) {
    console.error('Advanced detection failed, falling back to basic:', error);
    
    // Fallback to basic detection
    const { detectMultipleFormulas } = await import('../formulaDetection');
    const result = await detectMultipleFormulas(pageImageData);
    return result.formulas.map(f => ({
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
        x: f.bounds.x,
        y: f.bounds.y,
        width: f.bounds.width,
        height: f.bounds.height,
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
  config: PDFDetectionConfig = DEFAULT_PDF_CONFIG,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, FormulaRegion[]>> {
  const results = new Map<number, FormulaRegion[]>();
  
  for (let i = 0; i < pageImages.length; i++) {
    const pageNumber = i + 1;
    const formulas = await detectFormulasInPage(pageImages[i], pageNumber, config);
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
