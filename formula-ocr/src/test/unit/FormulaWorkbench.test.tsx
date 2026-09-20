import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormulaWorkbench } from '../../components/FormulaWorkbench';
import { sourceBadge } from '../../types/workspace';

describe('FormulaWorkbench', () => {
  it('labels formula sources without presenting PDF text as OMML', () => {
    expect(['pdf', 'docx', 'markdown', 'image'].map(source => sourceBadge(source as 'pdf' | 'docx' | 'markdown' | 'image'))).toEqual(['PDF', 'OMML', 'MD', 'IMG']);
  });

  it('provides an accessible name for the result status filter', () => {
    render(<FormulaWorkbench provider="openai" formulaType="auto" onFormulaTypeChange={() => {}} onOpenProvider={() => {}} />);
    expect(screen.getByLabelText('结果筛选')).toBeTruthy();
  });

  it('imports Markdown source formulas into editable selected results without OCR', async () => {
    const { container } = render(<FormulaWorkbench provider="openai" formulaType="auto" onFormulaTypeChange={() => {}} onOpenProvider={() => {}} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['正文 $x^2+y^2=z^2$'], 'paper.md', { type: 'text/markdown' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('识别成功')).toBeTruthy());
    expect((screen.getByLabelText('LaTeX 编辑器') as HTMLTextAreaElement).value).toBe('x^2+y^2=z^2');
    expect((screen.getByLabelText('选择公式') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText('识别中')).toBeNull();
  });

  it('shows an unsupported file as a file-level failure', async () => {
    const { container } = render(<FormulaWorkbench provider="openai" formulaType="auto" onFormulaTypeChange={() => {}} onOpenProvider={() => {}} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.csv', { type: 'text/csv' })] } });
    await waitFor(() => expect(screen.getByText(/不支持的文件格式/)).toBeTruthy());
  });

  it('continues accepting files after the StrictMode effect probe', async () => {
    const { container } = render(<StrictMode><FormulaWorkbench provider="openai" formulaType="auto" onFormulaTypeChange={() => {}} onOpenProvider={() => {}} /></StrictMode>);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['$E=mc^2$'], 'strict.md', { type: 'text/markdown' })] } });
    await waitFor(() => expect((screen.getByLabelText('LaTeX 编辑器') as HTMLTextAreaElement).value).toBe('E=mc^2'));
  });

  it('bounds the initial result DOM and reveals additional formulas on demand', async () => {
    const { container } = render(<FormulaWorkbench provider="openai" formulaType="auto" onFormulaTypeChange={() => {}} onOpenProvider={() => {}} />);
    const formulas = Array.from({ length: 75 }, (_, index) => `$x_${index}=${index}$`).join('\n');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([formulas], 'many.md', { type: 'text/markdown' })] } });

    await waitFor(() => expect(screen.getByText(/75 条/)).toBeTruthy());
    expect(screen.getAllByLabelText('LaTeX 编辑器')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: '显示其余 55 条' }));
    expect(screen.getAllByLabelText('LaTeX 编辑器')).toHaveLength(75);
  }, 15_000);
});
