// Node-side WASM acquisition (review r1) — the stdio transport and the
// .mcpb bundle. require.resolve walks the real node_modules tree (the
// codec packages are direct deps of @limner/mcp, so resolution works
// both in the pnpm workspace and inside the packed bundle, where
// `mcpb pack` dereferences the symlinks), and readFileSync +
// WebAssembly.Module compiles eagerly at boot — tens of ms per module.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { initComposeWasm } from './wasm-init-common.js';

const require = createRequire(import.meta.url);

// @cloudflare/workers-types (in this package's tsconfig for worker.ts)
// declares the WebAssembly.Module constructor abstract — isolates can't
// compile wasm from bytes. This file only ever runs under Node, where the
// constructor is real; cast around the workers-flavored lib type.
const WasmModule = WebAssembly.Module as unknown as new (bytes: BufferSource) => WebAssembly.Module;

function loadWasm(specifier: string): WebAssembly.Module {
  return new WasmModule(readFileSync(require.resolve(specifier)));
}

let ready: Promise<void> | undefined;

export function initComposeWasmNode(): Promise<void> {
  if (!ready) {
    ready = initComposeWasm({
      resvg: loadWasm('@resvg/resvg-wasm/index_bg.wasm'),
      png: loadWasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm'),
      jpegDec: loadWasm('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm'),
      jpegEnc: loadWasm('@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm'),
      webpDec: loadWasm('@jsquash/webp/codec/dec/webp_dec.wasm'),
      webpEnc: loadWasm('@jsquash/webp/codec/enc/webp_enc.wasm'),
      avifDec: loadWasm('@jsquash/avif/codec/dec/avif_dec.wasm'),
      avifEnc: loadWasm('@jsquash/avif/codec/enc/avif_enc.wasm'),
    });
  }
  return ready;
}
