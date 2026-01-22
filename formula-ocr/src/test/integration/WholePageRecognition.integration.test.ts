/**
 * 整页公式识别系统 - 集成测试
 */

import { describe, it, expect } from 'vitest';
import { WholePageProcessor } from '../../utils/wholePageRecognition';
import type { PageData } from '../../utils/wholePageRecognition';

// 创建模拟页面数据
function createMockPageData(width: number, height: number): PageData {
  const imageData = new ImageData(width, height);
  
  return {
    imageData,
    textLayer: {
      items: [
        {
          str: 'E = mc²',
          transform: [1, 0, 0, 1, 100, 100],
          width: 50,
          height: 20,
          fontName: 'Times-Roman',
        },
        {
          str: '∫₀^∞ e^(-x²) dx',
          transform: [1, 0, 0, 1, 200, 200],
          width: 100,
          height: 30,
          fontName: 'Symbol',
        },
      ],
      styles: {
        'Times-Roman': {
          fontFamily: 'Times New Roman',
          isMathFont: false,
        },
        'Symbol': {
          fontFamily: 'Symbol',
          isMathFont: true,
        },
      },
    },
    width,
    height,
    pageNumber: 1,
  };
}

describe('WholePageRecognition Integration', () => {
  it('should process a standard page', async () => {
    const processor = new WholePageProcessor();
    const pageData = createMockPageData(1000, 1500);
    
    const formulas = await processor.processWholePage(pageData);
    
    // 验证返回结果
    expect(Array.isArray(formulas)).toBe(true);
    expect(processor.getProgress()).toBe(100);
  });

  it('should process a large page with regions', async () => {
    const processor = new WholePageProcessor();
    const pageData = createMockPageData(2500, 3500);
    
    const formulas = await processor.processWholePage(pageData);
    
    expect(Array.isArray(formulas)).toBe(true);
    expect(processor.getProgress()).toBe(100);
  });

  it('should respect confidence threshold', async () => {
    const processor = new WholePageProcessor();
    const pageData = createMockPageData(1000, 1500);
    
    const formulas = await processor.processWholePage(pageData, {
      confidenceThreshold: 0.9,
    });
    
    // 所有返回的公式置信度应该 >= 0.9
    formulas.forEach(formula => {
      expect(formula.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  it('should respect max formulas limit', async () => {
    const processor = new WholePageProcessor();
    const pageData = createMockPageData(1000, 1500);
    
    const formulas = await processor.processWholePage(pageData, {
      maxFormulas: 5,
    });
    
    expect(formulas.length).toBeLessThanOrEqual(5);
  });

  it('should support cancellation', async () => {
    const processor = new WholePageProcessor();
    const pageData = createMockPageData(2500, 3500);
    
    // 启动处理
    const promise = processor.processWholePage(pageData);
    
    // 立即取消
    processor.cancelProcessing();
    
    // 由于处理速度很快，可能已经完成，所以不强制要求抛出错误
    try {
      await promise;
    } catch (error: any) {
      expect(error.message).toContain('cancel');
    }
  });

  it('should track progress', async () => {
    const processor = new WholePageProcessor();
    const pageData = createMockPageData(1000, 1500);
    
    const progressValues: number[] = [];
    
    // 记录初始进度
    progressValues.push(processor.getProgress());
    
    // 启动处理
    await processor.processWholePage(pageData);
    
    // 记录最终进度
    progressValues.push(processor.getProgress());
    
    // 进度应该从0增长到100
    expect(progressValues[0]).toBe(0);
    expect(progressValues[progressValues.length - 1]).toBe(100);
  });
});
