# Phase 2: UI Integration Guide

## Overview

Phase 2 focuses on integrating the Advanced Formula Detection engine (Phase 1) into the existing PDF viewer with enhanced UI components.

## Completed Components

### 1. PDF Integration Module (`pdfIntegration.ts`)

**Location:** `src/utils/advancedFormulaDetection/pdfIntegration.ts`

**Purpose:** Bridges the advanced detection engine with the PDF viewer

**Key Features:**
- Seamless integration with existing `FormulaRegion` interface
- Configurable detection options (confidence threshold, formula type filter)
- Automatic fallback to basic detection on errors
- Progress tracking for multi-page detection
- Statistics calculation (formula types, confidence levels)

**Usage Example:**
```typescript
import { detectFormulasInPage, DEFAULT_PDF_CONFIG } from './utils/advancedFormulaDetection/pdfIntegration';

// Detect formulas in a single page
const formulas = await detectFormulasInPage(
  pageImageData,
  pageNumber,
  {
    ...DEFAULT_PDF_CONFIG,
    minConfidence: 0.7,
    formulaTypeFilter: 'display'
  }
);

// Detect in multiple pages with progress
const results = await detectFormulasInPages(
  pageImages,
  config,
  (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
);
```

### 2. Confidence Filter Component (`ConfidenceFilter.tsx`)

**Location:** `src/components/ConfidenceFilter.tsx`

**Purpose:** Interactive slider for filtering formulas by confidence threshold

**Features:**
- Visual slider with color-coded confidence levels (red/yellow/green)
- Real-time filtering statistics
- Quick preset buttons (All, Medium, High Quality)
- Smooth drag interaction with visual feedback

**Props:**
```typescript
interface ConfidenceFilterProps {
  threshold: number;           // Current threshold (0-1)
  onThresholdChange: (threshold: number) => void;
  totalCount: number;          // Total formulas
  filteredCount: number;       // Formulas after filtering
  showStats?: boolean;         // Show detailed stats
}
```

### 3. Enhanced Formula Panel (`EnhancedFormulaPanel.tsx`)

**Location:** `src/components/EnhancedFormulaPanel.tsx`

**Purpose:** Advanced formula panel with detection information display

**New Features:**
- **Confidence Filtering:** Integrated confidence slider
- **Formula Type Badges:** Visual indicators for "独立" (display) and "行内" (inline)
- **Confidence Badges:** Color-coded percentage display (green/yellow/red)
- **Enhanced Statistics:** Shows formula type counts and confidence distribution
- **Backward Compatible:** Works with or without enhanced detection info

**Enhanced Info Interface:**
```typescript
interface EnhancedFormulaInfo {
  formulaType?: 'display' | 'inline';
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
}
```

## Integration Steps

### Step 1: Update Document Parser (Optional)

If you want to store enhanced info with formulas:

```typescript
// In documentParser.ts
export interface FormulaRegion {
  id: string;
  pageNumber: number;
  imageData: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // Add optional enhanced fields
  formulaType?: 'display' | 'inline';
  confidence?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
}
```

### Step 2: Update PDFFormulaViewer

Replace the basic detection with advanced detection:

```typescript
// In PDFFormulaViewer/index.tsx
import { detectFormulasInPage } from '../../utils/advancedFormulaDetection/pdfIntegration';
import { EnhancedFormulaPanel } from '../EnhancedFormulaPanel';

// Replace FormulaPanel with EnhancedFormulaPanel
<EnhancedFormulaPanel
  formulas={document.formulas}
  currentPage={currentPage}
  selectedId={selectedFormulaId}
  hoveredId={hoveredFormulaId}
  recognizedFormulas={recognizedFormulas}
  enhancedInfo={enhancedInfoMap}  // New prop
  onFormulaSelect={handleFormulaClick}
  onFormulaHover={handleFormulaHover}
  onRecognize={handleRecognize}
  onRecognizeAll={handleRecognizeAll}
  onCopy={handleCopy}
  isCollapsed={isPanelCollapsed}
  onToggleCollapse={() => setIsPanelCollapsed(prev => !prev)}
/>
```

### Step 3: Update Document Upload Handler

Use advanced detection when parsing PDFs:

```typescript
// In documentParser.ts or upload handler
import { detectFormulasInPage } from './advancedFormulaDetection/pdfIntegration';

async function parsePageFormulas(pageImage: string, pageNumber: number) {
  const formulas = await detectFormulasInPage(pageImage, pageNumber, {
    useAdvancedDetection: true,
    minConfidence: 0.6,
    formulaTypeFilter: 'both',
    enableCache: true,
    enableParallel: false,
  });
  
  return formulas;
}
```

## Configuration Options

### Detection Configuration

