// Thin wrapper over ssim.js so test files don't depend on the package's
// import shape directly. Returns the mean SSIM (0..1; higher = more
// similar). Visual-equivalence tests assert score >= 0.98 per
// Phase 3 decision (D-RA-16; tolerance chosen 2026-05-25).
//
// Both inputs must decode through the same format. jsquash-codecs.decode
// is the uniform path to a {data, width, height} shape.

import { ssim as ssimJs } from 'ssim.js';

import { decode, type Format } from '../../../src/compose/jsquash-codecs.js';

export async function ssim(
  a: Uint8Array,
  b: Uint8Array,
  format: Format = 'png',
): Promise<number> {
  const A = await decode(format, a);
  const B = await decode(format, b);

  // ssim.js accepts a structurally-compatible ImageData: {data, width, height}.
  // It does NOT require equal dimensions, but our use cases (resize-then-compare,
  // equivalence-vs-reference) always pre-match dimensions; we assert here.
  if (A.width !== B.width || A.height !== B.height) {
    throw new Error(
      `ssim: dimension mismatch (${A.width}x${A.height} vs ${B.width}x${B.height})`,
    );
  }

  const result = ssimJs(
    { data: A.data, width: A.width, height: A.height } as unknown as ImageData,
    { data: B.data, width: B.width, height: B.height } as unknown as ImageData,
  );
  return result.mssim;
}
