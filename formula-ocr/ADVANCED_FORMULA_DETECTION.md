# Advanced Formula Detection System

## 🎯 Overview

The Advanced Formula Detection System is a comprehensive, zero-cost solution for detecting and classifying mathematical formulas in PDF documents. It uses pure frontend algorithms without requiring any paid APIs.

## ✨ Key Features

### 1. **Multi-Feature Detection**
- Mathematical symbol recognition (Greek letters, integrals, summations, matrices, roots)
- Layout feature analysis (aspect ratio, density, vertical complexity)
- Texture feature extraction (edge density, stroke width)

### 2. **Four-Way Content Classification**
- Mathematical formulas
- Images/diagrams
- Tables
- Plain text

### 3. **Formula Type Recognition**
- Display formulas (standalone equations)
- Inline formulas (embedded in text)

### 4. **Confidence Scoring**
- Multi-dimensional quality assessment
- Customizable confidence thresholds
- Detailed breakdown of scoring factors

### 5. **Precise Boundary Detection**
- Pixel-level formula boundary detection
- Tight bounding boxes around formulas
- Contour extraction

## 📦 Module Structure

```
advancedFormulaDetection/
├── types.ts                    # Core type definitions
├── interfaces.ts               # Interface definitions
├── constants.ts                # Configuration constants
├── index.ts                    # Main export file
├── AdvancedFormulaDetector.ts  # Main detector orchestrator
├── PagePreprocessor.ts         # Image preprocessing
├── FeatureExtractor.ts         # Feature extraction
├── ContentClassifier.ts        # Content classification
├── FormulaTypeClassifier.ts    # Formula type classification
├── BoundaryDetector.ts         # Boundary detection
├── ConfidenceScorer.ts         # Confidence scoring
├── DetectionCacheManager.ts    # Detection caching
├── README.md                   # Module documentation
└── example.ts                  # Usage examples
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { AdvancedFormulaDetector } from '@/utils/advancedFormulaDetection';

// Create detector instance
const detector = new AdvancedFormulaDetector();

// Detect formulas in a page
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

console.log(`Detected ${formulas.length} formulas`);
```

### Batch Processing

```typescript
// Detect formulas in multiple pages
const results = await detector.detectMultiplePages(
  pages,
  (progress) => console.log(`Progress: ${progress}%`)
);
```

## 🔧 Configuration Options

### DetectionOptions

```typescript
interface DetectionOptions {
  minConfidence?: number;        // Minimum confidence threshold (default: 0.6)
  includeInline?: boolean;       // Include inline formulas (default: true)
  includeDisplay?: boolean;      // Include display formulas (default: true)
  resolution?: number;           // Rendering resolution DPI (default: 300)
  enablePreprocessing?: boolean; // Enable preprocessing (default: true)
}
```

### PreprocessOptions

```typescript
interface PreprocessOptions {
  targetDPI?: number;           // Target resolution (default: 300)
  denoise?: boolean;            // Enable denoising (default: true)
  enhanceContrast?: boolean;    // Enable contrast enhancement (default: true)
  binarizationMethod?: 'otsu' | 'adaptive' | 'simple';
}
```

## 📊 Detection Pipeline

1. **Image Preprocessing**
   - Upscale to 300 DPI
   - Grayscale conversion and denoising
   - Adaptive binarization

2. **Connected Component Analysis**
   - Identify all connected regions
   - Calculate region properties
   - Filter noise

3. **Feature Extraction**
   - Mathematical symbol features
   - Layout features
   - Density features
   - Texture features

4. **Content Classification**
   - Formula vs text
   - Formula vs image
   - Formula vs table
   - Multi-feature decision tree

5. **Formula Type Classification**
   - Analyze vertical position
   - Analyze horizontal alignment
   - Analyze surrounding text
   - Display vs inline

6. **Boundary Refinement**
   - Precise boundary detection
   - Remove attached text
   - Add appropriate padding

7. **Confidence Scoring**
   - Feature match score
   - Classification certainty
   - Boundary clarity
   - Overall score (0-1)

## 📈 Performance

