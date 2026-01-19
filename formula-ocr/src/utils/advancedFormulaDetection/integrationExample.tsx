/**
 * Integration Example: How to use Advanced Formula Detection in PDF Viewer
 * 
 * This example shows how to integrate the advanced detection engine
 * with the existing PDF viewer components.
 */

import React, { useState, useEffect } from 'react';
import { detectFormulasInPage, DEFAULT_PDF_CONFIG } from './pdfIntegration';
import { EnhancedFormulaPanel } from '../../components/EnhancedFormulaPanel';
import type { FormulaRegion } from '../documentParser';

/**
 * Example 1: Basic Integration
 * Replace basic detection with advanced detection
 */
export async function basicIntegrationExample(pageImage: string, pageNumber: number) {
  // Old way (basic detection)
  // const { detectMultipleFormulas } = await import('../formulaDetection');
  // const result = await detectMultipleFormulas(pageImage);
  
  // New way (advanced detection)
  const formulas = await detectFormulasInPage(pageImage, pageNumber, {
    useAdvancedDetection: true,
    minConfidence: 0.6,
    formulaTypeFilter: 'both',
    enableCache: true,
    enableParallel: false,
  });
  
  console.log(`Detected ${formulas.length} formulas`);
  return formulas;
}

/**
 * Example 2: Multi-Page Detection with Progress
 */
export async function multiPageDetectionExample(pageImages: string[]) {
  const { detectFormulasInPages } = await import('./pdfIntegration');
  
  const results = await detectFormulasInPages(
    pageImages,
    DEFAULT_PDF_CONFIG,
    (completed, total) => {
      console.log(`Progress: ${completed}/${total} pages`);
      // Update UI progress bar here
    }
  );
  
  // Convert Map to array of formulas
  const allFormulas: FormulaRegion[] = [];
  results.forEach((formulas) => {
    allFormulas.push(...formulas);
  });
  
  return allFormulas;
}

/**
 * Example 3: Using Enhanced Formula Panel
 */
export function EnhancedPanelExample() {
  const [formulas, setFormulas] = useState<FormulaRegion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recognizedFormulas, setRecognizedFormulas] = useState(new Map());
  
  // Build enhanced info map from formulas
  const enhancedInfo = new Map();
  formulas.forEach(f => {
    // If formula has enhanced fields, add them to the map
    if ('formulaType' in f || 'confidence' in f) {
      enhancedInfo.set(f.id, {
        formulaType: (f as any).formulaType,
        confidence: (f as any).confidence,
        confidenceLevel: (f as any).confidenceLevel,
      });
    }
  });
  
  return (
    <EnhancedFormulaPanel
      formulas={formulas}
      currentPage={0}
      selectedId={selectedId}
      hoveredId={null}
      recognizedFormulas={recognizedFormulas}
      enhancedInfo={enhancedInfo}
      onFormulaSelect={(f) => setSelectedId(f.id)}
      onFormulaHover={() => {}}
      onRecognize={() => {}}
      onRecognizeAll={() => {}}
      onCopy={() => {}}
      isCollapsed={false}
    />
  );
}

/**
 * Example 4: Configurable Detection
 */
