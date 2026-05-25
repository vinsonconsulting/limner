// Barrel exports for @limner/core. Phase 2+ packages import from here
// rather than reaching into subpaths.

export * from './types.js';

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
