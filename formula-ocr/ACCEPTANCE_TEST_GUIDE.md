# 整页公式识别系统 - 验收测试指南

## 测试概述

本文档提供了整页公式识别深度优化系统的完整验收测试指南，包括功能测试、性能测试和正确性验证。

## 测试环境要求

- Node.js >= 18
- 浏览器：Chrome/Edge/Firefox（最新版本）
- 内存：至少4GB可用
- CPU：多核处理器（推荐4核以上）

## 快速测试

### 1. 运行单元测试

```bash
cd formula-ocr
npm run test
```

### 2. 运行测试覆盖率

```bash
npm run test:coverage
```

**目标**：代码覆盖率 ≥ 80%

### 3. 运行UI测试

```bash
npm run test:ui
```

## 功能验收测试

### Test 1: 整页批量处理完整性

**测试目标**：验证系统能一次性处理整个页面的所有公式

**测试步骤**：
1. 准备一个包含10-20个公式的PDF页面
2. 调用 `WholePageProcessor.processWholePage()`
3. 验证返回的公式数组

**验收标准**：
- ✅ 一次调用返回所有公式
- ✅ 不需要多次调用或切片处理
- ✅ 处理时间 < 5秒

**测试代码**：
```typescript
const processor = new WholePageProcessor();
const startTime = Date.now();
const formulas = await processor.processWholePage(pageData);
const duration = Date.now() - startTime;

console.assert(formulas.length > 0, '应该检测到公式');
console.assert(duration < 5000, '处理时间应该小于5秒');
```

### Test 2: 边界精度验证

**测试目标**：验证边界框精度 ≤ 5像素

**测试步骤**：
1. 准备带有标注真实边界的测试图像
2. 运行检测
3. 计算边界误差

**验收标准**：
- ✅ 上边界误差 ≤ 5px
- ✅ 下边界误差 ≤ 5px
- ✅ 左边界误差 ≤ 5px
- ✅ 右边界误差 ≤ 5px

**测试代码**：
```typescript
const formulas = await processor.processWholePage(pageData);
formulas.forEach((formula, index) => {
  const groundTruth = groundTruthBoundaries[index];
  const detected = formula.boundingBox;
  
  const errorTop = Math.abs(detected.y - groundTruth.y);
  const errorBottom = Math.abs((detected.y + detected.height) - (groundTruth.y + groundTruth.height));
  const errorLeft = Math.abs(detected.x - groundTruth.x);
  const errorRight = Math.abs((detected.x + detected.width) - (groundTruth.x + groundTruth.width));
  
  console.assert(errorTop <= 5, `公式${index}上边界误差: ${errorTop}px`);
  console.assert(errorBottom <= 5, `公式${index}下边界误差: ${errorBottom}px`);
  console.assert(errorLeft <= 5, `公式${index}左边界误差: ${errorLeft}px`);
  console.assert(errorRight <= 5, `公式${index}右边界误差: ${errorRight}px`);
});
```

### Test 3: 置信度评分验证

**测试目标**：验证置信度分数在有效范围内

**测试步骤**：
1. 运行检测
2. 检查所有公式的置信度

**验收标准**：
- ✅ 所有置信度 ∈ [0, 1]
- ✅ 高质量公式置信度 > 0.75
- ✅ 低质量公式置信度 < 0.5

**测试代码**：
```typescript
const formulas = await processor.processWholePage(pageData);
formulas.forEach(formula => {
  console.assert(
    formula.confidence >= 0 && formula.confidence <= 1,
    `置信度应该在0-1范围内: ${formula.confidence}`
  );
});
```

### Test 4: 格式转换正确性

**测试目标**：验证LaTeX和Markdown转换

**测试步骤**：
1. 检测公式
2. 转换为LaTeX和Markdown
3. 验证语法

**验收标准**：
- ✅ LaTeX语法有效
- ✅ Markdown语法有效
- ✅ 转换保持数学语义

**测试代码**：
```typescript
const converter = new FormatConverter();
const formula = formulas[0];

const latex = await converter.imageToLatex(formula.imageData);
const markdown = await converter.imageToMarkdown(formula.imageData);

console.assert(converter.validateLatex(latex), 'LaTeX应该有效');
console.assert(converter.validateMarkdown(markdown), 'Markdown应该有效');
```

### Test 5: 剪贴板操作

**测试目标**：验证复制功能

**测试步骤**：
1. 复制公式为LaTeX
2. 复制公式为Markdown
3. 验证剪贴板内容

**验收标准**：
- ✅ 复制成功返回true
- ✅ 剪贴板包含正确内容
- ✅ 降级方案可用

