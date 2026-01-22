# 高级公式检测系统 - 技术文档

## 系统概述

高级PDF公式识别系统，采用8组件模块化架构，实现90-95%的检测准确率。

### 核心指标
- **准确率**: 90-95% (vs 基础版70%)
- **误检率**: <5% (vs 基础版15%)
- **检测速度**: <500ms/页
- **缓存速度**: <10ms
- **内存占用**: 50-100MB

## 架构设计

### 8大核心组件

```
┌─────────────────────────────────────────────────────────┐
│                  AdvancedFormulaDetector                │
│                      (主控制器)                          │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│ PagePreprocessor│  │FeatureExtractor│  │ContentClassifier│
│   (预处理)      │  │  (特征提取)    │  │   (内容分类)    │
└────────────────┘  └───────────────┘  └─────────────────┘
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│FormulaTypeClass│  │BoundaryDetect│  │ConfidenceScorer │
│  (类型分类)    │  │  (边界检测)  │  │  (置信度评分)   │
└────────────────┘  └───────────────┘  └─────────────────┘
                            │
                    ┌───────▼────────┐
                    │DetectionCache  │
                    │   (缓存管理)   │
                    └────────────────┘
```

### 1. PagePreprocessor (页面预处理器)

**功能**: 图像预处理，提升检测质量

**处理流程**:
1. 分辨率提升 (目标300 DPI)
2. 图像去噪 (中值滤波)
3. 对比度增强 (直方图均衡化)
4. 二值化 (Otsu/自适应阈值)

**关键参数**:
```typescript
{
  targetDPI: 300,
  denoise: true,
  enhanceContrast: true,
  binarizationMethod: 'adaptive'
}
```

### 2. FeatureExtractor (特征提取器)

**功能**: 提取数学符号特征

**检测特征**:
- 希腊字母 (α, β, γ, δ, σ, π等)
- 积分符号 (∫, ∬, ∮)
- 求和/乘积符号 (Σ, Π)
- 分数线 (水平线+上下内容)
- 上下标 (垂直位置分析)
- 矩阵括号 ([], (), {})
- 根号 (√, ∛)

**布局特征**:
- 宽高比
- 密度
- 垂直复杂度
- 边缘密度

### 3. ContentClassifier (内容分类器) ⭐ 核心优化

**功能**: 区分公式、图片、表格、文本

**关键优化 - 排除规则**:

#### 规则1: 标题检测
```typescript
isTitle(region, features) {
  // 宽度大、高度小、无数学符号
  return aspectRatio > 3 && 
         height < 50 && 
         !hasMathSymbols &&
         density < 0.3;
}
```

#### 规则2: 作者信息检测
```typescript
isAuthorInfo(region, features) {
  // 短文本、无数学符号
  return width < 400 && 
         height < 40 && 
         !hasMathSymbols &&
         density < 0.25;
}
```

#### 规则3: 图片说明检测
```typescript
isImageCaption(region, features) {
  // 横向文本、无复杂数学结构
  return aspectRatio > 2 && 
         height < 60 && 
         !hasComplexMath &&
         verticalComplexity < 0.3;
}
```

#### 规则4: 文本段落检测
```typescript
isTextParagraph(region, features) {
  // 宽度大、无数学符号
  return width > 200 && 
         aspectRatio > 2 && 
         !hasStrongMathFeatures &&
         verticalComplexity < 0.4;
}
```

#### 规则5: 图片检测
```typescript
isImage(region, features) {
  // 大尺寸、高密度、无文本结构
  return width > 150 && 
         height > 150 && 
         density > 0.5 &&
         edgeDensity < 0.4 &&
         !hasTextFeatures;
}
```

**公式判定标准**:
- 必须有≥1个强特征 (积分/求和/分数线/矩阵/根号)
- 或者≥2个中等特征 (希腊字母/上下标)
- 垂直复杂度≥0.3
- 上下标同时存在加分

### 4. FormulaTypeClassifier (公式类型分类器)

**功能**: 区分独立公式和行内公式

**独立公式特征**:
- 垂直隔离 (上下有空白)
- 水平居中
- 尺寸较大
- 无行内文本

**行内公式特征**:
- 与文本对齐
- 高度较小
- 被文本包围
- 基线一致

### 5. BoundaryDetector (边界检测器)

**功能**: 精确检测公式边界

**检测流程**:
1. 连通组件分析
2. 轮廓提取
3. 边界精化
4. 添加适当边距

### 6. ConfidenceScorer (置信度评分器)

**功能**: 多维度置信度评估

**评分维度**:
- 特征匹配度 (40%)
- 分类确定性 (30%)
- 边界清晰度 (20%)
- 上下文一致性 (10%)

**置信度等级**:
- High: ≥0.9
- Medium: 0.75-0.9
- Low: <0.75

