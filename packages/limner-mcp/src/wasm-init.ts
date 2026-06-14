// Workers-side WASM acquisition (review r1). Under wrangler, a static
// `.wasm` import is bundled by the default CompiledWasm rule and yields
// a WebAssembly.Module at runtime — the only way to get wasm into the
// isolate, since the jsquash glue's fetch(import.meta.url) fallback has
// nothing to fetch in a deployed worker.

import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
// @ts-expect-error TS1192 — wasm-bindgen ships squoosh_png_bg.wasm.d.ts
// (named raw exports, no default) which shadows the ambient *.wasm shim;
// under wrangler's CompiledWasm rule the default import IS a
// WebAssembly.Module, same as every other .wasm import here.
import pngWasm from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import jpegDecWasm from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import jpegEncWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm';
import webpDecWasm from '@jsquash/webp/codec/dec/webp_dec.wasm';
import webpEncWasm from '@jsquash/webp/codec/enc/webp_enc.wasm';
import avifDecWasm from '@jsquash/avif/codec/dec/avif_dec.wasm';
import avifEncWasm from '@jsquash/avif/codec/enc/avif_enc.wasm';

import { registerComposeWasmProvider, ensureComposeWasm } from '@limner/core';
import type { ComposeWasmModules } from '@limner/core';

// Register the Workers module provider with core, then drive the shared
// lazy ensure. The static imports above are bundled as CompiledWasm by
// wrangler's default **/*.wasm rule; the provider just hands them over.
// Returns core's memoized promise (idempotent across calls).
export function initComposeWasmWorkers(): Promise<void> {
  registerComposeWasmProvider(
    (): ComposeWasmModules => ({
      resvg: resvgWasm,
      png: pngWasm,
      jpegDec: jpegDecWasm,
      jpegEnc: jpegEncWasm,
      webpDec: webpDecWasm,
      webpEnc: webpEncWasm,
      avifDec: avifDecWasm,
      avifEnc: avifEncWasm,
    }),
  );
  return ensureComposeWasm();
}
