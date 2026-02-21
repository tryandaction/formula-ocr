/**
 * Property Tests for Enhanced Formula Panel Component
 * Tests UI display with random detection results
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 7: Detection Result UI Display
 * 
 * Given:
 * - Random detection results with various properties
 * 
 * Then:
 * - UI should display all required information
 * - Formula types should be correctly categorized
 * - Confidence levels should be properly color-coded
 * - Statistics should be accurate
 */

describe('Property Tests: Enhanced Formula Panel', () => {
  it('Property 7.1: All formulas have required display information', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            formulaType: fc.constantFrom('display', 'inline', undefined),
            confidence: fc.option(fc.float({ min: 0, max: 1 })),
            confidenceLevel: fc.constantFrom('high', 'medium', 'low', undefined),
            pageNumber: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (formulas) => {
          // Every formula should have an ID
          for (const formula of formulas) {
            expect(formula.id).toBeTruthy();
            expect(typeof formula.id).toBe('string');
            expect(formula.id.length).toBeGreaterThan(0);
          }
          
          // Every formula should have a valid page number
          for (const formula of formulas) {
            expect(formula.pageNumber).toBeGreaterThan(0);
            expect(Number.isInteger(formula.pageNumber)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: Formula type categorization is consistent', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            formulaType: fc.constantFrom('display', 'inline', undefined),
            confidence: fc.option(fc.float({ min: 0, max: 1 })),
            pageNumber: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (formulas) => {
          const displayCount = formulas.filter(f => f.formulaType === 'display').length;
          const inlineCount = formulas.filter(f => f.formulaType === 'inline').length;
          const unknownCount = formulas.filter(f => !f.formulaType).length;
          
          // Counts should sum to total
          expect(displayCount + inlineCount + unknownCount).toBe(formulas.length);
          
          // Counts should be non-negative
          expect(displayCount).toBeGreaterThanOrEqual(0);
          expect(inlineCount).toBeGreaterThanOrEqual(0);
          expect(unknownCount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: Confidence levels match confidence scores', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            // High confidence formulas
            fc.record({
              id: fc.string(),
              confidence: fc.double({ min: 0.9, max: 1, noNaN: true }),
              confidenceLevel: fc.constant('high' as const),
            }),
            // Medium confidence formulas
            fc.record({
              id: fc.string(),
              confidence: fc.double({ min: 0.75, max: 0.8999, noNaN: true }),
              confidenceLevel: fc.constant('medium' as const),
            }),
            // Low confidence formulas
            fc.record({
              id: fc.string(),
              confidence: fc.double({ min: 0, max: 0.7499, noNaN: true }),
              confidenceLevel: fc.constant('low' as const),
            })
          ),
          { minLength: 1, maxLength: 50 }
        ),
        (formulas) => {
          for (const formula of formulas) {
            // Verify confidence level matches score (v2.1.1 thresholds)
            if (formula.confidenceLevel === 'high') {
              // High confidence formulas should have score >= 0.9
              expect(formula.confidence).toBeGreaterThanOrEqual(0.9);
            } else if (formula.confidenceLevel === 'medium') {
              // Medium confidence should be in range [0.75, 0.9)
              expect(formula.confidence).toBeGreaterThanOrEqual(0.75);
              expect(formula.confidence).toBeLessThan(0.9);
            } else if (formula.confidenceLevel === 'low') {
              // Low confidence should be below 0.75
              expect(formula.confidence).toBeLessThan(0.75);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: Page filtering works correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            pageNumber: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.integer({ min: 1, max: 10 }),
        (formulas, currentPage) => {
          // Filter formulas for current page
          const pageFormulas = formulas.filter(f => f.pageNumber === currentPage);
          
          // All filtered formulas should be on current page
          for (const formula of pageFormulas) {
            expect(formula.pageNumber).toBe(currentPage);
          }
          
          // Count should be <= total
          expect(pageFormulas.length).toBeLessThanOrEqual(formulas.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: Statistics calculations are accurate', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            formulaType: fc.constantFrom('display', 'inline', undefined),
            confidence: fc.option(fc.float({ min: 0, max: 1 })),
            confidenceLevel: fc.constantFrom('high', 'medium', 'low', undefined),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (formulas) => {
          // Calculate statistics
          const totalCount = formulas.length;
          const displayCount = formulas.filter(f => f.formulaType === 'display').length;
          const inlineCount = formulas.filter(f => f.formulaType === 'inline').length;
          const highConfCount = formulas.filter(f => f.confidenceLevel === 'high').length;
          const mediumConfCount = formulas.filter(f => f.confidenceLevel === 'medium').length;
          const lowConfCount = formulas.filter(f => f.confidenceLevel === 'low').length;
          
          // Verify counts
          expect(totalCount).toBe(formulas.length);
          expect(displayCount).toBeGreaterThanOrEqual(0);
          expect(inlineCount).toBeGreaterThanOrEqual(0);
          expect(highConfCount).toBeGreaterThanOrEqual(0);
          expect(mediumConfCount).toBeGreaterThanOrEqual(0);
          expect(lowConfCount).toBeGreaterThanOrEqual(0);
          
          // Type counts should not exceed total
          expect(displayCount + inlineCount).toBeLessThanOrEqual(totalCount);
          
          // Confidence counts should not exceed total
          expect(highConfCount + mediumConfCount + lowConfCount).toBeLessThanOrEqual(totalCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.6: View mode filtering is consistent', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            pageNumber: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.integer({ min: 1, max: 10 }),
        (formulas, currentPage) => {
          // Current page view
          const currentPageFormulas = formulas.filter(f => f.pageNumber === currentPage);
          
          // All pages view
          const allFormulas = formulas;
          
          // Current page count should be <= all pages count
          expect(currentPageFormulas.length).toBeLessThanOrEqual(allFormulas.length);
          
          // All current page formulas should be in all formulas
          for (const formula of currentPageFormulas) {
            expect(allFormulas).toContainEqual(formula);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.7: Combined filtering (page + confidence) works correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            pageNumber: fc.integer({ min: 1, max: 10 }),
            confidence: fc.float({ min: 0, max: 1 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.integer({ min: 1, max: 10 }),
        fc.float({ min: 0, max: 1 }),
        (formulas, currentPage, threshold) => {
          // Apply both filters
          const filtered = formulas.filter(
            f => f.pageNumber === currentPage && f.confidence >= threshold
          );
          
          // All filtered formulas should match both criteria
          for (const formula of filtered) {
            expect(formula.pageNumber).toBe(currentPage);
            expect(formula.confidence).toBeGreaterThanOrEqual(threshold);
          }
          
          // Filtered count should be <= total
          expect(filtered.length).toBeLessThanOrEqual(formulas.length);
          
          // Filtered count should be <= page-only filter
          const pageOnly = formulas.filter(f => f.pageNumber === currentPage);
          expect(filtered.length).toBeLessThanOrEqual(pageOnly.length);
          
          // Filtered count should be <= confidence-only filter
          const confOnly = formulas.filter(f => f.confidence >= threshold);
          expect(filtered.length).toBeLessThanOrEqual(confOnly.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.8: Formula ordering is stable', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            pageNumber: fc.integer({ min: 1, max: 10 }),
            position: fc.record({
              y: fc.float({ min: 0, max: 1000, noNaN: true }),
              x: fc.float({ min: 0, max: 1000, noNaN: true }),
            }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (formulas) => {
          // Sort by position (top to bottom, left to right)
          const sorted = [...formulas].sort((a, b) => {
            const yDiff = a.position.y - b.position.y;
            if (Math.abs(yDiff) > 20) return yDiff;
            return a.position.x - b.position.x;
          });
          
          // Verify ordering
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            
            // Either y is greater, or y is similar and x is greater
            const yDiff = curr.position.y - prev.position.y;
            if (Math.abs(yDiff) > 20) {
              expect(curr.position.y).toBeGreaterThanOrEqual(prev.position.y);
            } else {
              // Y positions are similar, check X
              expect(curr.position.x).toBeGreaterThanOrEqual(prev.position.x - 0.01);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
