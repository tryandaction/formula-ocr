/**
 * 优化的图像预处理器
 * 使用高效算法进行图像预处理，提升检测速度
 */

/**
 * 预处理选项
 */
export interface PreprocessOptions {
  /** 是否进行二值化 */
  binarize?: boolean;
  /** 二值化阈值（0-255） */
  binarizeThreshold?: number;
  /** 是否进行降噪 */
  denoise?: boolean;
  /** 是否进行对比度增强 */
  enhanceContrast?: boolean;
  /** 是否进行锐化 */
  sharpen?: boolean;
}

/**
 * 优化的图像预处理器
 */
export class OptimizedPreprocessor {
  /**
   * 预处理图像
   * @param imageData - 原始图像数据
   * @param options - 预处理选项
   * @returns 预处理后的图像数据
   */
  preprocess(
    imageData: ImageData,
    options: PreprocessOptions = {}
  ): ImageData {
    let result = this.cloneImageData(imageData);

    // 对比度增强
    if (options.enhanceContrast) {
      result = this.enhanceContrast(result);
    }

    // 降噪
    if (options.denoise) {
      result = this.denoise(result);
    }

    // 二值化
    if (options.binarize) {
      const threshold = options.binarizeThreshold ?? this.calculateOtsuThreshold(result);
      result = this.binarize(result, threshold);
    }

    // 锐化
    if (options.sharpen) {
      result = this.sharpen(result);
    }

    return result;
  }

  /**
   * 克隆ImageData
   */
  private cloneImageData(imageData: ImageData): ImageData {
    const cloned = new ImageData(imageData.width, imageData.height);
    cloned.data.set(imageData.data);
    return cloned;
  }

  /**
   * 对比度增强（直方图均衡化）
   */
  private enhanceContrast(imageData: ImageData): ImageData {
    const data = imageData.data;
    const histogram = new Array(256).fill(0);

    // 计算直方图
    for (let i = 0; i < data.length; i += 4) {
      const gray = this.toGrayscale(data[i], data[i + 1], data[i + 2]);
      histogram[gray]++;
    }

    // 计算累积分布函数
    const cdf = new Array(256).fill(0);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // 归一化
    const totalPixels = imageData.width * imageData.height;
    const cdfMin = cdf.find(v => v > 0) ?? 0;
    const lookupTable = cdf.map(v => 
      Math.round(((v - cdfMin) / (totalPixels - cdfMin)) * 255)
    );

    // 应用查找表
    const result = this.cloneImageData(imageData);
    for (let i = 0; i < result.data.length; i += 4) {
      const gray = this.toGrayscale(result.data[i], result.data[i + 1], result.data[i + 2]);
      const enhanced = lookupTable[gray];
      result.data[i] = enhanced;
      result.data[i + 1] = enhanced;
      result.data[i + 2] = enhanced;
    }

    return result;
  }

  /**
   * 降噪（中值滤波）
   */
  private denoise(imageData: ImageData): ImageData {
    const result = this.cloneImageData(imageData);
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // 3x3中值滤波
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const values: number[] = [];

        // 收集3x3邻域的像素值
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4;
            values.push(this.toGrayscale(data[idx], data[idx + 1], data[idx + 2]));
          }
        }

        // 计算中值
        values.sort((a, b) => a - b);
        const median = values[4]; // 中间值

        // 设置结果
        const idx = (y * width + x) * 4;
        result.data[idx] = median;
        result.data[idx + 1] = median;
        result.data[idx + 2] = median;
      }
    }

    return result;
  }

  /**
   * 二值化
   */
  private binarize(imageData: ImageData, threshold: number): ImageData {
    const result = this.cloneImageData(imageData);
    const data = result.data;

    for (let i = 0; i < data.length; i += 4) {
      const gray = this.toGrayscale(data[i], data[i + 1], data[i + 2]);
      const binary = gray > threshold ? 255 : 0;
      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
    }

    return result;
  }

  /**
   * 锐化
   */
  private sharpen(imageData: ImageData): ImageData {
    const result = this.cloneImageData(imageData);
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // 锐化卷积核
    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;

        // 应用卷积核
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = this.toGrayscale(data[idx], data[idx + 1], data[idx + 2]);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            sum += gray * kernel[kernelIdx];
          }
        }

        // 限制范围
        sum = Math.max(0, Math.min(255, sum));

        // 设置结果
        const idx = (y * width + x) * 4;
        result.data[idx] = sum;
        result.data[idx + 1] = sum;
        result.data[idx + 2] = sum;
      }
    }

    return result;
  }

  /**
   * 计算Otsu阈值（自动二值化）
   */
  private calculateOtsuThreshold(imageData: ImageData): number {
    const data = imageData.data;
    const histogram = new Array(256).fill(0);

    // 计算直方图
    for (let i = 0; i < data.length; i += 4) {
      const gray = this.toGrayscale(data[i], data[i + 1], data[i + 2]);
      histogram[gray]++;
    }

    // 归一化直方图
    const total = imageData.width * imageData.height;
    const normalizedHistogram = histogram.map(v => v / total);

    // 计算Otsu阈值
    let maxVariance = 0;
    let threshold = 0;

    for (let t = 0; t < 256; t++) {
      // 计算背景和前景的权重
      let w0 = 0;
      let w1 = 0;
      for (let i = 0; i <= t; i++) w0 += normalizedHistogram[i];
      for (let i = t + 1; i < 256; i++) w1 += normalizedHistogram[i];

      if (w0 === 0 || w1 === 0) continue;

      // 计算背景和前景的均值
      let mu0 = 0;
      let mu1 = 0;
      for (let i = 0; i <= t; i++) mu0 += i * normalizedHistogram[i];
      for (let i = t + 1; i < 256; i++) mu1 += i * normalizedHistogram[i];
      mu0 /= w0;
      mu1 /= w1;

      // 计算类间方差
      const variance = w0 * w1 * Math.pow(mu0 - mu1, 2);

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    return threshold;
  }

  /**
   * 转换为灰度值
   */
  private toGrayscale(r: number, g: number, b: number): number {
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
}
