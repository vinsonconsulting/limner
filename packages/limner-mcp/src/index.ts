// Limner MCP server. Two transport entry points (stdio + Workers HTTP)
// + shared tool registry + OAuth + MCPB bundle.
//
// Refs: D-RA-05, D-RA-06

// Tool registry primitives — Phase 5 (@limner/cma-tools) re-uses these
// to keep Path A and Path B contracts in lockstep per D-RA-12.
export type { Tool, ToolContext } from './server.js';
export { createServer, registerTools } from './server.js';

// Tool registries by category. Phase 5 imports these to look up zod
// schemas by name and build Path-A wrappers around them.
export { pipelineTools } from './tools/pipelines.js';
export { composeTool, composeInputSchema } from './tools/compose.js';
export { memoryTools } from './tools/memory.js';
export { projectTools } from './tools/context.js';
export { metaTools } from './tools/meta.js';

// Transports (Recraft MCP adapter; Phase 5 reuses the connection logic).
export { McpRecraftTransport } from './transports/mcp-recraft.js';
