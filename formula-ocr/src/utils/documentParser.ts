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
  // Enhanced detection fields (optional)
  formulaType?: 'display' | 'inline';
  confidenceLevel?: 'high' | 'medium' | 'low';
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

// Advanced detection configuration
export interface DetectionConfig {
  useAdvancedDetection?: boolean;
  minConfidence?: number;
  formulaTypeFilter?: 'display' | 'inline' | 'both';
}

// Default detection config
const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  useAdvancedDetection: true,
  minConfidence: 0.75, // 提高到0.75以减少误检
  formulaTypeFilter: 'both',
};

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
  onProgress?: (progress: number, message: string) => void,
  detectionConfig: DetectionConfig = DEFAULT_DETECTION_CONFIG
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
  
  // Use advanced detection if enabled
  if (detectionConfig.useAdvancedDetection) {
    try {
      const { detectFormulasInPage: detectAdvanced } = await import('./advancedFormulaDetection/pdfIntegration');
      
      for (let i = 0; i < pageCount; i++) {
        onProgress?.(80 + ((i + 1) / pageCount) * 18, `正在分析第 ${i + 1}/${pageCount} 页公式...`);
        
        const pageFormulas = await detectAdvanced(
          pageImages[i],
          i + 1,
          {
            useAdvancedDetection: true,
            minConfidence: detectionConfig.minConfidence ?? 0.75, // 提高默认阈值
            formulaTypeFilter: detectionConfig.formulaTypeFilter ?? 'both',
            enableCache: true,
            enableParallel: false,
          }
        );
        
        // Convert to FormulaRegion format with enhanced fields
        for (const formula of pageFormulas) {
          formulas.push({
            ...formula,
            position: {
              x: formula.x,
              y: formula.y,
              width: formula.width,
              height: formula.height,
            },
            originalPosition: {
              x: formula.x / FORMULA_RENDER_SCALE,
              y: formula.y / FORMULA_RENDER_SCALE,
              width: formula.width / FORMULA_RENDER_SCALE,
              height: formula.height / FORMULA_RENDER_SCALE,
            },
          });
        }
      }
    } catch (error) {
      console.warn('Advanced detection failed, falling back to basic detection:', error);
      // Fall back to basic detection
      await runBasicDetection();
    }
  } else {
    // Use basic detection
    await runBasicDetection();
  }
  
  async function runBasicDetection() {
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
 * 改进的公式检测算法 v2
 * 使用连通域分析 + 数学符号特征检测
 * 核心改进：
 * 1. 使用连通域分析精确定位公式边界
 * 2. 检测数学符号特征（希腊字母、运算符、分数线等）
 * 3. 区分公式与普通文本
 * 4. 紧贴公式边缘的边框
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
  
  // 1. 二值化图像
  const binaryImage = new Uint8Array(width * height);
  const threshold = 180; // 二值化阈值
  
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    binaryImage[i] = brightness < threshold ? 1 : 0;
  }
  
  // 2. 连通域分析 - 找到所有独立的内容块
  const visited = new Uint8Array(width * height);
  const regions: Array<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    pixels: number;
    aspectRatio: number;
    density: number;
  }> = [];
  
  // BFS 找连通域
  const findConnectedRegion = (startX: number, startY: number): typeof regions[0] | null => {
    const queue: Array<[number, number]> = [[startX, startY]];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixelCount = 0;
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited[idx] || binaryImage[idx] === 0) continue;
      
      visited[idx] = 1;
      pixelCount++;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // 8-连通
      queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
      queue.push([x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1]);
    }
    
    if (pixelCount < 10) return null; // 忽略太小的区域
    
    const regionWidth = maxX - minX + 1;
    const regionHeight = maxY - minY + 1;
    const aspectRatio = regionWidth / Math.max(1, regionHeight);
    const density = pixelCount / (regionWidth * regionHeight);
    
    return { minX, maxX, minY, maxY, pixels: pixelCount, aspectRatio, density };
  };
  
  // 扫描所有像素找连通域
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryImage[idx] === 1 && !visited[idx]) {
        const region = findConnectedRegion(x, y);
        if (region) {
          regions.push(region);
        }
      }
    }
  }
  
  // 3. 合并相邻的连通域（可能是同一个公式的不同部分）
  const mergedRegions: typeof regions = [];
  const regionUsed = new Array(regions.length).fill(false);
  
  // 按 Y 坐标排序
  regions.sort((a, b) => a.minY - b.minY);
  
  const mergeThresholdX = Math.round(30 * scale); // 水平合并阈值
  const mergeThresholdY = Math.round(15 * scale); // 垂直合并阈值
  
  for (let i = 0; i < regions.length; i++) {
    if (regionUsed[i]) continue;
    
    let merged = { ...regions[i] };
    regionUsed[i] = true;
    
    // 尝试合并相邻区域
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < regions.length; j++) {
        if (regionUsed[j]) continue;
        
        const r = regions[j];
        
        // 检查是否相邻
        const horizontalOverlap = !(r.maxX + mergeThresholdX < merged.minX || r.minX - mergeThresholdX > merged.maxX);
        const verticalClose = Math.abs(r.minY - merged.maxY) < mergeThresholdY || 
                             Math.abs(merged.minY - r.maxY) < mergeThresholdY ||
                             (r.minY <= merged.maxY && r.maxY >= merged.minY);
        
        if (horizontalOverlap && verticalClose) {
          merged.minX = Math.min(merged.minX, r.minX);
          merged.maxX = Math.max(merged.maxX, r.maxX);
          merged.minY = Math.min(merged.minY, r.minY);
          merged.maxY = Math.max(merged.maxY, r.maxY);
          merged.pixels += r.pixels;
          regionUsed[j] = true;
          changed = true;
        }
      }
    }
    
    // 重新计算属性
    const regionWidth = merged.maxX - merged.minX + 1;
    const regionHeight = merged.maxY - merged.minY + 1;
    merged.aspectRatio = regionWidth / Math.max(1, regionHeight);
    merged.density = merged.pixels / (regionWidth * regionHeight);
    
    mergedRegions.push(merged);
  }
  
  // 4. 分析每个区域是否为公式
  const minFormulaHeight = Math.round(15 * scale);
  const maxFormulaHeight = Math.round(300 * scale);
  const minFormulaWidth = Math.round(20 * scale);
  
  for (const region of mergedRegions) {
    const regionWidth = region.maxX - region.minX + 1;
    const regionHeight = region.maxY - region.minY + 1;
    
    // 基本尺寸过滤
    if (regionHeight < minFormulaHeight || regionHeight > maxFormulaHeight) continue;
    if (regionWidth < minFormulaWidth) continue;
    
    // 分析区域特征判断是否为公式
    const formulaScore = analyzeFormulaFeatures(
      data, width, height,
      region.minX, region.minY, region.maxX, region.maxY,
      scale
    );
    
    if (formulaScore.isFormula) {
      // 提取公式图像（带紧凑padding）
      const padding = Math.round(4 * scale); // 更紧凑的padding
      const left = Math.max(0, region.minX - padding);
      const top = Math.max(0, region.minY - padding);
      const right = Math.min(width, region.maxX + padding);
      const bottom = Math.min(height, region.maxY + padding);
      
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
        confidence: formulaScore.confidence,
        type: formulaScore.type,
      });
    }
  }
  
  // 按位置排序（从上到下，从左到右）
  formulas.sort((a, b) => {
    const yDiff = a.originalPosition.y - b.originalPosition.y;
    if (Math.abs(yDiff) > 20) return yDiff;
    return a.originalPosition.x - b.originalPosition.x;
  });
  
  return formulas;
}

