/**
 * Vitest Setup File
 * 测试环境设置
 */

import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Extend expect matchers if needed
// expect.extend({
//   // Custom matchers
// });

// Mock canvas if needed for image processing tests
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function() {
    return {
      fillStyle: '',
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
      putImageData: () => {},
      createImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    } as unknown as CanvasRenderingContext2D;
  };

  HTMLCanvasElement.prototype.toDataURL = function() {
    // 1x1 transparent PNG
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' +
      'CAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAGgwJ/l2f1JwAAAABJRU5ErkJggg==';
  };
}

// Mock Image for predictable onload in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Image = class {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 100;
  height = 100;
  private _src = '';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    if (!value) {
      this.onerror?.();
      return;
    }
    // Simulate async image decode
    setTimeout(() => this.onload?.(), 0);
  }
} as unknown as typeof Image;

// Mock ImageData if needed
if (typeof ImageData === 'undefined') {
  global.ImageData = class {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height || dataOrWidth.length / (widthOrHeight * 4);
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      }
    }
  } as unknown as typeof ImageData;
}
