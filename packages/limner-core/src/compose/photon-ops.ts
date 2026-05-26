// V8 wrappers over @cf-wasm/photon. Functions, not classes — these are
// internal composition stages, not user-facing pipelines (compare to
// DallePipeline / RecraftPipeline in ../pipelines/, which implement
// the PipelineRunner contract).
//
// Conventions:
//   - All wrappers take Uint8Array bytes and return Uint8Array bytes.
//     Callers never see PhotonImage; allocation / free is internal.
//   - Default output format is PNG (Photon's get_bytes() returns PNG).
//     Use jsquash-codecs.encode for JPEG / WebP / AVIF output.
//   - Photon balloons JPEG sizes after resize / crop / watermark
//     (D-RA-16 quirk); the compose facade routes JPEG output through
//     jsquash-codecs.encode to fix it.
//
// V8 memory cap: V8 isolates cap at 128 MB total (V8 runtime + WASM
// modules + image data). Practical ceiling ~10 megapixels per image.
// For oversize work, route through cf-images-transform (network).
//
// Refs: D-RA-16

import {
  PhotonImage,
  SamplingFilter,
  resize as photonResize,
  crop as photonCrop,
  adjust_brightness,
  adjust_contrast,
  gaussian_blur,
  sharpen as photonSharpen,
  watermark as photonWatermark,
} from '@cf-wasm/photon';

export type FitMode = 'cover' | 'contain';

// Photon's resize is target-size-driven and doesn't itself implement
// cover / contain semantics — those are caller-side rect calculations.
// We pre-compute the inner crop / pad so Photon just does the raster work.
// For now, both modes resize to (width,height); contain pads via background
// fill when the aspect mismatches. Aspect-preservation lands when a real
// caller surfaces a use case (current MVP is cover).

/**
 * Resize an image to (width, height) using Lanczos3 sampling.
 *
 * @param input PNG / JPEG / WebP / AVIF bytes; format auto-detected.
 * @param width target width in pixels
 * @param height target height in pixels
 * @param fit 'cover' (default) crops to fill; 'contain' would pad — not yet implemented (resizes both modes to the exact target).
 * @returns PNG bytes. JPEG output? Pipe through jsquashCodecs.encode('jpeg', ...).
 */
export function resize(
  input: Uint8Array,
  width: number,
  height: number,
  _fit: FitMode = 'cover',
): Uint8Array {
  const img = PhotonImage.new_from_byteslice(input);
  const out = photonResize(img, width, height, SamplingFilter.Lanczos3);
  const bytes = out.get_bytes();
  img.free();
  out.free();
  return bytes;
}

/**
 * Crop a rectangular region from the input image.
 *
 * Photon's underlying crop signature uses corner coordinates (x1,y1,x2,y2);
 * this wrapper accepts the more common (x,y,width,height) shape and
 * converts internally.
 *
 * @returns PNG bytes. JPEG output? Pipe through jsquashCodecs.encode('jpeg', ...).
 */
export function crop(
  input: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
): Uint8Array {
  const img = PhotonImage.new_from_byteslice(input);
  const out = photonCrop(img, x, y, x + width, y + height);
  const bytes = out.get_bytes();
  img.free();
  out.free();
  return bytes;
}

/**
 * Adjust brightness by `delta`. Photon's signed-int offset semantics:
 * positive brightens, negative darkens. Typical range: -50..+50.
 */
export function brightness(input: Uint8Array, delta: number): Uint8Array {
  const img = PhotonImage.new_from_byteslice(input);
  adjust_brightness(img, delta);
  const bytes = img.get_bytes();
  img.free();
  return bytes;
}

/**
 * Adjust contrast by `factor`. Photon's float multiplier: 1.0 is no change,
 * >1 increases contrast, 0..1 decreases. Typical range: 0.5..2.0.
 */
export function contrast(input: Uint8Array, factor: number): Uint8Array {
  const img = PhotonImage.new_from_byteslice(input);
  adjust_contrast(img, factor);
  const bytes = img.get_bytes();
  img.free();
  return bytes;
}

/**
 * Gaussian blur with a given pixel radius. Typical range: 1..20.
 */
export function blur(input: Uint8Array, radius: number): Uint8Array {
  const img = PhotonImage.new_from_byteslice(input);
  gaussian_blur(img, radius);
  const bytes = img.get_bytes();
  img.free();
  return bytes;
}

/**
 * Unsharp-mask sharpening. Photon offers a parameter-free `sharpen`;
 * for finer control, multiple passes can be chained.
 */
export function sharpen(input: Uint8Array): Uint8Array {
  const img = PhotonImage.new_from_byteslice(input);
  photonSharpen(img);
  const bytes = img.get_bytes();
  img.free();
  return bytes;
}

/**
 * Composite `overlay` onto `base` at position (x, y). Single-layer
 * watermark — multi-layer composites can be expressed as repeated
 * watermark() calls feeding output back as the base, or routed through
 * cf-images-transform.cfOverlay when the layer count is large.
 *
 * @returns PNG bytes. JPEG output? Pipe through jsquashCodecs.encode('jpeg', ...).
 */
export function watermark(
  base: Uint8Array,
  overlay: Uint8Array,
  x: number,
  y: number,
): Uint8Array {
  const baseImg = PhotonImage.new_from_byteslice(base);
  const overlayImg = PhotonImage.new_from_byteslice(overlay);
  // Photon's watermark takes BigInt for x,y (Rust u32 -> wasm i64 binding).
  photonWatermark(baseImg, overlayImg, BigInt(x), BigInt(y));
  const bytes = baseImg.get_bytes();
  baseImg.free();
  overlayImg.free();
  return bytes;
}