```typescript
interface PDFDetectionConfig {
  useAdvancedDetection: boolean;  // Enable/disable advanced detection
  minConfidence: number;          // Threshold (0-1)
  formulaTypeFilter?: 'display' | 'inline' | 'both';
  enableCache: boolean;           // Cache detection results
  enableParallel: boolean;        // Use Web Workers (Phase 2.2)
}
```

### Recommended Settings

**High Accuracy (Slower):**
```typescript
{
  useAdvancedDetection: true,
  minConfidence: 0.85,
  formulaTypeFilter: 'both',
  enableCache: true,
  enableParallel: false,
}
```

**Balanced (Default):**
```typescript
{
  useAdvancedDetection: true,
  minConfidence: 0.6,
  formulaTypeFilter: 'both',
  enableCache: true,
  enableParallel: false,
}
```

**Fast (Lower Quality):**
```typescript
{
  useAdvancedDetection: false,  // Use basic detection
  minConfidence: 0.5,
  formulaTypeFilter: 'both',
  enableCache: true,
  enableParallel: false,
}
```

## UI Components Usage

### Standalone Confidence Filter

```typescript
import { ConfidenceFilter } from './components/ConfidenceFilter';

function MyComponent() {
  const [threshold, setThreshold] = useState(0.6);
  const [formulas, setFormulas] = useState([...]);
  
  const filtered = formulas.filter(f => f.confidence >= threshold);
  
  return (
    <ConfidenceFilter
      threshold={threshold}
      onThresholdChange={setThreshold}
      totalCount={formulas.length}
      filteredCount={filtered.length}
      showStats={true}
    />
  );
}
```

### Enhanced Formula Panel

```typescript
import { EnhancedFormulaPanel } from './components/EnhancedFormulaPanel';

function MyViewer() {
  // Build enhanced info map
  const enhancedInfo = new Map<string, EnhancedFormulaInfo>();
  formulas.forEach(f => {
    enhancedInfo.set(f.id, {
      formulaType: f.formulaType,
      confidence: f.confidence,
      confidenceLevel: f.confidenceLevel,
    });
  });
  
  return (
    <EnhancedFormulaPanel
      formulas={formulas}
      enhancedInfo={enhancedInfo}
      // ... other props
    />
  );
}
```

## Backward Compatibility

All new components are **fully backward compatible**:

1. **EnhancedFormulaPanel** works without `enhancedInfo` prop (falls back to basic display)
2. **pdfIntegration** can use basic detection via `useAdvancedDetection: false`
3. Existing `FormulaRegion` interface unchanged (enhanced fields are optional)

## Testing

### Manual Testing Checklist

- [ ] Upload PDF with formulas
- [ ] Verify formulas are detected with confidence scores
- [ ] Test confidence filter slider
- [ ] Verify formula type badges (独立/行内)
- [ ] Test quick preset buttons (All/Medium/High Quality)
- [ ] Verify filtering updates formula count
- [ ] Test with low confidence threshold (should show more formulas)
- [ ] Test with high confidence threshold (should show fewer formulas)
- [ ] Verify fallback to basic detection on errors

### Integration Testing

```typescript
// Test detection
const formulas = await detectFormulasInPage(testImage, 1);
expect(formulas.length).toBeGreaterThan(0);
expect(formulas[0]).toHaveProperty('id');
expect(formulas[0]).toHaveProperty('imageData');

// Test filtering
const filtered = formulas.filter(f => (f.confidence ?? 1) >= 0.7);
expect(filtered.length).toBeLessThanOrEqual(formulas.length);
```

## Next Steps (Phase 2.2)

1. **Web Worker Integration** (Task 11)
   - Create `formulaDetection.worker.ts`
   - Implement worker pool for parallel processing
   - Update `pdfIntegration.ts` to use workers

2. **User Corrections** (Task 14)
   - Add delete/add/adjust formula boundaries
   - Persist corrections to localStorage
   - Restore corrections on document reload

3. **Performance Optimization** (Task 18)
   - Performance monitoring
   - Adaptive quality adjustment
   - Benchmark testing

## Troubleshooting

### Issue: Formulas not detected
- Check `useAdvancedDetection` is `true`
- Lower `minConfidence` threshold
- Verify image quality (should be at least 150 DPI)

### Issue: Too many false positives
- Increase `minConfidence` threshold (try 0.75-0.85)
- Use `formulaTypeFilter` to filter specific types

### Issue: Slow detection
- Enable caching: `enableCache: true`
- Consider using basic detection for preview
- Wait for Web Worker implementation (Phase 2.2)

## API Reference

See individual component files for detailed API documentation:
- `pdfIntegration.ts` - Detection functions
- `ConfidenceFilter.tsx` - Filter component
- `EnhancedFormulaPanel.tsx` - Panel component
