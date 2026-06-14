// Uniform codec wrappers over jSquash for JPEG / PNG / WebP / AVIF.
// Used by the facade for format conversion and for fixing Photon's
// JPEG-output-size quirk (encode-after-resize path).
//
// jSquash's surface uses the browser `ImageData` global, which is not
// defined in Node 22+ by default. We expose a structural type and
// duck-type through the jSquash API at runtime (which only reads
// .data / .width / .height).
//
// Refs: D-RA-16

// Note: explicit `.js` suffix is required for Node's strict ESM
// resolution. The jSquash packages publish subpath modules without an
// `exports` field, so without the suffix Node fails with
// ERR_MODULE_NOT_FOUND at runtime. Vitest and the TS compiler are
// looser and accept the bare path; we honor the strict shape.
import jpegDecode from '@jsquash/jpeg/decode.js';
import jpegEncode from '@jsquash/jpeg/encode.js';
import pngDecode from '@jsquash/png/decode.js';
import pngEncode from '@jsquash/png/encode.js';
import webpDecode from '@jsquash/webp/decode.js';
import webpEncode from '@jsquash/webp/encode.js';
import avifDecode from '@jsquash/avif/decode.js';
import avifEncode from '@jsquash/avif/encode.js';

import { ensureComposeWasm } from './compose-wasm.js';

export type Format = 'jpeg' | 'png' | 'webp' | 'avif';

// Structural shape compatible with browser ImageData. jSquash reads
// these three fields only — we don't need a real ImageData instance.
export type DecodedImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

// Codec-agnostic quality knob. Codec-specific clamping happens in encode().
// Range: 1-100 where higher = better quality / larger file.
export type CodecOpts = {
  quality?: number;
};

/**
 * Decode encoded image bytes to RGBA pixel data.
 *
 * Throws PipelineError-style 'invalid_input' if the bytes can't be
 * decoded — most commonly when the format hint doesn't match the
 * actual bytes (e.g., passing PNG bytes with format='jpeg').
 */
export async function decode(format: Format, input: Uint8Array): Promise<DecodedImage> {
  await ensureComposeWasm();
  // jSquash takes ArrayBuffer; Uint8Array's underlying buffer may be
  // a slice of a larger buffer, so copy when byteOffset != 0.
  const ab = input.byteOffset === 0 && input.byteLength === input.buffer.byteLength
    ? (input.buffer as ArrayBuffer)
    : input.slice().buffer as ArrayBuffer;

  let raw: { data: Uint8ClampedArray; width: number; height: number } | null;
  switch (format) {
    case 'jpeg':
      raw = await jpegDecode(ab);
      break;
    case 'png':
      raw = await pngDecode(ab);
      break;
    case 'webp':
      raw = await webpDecode(ab);
      break;
    case 'avif':
      raw = await avifDecode(ab);
      break;
  }
  if (!raw) {
    throw new Error(`jsquash-codecs: decode failed for format=${format} (codec returned null)`);
  }
  return { data: raw.data, width: raw.width, height: raw.height };
}

/**
 * Encode RGBA pixel data to the given format.
 *
 * @param opts.quality 1-100; codec-specific mapping inside (e.g.,
 *   jSquash's JPEG quality maps directly; WebP uses 0-100; AVIF uses
 *   0-63 cq_level which we invert).
 */
export async function encode(
  format: Format,
  raw: DecodedImage,
  opts?: CodecOpts,
): Promise<Uint8Array> {
  await ensureComposeWasm();
  // jSquash's encode signatures take `ImageData`; we pass a duck-typed
  // object since jSquash only reads .data/.width/.height. Cast through
  // `unknown` to satisfy TS without depending on a DOM lib at compile time.
  const imageData = {
    data: raw.data,
    width: raw.width,
    height: raw.height,
  } as unknown as ImageData;

  let buf: ArrayBuffer;
  switch (format) {
    case 'jpeg': {
      const quality = opts?.quality ?? 75;
      buf = await jpegEncode(imageData, { quality });
      break;
    }
    case 'png': {
      // PNG encode in jSquash has no `quality` knob (lossless); we accept
      // and ignore the option for API uniformity.
      buf = await pngEncode(imageData);
      break;
    }
    case 'webp': {
      const quality = opts?.quality ?? 75;
      buf = await webpEncode(imageData, { quality });
      break;
    }
    case 'avif': {
      // AVIF in jSquash takes a 0-100 quality knob directly (mapped to
      // AOM's internal cq_level inside the codec). Higher = better.
      const quality = opts?.quality ?? 50;
      buf = await avifEncode(imageData, { quality });
      break;
    }
  }
  return new Uint8Array(buf);
}

/**
 * Convenience: decode + re-encode in one call. Used by the facade to
 * fix Photon's JPEG-output-size quirk (Photon outputs PNG; we re-encode
 * to JPEG for size control) and for general format conversion.
 */
export async function convert(
  input: Uint8Array,
  from: Format,
  to: Format,
  opts?: CodecOpts,
): Promise<Uint8Array> {
  // decode + encode each ensure transitively; called here for directness.
  await ensureComposeWasm();
  const decoded = await decode(from, input);
  return encode(to, decoded, opts);
}
