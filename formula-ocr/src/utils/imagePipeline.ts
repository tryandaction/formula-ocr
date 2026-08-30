export type ImageValidationError =
  | 'invalid_input'
  | 'unsupported_mime'
  | 'invalid_dimensions'
  | 'empty_image'
  | 'too_large';

export interface ImageMetadata {
  mime: string;
  width: number;
  height: number;
  hasAlpha: boolean;
  alphaCoverage: number;
  orientation: number;
  byteLength: number;
}

export interface ImageValidationResult {
  valid: boolean;
  errorClass?: ImageValidationError;
  message?: string;
}

export type PreprocessingVariant = 'original' | 'upscale' | 'contrast' | 'grayscale' | 'binarized';

export interface PreprocessingSelection {
  preferred?: PreprocessingVariant;
  benchmarkApproved?: boolean;
}

export interface PreprocessingMetadata {
  variant: PreprocessingVariant;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  scale: number;
  padding: number;
  durationMs: number;
  failureReason?: string;
}

export function describePreprocessing(
  variant: PreprocessingVariant,
  input: { width: number; height: number },
  output: { width: number; height: number },
  durationMs: number,
  padding = 0,
  failureReason?: string,
): PreprocessingMetadata {
  return {
    variant,
    inputWidth: input.width,
    inputHeight: input.height,
    outputWidth: output.width,
    outputHeight: output.height,
    scale: input.width > 0 ? output.width / input.width : 1,
    padding,
    durationMs: Math.max(0, Math.round(durationMs)),
    ...(failureReason ? { failureReason } : {}),
  };
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropOptions {
  paddingRatio?: number;
  minPadding?: number;
}

const SUPPORTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 10 * 1024 * 1024;

export function validateImageReference(reference: string, metadata: ImageMetadata): ImageValidationResult {
  if (!reference || !reference.startsWith('data:')) {
    return { valid: false, errorClass: 'invalid_input', message: '图片数据为空或不是 data URL' };
  }
  const referenceMime = reference.match(/^data:([^;,]+)[;,]/)?.[1];
  const mime = (referenceMime || metadata.mime).split(';', 1)[0].toLowerCase();
  if (!SUPPORTED_MIME.has(mime)) {
    return { valid: false, errorClass: 'unsupported_mime', message: `不支持的图片类型: ${mime}` };
  }
  if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height) || metadata.width <= 0 || metadata.height <= 0) {
    return { valid: false, errorClass: 'invalid_dimensions', message: '图片尺寸无效' };
  }
  if (!Number.isFinite(metadata.byteLength) || metadata.byteLength <= 0) {
    return { valid: false, errorClass: 'empty_image', message: '图片没有可读取的像素数据' };
  }
  if (metadata.byteLength > MAX_BYTES) {
    return { valid: false, errorClass: 'too_large', message: '图片超过 10MB 限制' };
  }
  return { valid: true };
}

export function choosePreprocessingVariant(selection: PreprocessingSelection): PreprocessingVariant {
  if (selection.benchmarkApproved && selection.preferred) return selection.preferred;
  return 'original';
}

export function calculateCropBox(box: CropBox, pageWidth: number, pageHeight: number, options: CropOptions = {}): CropBox {
  const paddingRatio = Math.max(0, options.paddingRatio ?? 0.12);
  const minPadding = Math.max(0, options.minPadding ?? 4);
  const padding = Math.max(minPadding, Math.round(Math.max(box.width, box.height) * paddingRatio));
  const left = Math.max(0, Math.floor(box.x - padding));
  const top = Math.max(0, Math.floor(box.y - padding));
  const right = Math.min(pageWidth, Math.ceil(box.x + box.width + padding));
  const bottom = Math.min(pageHeight, Math.ceil(box.y + box.height + padding));
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function mapPagePixelToPdf(point: { x: number; y: number }, page: { width: number; height: number }, pdf: { width: number; height: number }): { x: number; y: number } {
  return {
    x: point.x * pdf.width / page.width,
    y: point.y * pdf.height / page.height,
  };
}

export function mapPdfToPagePixel(point: { x: number; y: number }, page: { width: number; height: number }, pdf: { width: number; height: number }): { x: number; y: number } {
  return {
    x: point.x * page.width / pdf.width,
    y: point.y * page.height / pdf.height,
  };
}
