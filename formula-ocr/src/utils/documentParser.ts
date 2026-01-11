/**
 * 文档解析服务 - 支持 PDF、DOCX、Markdown 文件的公式提取
 * 优化版本：提升渲染质量、改进公式检测算法、支持精确定位
 */

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
  fileType: DocumentType | null;
  fileSize: number;
  pageCount?: number;
}

export interface FormulaRegion {
  id: string;
  imageData: string; // base64
  pageNumber: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 原始坐标（用于高亮显示，基于原始PDF尺寸）
  originalPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
  type?: 'inline' | 'display' | 'equation'; // 公式类型
}

export interface ParsedDocument {
  fileName: string;
  fileType: DocumentType;
  pageCount: number;
  formulas: FormulaRegion[];
  thumbnails: string[]; // 页面缩略图 base64
  pageImages: string[]; // 高清页面图像（用于预览）
  pageDimensions: { width: number; height: number }[]; // 每页原始尺寸
}

export type DocumentType = 'pdf' | 'docx' | 'markdown';

// 文件大小限制 (bytes)
const SIZE_LIMITS: Record<DocumentType, number> = {
  pdf: 50 * 1024 * 1024,    // 50MB
  docx: 20 * 1024 * 1024,   // 20MB
  markdown: 5 * 1024 * 1024, // 5MB
};

// PDF 页数限制
const PDF_PAGE_LIMIT = 100;

// 渲染比例 - 高清渲染
const RENDER_SCALE = 2.0;
// 公式提取时的渲染比例 - 更高清晰度
const FORMULA_RENDER_SCALE = 3.0;
const THUMBNAIL_WIDTH = 150;

// MIME 类型映射
const MIME_TYPES: Record<string, DocumentType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/plain': 'markdown',
};

// 文件扩展名映射
const EXTENSIONS: Record<string, DocumentType> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.md': 'markdown',
  '.markdown': 'markdown',
};

/**
 * 获取文件类型
 */
export function getDocumentType(file: File): DocumentType | null {
  if (file.type && MIME_TYPES[file.type]) {
    return MIME_TYPES[file.type];
  }
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return EXTENSIONS[ext] || null;
}

/**
 * 验证文档文件
 */
export async function validateDocument(file: File): Promise<DocumentValidationResult> {
  const fileType = getDocumentType(file);
  const fileSize = file.size;

  if (!fileType) {
    return {
      valid: false,
      error: '不支持的文件格式。支持的格式: PDF, DOCX, Markdown',
      fileType: null,
      fileSize,
    };
  }

  const sizeLimit = SIZE_LIMITS[fileType];
  if (fileSize > sizeLimit) {
    const limitMB = sizeLimit / (1024 * 1024);
    return {
      valid: false,
      error: `文件过大。${fileType.toUpperCase()} 文件最大支持 ${limitMB}MB`,
      fileType,
      fileSize,
    };
  }

  if (fileType === 'pdf') {
    try {
      const pageCount = await getPdfPageCount(file);
      if (pageCount > PDF_PAGE_LIMIT) {
        return {
          valid: false,
          error: `PDF 页数过多。最大支持 ${PDF_PAGE_LIMIT} 页，当前 ${pageCount} 页`,
          fileType,
          fileSize,
          pageCount,
        };
      }
      return { valid: true, fileType, fileSize, pageCount };
    } catch (error) {
      return {
        valid: false,
        error: 'PDF 文件损坏或无法读取',
        fileType,
        fileSize,
      };
    }
  }

  return { valid: true, fileType, fileSize };
}

/**
 * 获取 PDF 页数
 */
async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  return pdf.numPages;
}

// 缓存 PDF.js 模块
let pdfjsModule: typeof import('pdfjs-dist') | null = null;

/**
 * 预加载 PDF.js 模块
 */
