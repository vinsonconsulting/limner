// Typography rendering: JSX -> SVG (satori) -> PNG (resvg-wasm).
//
// Fonts ship with the package at packages/limner-core/assets/fonts/.
// IBM Plex Sans Regular (SIL OFL 1.1) is the default. Callers can
// override via opts.fonts.
//
// resvg-wasm needs explicit initialization; this module exposes
// `ensureResvgInit` so callers can plug in their own WASM source
// (Workers ship the WASM via wrangler bundling; Node tests read it
// from disk — see test/compose/helpers/satori-init.ts).
//
// No legacy precedent — typography is a forward-looking primitive
// per the Step 0 inventory.
//
// Refs: D-RA-16

import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

// Re-exported so callers (and the facade) can drive the same init
// state without reaching into the resvg-wasm package directly.
export { initWasm };

let resvgReady: Promise<void> | undefined;

/**
 * Idempotent resvg-wasm init guard. Callers in Workers may not need
 * to call this (wrangler can pre-resolve initWasm via a static
 * import); callers in Node MUST call this before the first renderText.
 *
 * Pass a resolved WebAssembly.Module, a Uint8Array of WASM bytes, a
 * Response, a URL, or a Promise thereof — whatever shape your runtime
 * has handy. The argument is forwarded directly to resvg's initWasm.
 */
export function ensureResvgInit(input: Parameters<typeof initWasm>[0]): Promise<void> {
  if (!resvgReady) {
    resvgReady = initWasm(input);
  }
  return resvgReady;
}

// Satori expects a ReactNode, but accepts plain JS objects shaped like
// JSX nodes ({ type, props: { ... children } }). We re-export this
// shape under our own name so callers don't need to import React types.
export type SatoriJsx = unknown;

export type SatoriFont = {
  name: string;
  data: ArrayBuffer | Uint8Array;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: 'normal' | 'italic';
};

export type SatoriRenderOptions = {
  width: number;
  height: number;
  /** Override the default IBM Plex Sans font. Required for Workers
   *  callers that load fonts via R2/KV bindings. */
  fonts: SatoriFont[];
};

/**
 * Render a JSX-shaped object tree to PNG bytes via Satori + resvg-wasm.
 *
 * Caller must have called `ensureResvgInit` first; this function does
 * NOT load any WASM by itself — V8 isolates and Node have different
 * WASM resolution paths, and bundling them into a runtime check would
 * pull `node:fs` into Workers builds.
 *
 * @returns PNG bytes.
 */
export async function renderText(
  jsx: SatoriJsx,
  opts: SatoriRenderOptions,
): Promise<Uint8Array> {
  // Satori's FontOptions.data is typed as `Buffer | ArrayBuffer`, which
  // excludes Uint8Array at the type level; at runtime Satori only reads
  // bytes, so the type narrowing is overly strict. Cast through
  // `unknown` to satisfy the Satori signature.
  const fonts = opts.fonts.map((f) => ({
    name: f.name,
    data: f.data,
    weight: f.weight ?? 400,
    style: f.style ?? 'normal',
  })) as unknown as Parameters<typeof satori>[1]['fonts'];
  // Cast to `never` because Satori's `ReactNode` type requires the React
  // runtime types; we pass a plain JSX-shaped object which Satori reads
  // structurally at runtime.
  const svg = await satori(jsx as never, {
    width: opts.width,
    height: opts.height,
    fonts,
  });
  const resvg = new Resvg(svg);
  const png = resvg.render().asPng();
  resvg.free();
  return png;
}
