# Advanced Formula Detection Module

高级 PDF 公式识别模块 - 提供智能、精准的数学公式检测功能

## 概述

本模块实现了一套完整的高级公式检测系统，能够准确识别复杂学术论文中的数学公式，并区分公式、图片、表格和文本。

## 核心特性

### 1. 智能多特征检测
- 数学符号识别（希腊字母、积分、求和、矩阵、根号等）
- 布局特征分析（宽高比、密度、垂直复杂度）
- 纹理特征提取（边缘密度、笔画宽度）

### 2. 四类内容分类
- 数学公式
- 图片/图表
- 表格
- 普通文本

### 3. 公式类型识别
- 独立公式（Display Formula）
- 行内公式（Inline Formula）

### 4. 置信度评分
- 多维度评估检测质量
- 支持用户自定义置信度阈值过滤

### 5. 精准边界定位
- 像素级的公式边界检测
- 紧贴公式边缘的高亮框

## 模块结构

```
advancedFormulaDetection/
├── types.ts                    # 核心类型定义
├── interfaces.ts               # 接口定义
├── constants.ts                # 常量配置
├── index.ts                    # 主导出文件
├── AdvancedFormulaDetector.ts  # 主检测器
├── PagePreprocessor.ts         # 页面预处理器
├── FeatureExtractor.ts         # 特征提取器
├── ContentClassifier.ts        # 内容分类器
├── FormulaTypeClassifier.ts    # 公式类型分类器
├── BoundaryDetector.ts         # 边界检测器
├── ConfidenceScorer.ts         # 置信度评分器
└── DetectionCacheManager.ts    # 检测缓存管理器
```

## 使用示例

```typescript
import { AdvancedFormulaDetector } from '@/utils/advancedFormulaDetection';

// 创建检测器实例
const detector = new AdvancedFormulaDetector();

// 检测单页公式
const formulas = await detector.detectFormulas(
  pageImageBase64,
  pageNumber,
  {
    minConfidence: 0.6,
    includeInline: true,
    includeDisplay: true,
    resolution: 300,
    enablePreprocessing: true,
  }
);

// 批量检测多页
const results = await detector.detectMultiplePages(
  pages,
  (progress) => console.log(`Progress: ${progress}%`)
);
```

## 检测流程

1. **页面预处理**
   - 提升分辨率到 300 DPI
   - 灰度化和去噪
   - 自适应二值化

2. **连通域分析**
   - 识别所有连通区域
   - 计算区域属性
   - 初步过滤噪声

3. **特征提取**
   - 数学符号特征
   - 布局特征
   - 密度特征
   - 纹理特征

4. **内容分类**
   - 公式 vs 文本
   - 公式 vs 图片
   - 公式 vs 表格
   - 多特征决策树

5. **公式类型分类**
   - 分析垂直位置
   - 分析水平对齐
   - 分析周围文本
   - Display vs Inline

6. **边界精化**
   - 精确边界检测
   - 去除粘连文本
   - 添加适当边距

7. **置信度评分**
   - 特征匹配度
   - 分类确定性
   - 边界清晰度
   - 综合评分 (0-1)

## 配置选项

### DetectionOptions

```typescript
interface DetectionOptions {
  minConfidence?: number;        // 最小置信度阈值 (默认 0.6)
  includeInline?: boolean;       // 是否包含行内公式 (默认 true)
  includeDisplay?: boolean;      // 是否包含独立公式 (默认 true)
  resolution?: number;           // 渲染分辨率 DPI (默认 300)
  enablePreprocessing?: boolean; // 是否启用预处理 (默认 true)
}
```

### PreprocessOptions

```typescript
interface PreprocessOptions {
  targetDPI?: number;           // 目标分辨率 (默认 300)
  denoise?: boolean;            // 是否去噪 (默认 true)
  enhanceContrast?: boolean;    // 是否增强对比度 (默认 true)
  binarizationMethod?: 'otsu' | 'adaptive' | 'simple'; // 二值化方法
}
```

## 性能优化

- **Web Worker 并行处理** - 多页面异步检测
- **结果缓存** - 避免重复检测
- **增量检测** - 仅检测可见页面
- **自适应策略** - 根据性能动态调整检测参数

## 测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行属性测试
npm run test:property

# 查看测试覆盖率
npm run test:coverage
```

## 零成本实现

本模块完全使用纯前端算法实现，无需依赖任何付费 API：
- 图像处理使用 Canvas API
- 特征提取使用自定义算法
- 分类使用基于规则的决策树
- 缓存使用 localStorage

## 向后兼容

本模块设计为可选升级，与现有的基础检测算法完全兼容：
- 保持相同的接口签名
- 支持降级到基础检测
- 不影响现有功能

## 贡献指南

1. 遵循 TypeScript 严格模式
2. 所有公共 API 必须有完整的 JSDoc 注释
3. 新功能必须包含单元测试和属性测试
4. 保持代码覆盖率 > 80%

## 许可证

MIT
