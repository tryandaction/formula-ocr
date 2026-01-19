/**
 * Advanced Formula Detection - Usage Example
 * 高级公式检测 - 使用示例
 */

import { AdvancedFormulaDetector } from './AdvancedFormulaDetector';
import type { DetectionOptions, PageImage } from './types';

/**
 * 示例 1: 检测单页公式
 */
export async function detectSinglePage(
  pageImageBase64: string,
  pageNumber: number
) {
  // 创建检测器实例
  const detector = new AdvancedFormulaDetector();
  
  // 配置检测选项
  const options: DetectionOptions = {
    minConfidence: 0.6,        // 最小置信度阈值
    includeInline: true,       // 包含行内公式
    includeDisplay: true,      // 包含独立公式
    resolution: 300,           // 300 DPI 分辨率
    enablePreprocessing: true, // 启用预处理
  };
  
  // 执行检测
  const formulas = await detector.detectFormulas(
    pageImageBase64,
    pageNumber,
    options
  );
  
  console.log(`检测到 ${formulas.length} 个公式`);
  
  // 遍历结果
  for (const formula of formulas) {
    console.log({
      id: formula.id,
      type: formula.formulaType,
      confidence: formula.confidence.overall,
      position: formula.position,
      features: {
        hasIntegral: formula.features.hasIntegralSymbols,
        hasFraction: formula.features.hasFractionLines,
        hasGreek: formula.features.hasGreekLetters,
      },
    });
  }
  
  return formulas;
}

/**
 * 示例 2: 批量检测多页
 */
export async function detectMultiplePages(pages: PageImage[]) {
  const detector = new AdvancedFormulaDetector();
  
  // 带进度回调的批量检测
  const results = await detector.detectMultiplePages(
    pages,
    (progress) => {
      console.log(`检测进度: ${progress.toFixed(1)}%`);
    }
  );
  
  // 统计结果
  let totalFormulas = 0;
  let displayFormulas = 0;
  let inlineFormulas = 0;
  
  for (const [pageNum, formulas] of results.entries()) {
    totalFormulas += formulas.length;
    
    for (const formula of formulas) {
      if (formula.formulaType === 'display') {
        displayFormulas++;
      } else {
        inlineFormulas++;
      }
    }
    
    console.log(`第 ${pageNum} 页: ${formulas.length} 个公式`);
  }
  
  console.log(`总计: ${totalFormulas} 个公式`);
  console.log(`独立公式: ${displayFormulas} 个`);
  console.log(`行内公式: ${inlineFormulas} 个`);
  
  return results;
}

/**
 * 示例 3: 高置信度过滤
 */
export async function detectHighConfidenceFormulas(
  pageImageBase64: string,
  pageNumber: number
) {
  const detector = new AdvancedFormulaDetector();
  
  // 只检测高置信度公式
  const formulas = await detector.detectFormulas(
    pageImageBase64,
    pageNumber,
    {
      minConfidence: 0.85, // 高置信度阈值
      includeInline: true,
      includeDisplay: true,
    }
  );
  
  console.log(`检测到 ${formulas.length} 个高置信度公式`);
  
  // 按置信度排序
  const sorted = formulas.sort(
    (a, b) => b.confidence.overall - a.confidence.overall
  );
  
  // 显示前 5 个
  console.log('Top 5 公式:');
  for (const formula of sorted.slice(0, 5)) {
    console.log({
      confidence: formula.confidence.overall.toFixed(3),
      level: formula.confidence.level,
      type: formula.formulaType,
      breakdown: {
        featureMatch: formula.confidence.breakdown.featureMatch.toFixed(3),
        classification: formula.confidence.breakdown.classificationCertainty.toFixed(3),
        boundary: formula.confidence.breakdown.boundaryClarity.toFixed(3),
        context: formula.confidence.breakdown.contextConsistency.toFixed(3),
      },
    });
  }
  
  return sorted;
}

/**
 * 示例 4: 只检测独立公式
 */