**测试代码**：
```typescript
const manager = new OperationManager();
const formula = formulas[0];

const latexSuccess = await manager.copyAsLatex(formula);
console.assert(latexSuccess, 'LaTeX复制应该成功');

const markdownSuccess = await manager.copyAsMarkdown(formula);
console.assert(markdownSuccess, 'Markdown复制应该成功');
```

## 性能验收测试

### Test 6: 标准页面处理时间

**测试目标**：标准页面 ≤ 2秒

**测试数据**：
- 页面尺寸：< 2000x3000px
- 公式数量：≤ 10个

**验收标准**：
- ✅ 处理时间 ≤ 2000ms

**测试代码**：
```typescript
const startTime = performance.now();
const formulas = await processor.processWholePage(standardPageData);
const duration = performance.now() - startTime;

console.log(`标准页面处理时间: ${duration.toFixed(0)}ms`);
console.assert(duration <= 2000, '标准页面应该在2秒内完成');
```

### Test 7: 复杂页面处理时间

**测试目标**：复杂页面 ≤ 5秒

**测试数据**：
- 页面尺寸：≥ 2000x3000px
- 公式数量：20-50个

**验收标准**：
- ✅ 处理时间 ≤ 5000ms

**测试代码**：
```typescript
const startTime = performance.now();
const formulas = await processor.processWholePage(complexPageData);
const duration = performance.now() - startTime;

console.log(`复杂页面处理时间: ${duration.toFixed(0)}ms`);
console.assert(duration <= 5000, '复杂页面应该在5秒内完成');
```

### Test 8: 内存使用

**测试目标**：内存使用 < 500MB

**测试步骤**：
1. 记录初始内存
2. 处理多个页面
3. 检查内存增长

**验收标准**：
- ✅ 峰值内存 < 500MB
- ✅ 自动清理生效

**测试代码**：
```typescript
if (performance.memory) {
  const initialMemory = performance.memory.usedJSHeapSize;
  
  // 处理10个页面
  for (let i = 0; i < 10; i++) {
    await processor.processWholePage(pageData);
  }
  
  const finalMemory = performance.memory.usedJSHeapSize;
  const memoryUsedMB = (finalMemory - initialMemory) / (1024 * 1024);
  
  console.log(`内存使用: ${memoryUsedMB.toFixed(2)}MB`);
  console.assert(memoryUsedMB < 500, '内存使用应该小于500MB');
}
```

### Test 9: UI响应性

**测试目标**：UI保持60fps

**测试步骤**：
1. 渲染大量公式（50+）
2. 监控帧率
3. 测试交互响应

**验收标准**：
- ✅ 平均帧率 ≥ 55fps
- ✅ 交互延迟 < 100ms

**测试代码**：
```typescript
let frameCount = 0;
let lastTime = performance.now();

function measureFPS() {
  frameCount++;
  const currentTime = performance.now();
  
  if (currentTime - lastTime >= 1000) {
    const fps = frameCount;
    console.log(`FPS: ${fps}`);
    console.assert(fps >= 55, 'FPS应该 ≥ 55');
    
    frameCount = 0;
    lastTime = currentTime;
  }
  
  requestAnimationFrame(measureFPS);
}

requestAnimationFrame(measureFPS);
```

## 准确率验收测试

### Test 10: 误检率

**测试目标**：误检率 ≤ 5%

**测试数据**：100个标注样本

**验收标准**：
- ✅ 误检数量 ≤ 5

**测试代码**：
```typescript
let falsePositives = 0;
const totalSamples = 100;

for (const sample of testSamples) {
  const formulas = await processor.processWholePage(sample.pageData);
  const detected = formulas.length;
  const groundTruth = sample.groundTruthCount;
  
  if (detected > groundTruth) {
    falsePositives += (detected - groundTruth);
  }
}

const falsePositiveRate = (falsePositives / totalSamples) * 100;
console.log(`误检率: ${falsePositiveRate.toFixed(2)}%`);
console.assert(falsePositiveRate <= 5, '误检率应该 ≤ 5%');
```

### Test 11: 漏检率

**测试目标**：漏检率 ≤ 3%

**测试数据**：100个标注样本

**验收标准**：
- ✅ 漏检数量 ≤ 3

**测试代码**：
```typescript
let falseNegatives = 0;
const totalSamples = 100;

for (const sample of testSamples) {
  const formulas = await processor.processWholePage(sample.pageData);
  const detected = formulas.length;
  const groundTruth = sample.groundTruthCount;
  
  if (detected < groundTruth) {
    falseNegatives += (groundTruth - detected);
  }
}

const falseNegativeRate = (falseNegatives / totalSamples) * 100;
console.log(`漏检率: ${falseNegativeRate.toFixed(2)}%`);
console.assert(falseNegativeRate <= 3, '漏检率应该 ≤ 3%');
```

