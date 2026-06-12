import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compose } from '../../src/compose/index.js';
import { initJsquashForNode } from './helpers/jsquash-init.js';
import { ssim } from './helpers/ssim.js';

// Visual-equivalence tests vs the Python legacy (a local limner-pixel-legacy
// checkout). Three cases — the rasa-relevant
// ops with legacy precedent per the Step 0 inventory:
//   1. crop          (vs scripts/crop_master.py:81)
//   2. composite     (vs cma/image_utils.py::compose_on_canvas:149)
//   3. format-convert (vs PIL.Image.save format=)
//
// Tolerance: SSIM ≥ 0.98 (project-wide decision 2026-05-25; D-RA-16).
//
// Fixtures generated via the legacy checkout's venv:
//   <limner-pixel-legacy>/.venv/bin/python3
//   ...running the inline script committed in this commit's message.
// Regenerate by re-running that script if the legacy semantics shift.

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, 'fixtures', 'legacy-equivalence');
const fix = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(resolve(FIXTURES, name)));

const SSIM_THRESHOLD = 0.98;

beforeAll(async () => {
  await initJsquashForNode();
}, 60_000);

describe('legacy-equivalence: crop (vs scripts/crop_master.py)', () => {
  test('rect crop (32,32 size 128x128) matches Python within SSIM ≥ 0.98', async () => {
    const out = compose.crop(fix('crop-master-source.png'), 32, 32, 128, 128);
    const score = await ssim(out, fix('crop-master-expected.png'));
    expect(score).toBeGreaterThanOrEqual(SSIM_THRESHOLD);
  });
});

describe('legacy-equivalence: composite (vs cma/image_utils.py::compose_on_canvas)', () => {
  test('two-layer composite (overlay at 32,32) matches Python within SSIM ≥ 0.98', async () => {
    const out = compose.watermark(
      fix('composite-source-base.png'),
      fix('composite-source-overlay.png'),
      32,
      32,
    );
    const score = await ssim(out, fix('composite-expected.png'));
    expect(score).toBeGreaterThanOrEqual(SSIM_THRESHOLD);
  });
});

describe('legacy-equivalence: format conversion (vs PIL.Image.save format=)', () => {
  test('PNG -> JPEG -> PNG round-trip retains SSIM ≥ 0.98 vs source', async () => {
    // JPEG is lossy; the round-trip is the legacy operation equivalent
    // (PIL also lossily encodes JPEG with quality=90 by default in the
    // legacy code paths that touch .save('foo.jpg', quality=90)).
    const source = fix('crop-master-source.png');
    const asJpeg = await compose.convert(source, 'png', 'jpeg', { quality: 90 });
    const backToPng = await compose.convert(asJpeg, 'jpeg', 'png');
    const score = await ssim(source, backToPng);
    expect(score).toBeGreaterThanOrEqual(SSIM_THRESHOLD);
  });
});

// Known-skip ops surfaced explicitly so future ports can flip them to
// test(). Each cites the D-RA category that justifies the skip.
describe.skip('legacy-equivalence: KNOWN-SKIP per D-RA-16 / D-RA-17', () => {
  test.skip('animation: GIF / WebP-animated / APNG frame manipulation (D-RA-16 cat. a)', () => {
    // Not exercised in the Python legacy; no rasa caller. Pixel-fork may
    // re-evaluate if Containers off-ramp opens (D-RA-02).
  });
  test.skip('libvips-parity: wavelet / vector field / advanced filters (D-RA-16 cat. b)', () => {
    // Not exercised. Containers off-ramp candidate per D-RA-02 if user
    // demand surfaces.
  });
  test.skip('pixel-fork: NEAREST upscale (D-RA-17; lives in limner-pixel)', () => {
    // scripts/generate_scene*.py uses Image.NEAREST upscale; pixel scope.
  });
  test.skip('pixel-fork: palette quantize (D-RA-17; lives in limner-pixel)', () => {
    // cma/image_utils.py::quantize_to_palette; pixel scope.
  });
  test.skip('pixel-fork: putpixel/getpixel chroma key (D-RA-17; lives in limner-pixel)', () => {
    // cma/image_utils.py::key_out_chroma; numpy + putpixel; pixel scope.
  });
  test.skip('pixel-fork: tint_grayscale (D-RA-17; lives in limner-pixel)', () => {
    // cma/image_utils.py::tint_grayscale; shadow/midtone/highlight remap; pixel scope.
  });
});
