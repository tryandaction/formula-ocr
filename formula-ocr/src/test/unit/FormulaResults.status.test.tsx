import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormulaResults } from '../../components/FormulaResults';

describe('FormulaResults status visibility', () => {
  it('shows failed OCR state and source metadata instead of hiding the result', () => {
    render(<FormulaResults
      images={[{
        id: 'pdf-2-1',
        base64: 'data:image/png;base64,AAAA',
        status: 'error',
        error: '网络不可用',
        fileName: 'lesson.pdf 第2页',
        source: 'lesson.pdf',
        pageNumber: 2,
        position: { x: 10, y: 20, width: 30, height: 40 },
        ocrStatus: 'failed',
        provider: 'backend',
        processingTime: 1200,
      }]}
      onLatexChange={() => {}}
      onRemove={() => {}}
      onClearAll={() => {}}
    />);
    expect(screen.getByText(/网络不可用/)).toBeTruthy();
    expect(screen.getByText(/第2页/)).toBeTruthy();
    expect(screen.getByText(/backend/)).toBeTruthy();
  });
});
