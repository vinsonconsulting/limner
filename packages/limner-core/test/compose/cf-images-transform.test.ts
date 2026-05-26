import { describe, expect, test, vi } from 'vitest';

import {
  transform,
  overlay,
  blur,
  smartCrop,
  backgroundFill,
  type CFImagesBinding,
  type CFImagesTransformOptions,
} from '../../src/compose/cf-images-transform.js';

// Builds a typed mock binding that captures input bytes, transform
// opts, and output format, then returns the given bytes (or an error
// Response when ok=false).
function mockBinding(responseBytes: Uint8Array, ok = true): {
  binding: CFImagesBinding;
  spies: {
    input: ReturnType<typeof vi.fn>;
    transform: ReturnType<typeof vi.fn>;
    output: ReturnType<typeof vi.fn>;
  };
} {
  const output = vi.fn().mockResolvedValue(
    ok
      ? new Response(responseBytes, { status: 200 })
      : new Response('upstream-err', { status: 500, statusText: 'Internal Server Error' }),
  );
  const transformFn = vi.fn().mockReturnValue({ output });
  const inputFn = vi.fn().mockReturnValue({ transform: transformFn });
  return {
    binding: { input: inputFn } as unknown as CFImagesBinding,
    spies: { input: inputFn, transform: transformFn, output },
  };
}

describe('compose/cf-images-transform.transform', () => {
  test('passes input, opts, and output format through the binding chain', async () => {
    const expected = new Uint8Array([1, 2, 3, 4]);
    const { binding, spies } = mockBinding(expected);
    const input = new Uint8Array([99]);
    const opts: CFImagesTransformOptions = { blur: 10, width: 200, height: 200 };

    const out = await transform(binding, input, opts, 'image/jpeg');

    expect(out).toEqual(expected);
    expect(spies.input).toHaveBeenCalledExactlyOnceWith(input);
    expect(spies.transform).toHaveBeenCalledExactlyOnceWith(opts);
    expect(spies.output).toHaveBeenCalledExactlyOnceWith({ format: 'image/jpeg' });
  });

  test('defaults output format to image/png', async () => {
    const { binding, spies } = mockBinding(new Uint8Array([0]));
    await transform(binding, new Uint8Array([0]), { blur: 5 });
    expect(spies.output).toHaveBeenCalledExactlyOnceWith({ format: 'image/png' });
  });

  test('non-ok binding response throws with status detail', async () => {
    const { binding } = mockBinding(new Uint8Array(), false);
    await expect(transform(binding, new Uint8Array([0]), { blur: 5 })).rejects.toThrow(
      /HTTP 500 Internal Server Error/,
    );
  });
});

describe('compose/cf-images-transform convenience wrappers', () => {
  test('overlay places the byte payload at (top, left)', async () => {
    const { binding, spies } = mockBinding(new Uint8Array([7]));
    const base = new Uint8Array([1]);
    const overlayBytes = new Uint8Array([2]);
    await overlay(binding, base, overlayBytes, 24, 32);

    expect(spies.input).toHaveBeenCalledExactlyOnceWith(base);
    expect(spies.transform).toHaveBeenCalledExactlyOnceWith({
      draw: [{ bytes: overlayBytes, top: 24, left: 32 }],
    });
  });

  test('blur forwards the radius', async () => {
    const { binding, spies } = mockBinding(new Uint8Array([7]));
    await blur(binding, new Uint8Array([1]), 50);
    expect(spies.transform).toHaveBeenCalledExactlyOnceWith({ blur: 50 });
  });

  test('smartCrop sets width/height with fit=crop', async () => {
    const { binding, spies } = mockBinding(new Uint8Array([7]));
    await smartCrop(binding, new Uint8Array([1]), 256, 256);
    expect(spies.transform).toHaveBeenCalledExactlyOnceWith({
      width: 256,
      height: 256,
      fit: 'crop',
    });
  });

  test('backgroundFill sets fit=pad + background color', async () => {
    const { binding, spies } = mockBinding(new Uint8Array([7]));
    await backgroundFill(binding, new Uint8Array([1]), 512, 384, '#fff');
    expect(spies.transform).toHaveBeenCalledExactlyOnceWith({
      width: 512,
      height: 384,
      fit: 'pad',
      background: '#fff',
    });
  });
});
