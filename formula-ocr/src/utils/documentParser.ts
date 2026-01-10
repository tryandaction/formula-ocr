/**
 * 文档解析服务 - 支持 PDF、DOCX、Markdown 文件的公式提取
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
  confidence?: number;
}

export interface ParsedDocument {
  fileName: string;
  fileType: DocumentType;
  pageCount: number;
  formulas: FormulaRegion[];
  thumbnails: string[]; // 页面缩略图 base64
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

// MIME 类型映射
const MIME_TYPES: Record<string, DocumentType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/plain': 'markdown', // .md 文件有时被识别为 text/plain
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
  // 优先通过 MIME 类型判断
  if (file.type && MIME_TYPES[file.type]) {
    return MIME_TYPES[file.type];
  }

  // 通过扩展名判断
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return EXTENSIONS[ext] || null;
}

/**
 * 验证文档文件
 */
export async function validateDocument(file: File): Promise<DocumentValidationResult> {
  const fileType = getDocumentType(file);
  const fileSize = file.size;

  // 检查文件类型
  if (!fileType) {
    return {
      valid: false,
      error: '不支持的文件格式。支持的格式: PDF, DOCX, Markdown',
      fileType: null,
      fileSize,
    };
  }

  // 检查文件大小
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

  // PDF 需要额外检查页数
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
  const pdfjs = await import('pdfjs-dist');
  
  // 设置 worker - 使用 unpkg CDN，它会自动同步 npm 版本
  // PDF.js 5.x 使用 .mjs 格式
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  return pdf.numPages;
}

// 缓存 PDF.js 模块
let pdfjsModule: typeof import('pdfjs-dist') | null = null;

/**
 * 预加载 PDF.js 模块（可在空闲时调用）
 */
export async function preloadPdfJs(): Promise<void> {
  if (!pdfjsModule) {
    pdfjsModule = await import('pdfjs-dist');
    // 使用 unpkg CDN，PDF.js 5.x 使用 .mjs 格式
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
  const formulas: FormulaRegion[] = [];
  
  // 渲染每一页
  for (let i = 1; i <= pageCount; i++) {
    onProgress?.((i / pageCount) * 100, `正在处理第 ${i}/${pageCount} 页...`);
    
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    
    // 创建 canvas 渲染页面
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any).promise;
    
    // 生成缩略图
    const thumbnailCanvas = document.createElement('canvas');
    const thumbCtx = thumbnailCanvas.getContext('2d')!;
    const thumbScale = 200 / viewport.width;
    thumbnailCanvas.width = 200;
    thumbnailCanvas.height = viewport.height * thumbScale;
    thumbCtx.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
    thumbnails.push(thumbnailCanvas.toDataURL('image/jpeg', 0.7));
    
    // 检测公式区域 (简单实现 - 基于图像分析)
    const pageFormulas = await detectFormulasInPage(canvas, i);
    formulas.push(...pageFormulas);
  }
  
  onProgress?.(100, '解析完成');
  
  return {
    fileName: file.name,
    fileType: 'pdf',
    pageCount,
    formulas,
    thumbnails,
  };
}

/**
 * 检测页面中的公式区域
 * 这是一个简化实现，实际生产中可能需要更复杂的算法或 AI 辅助
 */
async function detectFormulasInPage(
  canvas: HTMLCanvasElement,
  pageNumber: number
): Promise<FormulaRegion[]> {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  const formulas: FormulaRegion[] = [];
  
  // 简单的行检测 - 寻找可能包含公式的区域
  // 公式通常有以下特征：
  // 1. 独立成行或有较大的行间距
  // 2. 包含特殊字符（积分、求和等）
  // 3. 与周围文本有不同的密度
  
  // 这里使用简化的水平投影法检测可能的公式行
  const rowDensity: number[] = [];
  for (let y = 0; y < canvas.height; y++) {
    let blackPixels = 0;
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < 128) blackPixels++;
    }
    rowDensity.push(blackPixels / canvas.width);
  }
  
  // 找到密度变化较大的区域（可能是公式）
  let inRegion = false;
  let regionStart = 0;
  const threshold = 0.02;
  const minHeight = 20;
  
  for (let y = 0; y < rowDensity.length; y++) {
    if (!inRegion && rowDensity[y] > threshold) {
      inRegion = true;
      regionStart = y;
    } else if (inRegion && (rowDensity[y] < threshold * 0.5 || y === rowDensity.length - 1)) {
      inRegion = false;
      const height = y - regionStart;
      
      // 只保留高度合适的区域（可能是公式）
      if (height > minHeight && height < canvas.height * 0.3) {
        // 找到水平边界
        let left = canvas.width, right = 0;
        for (let ry = regionStart; ry < y; ry++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (ry * canvas.width + x) * 4;
            const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            if (brightness < 128) {
              left = Math.min(left, x);
              right = Math.max(right, x);
            }
          }
        }
        
        // 添加一些边距
        const padding = 10;
        left = Math.max(0, left - padding);
        right = Math.min(canvas.width, right + padding);
        const top = Math.max(0, regionStart - padding);
        const bottom = Math.min(canvas.height, y + padding);
        
        // 提取区域图像
        const regionCanvas = document.createElement('canvas');
        regionCanvas.width = right - left;
        regionCanvas.height = bottom - top;
        const regionCtx = regionCanvas.getContext('2d')!;
        regionCtx.drawImage(
          canvas,
          left, top, right - left, bottom - top,
          0, 0, regionCanvas.width, regionCanvas.height
        );
        
        formulas.push({
          id: `formula_${pageNumber}_${formulas.length}`,
          imageData: regionCanvas.toDataURL('image/png'),
          pageNumber,
          position: {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
          },
        });
      }
    }
  }
  
  return formulas;
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
