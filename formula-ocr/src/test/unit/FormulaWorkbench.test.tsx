import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormulaWorkbench } from '../../components/FormulaWorkbench';

describe('FormulaWorkbench', () => {
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
});