/**
 * 分析区域特征判断是否为数学公式
 * 使用多种特征：
 * 1. 垂直结构（分数、上下标）
 * 2. 特殊符号密度
 * 3. 宽高比
 * 4. 居中特征
 */
function analyzeFormulaFeatures(
  data: Uint8ClampedArray,
  imgWidth: number,
  _imgHeight: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  scale: number
): { isFormula: boolean; confidence: number; type: 'inline' | 'display' | 'equation' } {
  const regionWidth = maxX - minX + 1;
  const regionHeight = maxY - minY + 1;
  const aspectRatio = regionWidth / regionHeight;
  
  let score = 0;
  let type: 'inline' | 'display' | 'equation' = 'inline';
  
  // 1. 检查垂直结构（分数线、上下标等）
  // 分析每列的像素分布
  const colProfiles: number[] = [];
  for (let x = minX; x <= maxX; x++) {
    let colPixels = 0;
    for (let y = minY; y <= maxY; y++) {
      const idx = (y * imgWidth + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < 180) colPixels++;
    }
    colProfiles.push(colPixels);
  }
  
  // 检查是否有水平线（分数线特征）
  const rowProfiles: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    let rowPixels = 0;
    for (let x = minX; x <= maxX; x++) {
      const idx = (y * imgWidth + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < 180) rowPixels++;
    }
    rowProfiles.push(rowPixels);
  }
  
  // 检测水平线（分数线）
  const avgRowPixels = rowProfiles.reduce((a, b) => a + b, 0) / rowProfiles.length;
  let hasHorizontalLine = false;
  for (let i = 1; i < rowProfiles.length - 1; i++) {
    if (rowProfiles[i] > avgRowPixels * 2 && 
        rowProfiles[i] > regionWidth * 0.3 &&
        rowProfiles[i - 1] < rowProfiles[i] * 0.5 &&
        rowProfiles[i + 1] < rowProfiles[i] * 0.5) {
      hasHorizontalLine = true;
      break;
    }
  }
  
  if (hasHorizontalLine) {
    score += 40;
    type = 'display';
  }
  
  // 2. 检查高度特征（公式通常比普通文本高）
  const normalTextHeight = 12 * scale; // 假设正常文本高度
  if (regionHeight > normalTextHeight * 1.5) {
    score += 25;
    type = 'display';
  }
  
  // 3. 检查宽高比（公式通常不会太窄长）
  if (aspectRatio > 0.5 && aspectRatio < 15) {
    score += 15;
  }
  
  // 4. 检查像素密度分布的不均匀性（公式有更多变化）
  const colVariance = calculateVariance(colProfiles);
  const avgColPixels = colProfiles.reduce((a, b) => a + b, 0) / colProfiles.length;
  if (colVariance > avgColPixels * 0.5) {
    score += 15;
  }
  
  // 5. 检查是否有上下标结构
  const topThird = rowProfiles.slice(0, Math.floor(rowProfiles.length / 3));
  const bottomThird = rowProfiles.slice(Math.floor(rowProfiles.length * 2 / 3));
  const middleThird = rowProfiles.slice(Math.floor(rowProfiles.length / 3), Math.floor(rowProfiles.length * 2 / 3));
  
  const topDensity = topThird.reduce((a, b) => a + b, 0) / topThird.length;
  const bottomDensity = bottomThird.reduce((a, b) => a + b, 0) / bottomThird.length;
  const middleDensity = middleThird.reduce((a, b) => a + b, 0) / middleThird.length;
  
  // 上下标特征：上部或下部有内容，但不是均匀分布
  if ((topDensity > middleDensity * 0.3 || bottomDensity > middleDensity * 0.3) &&
      Math.abs(topDensity - bottomDensity) > middleDensity * 0.2) {
    score += 20;
  }
  
  // 6. 检查区域内是否有多个垂直分离的部分（如求和符号上下的范围）
  let verticalGaps = 0;
  let inContent = false;
  for (const rowPixels of rowProfiles) {
    if (rowPixels > avgRowPixels * 0.1) {
      if (!inContent) {
        verticalGaps++;
        inContent = true;
      }
    } else {
      inContent = false;
    }
  }
  
  if (verticalGaps >= 2) {
    score += 15;
    type = 'display';
  }
  
  // 7. 排除纯文本行（宽度很长但高度接近正常文本）
  if (regionHeight < normalTextHeight * 1.3 && aspectRatio > 8) {
    score -= 30; // 可能是普通文本行
  }
  
  // 8. 排除太小的区域
  if (regionWidth < 30 * scale || regionHeight < 15 * scale) {
    score -= 20;
  }
  
  const confidence = Math.max(0, Math.min(100, score));
  const isFormula = score >= 35;
  
  return { isFormula, confidence, type };
}

/**
 * 计算数组方差
 */
function calculateVariance(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
}

// analyzeRegion 函数已被 analyzeFormulaFeatures 替代

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
