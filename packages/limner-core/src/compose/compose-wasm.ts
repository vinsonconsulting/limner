// Compose WASM lifecycle: lazy, memoized init driven by a platform-
// registered module provider. Single source for both the resvg memo and
// the jSquash codec inits.
//
// Why a provider closure instead of self-acquisition: WASM acquisition
// cannot be shared across runtimes. Workers needs static `.wasm`
// CompiledWasm imports (bundled by wrangler); Node needs
// `new WebAssembly.Module(readFileSync(...))`. Each is broken on the
// other runtime, and pulling `node:fs` into a Workers bundle is fatal.
// So core can't acquire the modules — it can only run init given
// pre-compiled ones. The platform (@limner/mcp's wasm-init{,-node}.ts)
// supplies a provider; core memoizes and runs init lazily at the first
// op, so no compose call site can forget to initialize.
//
// V8 soundness: instantiating an already-compiled WebAssembly.Module
// during request handling is permitted in Workers (only compilation
// from bytes at runtime is blocked). The DO already instantiates inside
// init(), so a lazy ensure at the op boundary crosses no new boundary.
//
// `.js` suffix on the jSquash subpath imports is required for Node's
// strict ESM resolution (matches jsquash-codecs.ts).
//
// Refs: D-RA-16

import { initWasm } from '@resvg/resvg-wasm';
import { init as pngDecodeInit } from '@jsquash/png/decode.js';
import { init as pngEncodeInit } from '@jsquash/png/encode.js';
import { init as jpegDecodeInit } from '@jsquash/jpeg/decode.js';
import { init as jpegEncodeInit } from '@jsquash/jpeg/encode.js';
import { init as webpDecodeInit } from '@jsquash/webp/decode.js';
import { init as webpEncodeInit } from '@jsquash/webp/encode.js';
import { init as avifDecodeInit } from '@jsquash/avif/decode.js';
import { init as avifEncodeInit } from '@jsquash/avif/encode.js';

/**
 * A pre-compiled WASM module supplied by the platform provider.
 *
 * Typed structurally as `object` rather than `WebAssembly.Module`: the
 * `WebAssembly` global isn't in @limner/core's lib (Workers gets it from
 * @cloudflare/workers-types, Node from its runtime), and adding the
 * DOM/webworker lib here would collide with @types/node's globals
 * (core's pipelines use the global `fetch`/`Response`). The resvg /
 * jSquash init functions accept it — their wasm-bindgen `InitInput`
 * param degrades to `any` under skipLibCheck — and the providers in
 * @limner/mcp construct these from real `WebAssembly.Module` instances.
 */
export type ComposeWasmModule = object;

/**
 * Pre-compiled WASM modules for the compose stack, acquired by the
 * platform and handed to {@link ensureComposeWasm} via a provider.
 */
export type ComposeWasmModules = {
  resvg: ComposeWasmModule;
  // PNG is wasm-bindgen: one module shared by decode + encode.
  png: ComposeWasmModule;
  jpegDec: ComposeWasmModule;
  jpegEnc: ComposeWasmModule;
  webpDec: ComposeWasmModule;
  webpEnc: ComposeWasmModule;
  avifDec: ComposeWasmModule;
  avifEnc: ComposeWasmModule;
};

let resvgReady: Promise<void> | undefined;

/**
 * Idempotent resvg-wasm init guard. The single resvg memo lives here so
 * a direct caller (test helpers) and {@link ensureComposeWasm} share one
 * instantiation. Callers in Workers may not need this directly (wrangler
 * pre-resolves the static import); Node callers MUST init before the
 * first renderText.
 *
 * Pass a resolved WebAssembly.Module, a Uint8Array of WASM bytes, a
 * Response, a URL, or a Promise thereof — forwarded directly to resvg's
 * initWasm.
 */
export function ensureResvgInit(input: Parameters<typeof initWasm>[0]): Promise<void> {
  if (!resvgReady) {
    resvgReady = initWasm(input);
  }
  return resvgReady;
}

let provider: (() => ComposeWasmModules | Promise<ComposeWasmModules>) | undefined;
let ready: Promise<void> | undefined;

/**
 * Register the platform's compose-WASM module provider. Called once at
 * Worker/process startup by the transport layer (@limner/mcp's
 * wasm-init{,-node}.ts). Last-write-wins; MUST NOT reset `ready` so a
 * re-registration after init is a no-op rather than a double-init.
 */
export function registerComposeWasmProvider(
  p: () => ComposeWasmModules | Promise<ComposeWasmModules>,
): void {
  provider = p;
}

/**
 * Lazily initialize the compose WASM stack, memoized so concurrent
 * first-calls in one isolate await the same instantiation (promise memo,
 * not a boolean). The compose ops await this internally, so no call site
 * can forget.
 *
 * Tolerant no-op: when no provider is registered this resolves without
 * doing anything AND does not cache that resolution — a later
 * registration still takes effect. This lets the test suite init the
 * WASM out-of-band (via the test helpers) while the production consumer
 * registers a provider; neither needs to know about the other.
 */
export function ensureComposeWasm(): Promise<void> {
  if (ready) return ready; // initialized or in-flight (via a provider)
  if (!provider) return Promise.resolve(); // tolerant no-op; deliberately NOT cached
  ready = (async () => {
    const m = await provider!();
    await ensureResvgInit(m.resvg);
    await pngDecodeInit(m.png);
    await pngEncodeInit(m.png);
    await jpegDecodeInit(m.jpegDec);
    await jpegEncodeInit(m.jpegEnc);
    await webpDecodeInit(m.webpDec);
    await webpEncodeInit(m.webpEnc);
    await avifDecodeInit(m.avifDec);
    await avifEncodeInit(m.avifEnc);
  })();
  return ready;
}