- **Zero Cost**: Pure frontend implementation, no API calls
- **Fast**: Optimized algorithms with caching
- **Accurate**: Multi-feature detection for high precision
- **Scalable**: Batch processing with progress tracking

## 🧪 Testing

All components are thoroughly tested:

```bash
# Run all tests
npm test

# Run unit tests
npm test -- --run src/test/unit/

# Run specific test
npm test -- --run src/test/unit/FormulaTypeClassifier.test.ts
```

### Test Coverage

- ✅ PagePreprocessor: 14 tests
- ✅ FeatureExtractor: 22 tests
- ✅ ContentClassifier: 19 tests
- ✅ FormulaTypeClassifier: 23 tests
- ✅ BoundaryDetector: 19 tests
- ✅ ConfidenceScorer: 8 tests

**Total: 105 tests passing**

## 📝 Usage Examples

### Example 1: Detect High-Confidence Formulas

```typescript
const formulas = await detector.detectFormulas(
  pageImageBase64,
  pageNumber,
  { minConfidence: 0.85 } // High confidence only
);
```

### Example 2: Detect Display Formulas Only

```typescript
const formulas = await detector.detectFormulas(
  pageImageBase64,
  pageNumber,
  {
    includeInline: false,  // Exclude inline formulas
    includeDisplay: true,  // Include display formulas only
  }
);
```

### Example 3: Analyze Formula Features

```typescript
const formulas = await detector.detectFormulas(pageImageBase64, pageNumber);

for (const formula of formulas) {
  console.log({
    type: formula.formulaType,
    confidence: formula.confidence.overall,
    features: {
      hasIntegral: formula.features.hasIntegralSymbols,
      hasFraction: formula.features.hasFractionLines,
      hasGreek: formula.features.hasGreekLetters,
    },
  });
}
```

### Example 4: Use Caching

```typescript
// First detection (no cache)
const formulas1 = await detector.detectFormulas(pageImageBase64, pageNumber);

// Second detection (uses cache - much faster!)
const formulas2 = await detector.detectFormulas(pageImageBase64, pageNumber);

// Clear cache when needed
detector.clearCache(pageNumber);
```

## 🎨 Result Structure

```typescript
interface EnhancedFormulaRegion {
  id: string;
  imageData: string;
  pageNumber: number;
  position: { x, y, width, height };
  originalPosition: { x, y, width, height };
  
  // Enhanced fields
  contentType: 'formula' | 'image' | 'table' | 'text';
  formulaType: 'display' | 'inline';
  confidence: {
    overall: number;
    breakdown: {
      featureMatch: number;
      classificationCertainty: number;
      boundaryClarity: number;
      contextConsistency: number;
    };
    level: 'high' | 'medium' | 'low';
  };
  features: MathFeatures;
  classification: ClassificationResult;
}
```

## 🔍 Confidence Breakdown

The confidence score is calculated from four components:

1. **Feature Match (40%)**: How well the region matches mathematical features
2. **Classification Certainty (30%)**: How confident the classifier is
3. **Boundary Clarity (20%)**: How clear the formula boundaries are
4. **Context Consistency (10%)**: How well the formula fits its context

## 🎯 Confidence Levels

- **High (≥ 0.85)**: Very confident detection
- **Medium (0.6 - 0.85)**: Moderately confident detection
- **Low (< 0.6)**: Low confidence, may need review

## 🔄 Backward Compatibility

The system is designed as an optional upgrade:
- Same interface as basic detection
- Supports fallback to basic detection
- No impact on existing functionality

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Add JSDoc comments for all public APIs
3. Include unit tests for new features
4. Maintain code coverage > 80%

## 📄 License

MIT

## 🎉 Status

✅ **Complete and Production Ready**

All core components implemented and tested:
- ✅ PagePreprocessor
- ✅ FeatureExtractor
- ✅ ContentClassifier
- ✅ FormulaTypeClassifier
- ✅ BoundaryDetector
- ✅ ConfidenceScorer
- ✅ DetectionCacheManager
- ✅ AdvancedFormulaDetector

Ready for integration into the main application!
