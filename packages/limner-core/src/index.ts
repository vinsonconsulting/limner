// Barrel exports for @limner/core. Phase 2+ packages import from here
// rather than reaching into subpaths.

export * from './types.js';

// Embedded initial schema (generated from migrations/0001_initial_schema.sql
// by scripts/sync-packaging.mjs). The stdio entry point and the .mcpb bundle
// default to this so published artifacts are self-contained.
export { INITIAL_SCHEMA_SQL } from './schema.generated.js';

// Bindings layer (Workers vs local stdio).
export type {
  Bindings,
  WorkersBindings,
  LocalBindings,
  LocalBindingsOptions,
} from './bindings/index.js';
export { isWorkers, isLocal, createLocalBindings } from './bindings/index.js';

// Memory store.
export type { MemoryStore, MemoryRow } from './memory/index.js';
export {
  D1MemoryStore,
  LocalMemoryStore,
  createMemoryStore,
  memoryFromRow,
  buildRecallSql,
} from './memory/index.js';

// Project store.
export type { ProjectStore } from './context/index.js';
export {
  D1ProjectStore,
  LocalProjectStore,
  createProjectStore,
} from './context/index.js';

// Pipelines (Phase 2). RetroDiffusion moved to limner-pixel per D-RA-18.
export type {
  PipelineRunner,
  PipelineContext,
  PipelineGenerateInput,
  PipelineGenerateOutput,
  PipelineTextOutput,
  PipelineImageOutput,
  PipelineErrorCode,
  MidjourneyOptions,
  DalleOptions,
  RecraftOptions,
  RecraftMode,
  RecraftTransport,
  RecraftGenerateArgs,
  RecraftGenerateResult,
} from './pipelines/index.js';
export {
  PipelineError,
  assertSecrets,
  MidjourneyPipeline,
  DallePipeline,
  RecraftPipeline,
} from './pipelines/index.js';

// Composition stack (Phase 3, D-RA-16). Hybrid V8 primitives + facade.
// Pipeline / MCP tool code imports { compose } from '@limner/core'.
export { compose } from './compose/index.js';
// Compose primitive types (consumed by Phase 4's compose MCP tool to
// type ctx.images and zod schemas).
export type {
  Format,
  CodecOpts,
  DecodedImage,
  FitMode,
  SatoriJsx,
  SatoriFont,
  SatoriRenderOptions,
  CFImagesBinding,
  CFImagesInputHandle,
  CFImagesTransformHandle,
  CFImagesTransformOptions,
  CFImagesOutputFormat,
  CFImagesFit,
  CFImagesDrawLayer,
} from './compose/index.js';
