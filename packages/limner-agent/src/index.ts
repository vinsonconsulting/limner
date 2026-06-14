// @limner/limner-agent — the CMA agent home (D-RA-24). The public surface is
// the pure skill-generation helpers. The fs-backed generator (gen-skills.ts)
// and the create/version entry point (create-agent.ts) are NOT exported: they
// are dev/maintenance entry points, kept out of any consumer bundle. The pure
// builders in agent-def.ts are likewise internal (the create-agent test imports
// them directly from src/).
export {
  SKILL_MARKER_BEGIN,
  SKILL_MARKER_END,
  generatedBlock,
  spliceGenerated,
  extractGenerated,
} from './skill-gen.js';
