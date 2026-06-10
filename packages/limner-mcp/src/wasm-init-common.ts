// Shared WASM initialization for the compose stack (review r1).
//
// compose's jsquash codec ops and satori renderText depend on WASM that
// does NOT self-initialize outside the test suite: jsquash's lazy init
// fetch()es its wasm relative to import.meta.url (no asset to fetch in a
// deployed worker; file:// fetch fails in Node), and resvg requires an
// explicit ensureResvgInit. Each transport entry point acquires the
// compiled modules its own way — static imports under wrangler
// (wasm-init.ts), createRequire + readFileSync under Node
// (wasm-init-node.ts) — and hands them here, so the codec wiring stays
// single-source.
//
// photon (@cf-wasm/photon) self-initializes on both transports and is
// deliberately absent. Not exported from index.ts: @limner/cma-tools
// consumers bundle this package for Workers, and the node-side loader
// must never enter those bundles.

// `.js` suffix required for Node's strict ESM (matches
// @limner/core src/compose/jsquash-codecs.ts).
import { init as pngDecodeInit } from '@jsquash/png/decode.js';
import { init as pngEncodeInit } from '@jsquash/png/encode.js';
import { init as jpegDecodeInit } from '@jsquash/jpeg/decode.js';
import { init as jpegEncodeInit } from '@jsquash/jpeg/encode.js';
import { init as webpDecodeInit } from '@jsquash/webp/decode.js';
import { init as webpEncodeInit } from '@jsquash/webp/encode.js';
import { init as avifDecodeInit } from '@jsquash/avif/decode.js';
import { init as avifEncodeInit } from '@jsquash/avif/encode.js';
import { compose } from '@limner/core';

export type ComposeWasmModules = {
  resvg: WebAssembly.Module;
  // PNG is wasm-bindgen: one module shared by decode + encode.
  png: WebAssembly.Module;
  jpegDec: WebAssembly.Module;
  jpegEnc: WebAssembly.Module;
  webpDec: WebAssembly.Module;
  webpEnc: WebAssembly.Module;
  avifDec: WebAssembly.Module;
  avifEnc: WebAssembly.Module;
};

export async function initComposeWasm(m: ComposeWasmModules): Promise<void> {
  await pngDecodeInit(m.png);
  await pngEncodeInit(m.png);
  await jpegDecodeInit(m.jpegDec);
  await jpegEncodeInit(m.jpegEnc);
  await webpDecodeInit(m.webpDec);
  await webpEncodeInit(m.webpEnc);
  await avifDecodeInit(m.avifDec);
  await avifEncodeInit(m.avifEnc);
  await compose.ensureResvgInit(m.resvg);
}
