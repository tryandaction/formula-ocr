// File handling utilities - validation, base64 conversion, download

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// Supported formats and size limit
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// 图片压缩配置
const COMPRESS_CONFIG = {
  maxWidth: 2048,      // 最大宽度
  maxHeight: 2048,     // 最大高度
  quality: 0.85,       // JPEG 质量
  targetSize: 1024 * 1024, // 目标大小 1MB（超过此大小会压缩）
};

/**
 * Validates a file for upload
 * @param file - The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): FileValidationResult {
  // Check file type
  if (!ALLOWED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: '请上传 JPG、PNG、WebP 或 HEIC 格式的图片'
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: '文件大小不能超过 10MB'
    };
  }

  return { valid: true };
}

/**
 * 压缩图片
 * @param file - 原始文件
 * @returns Promise resolving to compressed base64 or original if small enough
 */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // 如果文件已经很小，直接返回
    if (file.size <= COMPRESS_CONFIG.targetSize) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
      return;
    }

    // 创建图片对象
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      // 计算缩放比例
      let { width, height } = img;
      const maxWidth = COMPRESS_CONFIG.maxWidth;
      const maxHeight = COMPRESS_CONFIG.maxHeight;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      // 创建 canvas 进行压缩
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height);
      
      // 转换为 base64
      const base64 = canvas.toDataURL('image/jpeg', COMPRESS_CONFIG.quality);
      resolve(base64);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Converts a file to base64 string (with optional compression)
 * @param file - The file to convert
 * @param compress - Whether to compress large images (default: true)
 * @returns Promise resolving to base64 data URL
 */
export function convertToBase64(file: File, compress: boolean = true): Promise<string> {
  if (compress && file.type.startsWith('image/')) {
    return compressImage(file);
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Gets the media type from a file
 * @param file - The file to get media type from
 * @returns The MIME type string
 */
export function getMediaType(file: File): string {
  return file.type || 'image/jpeg';
}

/**
 * Downloads LaTeX content as a .tex file
 * @param latex - The LaTeX content to download
 * @param filename - Optional filename (default: formula.tex)
 */
export function downloadAsTexFile(latex: string, filename: string = 'formula.tex'): void {
  const blob = new Blob([latex], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates a Blob from LaTeX content (for testing)
 * @param latex - The LaTeX content
 * @returns Blob containing the LaTeX
 */
export function createTexBlob(latex: string): Blob {
  return new Blob([latex], { type: 'text/plain;charset=utf-8' });
}