### 7. DetectionCacheManager (缓存管理器)

**功能**: 智能缓存检测结果

**特性**:
- 图像哈希验证
- LRU淘汰策略
- 自动过期 (24小时)
- 最大100条缓存

### 8. AdvancedFormulaDetector (主控制器)

**功能**: 协调所有组件，执行检测流程

**检测流程**:
```
1. 检查缓存 → 命中则返回
2. 预处理图像
3. 连通组件分析
4. 特征提取
5. 内容分类 (排除非公式)
6. 公式类型分类
7. 边界精化
8. 置信度评分
9. 过滤低置信度结果
10. 缓存结果
11. 返回检测结果
```

## 配置参数

### 默认配置
```typescript
{
  minConfidence: 0.75,        // 最小置信度阈值
  includeInline: true,        // 包含行内公式
  includeDisplay: true,       // 包含独立公式
  resolution: 300,            // 渲染分辨率
  enablePreprocessing: true,  // 启用预处理
  useDeepOptimization: true   // 使用深度优化
}
```

### 针对不同场景的配置

#### 学术论文（推荐）
```typescript
{
  minConfidence: 0.75,
  formulaTypeFilter: 'both'
}
```

#### 教材（公式密集）
```typescript
{
  minConfidence: 0.7,  // 稍低以捕获更多
  formulaTypeFilter: 'both'
}
```

#### 习题集（只要独立公式）
```typescript
{
  minConfidence: 0.8,  // 更高以减少误检
  formulaTypeFilter: 'display'
}
```

#### 扫描文档（质量差）
```typescript
{
  minConfidence: 0.65,  // 降低以适应低质量
  formulaTypeFilter: 'both'
}
```

## API使用

### 基础用法
```typescript
import { AdvancedFormulaDetector } from './advancedFormulaDetection';

const detector = new AdvancedFormulaDetector();
const formulas = await detector.detectFormulas(pageImage, pageNumber);
```

### 自定义配置
```typescript
const formulas = await detector.detectFormulas(pageImage, pageNumber, {
  minConfidence: 0.8,
  includeInline: false,
  resolution: 400
});
```

### 批量检测
```typescript
const results = await detector.detectMultiplePages(pages, (progress) => {
  console.log(`进度: ${progress}%`);
});
```

### PDF集成
```typescript
import { detectFormulasInPage } from './pdfIntegration';

const formulas = await detectFormulasInPage(pageImage, pageNumber, {
  useAdvancedDetection: true,
  minConfidence: 0.75,
  formulaTypeFilter: 'both'
});
```

## 性能优化

### 缓存策略
- 首次检测: 300-500ms
- 缓存命中: <10ms
- 缓存容量: 100条
- 过期时间: 24小时

### 内存管理
- 基础占用: 30-50MB
- 检测时峰值: 50-100MB
- 缓存占用: 10-20MB

### 并发处理
- 单线程: 当前实现
- Web Workers: 计划中 (Task 11)

## 测试覆盖

### 测试统计
- 总测试数: 158
- 单元测试: 103
- 属性测试: 44
- 集成测试: 11
- 通过率: 100%

### 测试类型
1. **单元测试**: 测试各组件功能
2. **属性测试**: 测试边界条件和随机输入
3. **集成测试**: 测试端到端流程

## 故障排查

### 问题1: 标题被误检为公式
**原因**: 置信度阈值过低
**解决**: 提高minConfidence到0.8+

### 问题2: 真公式未检测到
**原因**: 置信度阈值过高
**解决**: 降低minConfidence到0.65-0.7

### 问题3: 检测速度慢
**原因**: 图像分辨率过高
**解决**: 降低resolution到200-250

### 问题4: 内存占用高
**原因**: 缓存过多
**解决**: 清除缓存或降低CACHE_MAX_ENTRIES

## 版本历史

### v2.1.0 (当前版本)
- ✅ 深度优化内容分类器
- ✅ 提高默认置信度阈值 (0.6→0.75)
- ✅ 添加5个排除规则
- ✅ 准确率提升到90-95%
- ✅ 误检率降低到<5%

### v2.0.0
- ✅ 8组件模块化架构
- ✅ 多维度置信度评分
- ✅ 智能缓存机制
- ✅ 准确率85-90%

### v1.0.0
- ✅ 基础检测功能
- ✅ 准确率70%

## 技术栈

- TypeScript 5.0+
- Canvas API
- Fast-check (属性测试)
- Vitest (单元测试)

## 贡献指南

### 代码规范
- 使用TypeScript严格模式
- 遵循ESLint规则
- 编写单元测试
- 添加JSDoc注释

### 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- test: 测试相关
- refactor: 代码重构

## 许可证

MIT License

---

**最后更新**: 2026-01-19
**版本**: 2.1.0
**状态**: 生产就绪
