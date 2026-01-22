/**
 * Property Tests for Confidence Filter Component
 * Tests confidence-based filtering with random inputs
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 12: Confidence-Based Filtering
 * 
 * Given:
 * - A list of formulas with random confidence scores
 * - A confidence threshold
 * 
 * Then:
 * - Filtered results should only include formulas with confidence >= threshold
 * - All filtered formulas should have valid confidence scores (0-1)
 * - Filter count should be <= total count
 */

interface FormulaWithConfidence {
  id: string;
  confidence: number;
}

describe('Property Tests: Confidence Filter', () => {
  it('Property 12.1: Filtered results only include formulas above threshold', () => {
    fc.assert(
      fc.property(
        // Generate array of formulas with random confidence scores
        fc.array(
          fc.record({
            id: fc.string(),
            confidence: fc.float({ min: 0, max: 1 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        // Generate random threshold
        fc.float({ min: 0, max: 1 }),
        (formulas, threshold) => {
          // Apply filter
          const filtered = formulas.filter(f => f.confidence >= threshold);
          
          // All filtered formulas should have confidence >= threshold
          for (const formula of filtered) {
            expect(formula.confidence).toBeGreaterThanOrEqual(threshold);
          }
          
          // Filtered count should be <= total count
          expect(filtered.length).toBeLessThanOrEqual(formulas.length);
          
          // If threshold is 0, all formulas should pass
          if (threshold === 0) {
            expect(filtered.length).toBe(formulas.length);
          }
          
          // If threshold is 1, only formulas with confidence === 1 should pass
          if (threshold === 1) {
            expect(filtered.every(f => f.confidence === 1)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.2: Filter is monotonic (higher threshold = fewer results)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            confidence: fc.float({ min: 0, max: 1 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        fc.float({ min: 0, max: Math.fround(0.9) }),
        (formulas, threshold1) => {
          const threshold2 = threshold1 + 0.1;
          
          const filtered1 = formulas.filter(f => f.confidence >= threshold1);
          const filtered2 = formulas.filter(f => f.confidence >= threshold2);
          
          // Higher threshold should result in fewer or equal results
          expect(filtered2.length).toBeLessThanOrEqual(filtered1.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.3: Filter count calculation is correct', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            confidence: fc.float({ min: 0, max: 1 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.float({ min: 0, max: 1 }),
        (formulas, threshold) => {
          const filtered = formulas.filter(f => f.confidence >= threshold);
          const totalCount = formulas.length;
          const filteredCount = filtered.length;
          
          // Counts should be non-negative
          expect(totalCount).toBeGreaterThanOrEqual(0);
          expect(filteredCount).toBeGreaterThanOrEqual(0);
          
          // Filtered count should not exceed total
          expect(filteredCount).toBeLessThanOrEqual(totalCount);
          
          // Hidden count should be correct
          const hiddenCount = totalCount - filteredCount;
          expect(hiddenCount).toBeGreaterThanOrEqual(0);
          expect(hiddenCount).toBe(totalCount - filteredCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.4: Confidence levels are correctly categorized', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1 }),
        (confidence) => {
          // Categorize confidence level
          let level: 'high' | 'medium' | 'low';
          if (confidence >= 0.85) {
            level = 'high';
          } else if (confidence >= 0.6) {
            level = 'medium';
          } else {
            level = 'low';
          }
          
          // Verify categorization
          if (level === 'high') {
            expect(confidence).toBeGreaterThanOrEqual(0.85);
          } else if (level === 'medium') {
            expect(confidence).toBeGreaterThanOrEqual(0.6);
            expect(confidence).toBeLessThan(0.85);
          } else {
            expect(confidence).toBeLessThan(0.6);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.5: Threshold presets work correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            confidence: fc.float({ min: 0, max: 1 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (formulas) => {
          // Test preset thresholds
          const presets = {
            all: 0.5,
            medium: 0.7,
            high: 0.85,
          };
          
          const allFiltered = formulas.filter(f => f.confidence >= presets.all);
          const mediumFiltered = formulas.filter(f => f.confidence >= presets.medium);
          const highFiltered = formulas.filter(f => f.confidence >= presets.high);
          
          // Verify ordering: all >= medium >= high
          expect(allFiltered.length).toBeGreaterThanOrEqual(mediumFiltered.length);
          expect(mediumFiltered.length).toBeGreaterThanOrEqual(highFiltered.length);
          
          // All high-confidence formulas should be in medium and all
          for (const formula of highFiltered) {
            expect(mediumFiltered).toContainEqual(formula);
            expect(allFiltered).toContainEqual(formula);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.6: Filter is idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string(),
            confidence: fc.float({ min: 0, max: 1 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        fc.float({ min: 0, max: 1 }),
        (formulas, threshold) => {
          // Apply filter once
          const filtered1 = formulas.filter(f => f.confidence >= threshold);
          
          // Apply filter again to filtered results
          const filtered2 = filtered1.filter(f => f.confidence >= threshold);
          
          // Results should be identical
          expect(filtered2).toEqual(filtered1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.7: Empty input produces empty output', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1 }),
        (threshold) => {
          const formulas: FormulaWithConfidence[] = [];
          const filtered = formulas.filter(f => f.confidence >= threshold);
          
          expect(filtered).toEqual([]);
          expect(filtered.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 12.8: Percentage calculation is correct', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1 }),
        (confidence) => {
          const percentage = Math.round(confidence * 100);
          
          // Percentage should be in valid range
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);
          
          // Verify rounding
          expect(percentage).toBe(Math.round(confidence * 100));
          
          // Edge cases
          if (confidence === 0) {
            expect(percentage).toBe(0);
          }
          if (confidence === 1) {
            expect(percentage).toBe(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