export function ConfigurableDetectionExample() {
  const [config, setConfig] = useState({
    useAdvanced: true,
    minConfidence: 0.6,
    formulaType: 'both' as 'display' | 'inline' | 'both',
  });
  
  const detectWithConfig = async (pageImage: string, pageNumber: number) => {
    return await detectFormulasInPage(pageImage, pageNumber, {
      useAdvancedDetection: config.useAdvanced,
      minConfidence: config.minConfidence,
      formulaTypeFilter: config.formulaType === 'both' ? undefined : config.formulaType,
      enableCache: true,
      enableParallel: false,
    });
  };
  
  return (
    <div className="p-4 space-y-4">
      <h3 className="font-bold">Detection Settings</h3>
      
      {/* Advanced detection toggle */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.useAdvanced}
          onChange={(e) => setConfig({ ...config, useAdvanced: e.target.checked })}
        />
        Use Advanced Detection
      </label>
      
      {/* Confidence threshold */}
      <div>
        <label className="block mb-1">
          Confidence Threshold: {Math.round(config.minConfidence * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={config.minConfidence}
          onChange={(e) => setConfig({ ...config, minConfidence: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>
      
      {/* Formula type filter */}
      <div>
        <label className="block mb-1">Formula Type</label>
        <select
          value={config.formulaType}
          onChange={(e) => setConfig({ ...config, formulaType: e.target.value as any })}
          className="border rounded px-2 py-1"
        >
          <option value="both">Both</option>
          <option value="display">Display Only</option>
          <option value="inline">Inline Only</option>
        </select>
      </div>
      
      <button
        onClick={() => {
          // Use detectWithConfig here
          console.log('Detecting with config:', config);
        }}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Detect Formulas
      </button>
    </div>
  );
}

/**
 * Example 5: Error Handling with Fallback
 */
export async function errorHandlingExample(pageImage: string, pageNumber: number) {
  try {
    // Try advanced detection first
    const formulas = await detectFormulasInPage(pageImage, pageNumber, {
      useAdvancedDetection: true,
      minConfidence: 0.6,
      formulaTypeFilter: 'both',
      enableCache: true,
      enableParallel: false,
    });
    
    console.log('Advanced detection succeeded:', formulas.length);
    return formulas;
  } catch (error) {
    console.error('Advanced detection failed:', error);
    
    // Automatic fallback is built-in, but you can also manually fallback
    const formulas = await detectFormulasInPage(pageImage, pageNumber, {
      useAdvancedDetection: false, // Use basic detection
      minConfidence: 0.5,
      formulaTypeFilter: 'both',
      enableCache: true,
      enableParallel: false,
    });
    
    console.log('Fallback detection succeeded:', formulas.length);
    return formulas;
  }
}

/**
 * Example 6: Statistics and Monitoring
 */
export async function statisticsExample(pageImage: string, pageNumber: number) {
  const startTime = performance.now();
  
  const formulas = await detectFormulasInPage(pageImage, pageNumber);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Calculate statistics
  const stats = {
    totalFormulas: formulas.length,
    detectionTime: duration,
    averageTimePerFormula: formulas.length > 0 ? duration / formulas.length : 0,
  };
  
  console.log('Detection Statistics:', stats);
  
  // If using enhanced detection, you can also get confidence stats
  const confidenceStats = {
    high: formulas.filter(f => (f as any).confidenceLevel === 'high').length,
    medium: formulas.filter(f => (f as any).confidenceLevel === 'medium').length,
    low: formulas.filter(f => (f as any).confidenceLevel === 'low').length,
  };
  
  console.log('Confidence Distribution:', confidenceStats);
  
  return { formulas, stats, confidenceStats };
}

/**
 * Example 7: Complete PDF Viewer Integration
 */
export function CompletePDFViewerIntegration() {
  const [document, setDocument] = useState<any>(null);
  const [formulas, setFormulas] = useState<FormulaRegion[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  // Detect formulas when document is loaded
  useEffect(() => {
    if (!document) return;
    
    const detectAllFormulas = async () => {
      setLoading(true);
      
      try {
        const { detectFormulasInPages } = await import('./pdfIntegration');
        
        const results = await detectFormulasInPages(
          document.pageImages,
          {
            useAdvancedDetection: true,
            minConfidence: 0.6,
            formulaTypeFilter: 'both',
            enableCache: true,
            enableParallel: false,
          },
          (completed, total) => {
            setProgress({ current: completed, total });
          }
        );
        
        // Flatten results
        const allFormulas: FormulaRegion[] = [];
        results.forEach((pageFormulas) => {
          allFormulas.push(...pageFormulas);
        });
        
        setFormulas(allFormulas);
      } catch (error) {
        console.error('Formula detection failed:', error);
      } finally {
        setLoading(false);
      }
    };
    
    detectAllFormulas();
  }, [document]);
  
  return (
    <div className="h-full flex flex-col">
      {/* Progress indicator */}
      {loading && (
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-700">
              Detecting formulas... {progress.current}/{progress.total} pages
            </span>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className="flex-1 flex">
        {/* PDF viewer would go here */}
        <div className="flex-1 bg-gray-100">
          {/* ... */}
        </div>
        
        {/* Enhanced formula panel */}
        <EnhancedFormulaPanel
          formulas={formulas}
          currentPage={0}
          selectedId={null}
          hoveredId={null}
          recognizedFormulas={new Map()}
          enhancedInfo={new Map(
            formulas.map(f => [
              f.id,
              {
                formulaType: (f as any).formulaType,
                confidence: (f as any).confidence,
                confidenceLevel: (f as any).confidenceLevel,
              }
            ])
          )}
          onFormulaSelect={() => {}}
          onFormulaHover={() => {}}
          onRecognize={() => {}}
          onRecognizeAll={() => {}}
          onCopy={() => {}}
        />
      </div>
    </div>
  );
}

/**
 * Usage Instructions:
 * 
 * 1. Import the integration module:
 *    import { detectFormulasInPage } from './utils/advancedFormulaDetection/pdfIntegration';
 * 
 * 2. Replace basic detection calls:
 *    const formulas = await detectFormulasInPage(pageImage, pageNumber);
 * 
 * 3. Use EnhancedFormulaPanel instead of FormulaPanel:
 *    import { EnhancedFormulaPanel } from './components/EnhancedFormulaPanel';
 * 
 * 4. Pass enhanced info to the panel:
 *    <EnhancedFormulaPanel enhancedInfo={enhancedInfoMap} ... />
 * 
 * 5. Configure detection options as needed:
 *    const config = { useAdvancedDetection: true, minConfidence: 0.7, ... };
 * 
 * See PHASE2_INTEGRATION_GUIDE.md for detailed instructions.
 */
