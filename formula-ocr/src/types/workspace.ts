import type { ProviderType } from '../utils/providers';

export type SourceKind = 'image' | 'pdf' | 'docx' | 'markdown';
export const sourceBadge = (kind: SourceKind): string => ({ image: 'IMG', pdf: 'PDF', docx: 'OMML', markdown: 'MD' })[kind];
export type FormulaStatus = 'queued' | 'recognizing' | 'success' | 'needs_review' | 'no_formula' | 'failed' | 'cancelled';

export interface FormulaItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceKind: SourceKind;
  image?: string;
  mime?: string;
  pageNumber?: number;
  position?: { x: number; y: number; width: number; height: number };
  latex: string;
  originalLatex?: string;
  status: FormulaStatus;
  provider?: ProviderType;
  confidence?: number;
  uncertainties: string[];
  processingTime?: number;
  errorClass?: string;
  error?: string;
  userEdited?: boolean;
  selected: boolean;
}

export interface SourceTask {
  id: string;
  name: string;
  kind: SourceKind;
  status: 'queued' | 'parsing' | 'detecting' | 'ready' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  formulaCount: number;
  warnings: string[];
  pageImages?: string[];
}
