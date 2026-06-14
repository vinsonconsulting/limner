// Unified composition facade. Pipeline / MCP tool code does:
//
//   import { compose } from '@limner/core';
//   await compose.resize(bytes, 512, 512);
//   await compose.encode('jpeg', decoded, { quality: 85 });
//
// Functions, not classes — these are internal stages, not user-facing
// pipelines. Compare to DallePipeline / RecraftPipeline in ../pipelines/,
// which implement the PipelineRunner contract.
//
// Routing matrix (documented inline so the matrix doesn't drift from
// the code that implements it):
//
//   resize / crop / brightness / contrast / blur / sharpen / watermark
//      -> photon-ops (in-isolate; fast; V8-bound)
//      -> JPEG output? pipe through compose.encode('jpeg') for the
//         Photon JPEG-size fix (D-RA-16 documented quirk).
//
//   format conversion (encode / decode / convert)
//      -> jsquash-codecs (JPEG / PNG / WebP / AVIF)
//
//   typography (renderText)
//      -> satori-text (no legacy precedent; forward-looking primitive)
//      -> caller is responsible for calling ensureResvgInit / providing
//         fonts (Workers: bundled WASM + R2 fonts; Node: fs-loaded).
//
//   overlay (multi-layer composite, complex) / blur (>20 radius) /
//   smartCrop / backgroundFill / general visual effects
//      -> cf-images-transform (network; requires Images binding)
//
//   Cost note: cf-images-transform is per-transform priced. Prefer
//   in-isolate primitives where the result is equivalent. Cheapest
//   path bias: jsquash > photon > satori > cf-images.
//
// Refs: D-RA-16

import * as photon from './photon-ops.js';
import * as codecs from './jsquash-codecs.js';
import * as satori from './satori-text.js';
import * as cfImages from './cf-images-transform.js';
import { ensureComposeWasm } from './compose-wasm.js';

// Type re-exports so consumers can `import type { Format } from '@limner/core'`
// once we wire those through src/index.ts (already done in Step 1).
export type { Format, CodecOpts, DecodedImage } from './jsquash-codecs.js';
export type { FitMode } from './photon-ops.js';
export type {
  SatoriJsx,
  SatoriFont,
  SatoriRenderOptions,
} from './satori-text.js';
export type {
  CFImagesBinding,
  CFImagesInputHandle,
  CFImagesTransformHandle,
  CFImagesTransformOptions,
  CFImagesOutputFormat,
  CFImagesFit,
  CFImagesDrawLayer,
} from './cf-images-transform.js';

export const compose = {
  // Photon — in-isolate raster ops
  resize: photon.resize,
  crop: photon.crop,
  brightness: photon.brightness,
  contrast: photon.contrast,
  blur: photon.blur,
  sharpen: photon.sharpen,
  watermark: photon.watermark,

  // jSquash — codecs
  encode: codecs.encode,
  decode: codecs.decode,
  convert: codecs.convert,

  // Satori — typography (no legacy precedent)
  renderText: satori.renderText,
  ensureResvgInit: satori.ensureResvgInit,

  // Compose WASM lifecycle — lazy ensure shared by codecs + satori. The
  // ops self-init internally; exposed here for front-loading at startup.
  ensureComposeWasm,

  // Cloudflare Images Transformations — network primitive
  cfTransform: cfImages.transform,
  cfOverlay: cfImages.overlay,
  cfBlur: cfImages.blur,
  cfSmartCrop: cfImages.smartCrop,
  cfBackgroundFill: cfImages.backgroundFill,
} as const;
