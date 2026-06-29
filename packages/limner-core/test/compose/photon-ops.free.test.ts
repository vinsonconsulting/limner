import { describe, expect, test, vi } from 'vitest';

// M2 (release review): every photon-ops wrapper must free its WASM-allocated
// PhotonImage(s) even when the op throws (out-of-bounds crop, undecodable
// bytes), or the decoded image buffer leaks and accumulates toward the 128 MB
// isolate cap. We mock @cf-wasm/photon so the op functions throw mid-way and
// assert .free() still runs (the try/finally). This file mocks the module, so
// it is kept separate from photon-ops.test.ts which exercises the real WASM.

const freeSpy = vi.fn();

vi.mock('@cf-wasm/photon', () => {
  class PhotonImage {
    free = freeSpy;
    get_bytes(): Uint8Array {
      return new Uint8Array([1]);
    }
    static new_from_byteslice(): PhotonImage {
      return new PhotonImage();
    }
  }
  const boom = () => {
    throw new Error('photon boom');
  };
  return {
    PhotonImage,
    SamplingFilter: { Lanczos3: 0 },
    resize: boom,
    crop: boom,
    adjust_brightness: boom,
    adjust_contrast: boom,
    gaussian_blur: boom,
    sharpen: boom,
    watermark: boom,
  };
});

const { resize, crop, brightness, contrast, blur, sharpen, watermark } = await import(
  '../../src/compose/photon-ops.js'
);

const bytes = new Uint8Array([1, 2, 3]);

describe('photon-ops free WASM allocations on throw (M2)', () => {
  test.each([
    ['resize', () => resize(bytes, 10, 10)],
    ['crop', () => crop(bytes, 0, 0, 10, 10)],
    ['brightness', () => brightness(bytes, 10)],
    ['contrast', () => contrast(bytes, 1.2)],
    ['blur', () => blur(bytes, 2)],
    ['sharpen', () => sharpen(bytes)],
  ])('%s frees its image when the op throws', (_name, call) => {
    freeSpy.mockClear();
    expect(call).toThrow('photon boom');
    expect(freeSpy).toHaveBeenCalled();
  });

  test('watermark frees BOTH images when the op throws', () => {
    freeSpy.mockClear();
    expect(() => watermark(bytes, bytes, 8, 8)).toThrow('photon boom');
    // base + overlay both allocated before the throw -> both freed.
    expect(freeSpy).toHaveBeenCalledTimes(2);
  });
});
