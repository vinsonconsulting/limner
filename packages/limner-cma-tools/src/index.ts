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
// Each subsequent step (3-5) populates the corresponding module and
// adds its exports here.
//
// Refs: D-RA-12

export type { CustomTool, CustomToolRunContext } from './runtime.js';
export { defineTool } from './runtime.js';
export {
  uploadImageToR2,
  imageReturnEnvelope,
  type UploadOptions,
} from './r2-upload.js';

// LIMNER_TOOLS array — populated as tool modules are filled in
// (Steps 3-5). Step 1 ships an empty array so the type plumbing is
// usable end-to-end.
export const LIMNER_TOOLS: readonly import('./runtime.js').CustomTool[] = [];
