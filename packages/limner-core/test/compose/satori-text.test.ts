import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderText, type SatoriJsx } from '../../src/compose/satori-text.js';
import { initSatoriForNode, loadDefaultFont } from './helpers/satori-init.js';
import { initJsquashForNode } from './helpers/jsquash-init.js';
import { ssim } from './helpers/ssim.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  // Resvg-wasm init + jsquash init for the SSIM comparison below.
  await Promise.all([initSatoriForNode(), initJsquashForNode()]);
}, 60_000);

const helloJsx: SatoriJsx = {
  type: 'div',
  props: {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      fontSize: 48,
      color: 'black',
      background: 'white',
    },
    children: 'Hello, World!',
  },
};

const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_MAGIC[i]) return false;
  }
  return true;
}

describe('compose/satori-text.renderText', () => {
  test('default font renders Hello, World! to PNG bytes', async () => {
    const font = loadDefaultFont();
    const out = await renderText(helloJsx, {
      width: 400,
      height: 100,
      fonts: [{ name: 'IBM Plex Sans', data: font, weight: 400, style: 'normal' }],
    });
    expect(isPng(out)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });

  test('matches reference render within SSIM tolerance', async () => {
    const font = loadDefaultFont();
    const out = await renderText(helloJsx, {
      width: 400,
      height: 100,
      fonts: [{ name: 'IBM Plex Sans', data: font, weight: 400, style: 'normal' }],
    });

    const refPath = resolve(__dirname, 'fixtures', 'expected-hello-world.png');

    // First-time fixture regeneration: set REGEN_FIXTURE=1 to commit
    // the current render as the contract. Remove that block once the
    // reference is in place (the test will then fail on drift).
    if (process.env['REGEN_FIXTURE']) {
      writeFileSync(refPath, out);
      console.warn(`[REGEN] wrote ${refPath} (${out.length} bytes)`);
      return;
    }

    if (!existsSync(refPath)) {
      throw new Error(
        `Reference fixture missing: ${refPath}.\n` +
          `Run \`REGEN_FIXTURE=1 pnpm --filter @limner/core test test/compose/satori-text.test.ts\` once and commit the produced PNG.`,
      );
    }

    const ref = new Uint8Array(readFileSync(refPath));
    const score = await ssim(out, ref);
    // SSIM ≥ 0.98 is the project-wide tolerance for visual equivalence
    // (decision 2026-05-25, D-RA-16). Documented in plan, README.
    expect(score).toBeGreaterThanOrEqual(0.98);
  });
});
