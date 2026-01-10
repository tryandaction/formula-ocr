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
 */
export async function detectMultipleFormulas(imageBase64: string): Promise<DetectionResult> {
  const img = await loadImage(imageBase64);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // 检测公式区域
  const regions = detectFormulaRegions(imageData);
  
  // 提取每个区域的图像
  const formulas: DetectedFormula[] = regions.map((region, index) => {
    const regionCanvas = document.createElement('canvas');
    const regionCtx = regionCanvas.getContext('2d')!;
    
    // 添加边距
    const padding = 10;
    const x = Math.max(0, region.x - padding);
    const y = Math.max(0, region.y - padding);
    const width = Math.min(canvas.width - x, region.width + padding * 2);
    const height = Math.min(canvas.height - y, region.height + padding * 2);
    
    regionCanvas.width = width;
    regionCanvas.height = height;
    
    // 白色背景
    regionCtx.fillStyle = 'white';
    regionCtx.fillRect(0, 0, width, height);
    
    // 绘制区域
    regionCtx.drawImage(
      canvas,
      x, y, width, height,
      0, 0, width, height
    );
    
    return {
      id: `formula_${Date.now()}_${index}`,
      imageData: regionCanvas.toDataURL('image/png'),
      bounds: { x, y, width, height },
      confidence: region.confidence,
    };
  });
  
  return {
    formulas,
    originalWidth: canvas.width,
    originalHeight: canvas.height,
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
 */
function detectFormulaRegions(imageData: ImageData): Region[] {
  const { data, width, height } = imageData;
  
  // 转换为灰度并二值化
  const binary: boolean[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    binary.push(gray < 200); // 阈值
  }
  
  // 计算水平投影（每行的黑色像素数）
  const horizontalProjection: number[] = [];
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (binary[y * width + x]) count++;
    }
    horizontalProjection.push(count);
  }
  
  // 找到行分隔（连续的空白行）
  const rowSeparators: number[] = [];
  let inBlank = true;
  let blankStart = 0;
  const minBlankHeight = 10; // 最小空白高度
  
  for (let y = 0; y < height; y++) {
    const isBlank = horizontalProjection[y] < width * 0.01; // 少于1%的像素
    
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
    // 找到该区域的水平边界
    let minX = width, maxX = 0;
    let minY = endY, maxY = startY;
    
    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < width; x++) {
        if (binary[y * width + x]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // 检查是否有有效内容
    if (maxX > minX && maxY > minY) {
      const regionWidth = maxX - minX;
      const regionHeight = maxY - minY;
      
      // 过滤太小的区域
      if (regionWidth > 20 && regionHeight > 10) {
        // 计算置信度（基于区域的密度和大小）
        let pixelCount = 0;
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            if (binary[y * width + x]) pixelCount++;
          }
        }
        const density = pixelCount / (regionWidth * regionHeight);
        const confidence = Math.min(1, density * 5); // 归一化
        
        regions.push({
          x: minX,
          y: minY,
          width: regionWidth,
          height: regionHeight,
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
  if (height > prevY + minBlankHeight) {
    processRegion(prevY, height);
  }
  
  // 如果没有检测到分隔，返回整个图像作为一个区域
  if (regions.length === 0) {
    // 找到整体边界
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binary[y * width + x]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    if (maxX > minX && maxY > minY) {
      regions.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        confidence: 1,
      });
    }
  }
  
  return regions;
}

/**
 * 判断图片是否可能包含多个公式
 */
export async function mightContainMultipleFormulas(imageBase64: string): Promise<boolean> {
  const result = await detectMultipleFormulas(imageBase64);
  return result.formulas.length > 1;
}
