/**
 * 图片质量检测服务
 * 检测图片的模糊度、分辨率、对比度等质量指标
 */

export interface ImageQualityResult {
  score: number; // 0-100 综合质量分数
  issues: ImageQualityIssue[];
  metrics: ImageQualityMetrics;
}

export interface ImageQualityIssue {
  type: 'blur' | 'low_resolution' | 'low_contrast' | 'too_dark' | 'too_bright';
  severity: 'warning' | 'error';
  message: string;
}

export interface ImageQualityMetrics {
  width: number;
  height: number;
  sharpness: number; // 0-100
  contrast: number; // 0-100
  brightness: number; // 0-255
}

// 质量阈值
const THRESHOLDS = {
  minWidth: 100,
  minHeight: 50,
  minSharpness: 30,
  minContrast: 20,
  minBrightness: 30,
  maxBrightness: 225,
};

/**
 * 分析图片质量
 */
export async function analyzeImageQuality(imageBase64: string): Promise<ImageQualityResult> {
  const img = await loadImage(imageBase64);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // 计算各项指标
  const sharpness = calculateSharpness(imageData);
  const contrast = calculateContrast(imageData);
  const brightness = calculateBrightness(imageData);
  
  const metrics: ImageQualityMetrics = {
    width: img.width,
    height: img.height,
    sharpness,
    contrast,
    brightness,
  };
  
  // 检测问题
  const issues: ImageQualityIssue[] = [];
  
  // 分辨率检查
  if (img.width < THRESHOLDS.minWidth || img.height < THRESHOLDS.minHeight) {
    issues.push({
      type: 'low_resolution',
      severity: img.width < THRESHOLDS.minWidth / 2 ? 'error' : 'warning',
      message: `图片分辨率较低 (${img.width}×${img.height})，可能影响识别准确度`,
    });
  }
  
  // 清晰度检查
  if (sharpness < THRESHOLDS.minSharpness) {
    issues.push({
      type: 'blur',
      severity: sharpness < THRESHOLDS.minSharpness / 2 ? 'error' : 'warning',
      message: '图片可能模糊，建议使用更清晰的图片',
    });
  }
  
  // 对比度检查
  if (contrast < THRESHOLDS.minContrast) {
    issues.push({
      type: 'low_contrast',
      severity: contrast < THRESHOLDS.minContrast / 2 ? 'error' : 'warning',
      message: '图片对比度较低，公式可能不够清晰',
    });
  }
  
  // 亮度检查
  if (brightness < THRESHOLDS.minBrightness) {
    issues.push({
      type: 'too_dark',
      severity: brightness < THRESHOLDS.minBrightness / 2 ? 'error' : 'warning',
      message: '图片过暗，建议提高亮度',
    });
  } else if (brightness > THRESHOLDS.maxBrightness) {
    issues.push({
      type: 'too_bright',
      severity: brightness > (THRESHOLDS.maxBrightness + 255) / 2 ? 'error' : 'warning',
      message: '图片过亮，可能导致细节丢失',
    });
  }
  
  // 计算综合分数
  const score = calculateOverallScore(metrics, issues);
  
  return { score, issues, metrics };
}

/**
 * 加载图片
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
 * 计算清晰度 (使用拉普拉斯算子)
 */
function calculateSharpness(imageData: ImageData): number {
  const { data, width, height } = imageData;
  
  // 转换为灰度
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  
  // 拉普拉斯算子
  let variance = 0;
  let count = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const laplacian = 
        -gray[idx - width - 1] - gray[idx - width] - gray[idx - width + 1] +
        -gray[idx - 1] + 8 * gray[idx] - gray[idx + 1] +
        -gray[idx + width - 1] - gray[idx + width] - gray[idx + width + 1];
      
      variance += laplacian * laplacian;
      count++;
    }
  }
  
  variance /= count;
  
  // 归一化到 0-100
  return Math.min(100, Math.sqrt(variance) / 10);
}

/**
 * 计算对比度
 */
function calculateContrast(imageData: ImageData): number {
  const { data } = imageData;
  
  let min = 255, max = 0;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    min = Math.min(min, gray);
    max = Math.max(max, gray);
  }
  
  // 归一化到 0-100
  return ((max - min) / 255) * 100;
}

/**
 * 计算平均亮度
 */
function calculateBrightness(imageData: ImageData): number {
  const { data } = imageData;
  
  let sum = 0;
  const pixelCount = data.length / 4;
  
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  
  return sum / pixelCount;
}

/**
 * 计算综合质量分数
 */
function calculateOverallScore(metrics: ImageQualityMetrics, issues: ImageQualityIssue[]): number {
  let score = 100;
  
  // 根据问题扣分
  for (const issue of issues) {
    if (issue.severity === 'error') {
      score -= 25;
    } else {
      score -= 10;
    }
  }
  
  // 根据指标微调
  if (metrics.sharpness > 70) score += 5;
  if (metrics.contrast > 70) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 获取质量等级描述
 */
export function getQualityLevel(score: number): {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  label: string;
  color: string;
} {
  if (score >= 80) {
    return { level: 'excellent', label: '优秀', color: 'text-green-600' };
  } else if (score >= 60) {
    return { level: 'good', label: '良好', color: 'text-blue-600' };
  } else if (score >= 40) {
    return { level: 'fair', label: '一般', color: 'text-yellow-600' };
  } else {
    return { level: 'poor', label: '较差', color: 'text-red-600' };
  }
}
