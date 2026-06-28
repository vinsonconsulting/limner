// Cloudflare Images Transformations client. The only network-touching
// composition primitive; everything else in compose/ runs entirely
// inside the V8 isolate.
//
// Binding configuration on the rasa zone (wrangler.toml IMAGES binding)
// lands with Phase 4 deploy work; Phase 3 ships:
//   - a typed CFImagesBinding stub interface so production code uses
//     the actual binding and tests can pass a mock,
//   - a uniform transform() entry point,
//   - convenience wrappers named to match the compose facade's routing.
//
// API surface chosen from CF Images Transformations:
//   overlay (draw), blur, brightness/contrast, fit modes,
//   background fills, trim. Expand as Phase 4+ surfaces real call sites.
//
// Refs: D-RA-16

// Minimal subset of the Cloudflare Images binding surface
// (https://developers.cloudflare.com/images/transform-images/bindings/).
// We model only what cf-images-transform.ts actually uses; the live
// binding has more methods.
export interface CFImagesBinding {
  input(stream: ReadableStream | ArrayBuffer | Uint8Array): CFImagesInputHandle;
}

export interface CFImagesInputHandle {
  transform(opts: CFImagesTransformOptions): CFImagesTransformHandle;
}

export interface CFImagesTransformHandle {
  output(opts?: { format?: CFImagesOutputFormat }): Promise<CFImagesTransformResult>;
}

// `.output()` resolves to an ImageTransformationResult, NOT a bare Response.
// `.response()` yields the Response (the live binding also exposes `.image()`
// and `.contentType()`, which we don't consume). The earlier stub modeled this
// as `Promise<Response>` and the production code read `.ok`/`.status` straight
// off the result — undefined on the result object — which is what produced
// "cf-images transform failed: HTTP undefined undefined" on every call (F6).
// https://developers.cloudflare.com/images/optimization/binding/
export interface CFImagesTransformResult {
  response(): Response;
}

export type CFImagesOutputFormat = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';

export type CFImagesFit = 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';

export type CFImagesDrawLayer = {
  /** Either a URL or raw bytes; CF Images binding accepts both shapes. */
  url?: string;
  bytes?: Uint8Array;
  top?: number;
  left?: number;
  /** 0..1; default 1.0. */
  opacity?: number;
};

export type CFImagesTransformOptions = {
  width?: number;
  height?: number;
  fit?: CFImagesFit;
  /** 1..250 */
  blur?: number;
  /** 0..2 (1 = no change) */
  brightness?: number;
  /** 0..2 (1 = no change) */
  contrast?: number;
  /** CSS color for `pad` / `contain` background. */
  background?: string;
  trim?: { left?: number; right?: number; top?: number; bottom?: number };
  /** Multi-layer overlay. CF Images accepts these in left-to-right z-order. */
  draw?: CFImagesDrawLayer[];
};

/**
 * Apply a Cloudflare Images Transformations call. Returns the response
 * bytes in the requested output format (default PNG).
 *
 * Throws if the binding reports a non-OK Response; callers should
 * inspect the rethrown Error.message for upstream details.
 */
export async function transform(
  binding: CFImagesBinding,
  input: Uint8Array,
  opts: CFImagesTransformOptions,
  outputFormat: CFImagesOutputFormat = 'image/png',
): Promise<Uint8Array> {
  const result = await binding.input(input).transform(opts).output({ format: outputFormat });
  const response = toResponse(result);
  if (!response.ok) {
    throw new Error(
      `cf-images transform failed: HTTP ${response.status} ${response.statusText}`,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Extract the Response from the binding's transform result. The Images binding
// returns an ImageTransformationResult whose `.response()` yields the Response.
// If the runtime hands back something else (e.g. Images Transformations is not
// enabled on the account and the binding returns a stub), surface a clean,
// actionable error rather than reading `.ok`/`.status` off the wrong object —
// the source of the old "HTTP undefined undefined" (F6).
function toResponse(result: unknown): Response {
  if (result && typeof (result as CFImagesTransformResult).response === 'function') {
    const response = (result as CFImagesTransformResult).response();
    if (response instanceof Response) return response;
  }
  throw new Error(
    'cf-images transform failed: the Images binding returned an unexpected result ' +
      '(no .response()). Cloudflare Images Transformations may not be enabled on this account.',
  );
}

// ---------------- Convenience wrappers ----------------
//
// Names match the compose facade's routing surface so the facade can
// re-export them directly without adapter shims.

export const overlay = (
  binding: CFImagesBinding,
  base: Uint8Array,
  overlayBytes: Uint8Array,
  top: number,
  left: number,
): Promise<Uint8Array> =>
  transform(binding, base, { draw: [{ bytes: overlayBytes, top, left }] });

export const blur = (
  binding: CFImagesBinding,
  input: Uint8Array,
  radius: number,
): Promise<Uint8Array> => transform(binding, input, { blur: radius });

export const smartCrop = (
  binding: CFImagesBinding,
  input: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> => transform(binding, input, { width, height, fit: 'crop' });

export const backgroundFill = (
  binding: CFImagesBinding,
  input: Uint8Array,
  width: number,
  height: number,
  background: string,
): Promise<Uint8Array> =>
  transform(binding, input, { width, height, fit: 'pad', background });
