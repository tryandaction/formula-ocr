# Phase 2 交付记录

## 阶段边界

- 单一根因假设：统一增强可能损伤细线/上下标，且裁剪与坐标规则缺少纯函数契约。
- 修改范围：图片校验、预处理选择元数据、裁剪半开区间和页面像素/PDF 点映射；未修改 PDF 文件协议或额度逻辑。

## 修改文件

- `formula-ocr/src/utils/imagePipeline.ts`
- `formula-ocr/src/utils/formulaOCR.ts`
- `formula-ocr/src/test/unit/imagePipeline.test.ts`

## 验证

- `npx vitest run src/test/unit/imagePipeline.test.ts src/test/unit/ocrContract.test.ts`：13/13 通过。
- `npx tsc -b --pretty false`：通过。

## 真实指标

没有足够的人工图像基准和 Provider 输出，不能报告变体 exact match 或 OCR 提升。当前可确认的行为事实：云端默认返回原图；local 分支仍使用原有放大、padding 和二值化路径；所有派生元数据不含图像内容。

## 未解决问题与风险

- 浏览器 EXIF 方向、真实 alpha 覆盖率和 Canvas 最大尺寸尚未接入文件读取层。
- PDF 检测模块仍有另一套坐标/裁剪实现，需要 Phase 4 统一。
- local 变体尚未通过真实样本比较，因此仅作为显式 provider-specific 行为保留。
