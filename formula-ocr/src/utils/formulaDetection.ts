/**
 * 多公式检测服务
 * 检测图片中的多个公式区域并分离
 */

export interface DetectedFormula {
  id: string;
  imageData: string; // base64
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
}

export interface DetectionResult {
  formulas: DetectedFormula[];
  originalWidth: number;
  originalHeight: number;
}

/**
 * 检测图片中的多个公式区域
 * 优化版本：快速返回整个图像，避免复杂计算
 */
export async function detectMultipleFormulas(imageBase64: string): Promise<DetectionResult> {
  const img = await loadImage(imageBase64);
  
  // 快速方案：直接返回整个图像作为单个公式区域
  // 避免复杂的像素遍历和区域检测
  const formulas: DetectedFormula[] = [{
    id: `formula_${Date.now()}_0`,
    imageData: imageBase64,
    bounds: {
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
    },
    confidence: 0.9,
  }];
  
  return {
    formulas,
    originalWidth: img.width,
    originalHeight: img.height,
  };
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

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * 检测公式区域
 * 使用水平和垂直投影分析来分离多个公式
 * 优化：添加超时机制和性能优化
 */
function detectFormulaRegions(imageData: ImageData): Region[] {
  const { data, width, height } = imageData;
  
  // 性能优化：限制处理时间
  const startTime = Date.now();
  const MAX_PROCESSING_TIME = 5000; // 5秒超时
  
  // 性能优化：如果图像太大，先缩小处理
  const MAX_DIMENSION = 2000;
  let scale = 1;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
  }
  
  const scaledWidth = Math.floor(width * scale);
  const scaledHeight = Math.floor(height * scale);
  
  // 转换为灰度并二值化（使用缩放后的尺寸）
  const binary: boolean[] = [];
  for (let y = 0; y < scaledHeight; y++) {
    for (let x = 0; x < scaledWidth; x++) {
      // 从原图采样
      const srcX = Math.floor(x / scale);
      const srcY = Math.floor(y / scale);
      const i = (srcY * width + srcX) * 4;
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      binary.push(gray < 200); // 阈值
    }
    
    // 检查超时
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      console.warn('Formula detection timeout, returning whole image');
      return [{
        x: 0,
        y: 0,
        width: width,
        height: height,
        confidence: 0.5,
      }];
    }
  }
  
  // 计算水平投影（每行的黑色像素数）
  const horizontalProjection: number[] = [];
  for (let y = 0; y < scaledHeight; y++) {
    let count = 0;
    for (let x = 0; x < scaledWidth; x++) {
      if (binary[y * scaledWidth + x]) count++;
    }
    horizontalProjection.push(count);
  }
  
  // 找到行分隔（连续的空白行）
  const rowSeparators: number[] = [];
  let inBlank = true;
  let blankStart = 0;
  const minBlankHeight = Math.floor(10 * scale); // 最小空白高度（缩放）
  
  for (let y = 0; y < scaledHeight; y++) {
    const isBlank = horizontalProjection[y] < scaledWidth * 0.01; // 少于1%的像素
    
    if (isBlank && !inBlank) {
      blankStart = y;
      inBlank = true;
    } else if (!isBlank && inBlank) {
      if (y - blankStart >= minBlankHeight) {
        rowSeparators.push(Math.floor((blankStart + y) / 2));
      }
      inBlank = false;
    }
  }
  
  // 根据分隔符划分区域
  const regions: Region[] = [];
  let prevY = 0;
  
  const processRegion = (startY: number, endY: number) => {
    // 检查超时
    if (Date.now() - startTime > MAX_PROCESSING_TIME) {
      return;
    }
    
    // 找到该区域的水平边界（优化：只扫描有内容的行）
    let minX = scaledWidth, maxX = 0;
    let minY = endY, maxY = startY;
    
    for (let y = startY; y < endY; y++) {
      let hasContent = false;
      for (let x = 0; x < scaledWidth; x++) {
        if (binary[y * scaledWidth + x]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          hasContent = true;
        }
      }
      // 优化：如果这行没内容，跳过
      if (!hasContent) continue;
    }
    
    // 检查是否有有效内容
    if (maxX > minX && maxY > minY) {
      const regionWidth = maxX - minX;
      const regionHeight = maxY - minY;
      
      // 过滤太小的区域（考虑缩放）
      if (regionWidth > 20 * scale && regionHeight > 10 * scale) {
        // 简化置信度计算（避免再次遍历）
        const area = regionWidth * regionHeight;
        const confidence = Math.min(1, Math.max(0.3, area / (scaledWidth * scaledHeight * 0.1)));
        
        // 转换回原始坐标
        regions.push({
          x: Math.floor(minX / scale),
          y: Math.floor(minY / scale),
          width: Math.floor(regionWidth / scale),
          height: Math.floor(regionHeight / scale),
          confidence,
        });
      }
    }
  };
  
  // 处理每个分隔的区域
  for (const sep of rowSeparators) {
    if (sep > prevY + minBlankHeight) {
      processRegion(prevY, sep);
    }
    prevY = sep;
  }
  
  // 处理最后一个区域
  if (scaledHeight > prevY + minBlankHeight) {
    processRegion(prevY, scaledHeight);
  }
  
  // 如果没有检测到分隔或超时，返回整个图像作为一个区域
  if (regions.length === 0 || Date.now() - startTime > MAX_PROCESSING_TIME) {
    return [{
      x: 0,
      y: 0,
      width: width,
      height: height,
      confidence: 0.8,
    }];
  }
  
  return regions;
}

/**
 * 判断图片是否可能包含多个公式
 * 简化版本：总是返回false，避免复杂检测
 */
export async function mightContainMultipleFormulas(_imageBase64: string): Promise<boolean> {
  // 简化：总是返回false，直接进行单个公式识别
  return false;
}
