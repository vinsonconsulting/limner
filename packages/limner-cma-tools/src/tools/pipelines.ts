// Pipeline tools: generate_dalle, generate_midjourney, generate_recraft.
// Wraps the Phase 4 schemas (re-imported from @limner/mcp) with
// CMA-side run handlers that:
//   - call @limner/core's PipelineRunner instances
//   - upload image output to R2 and return a JSON envelope URL
//   - return text output (Midjourney prompt composition) as a JSON
//     envelope `{text, metadata}`
//
// Refs: D-RA-12, D-RA-14

export {}; // populated in Step 3
