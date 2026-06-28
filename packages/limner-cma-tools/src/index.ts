// Limner CMA sandbox custom tools (Path A surface per D-RA-12).
//
// Ship shape: library exporting `LIMNER_TOOLS`, an array of
// CustomTool-typed objects compatible with the
// cloudflare/claude-managed-agents template's defineTool shape.
//
// Consuming Workers (the actual CMA agent deploy target; Phase 7)
// import this and populate their template's CUSTOM_TOOLS:
//
//   import { LIMNER_TOOLS } from '@limner/cma-tools';
//   export const CUSTOM_TOOLS = [...LIMNER_TOOLS, ...otherTools];
//
// Required bindings on the consuming Worker:
//   BUCKET  (R2)        image-returning tools upload here
//   DB      (D1)        memory + project tools read/write here
//   IMAGES  (optional)  cf-* compose ops use this
// Required secrets:
//   OPENAI_API_KEY      limner_generate_dalle
//   RECRAFT_API_KEY     limner_generate_recraft (remote mode)
//
// Refs: D-RA-12

import { pipelineTools } from './tools/pipelines.js';
import { composeTool } from './tools/compose.js';
import { memoryTools } from './tools/memory.js';
import { projectTools } from './tools/context.js';
import { metaTools } from './tools/meta.js';

export type { CustomTool, CustomToolRunContext } from './runtime.js';
export { defineTool } from './runtime.js';
export {
  uploadImageToR2,
  imageReturnEnvelope,
  type UploadOptions,
} from './r2-upload.js';

export { pipelineTools, composeTool, memoryTools, projectTools, metaTools };

// 18 tools total: 5 pipelines (incl. limner_upscale + limner_vectorize) + 1 compose + 4 memory + 4 project + 4 meta.
// Mirrors the Path B (@limner/mcp) tool surface per D-RA-12.
export const LIMNER_TOOLS = [
  ...pipelineTools,
  composeTool,
  ...memoryTools,
  ...projectTools,
  ...metaTools,
] as const;
