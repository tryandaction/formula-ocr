import { describe, expect, it } from 'vitest';
import {
  validateImageReference,
  choosePreprocessingVariant,
  calculateCropBox,
  mapPagePixelToPdf,
  mapPdfToPagePixel,
  describePreprocessing,
  type ImageMetadata,
} from '../../utils/imagePipeline';

describe('image input and coordinate pipeline', () => {
  const metadata: ImageMetadata = {
    mime: 'image/png',
    width: 800,
    height: 600,
    hasAlpha: false,
    alphaCoverage: 0,
    orientation: 1,
    byteLength: 1000,
  };

  it('classifies invalid MIME, dimensions, and empty inputs without reading image content', () => {
    expect(validateImageReference('', metadata)).toMatchObject({ valid: false, errorClass: 'invalid_input' });
    expect(validateImageReference('data:text/plain;base64,AAAA', metadata)).toMatchObject({ valid: false, errorClass: 'unsupported_mime' });
    expect(validateImageReference('data:image/png;base64,AAAA', { ...metadata, width: 0 })).toMatchObject({ valid: false, errorClass: 'invalid_dimensions' });
    expect(validateImageReference('data:image/png;base64,AAAA', { ...metadata, width: 100, height: 100, byteLength: 0 })).toMatchObject({ valid: false, errorClass: 'empty_image' });
  });

  it('uses original pixels by default until a benchmark selects a derived variant', () => {
    expect(choosePreprocessingVariant({})).toBe('original');
    expect(choosePreprocessingVariant({ preferred: 'upscale', benchmarkApproved: false })).toBe('original');
    expect(choosePreprocessingVariant({ preferred: 'upscale', benchmarkApproved: true })).toBe('upscale');
  });

  it('records only reproducible preprocessing metadata', () => {
    expect(describePreprocessing('upscale', { width: 100, height: 50 }, { width: 200, height: 100 }, 2.7, 8)).toEqual({
      variant: 'upscale', inputWidth: 100, inputHeight: 50, outputWidth: 200, outputHeight: 100,
      scale: 2, padding: 8, durationMs: 3,
    });
  });

  it('pads a crop while keeping it inside the page and preserving structure margins', () => {
    expect(calculateCropBox({ x: 2, y: 3, width: 20, height: 10 }, 100, 80, { paddingRatio: 0.2, minPadding: 4 })).toEqual({
      x: 0, y: 0, width: 26, height: 17,
    });
    expect(calculateCropBox({ x: 90, y: 70, width: 20, height: 20 }, 100, 80, { paddingRatio: 0.2, minPadding: 4 })).toEqual({
      x: 86, y: 66, width: 14, height: 14,
    });
  });

  it('maps page pixels to PDF points and back without drift', () => {
    const page = { width: 1200, height: 1600 };
    const pdf = { width: 600, height: 800 };
    const point = { x: 333, y: 777 };
    const mapped = mapPagePixelToPdf(point, page, pdf);
    expect(mapped).toEqual({ x: 166.5, y: 388.5 });
    expect(mapPdfToPagePixel(mapped, page, pdf)).toEqual(point);
  });
});
