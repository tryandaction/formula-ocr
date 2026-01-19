/**
 * Page Preprocessor - 页面预处理器
 * 提供图像预处理功能：分辨率提升、去噪、对比度增强、二值化
 */

import type { IPagePreprocessor } from './interfaces';
import type { PreprocessOptions, ProcessedImage } from './types';
import { DEFAULT_PREPROCESS_OPTIONS, BINARIZATION_THRESHOLD } from './constants';

export class PagePreprocessor implements IPagePreprocessor {
  /**
   * 预处理页面图像
   */
  preprocess(
    imageData: ImageData,
    options?: PreprocessOptions
  ): ProcessedImage {
    const opts = { ...DEFAULT_PREPROCESS_OPTIONS, ...options };
    
    let processedData = imageData;
    let scaleFactor = 1;
    
    // 1. 提升分辨率
    if (opts.targetDPI && opts.targetDPI > 72) {
      scaleFactor = opts.targetDPI / 72;
      processedData = this.upscaleImage(processedData, opts.targetDPI);
    }
    
    // 2. 去噪
    if (opts.denoise) {
      processedData = this.denoiseImage(processedData);
    }
    
    // 3. 增强对比度
    if (opts.enhanceContrast) {
      processedData = this.enhanceContrast(processedData);
    }
    
    // 4. 二值化
    const binaryData = this.binarize(processedData, opts.binarizationMethod);
    
    return {
      imageData: processedData,
      binaryData,
      width: processedData.width,
      height: processedData.height,
      scaleFactor,
    };
  }

  /**
   * 提升图像分辨率
   * 使用双线性插值进行高质量缩放
   */
  upscaleImage(imageData: ImageData, targetDPI: number): ImageData {
    const scaleFactor = targetDPI / 72; // 假设原始 DPI 为 72
    const newWidth = Math.round(imageData.width * scaleFactor);
    const newHeight = Math.round(imageData.height * scaleFactor);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    
    // 设置新尺寸
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // 创建临时 canvas 用于原始图像
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    tempCtx.putImageData(imageData, 0, 0);
    
    // 使用高质量缩放
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);
    
    return ctx.getImageData(0, 0, newWidth, newHeight);
  }

  /**
   * 去噪处理
   * 使用中值滤波去除噪点
   */
  denoiseImage(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data.length);
    
    // 中值滤波窗口大小
    const windowSize = 3;
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // 对于边缘像素，直接复制
        if (x < halfWindow || x >= width - halfWindow ||
            y < halfWindow || y >= height - halfWindow) {
          output[idx] = data[idx];
          output[idx + 1] = data[idx + 1];
          output[idx + 2] = data[idx + 2];
          output[idx + 3] = data[idx + 3];
          continue;
        }
        
        // 收集窗口内的像素值
        const rValues: number[] = [];
        const gValues: number[] = [];
        const bValues: number[] = [];
        
        for (let wy = -halfWindow; wy <= halfWindow; wy++) {
          for (let wx = -halfWindow; wx <= halfWindow; wx++) {
            const wIdx = ((y + wy) * width + (x + wx)) * 4;
            rValues.push(data[wIdx]);
            gValues.push(data[wIdx + 1]);
            bValues.push(data[wIdx + 2]);
          }
        }
        
        // 计算中值
        output[idx] = this.median(rValues);
        output[idx + 1] = this.median(gValues);
        output[idx + 2] = this.median(bValues);
        output[idx + 3] = data[idx + 3]; // Alpha 通道保持不变
      }
    }
    
    return new ImageData(output, width, height);
  }

  /**
   * 增强对比度
   * 使用直方图均衡化
   */
  enhanceContrast(imageData: ImageData): ImageData {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data.length);
    
    // 转换为灰度并计算直方图
    const histogram = new Array(256).fill(0);
    const grayValues: number[] = [];
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      grayValues.push(gray);
      histogram[gray]++;
    }
    
    // 计算累积分布函数 (CDF)
    const cdf = new Array(256).fill(0);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }
    
    // 归一化 CDF
    const totalPixels = width * height;
    const cdfMin = cdf.find(v => v > 0) || 0;
    const lookupTable = cdf.map(v => 
      Math.round(((v - cdfMin) / (totalPixels - cdfMin)) * 255)
    );
    
    // 应用均衡化
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const gray = grayValues[j];
      const enhanced = lookupTable[gray];
      
      // 保持颜色比例
      const ratio = enhanced / Math.max(1, gray);
      output[i] = Math.min(255, Math.round(data[i] * ratio));
      output[i + 1] = Math.min(255, Math.round(data[i + 1] * ratio));
      output[i + 2] = Math.min(255, Math.round(data[i + 2] * ratio));
      output[i + 3] = data[i + 3];
    }
    
    return new ImageData(output, width, height);
  }

  /**
   * 二值化处理
   */
  binarize(
    imageData: ImageData,
    method: 'otsu' | 'adaptive' | 'simple'
  ): Uint8Array {
    switch (method) {
      case 'otsu':
        return this.binarizeOtsu(imageData);
      case 'adaptive':
        return this.binarizeAdaptive(imageData);
      case 'simple':
      default:
        return this.binarizeSimple(imageData);
    }
  }

  /**
   * 简单阈值二值化
   */
  private binarizeSimple(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const binary = new Uint8Array(width * height);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      binary[j] = gray < BINARIZATION_THRESHOLD ? 1 : 0;
    }
    
    return binary;
  }

  /**
   * Otsu 自动阈值二值化
   */
  private binarizeOtsu(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    
    // 计算灰度直方图
    const histogram = new Array(256).fill(0);
    const grayValues: number[] = [];
    
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      grayValues.push(gray);
      histogram[gray]++;
    }
    
    // 计算 Otsu 阈值
    const totalPixels = width * height;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }
    
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;
    
    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      
      wF = totalPixels - wB;
      if (wF === 0) break;
      
      sumB += t * histogram[t];
      
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      
      const variance = wB * wF * (mB - mF) * (mB - mF);
      
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }
    
    // 应用阈值
    const binary = new Uint8Array(width * height);
    for (let i = 0; i < grayValues.length; i++) {
      binary[i] = grayValues[i] < threshold ? 1 : 0;
    }
    
    return binary;
  }

  /**
   * 自适应阈值二值化
   */
  private binarizeAdaptive(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const binary = new Uint8Array(width * height);
    
    // 窗口大小
    const windowSize = 15;
    const halfWindow = Math.floor(windowSize / 2);
    const C = 10; // 常数偏移
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixelIdx = idx * 4;
        
        // 计算当前像素的灰度值
        const gray = 0.299 * data[pixelIdx] + 
                     0.587 * data[pixelIdx + 1] + 
                     0.114 * data[pixelIdx + 2];
        
        // 计算局部窗口的平均值
        let sum = 0;
        let count = 0;
        
        for (let wy = Math.max(0, y - halfWindow); 
             wy <= Math.min(height - 1, y + halfWindow); 
             wy++) {
          for (let wx = Math.max(0, x - halfWindow); 
               wx <= Math.min(width - 1, x + halfWindow); 
               wx++) {
            const wIdx = (wy * width + wx) * 4;
            const wGray = 0.299 * data[wIdx] + 
                         0.587 * data[wIdx + 1] + 
                         0.114 * data[wIdx + 2];
            sum += wGray;
            count++;
          }
        }
        
        const localMean = sum / count;
        const threshold = localMean - C;
        
        binary[idx] = gray < threshold ? 1 : 0;
      }
    }
    
    return binary;
  }

  /**
   * 计算中值
   */
  private median(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    } else {
      return sorted[mid];
    }
  }
}
