// Test-only Worker entry for the Phase 6c DO handshake regression test
// (test/worker.handshake.test.ts, booted via wrangler's unstable_dev).
//
// It exposes the *bare* LimnerMCP Streamable-HTTP handler — the same Durable
// Object class that ships — WITHOUT the production OAuthProvider wrapper, so the
// test can exercise the MCP handshake directly. OAuth is orthogonal (and
// already working); the full OAuth + DO + transport path is covered by the
// manual MCP Inspector smoke.
//
// Re-exporting LimnerMCP makes the Durable Object class discoverable from this
// entry module, matching the `class_name = "LimnerMCP"` migration in
// test/wrangler.handshake.toml.
import { LimnerMCP } from '../src/worker.js';

export { LimnerMCP };

export default LimnerMCP.serve('/mcp', { binding: 'LIMNER_MCP' });
