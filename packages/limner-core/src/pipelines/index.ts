// Barrel for the pipelines surface. Phase 2 adds individual pipelines below
// the type/error exports.

export type {
  PipelineGenerateInput,
  PipelineGenerateOutput,
  PipelineTextOutput,
  PipelineImageOutput,
  PipelineContext,
  PipelineRunner,
} from './types.js';

export type { PipelineErrorCode } from './errors.js';
export { PipelineError, assertSecrets } from './errors.js';

// Individual pipelines. RetroDiffusion moved to limner-pixel per D-RA-18
// (specialty pixel-art tools live in variants, not the rasa foundation —
// pattern-matches D-RA-17 for Pixellab).
export { MidjourneyPipeline, type MidjourneyOptions } from './midjourney.js';
export { DallePipeline, type DalleOptions } from './dalle.js';
export {
  RecraftPipeline,
  type RecraftOptions,
  type RecraftMode,
  type RecraftTransport,
  type RecraftGenerateArgs,
  type RecraftGenerateResult,
} from './recraft.js';
