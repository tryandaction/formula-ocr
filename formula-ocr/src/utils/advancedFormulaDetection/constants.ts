/**
 * Advanced Formula Detection - Constants
 * 高级公式检测 - 常量定义
 */

// ============================================================================
// Detection Parameters
// ============================================================================

export const DEFAULT_DETECTION_OPTIONS = {
  minConfidence: 0.75, // 提高到0.75以减少误检
  includeInline: true,
  includeDisplay: true,
  resolution: 300,
  enablePreprocessing: true,
  useDeepOptimization: true, // 使用深度优化分类器
} as const;

export const CONFIDENCE_THRESHOLDS = {
  LOW: 0.75, // 提高低阈值
  HIGH: 0.9, // 提高高阈值
} as const;

// ============================================================================
// Image Processing Parameters
// ============================================================================

export const DEFAULT_PREPROCESS_OPTIONS = {
  targetDPI: 300,
  denoise: true,
  enhanceContrast: true,
  binarizationMethod: 'adaptive' as const,
} as const;

export const BINARIZATION_THRESHOLD = 180;

// ============================================================================
// Feature Detection Parameters
// ============================================================================

export const MIN_FORMULA_HEIGHT = 15;
export const MAX_FORMULA_HEIGHT = 300;
export const MIN_FORMULA_WIDTH = 20;

export const MIN_REGION_PIXELS = 10;
export const MIN_BLANK_HEIGHT = 10;

// ============================================================================
// Classification Rules
// ============================================================================

export const CLASSIFICATION_RULES = {
  formula: {
    strongFeatures: [
      'hasIntegralSymbols',
      'hasSummationSymbols',
      'hasFractionLines',
      'hasMatrixBrackets',
    ],
    mediumFeatures: [
      'hasGreekLetters',
      'hasSuperscripts',
      'hasSubscripts',
      'hasRootSymbols',
    ],
    layoutConstraints: {
      minVerticalComplexity: 0.3,
      maxAspectRatio: 10,
      minDensity: 0.05,
      maxDensity: 0.5,
    },
    minScore: 35,
  },
  image: {
    characteristics: {
      highDensity: true,
      lowEdgeDensity: true,
      largeSize: true,
      noTextStructure: true,
    },
  },
  table: {
    characteristics: {
      hasGridLines: true,
      regularSpacing: true,
      alignedContent: true,
      rectangularShape: true,
    },
  },
  text: {
    characteristics: {
      linearLayout: true,
      uniformHeight: true,
      regularSpacing: true,
      noMathSymbols: true,
    },
  },
} as const;

// ============================================================================
// Formula Type Classification Rules
// ============================================================================

export const FORMULA_TYPE_RULES = {
  display: {
    verticalIsolation: true,
    horizontalCentered: true,
    largerSize: true,
    noInlineText: true,
  },
  inline: {
    alignedWithText: true,
    smallerHeight: true,
    surroundedByText: true,
    sameBaseline: true,
  },
} as const;

// ============================================================================
// Confidence Scoring Weights
// ============================================================================

export const CONFIDENCE_WEIGHTS = {
  featureMatch: 0.4,
  classificationCertainty: 0.3,
  boundaryClarity: 0.2,
  contextConsistency: 0.1,
} as const;

// ============================================================================
// Math Symbol Patterns
// ============================================================================

export const MATH_SYMBOL_PATTERNS = {
  greekLetters: {
    patterns: [
      { name: 'alpha', features: ['curved', 'loop'] },
      { name: 'beta', features: ['vertical-loop', 'curved-bottom'] },
      { name: 'gamma', features: ['curved-top', 'vertical-stem'] },
      { name: 'delta', features: ['triangular', 'curved-top'] },
      { name: 'sigma', features: ['curved', 'horizontal-top'] },
      { name: 'pi', features: ['horizontal-top', 'two-vertical'] },
    ],
    detectionMethod: 'template-matching',
  },
  integralSymbols: {
    patterns: [
      { name: 'integral', features: ['s-curve', 'vertical-elongated'] },
      { name: 'double-integral', features: ['two-s-curves', 'parallel'] },
      { name: 'contour-integral', features: ['s-curve', 'circle'] },
    ],
    detectionMethod: 'shape-analysis',
  },
  summationSymbols: {
    patterns: [
      { name: 'summation', features: ['zigzag', 'horizontal-lines'] },
      { name: 'product', features: ['pi-shape', 'horizontal-top'] },
    ],
    detectionMethod: 'shape-analysis',
  },
  fractionLines: {
    detectionMethod: 'horizontal-line-detection',
    characteristics: {
      minLength: 10,
      maxThickness: 3,
      horizontalTolerance: 5,
      hasContentAbove: true,
      hasContentBelow: true,
    },
  },
  superscriptsSubscripts: {
    detectionMethod: 'vertical-position-analysis',
    characteristics: {
      smallerSize: true,
      verticalOffset: true,
      adjacentToBase: true,
    },
  },
  matrixBrackets: {
    patterns: [
      { name: 'square-brackets', features: ['vertical-lines', 'horizontal-caps'] },
      { name: 'parentheses', features: ['curved', 'symmetric'] },
      { name: 'curly-braces', features: ['curved', 'center-point'] },
    ],
    detectionMethod: 'bracket-matching',
    characteristics: {
      paired: true,
      enclosesContent: true,
      verticallyAligned: true,
    },
  },
  rootSymbols: {
    patterns: [
      { name: 'square-root', features: ['checkmark', 'horizontal-top'] },
      { name: 'nth-root', features: ['checkmark', 'horizontal-top', 'index'] },
    ],
    detectionMethod: 'shape-analysis',
  },
} as const;

// ============================================================================
// Merge Thresholds
// ============================================================================

export const MERGE_THRESHOLD_X_SCALE = 30;
export const MERGE_THRESHOLD_Y_SCALE = 15;

// ============================================================================
// Cache Settings
// ============================================================================

export const CACHE_KEY_PREFIX = 'formula_detection_cache_';
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
export const CACHE_MAX_ENTRIES = 100;

// ============================================================================
// Performance Settings
// ============================================================================

export const MAX_DETECTION_TIME = 3000; // 3 seconds per page
export const WORKER_POOL_SIZE = 2;
export const BATCH_SIZE = 5;
