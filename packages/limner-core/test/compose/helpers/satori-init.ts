// Node-only helpers for satori-text tests: initialize resvg-wasm and
// load the default IBM Plex Sans font from disk. Workers callers
// don't need either of these (wrangler bundles the WASM; fonts come
// via bindings).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureResvgInit } from '../../../src/compose/satori-text.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RESVG_WASM_PATH = resolve(
  __dirname,
  '../../../node_modules/@resvg/resvg-wasm/index_bg.wasm',
);

const DEFAULT_FONT_PATH = resolve(
  __dirname,
  '../../../assets/fonts/IBMPlexSans-Regular.ttf',
);

let inited: Promise<void> | undefined;

export function initSatoriForNode(): Promise<void> {
  if (!inited) {
    inited = ensureResvgInit(new WebAssembly.Module(readFileSync(RESVG_WASM_PATH)));
  }
  return inited;
}

export function loadDefaultFont(): Uint8Array {
  return new Uint8Array(readFileSync(DEFAULT_FONT_PATH));
}
