// Barrel exports for @limner/core. Phase 2+ packages import from here
// rather than reaching into subpaths.

export * from './types.js';

// Embedded initial schema (generated from migrations/0001_initial_schema.sql
// by scripts/sync-packaging.mjs). The stdio entry point and the .mcpb bundle
// default to this so published artifacts are self-contained.
export { INITIAL_SCHEMA_SQL } from './schema.generated.js';

// Shared base64 codecs (r5) — chunked encode for multi-MB images under
// isolate CPU limits. Single source for the mcp + cma tool layers.
export { bytesToBase64, base64ToBytes } from './base64.js';

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
  RestRecraftTransport,
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
  FontId,
  CFImagesBinding,
  CFImagesInputHandle,
  CFImagesTransformHandle,
  CFImagesTransformOptions,
  CFImagesOutputFormat,
  CFImagesFit,
  CFImagesDrawLayer,
} from './compose/index.js';
export {
  DEFAULT_FONT_ID,
  isFontId,
  listFontIds,
  fontDisplayName,
  resolveFontBytes,
} from './compose/index.js';

// Compose WASM lifecycle (D-RA-16). The transport layer (@limner/mcp's
// wasm-init{,-node}.ts) acquires the pre-compiled modules its own way and
// registers a provider; the compose ops self-init lazily via
// ensureComposeWasm, so no Path A / Path B call site can forget.
export { registerComposeWasmProvider, ensureComposeWasm } from './compose/compose-wasm.js';
export type { ComposeWasmModules, ComposeWasmModule } from './compose/compose-wasm.js';

// Guidance core (D-RA-24). Single source feeding the MCP prompt/resource
// surfaces (runtime) and the CMA skill generator (build time), so no concept's
// shared content is hand-copied across surfaces.
export type { GuidanceEntry, GuidanceBlock } from './guidance/index.js';
export {
  serializeGuidance,
  A4_FRAMING,
  guidanceRegistry,
  getGuidance,
  listGuidance,
} from './guidance/index.js';

// Style profile (D-RA-24). Cross-cutting schema + read/merge/write helpers over
// the project store, shared by the brand-kit / style-from-images / art-research
// surfaces. No new table, no new tool surface.
export {
  STYLE_PROFILE_KEY,
  StyleProfileSchema,
  parseStyleProfile,
  readStyleProfile,
  mergeStyleProfile,
  writeStyleProfile,
  upsertStyleProfile,
} from './style-profile/index.js';
export type {
  StyleProfile,
  StyleProfileInput,
  StyleProfilePatch,
} from './style-profile/index.js';

// Asset delivery (PR D). Store generated image bytes in R2 and return a
// capability URL (optionally HMAC-signed) instead of inline base64, so large
// outputs don't exceed the MCP message-size ceiling.
export {
  uploadArtifact,
  verifyArtifactSignature,
  ARTIFACT_KEY_PREFIX,
  ARTIFACT_PATH_PREFIX,
} from './delivery/r2.js';
export type { ArtifactDelivery } from './delivery/r2.js';