## 正确性属性验证

### 属性 1-18 验证清单

- [ ] **属性 1**: 整页批量处理完整性
- [ ] **属性 2**: 位置信息保留
- [ ] **属性 3**: 边界精度
- [ ] **属性 4**: 边界非重叠性
- [ ] **属性 5**: 格式转换正确性
- [ ] **属性 6**: 编辑隔离性
- [ ] **属性 7**: 操作反馈一致性
- [ ] **属性 8**: 特征验证
- [ ] **属性 9**: 纯文本过滤
- [ ] **属性 10**: 置信度阈值过滤
- [ ] **属性 11**: 置信度范围有效性
- [ ] **属性 12**: 置信度排序
- [ ] **属性 13**: 置信度分类
- [ ] **属性 14**: 公式类型标记
- [ ] **属性 15**: 资源复用
- [ ] **属性 16**: 进度报告
- [ ] **属性 17**: 内存管理
- [ ] **属性 18**: UI交互响应

## 集成测试场景

### 场景 1: 完整工作流

1. 加载PDF文档
2. 选择页面
3. 触发整页检测
4. 查看检测结果
5. 选择公式
6. 复制为LaTeX
7. 编辑公式
8. 导出所有公式

**验收标准**：所有步骤顺利完成，无错误

### 场景 2: 大文档处理

1. 加载50页PDF文档
2. 逐页检测
3. 监控内存使用
4. 验证缓存效果

**验收标准**：
- 内存稳定
- 缓存命中率 > 50%
- 无内存泄漏

### 场景 3: 错误恢复

1. 触发检测
2. 中途取消
3. 重新检测
4. 验证状态正确

**验收标准**：
- 取消成功
- 资源正确释放
- 重新检测正常

## 测试报告模板

```markdown
# 整页公式识别系统 - 验收测试报告

## 测试信息
- 测试日期：YYYY-MM-DD
- 测试人员：[姓名]
- 测试环境：[浏览器/OS]

## 功能测试结果
- [ ] Test 1: 整页批量处理 - PASS/FAIL
- [ ] Test 2: 边界精度 - PASS/FAIL
- [ ] Test 3: 置信度评分 - PASS/FAIL
- [ ] Test 4: 格式转换 - PASS/FAIL
- [ ] Test 5: 剪贴板操作 - PASS/FAIL

## 性能测试结果
- [ ] Test 6: 标准页面 - XXms (目标: ≤2000ms)
- [ ] Test 7: 复杂页面 - XXms (目标: ≤5000ms)
- [ ] Test 8: 内存使用 - XXMBs (目标: <500MB)
- [ ] Test 9: UI响应性 - XXfps (目标: ≥55fps)

## 准确率测试结果
- [ ] Test 10: 误检率 - XX% (目标: ≤5%)
- [ ] Test 11: 漏检率 - XX% (目标: ≤3%)

## 测试覆盖率
- 代码覆盖率: XX% (目标: ≥80%)
- 分支覆盖率: XX% (目标: ≥75%)

## 问题列表
1. [问题描述]
2. [问题描述]

## 总体评价
- [ ] 通过验收
- [ ] 需要修复后重测

## 备注
[其他说明]
```

## 自动化测试脚本

创建 `formula-ocr/scripts/acceptance-test.sh`:

```bash
#!/bin/bash

echo "=== 整页公式识别系统 - 验收测试 ==="
echo ""

echo "1. 运行单元测试..."
npm run test:run
if [ $? -ne 0 ]; then
  echo "❌ 单元测试失败"
  exit 1
fi
echo "✅ 单元测试通过"
echo ""

echo "2. 生成测试覆盖率..."
npm run test:coverage
echo "✅ 测试覆盖率报告已生成"
echo ""

echo "3. 检查代码质量..."
npm run lint
if [ $? -ne 0 ]; then
  echo "⚠️  代码质量检查有警告"
fi
echo ""

echo "4. 构建项目..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 构建失败"
  exit 1
fi
echo "✅ 构建成功"
echo ""

echo "=== 验收测试完成 ==="
echo "请查看测试覆盖率报告: coverage/index.html"
```

## 结论

完成以上所有测试后，如果：
- ✅ 所有功能测试通过
- ✅ 性能指标达标
- ✅ 准确率满足要求
- ✅ 测试覆盖率 ≥ 80%

则系统通过验收，可以投入生产使用。