export async function preloadPdfJs(): Promise<void> {
  if (!pdfjsModule) {
    pdfjsModule = await import('pdfjs-dist');
    pdfjsModule.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsModule.version}/build/pdf.worker.min.mjs`;
  }
}

/**
 * 获取 PDF.js 模块（带缓存）
 */
async function getPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsModule) {
    await preloadPdfJs();
  }
  return pdfjsModule!;
}

/**
 * 解析 PDF 文档并提取公式区域
 */
export async function parsePdfDocument(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<ParsedDocument> {
  const pdfjs = await getPdfJs();
  
  onProgress?.(0, '正在加载 PDF...');
  
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pageCount = pdf.numPages;
  
  const thumbnails: string[] = [];
  const pageImages: string[] = [];
  const pageDimensions: { width: number; height: number }[] = [];
  const formulas: FormulaRegion[] = [];
  
  for (let i = 1; i <= pageCount; i++) {
    onProgress?.((i / pageCount) * 80, `正在渲染第 ${i}/${pageCount} 页...`);
    
    const page = await pdf.getPage(i);
    
    // 获取原始页面尺寸
    const originalViewport = page.getViewport({ scale: 1 });
    pageDimensions.push({
      width: originalViewport.width,
      height: originalViewport.height,
    });
    
    // 高清渲染用于预览
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    
    // 创建高清 canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { 
      alpha: false,
      willReadFrequently: true 
    })!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // 白色背景
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).promise;
    
    // 生成高清页面图像（PNG格式保持清晰度）
    pageImages.push(canvas.toDataURL('image/png'));
    
    // 生成缩略图
    const thumbScale = THUMBNAIL_WIDTH / originalViewport.width;
    const thumbnailCanvas = document.createElement('canvas');
    const thumbCtx = thumbnailCanvas.getContext('2d')!;
    thumbnailCanvas.width = THUMBNAIL_WIDTH;
    thumbnailCanvas.height = originalViewport.height * thumbScale;
    thumbCtx.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    thumbnails.push(thumbnailCanvas.toDataURL('image/jpeg', 0.85));
  }
  
  // 第二遍：检测公式（使用更高分辨率）
  onProgress?.(80, '正在检测公式区域...');
  
  for (let i = 1; i <= pageCount; i++) {
    onProgress?.(80 + (i / pageCount) * 18, `正在分析第 ${i}/${pageCount} 页公式...`);
    
    const page = await pdf.getPage(i);
    const formulaViewport = page.getViewport({ scale: FORMULA_RENDER_SCALE });
    
    // 创建高分辨率 canvas 用于公式检测
    const formulaCanvas = document.createElement('canvas');
    const formulaCtx = formulaCanvas.getContext('2d', { 
      alpha: false,
      willReadFrequently: true 
    })!;
    formulaCanvas.width = formulaViewport.width;
    formulaCanvas.height = formulaViewport.height;
    
    formulaCtx.fillStyle = '#ffffff';
    formulaCtx.fillRect(0, 0, formulaCanvas.width, formulaCanvas.height);
    
    await page.render({
      canvasContext: formulaCtx,
      viewport: formulaViewport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).promise;
    
    // 检测公式区域
    const pageFormulas = await detectFormulasInPage(
      formulaCanvas, 
      i, 
      FORMULA_RENDER_SCALE,
      pageDimensions[i - 1]
    );
    formulas.push(...pageFormulas);
  }
  
  onProgress?.(100, '解析完成');
  
  return {
    fileName: file.name,
    fileType: 'pdf',
    pageCount,
    formulas,
    thumbnails,
    pageImages,
    pageDimensions,
  };
}

/**
 * 改进的公式检测算法
 * 使用多种特征来识别公式区域
 */
async function detectFormulasInPage(
  canvas: HTMLCanvasElement,
  pageNumber: number,
  scale: number,
  _pageDimension: { width: number; height: number }
): Promise<FormulaRegion[]> {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  const formulas: FormulaRegion[] = [];
  
  // 计算每行的像素密度和特征
  const rowDensity: number[] = [];
  const rowVariance: number[] = [];
  const rowCenterOfMass: number[] = []; // 行内容重心
  
  for (let y = 0; y < height; y++) {
    let blackPixels = 0;
    let pixelValues: number[] = [];
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      pixelValues.push(brightness);
      if (brightness < 200) {
        blackPixels++;
        const weight = 255 - brightness;
        weightedSum += x * weight;
        totalWeight += weight;
      }
    }
    
    rowDensity.push(blackPixels / width);
    rowCenterOfMass.push(totalWeight > 0 ? weightedSum / totalWeight : width / 2);
    
    // 计算行内变化度
    const mean = pixelValues.reduce((a, b) => a + b, 0) / pixelValues.length;
    const variance = pixelValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pixelValues.length;
    rowVariance.push(variance);
  }
  
  // 找到内容区域边界
  const contentThreshold = 0.003;
  let contentTop = 0, contentBottom = height;
  let contentLeft = 0, contentRight = width;
  
  // 找上下边界
  for (let y = 0; y < height; y++) {
    if (rowDensity[y] > contentThreshold) {
      contentTop = y;
      break;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    if (rowDensity[y] > contentThreshold) {
      contentBottom = y;
      break;
    }
  }
  
  // 计算列密度找左右边界
  const colDensity: number[] = [];
  for (let x = 0; x < width; x++) {
    let blackPixels = 0;
    for (let y = contentTop; y < contentBottom; y++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < 200) blackPixels++;
    }
    colDensity.push(blackPixels / Math.max(1, contentBottom - contentTop));
  }
  
  for (let x = 0; x < width; x++) {
    if (colDensity[x] > contentThreshold) {
      contentLeft = x;
      break;
    }
  }
  for (let x = width - 1; x >= 0; x--) {
    if (colDensity[x] > contentThreshold) {
      contentRight = x;
      break;
    }
  }
  
  // 检测可能的公式区域
  const minGap = Math.round(8 * scale);
  const minHeight = Math.round(12 * scale);
  const maxHeight = Math.round(250 * scale);
  const densityThreshold = 0.008;
  
  let inRegion = false;
  let regionStart = 0;
  let gapCount = 0;
  
  for (let y = contentTop; y <= contentBottom; y++) {
    const density = rowDensity[y];
    
    if (!inRegion && density > densityThreshold) {
      inRegion = true;
      regionStart = y;
      gapCount = 0;
    } else if (inRegion) {
      if (density < densityThreshold * 0.2) {
        gapCount++;
        if (gapCount > minGap) {
          const regionEnd = y - gapCount;
          const regionHeight = regionEnd - regionStart;
          
          if (regionHeight >= minHeight && regionHeight <= maxHeight) {
            const region = analyzeRegion(
              data, width, height,
              contentLeft, regionStart, contentRight, regionEnd,
              rowDensity, rowVariance, rowCenterOfMass
            );
            
            if (region.isFormula) {
              // 提取公式图像（带padding）
              const padding = Math.round(8 * scale);
              const left = Math.max(0, region.left - padding);
              const top = Math.max(0, regionStart - padding);
              const right = Math.min(width, region.right + padding);
              const bottom = Math.min(height, regionEnd + padding);
              
              const regionCanvas = document.createElement('canvas');
              regionCanvas.width = right - left;
              regionCanvas.height = bottom - top;
              const regionCtx = regionCanvas.getContext('2d')!;
              
              regionCtx.fillStyle = '#ffffff';
              regionCtx.fillRect(0, 0, regionCanvas.width, regionCanvas.height);
              regionCtx.drawImage(
                canvas,
                left, top, right - left, bottom - top,
                0, 0, regionCanvas.width, regionCanvas.height
              );
              
              // 计算原始坐标（基于PDF原始尺寸）
              const originalX = left / scale;
              const originalY = top / scale;
              const originalWidth = (right - left) / scale;
              const originalHeight = (bottom - top) / scale;
              
              formulas.push({
                id: `formula_${pageNumber}_${formulas.length + 1}_${Date.now()}`,
                imageData: regionCanvas.toDataURL('image/png'),
                pageNumber,
                position: {
                  x: left,
                  y: top,
                  width: right - left,
                  height: bottom - top,
                },
                originalPosition: {
                  x: originalX,
                  y: originalY,
                  width: originalWidth,
                  height: originalHeight,
                },
                confidence: region.confidence,
                type: region.type,
              });
            }
          }
          
          inRegion = false;
          gapCount = 0;
        }
      } else {
        gapCount = 0;
      }
    }
  }
  
  // 处理最后一个区域
  if (inRegion) {
    const regionEnd = contentBottom;
    const regionHeight = regionEnd - regionStart;
    
    if (regionHeight >= minHeight && regionHeight <= maxHeight) {
      const region = analyzeRegion(
        data, width, height,
        contentLeft, regionStart, contentRight, regionEnd,
        rowDensity, rowVariance, rowCenterOfMass
      );
      
      if (region.isFormula) {
        const padding = Math.round(8 * scale);
        const left = Math.max(0, region.left - padding);
        const top = Math.max(0, regionStart - padding);
        const right = Math.min(width, region.right + padding);
        const bottom = Math.min(height, regionEnd + padding);
        
        const regionCanvas = document.createElement('canvas');
        regionCanvas.width = right - left;
        regionCanvas.height = bottom - top;
        const regionCtx = regionCanvas.getContext('2d')!;
        
        regionCtx.fillStyle = '#ffffff';
        regionCtx.fillRect(0, 0, regionCanvas.width, regionCanvas.height);
        regionCtx.drawImage(
          canvas,
          left, top, right - left, bottom - top,
          0, 0, regionCanvas.width, regionCanvas.height
        );
        
        const originalX = left / scale;
        const originalY = top / scale;
        const originalWidth = (right - left) / scale;
        const originalHeight = (bottom - top) / scale;
        
        formulas.push({
          id: `formula_${pageNumber}_${formulas.length + 1}_${Date.now()}`,
          imageData: regionCanvas.toDataURL('image/png'),
          pageNumber,
          position: {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
          },
          originalPosition: {
            x: originalX,
            y: originalY,
            width: originalWidth,
            height: originalHeight,
          },
          confidence: region.confidence,
          type: region.type,
        });
      }
    }
  }
  
  return formulas;
}

/**
 * 分析区域是否为公式
 */
function analyzeRegion(
  data: Uint8ClampedArray,
  width: number,
  _height: number,
  contentLeft: number,
  top: number,
  contentRight: number,
  bottom: number,
  rowDensity: number[],
  rowVariance: number[],
  rowCenterOfMass: number[]
): { isFormula: boolean; left: number; right: number; confidence: number; type: 'inline' | 'display' | 'equation' } {
  // 找到区域的实际左右边界
  let left = contentRight, right = contentLeft;
  
  for (let y = top; y < bottom; y++) {
    for (let x = contentLeft; x < contentRight; x++) {
      const idx = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < 200) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
  }
  
  if (left >= right) {
    return { isFormula: false, left: 0, right: 0, confidence: 0, type: 'inline' };
  }
  
  const regionWidth = right - left;
  const contentWidth = contentRight - contentLeft;
  const regionHeight = bottom - top;
  
  let score = 0;
  let type: 'inline' | 'display' | 'equation' = 'inline';
  
  // 1. 检查是否居中（display 公式通常居中）
  const regionCenter = (left + right) / 2;
  const contentCenter = (contentLeft + contentRight) / 2;
  const centerOffset = Math.abs(regionCenter - contentCenter);
  const isCentered = centerOffset < contentWidth * 0.12;
  
  if (isCentered && regionWidth < contentWidth * 0.85) {
    score += 35;
    type = 'display';
  }
  
  // 2. 检查宽度比例
  const widthRatio = regionWidth / contentWidth;
  if (widthRatio > 0.15 && widthRatio < 0.92) {
    score += 20;
  }
  
  // 3. 检查高度特征
  if (regionHeight > 15 && regionHeight < 180) {
    score += 15;
  }
  
  // 4. 检查行内变化度（公式有更多符号变化）
  let avgVariance = 0;
  for (let y = top; y < bottom; y++) {
    avgVariance += rowVariance[y];
  }
  avgVariance /= Math.max(1, bottom - top);
  if (avgVariance > 800) {
    score += 20;
  }
  
  // 5. 检查密度分布
  let densitySum = 0;
  for (let y = top; y < bottom; y++) {
    densitySum += rowDensity[y];
  }
  const avgDensity = densitySum / Math.max(1, bottom - top);
  if (avgDensity > 0.015 && avgDensity < 0.35) {
    score += 15;
  }
  
  // 6. 检查重心分布（公式重心通常较稳定）
  let centerVariance = 0;
  const avgCenter = rowCenterOfMass.slice(top, bottom).reduce((a, b) => a + b, 0) / Math.max(1, bottom - top);
  for (let y = top; y < bottom; y++) {
    centerVariance += Math.pow(rowCenterOfMass[y] - avgCenter, 2);
  }
  centerVariance /= Math.max(1, bottom - top);
  if (centerVariance < contentWidth * contentWidth * 0.02) {
    score += 10;
  }
  
  // 7. 检查是否有缩进（equation 环境通常有编号）
  const leftMargin = left - contentLeft;
  const rightMargin = contentRight - right;
  if (leftMargin > contentWidth * 0.08 || rightMargin > contentWidth * 0.08) {
    score += 10;
    if (rightMargin > contentWidth * 0.12 && rightMargin < contentWidth * 0.28) {
      type = 'equation';
    }
  }
  
  const confidence = Math.min(100, Math.round(score * 0.9));
  const isFormula = score >= 38;
  
  return { isFormula, left, right, confidence, type };
}

/**
 * 手动选择区域提取公式
 */
export function extractRegionAsFormula(
  pageImage: string,
  pageNumber: number,
  region: { x: number; y: number; width: number; height: number },
  scale: number = 1
): Promise<FormulaRegion> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // 应用缩放
      const x = region.x * scale;
      const y = region.y * scale;
      const w = region.width * scale;
      const h = region.height * scale;
      
      canvas.width = w;
      canvas.height = h;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      
      resolve({
        id: `manual_${pageNumber}_${Date.now()}`,
        imageData: canvas.toDataURL('image/png'),
        pageNumber,
        position: { x, y, width: w, height: h },
        originalPosition: region,
        confidence: 100,
        type: 'display',
      });
    };
    img.src = pageImage;
  });
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 获取支持的文件类型描述
 */
export function getSupportedFormats(): string {
  return 'PDF (最大50MB, 100页), DOCX (最大20MB), Markdown (最大5MB)';
}

/**
 * 检查是否为支持的文档类型
 */
export function isSupportedDocument(file: File): boolean {
  return getDocumentType(file) !== null;
}