export async function detectDisplayFormulasOnly(
  pageImageBase64: string,
  pageNumber: number
) {
  const detector = new AdvancedFormulaDetector();
  
  // 只检测独立公式（通常是重要的数学表达式）
  const formulas = await detector.detectFormulas(
    pageImageBase64,
    pageNumber,
    {
      minConfidence: 0.6,
      includeInline: false,  // 不包含行内公式
      includeDisplay: true,  // 只包含独立公式
    }
  );
  
  console.log(`检测到 ${formulas.length} 个独立公式`);
  
  return formulas;
}

/**
 * 示例 5: 分析公式特征
 */
export async function analyzeFormulaFeatures(
  pageImageBase64: string,
  pageNumber: number
) {
  const detector = new AdvancedFormulaDetector();
  
  const formulas = await detector.detectFormulas(
    pageImageBase64,
    pageNumber
  );
  
  // 统计特征
  const stats = {
    total: formulas.length,
    withIntegral: 0,
    withSummation: 0,
    withFraction: 0,
    withMatrix: 0,
    withGreek: 0,
    withSuperscript: 0,
    withSubscript: 0,
    withRoot: 0,
  };
  
  for (const formula of formulas) {
    const f = formula.features;
    if (f.hasIntegralSymbols) stats.withIntegral++;
    if (f.hasSummationSymbols) stats.withSummation++;
    if (f.hasFractionLines) stats.withFraction++;
    if (f.hasMatrixBrackets) stats.withMatrix++;
    if (f.hasGreekLetters) stats.withGreek++;
    if (f.hasSuperscripts) stats.withSuperscript++;
    if (f.hasSubscripts) stats.withSubscript++;
    if (f.hasRootSymbols) stats.withRoot++;
  }
  
  console.log('公式特征统计:');
  console.log(`总数: ${stats.total}`);
  console.log(`包含积分: ${stats.withIntegral} (${(stats.withIntegral/stats.total*100).toFixed(1)}%)`);
  console.log(`包含求和: ${stats.withSummation} (${(stats.withSummation/stats.total*100).toFixed(1)}%)`);
  console.log(`包含分数: ${stats.withFraction} (${(stats.withFraction/stats.total*100).toFixed(1)}%)`);
  console.log(`包含矩阵: ${stats.withMatrix} (${(stats.withMatrix/stats.total*100).toFixed(1)}%)`);
  console.log(`包含希腊字母: ${stats.withGreek} (${(stats.withGreek/stats.total*100).toFixed(1)}%)`);
  console.log(`包含上标: ${stats.withSuperscript} (${(stats.withSuperscript/stats.total*100).toFixed(1)}%)`);
  console.log(`包含下标: ${stats.withSubscript} (${(stats.withSubscript/stats.total*100).toFixed(1)}%)`);
  console.log(`包含根号: ${stats.withRoot} (${(stats.withRoot/stats.total*100).toFixed(1)}%)`);
  
  return stats;
}

/**
 * 示例 6: 使用缓存
 */
export async function detectWithCache(
  pageImageBase64: string,
  pageNumber: number
) {
  const detector = new AdvancedFormulaDetector();
  
  console.log('第一次检测（无缓存）...');
  const start1 = Date.now();
  const formulas1 = await detector.detectFormulas(pageImageBase64, pageNumber);
  const time1 = Date.now() - start1;
  console.log(`耗时: ${time1}ms, 检测到 ${formulas1.length} 个公式`);
  
  console.log('第二次检测（使用缓存）...');
  const start2 = Date.now();
  const formulas2 = await detector.detectFormulas(pageImageBase64, pageNumber);
  const time2 = Date.now() - start2;
  console.log(`耗时: ${time2}ms, 检测到 ${formulas2.length} 个公式`);
  
  console.log(`缓存加速: ${(time1/time2).toFixed(1)}x`);
  
  // 清除缓存
  detector.clearCache(pageNumber);
  console.log('缓存已清除');
  
  return formulas2;
}
