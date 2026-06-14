// Guidance core (D-RA-24). Pure data + a single serializer; the canonical
// source for the MCP prompt/resource surfaces (runtime) and the CMA skill
// generator (build time).
export type { GuidanceEntry, GuidanceBlock } from './types.js';
export { serializeGuidance, A4_FRAMING } from './serialize.js';
export { guidanceRegistry, getGuidance, listGuidance } from './registry.js';
