// Node-only WASM initialization for jSquash codecs. Cloudflare Workers
// resolve WASM via wrangler's static-import bundling; Node has no
// equivalent, so codec.init() must be called explicitly with a compiled
// WebAssembly.Module before any decode/encode in test runs.
//
// Tests import { initJsquashForNode } and await it once before exercising
// the wrappers in src/compose/jsquash-codecs.ts.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// `.js` suffix required for Node's strict ESM (matches src/compose/jsquash-codecs.ts).
import { init as pngDecodeInit } from '@jsquash/png/decode.js';
import { init as pngEncodeInit } from '@jsquash/png/encode.js';
import { init as jpegDecodeInit } from '@jsquash/jpeg/decode.js';
import { init as jpegEncodeInit } from '@jsquash/jpeg/encode.js';
import { init as webpDecodeInit } from '@jsquash/webp/decode.js';
import { init as webpEncodeInit } from '@jsquash/webp/encode.js';
import { init as avifDecodeInit } from '@jsquash/avif/decode.js';
import { init as avifEncodeInit } from '@jsquash/avif/encode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolves from test/compose/helpers/ to the repo root — five levels up:
// helpers -> compose -> test -> limner-core -> packages -> repo root.
// From there into the limner-core's symlinked node_modules.
function wasmPath(rel: string): string {
  return resolve(__dirname, '../../../node_modules/@jsquash', rel);
}

function loadWasm(rel: string): WebAssembly.Module {
  return new WebAssembly.Module(readFileSync(wasmPath(rel)));
}

let initialized: Promise<void> | undefined;

export function initJsquashForNode(): Promise<void> {
  if (!initialized) {
    initialized = (async () => {
      // PNG (wasm-bindgen): same wasm for decode and encode (squoosh_png_bg.wasm).
      const pngModule = loadWasm('png/codec/pkg/squoosh_png_bg.wasm');
      await pngDecodeInit(pngModule);
      await pngEncodeInit(pngModule);

      // JPEG (Emscripten): separate decode + encode wasm modules.
      await jpegDecodeInit(loadWasm('jpeg/codec/dec/mozjpeg_dec.wasm'));
      await jpegEncodeInit(loadWasm('jpeg/codec/enc/mozjpeg_enc.wasm'));

      // WebP (Emscripten): separate decode + encode.
      await webpDecodeInit(loadWasm('webp/codec/dec/webp_dec.wasm'));
      await webpEncodeInit(loadWasm('webp/codec/enc/webp_enc.wasm'));

      // AVIF (Emscripten): separate decode + encode. AVIF encode is the
      // slow one — first init may take a couple seconds.
      await avifDecodeInit(loadWasm('avif/codec/dec/avif_dec.wasm'));
      await avifEncodeInit(loadWasm('avif/codec/enc/avif_enc.wasm'));
    })();
  }
  return initialized;
}
