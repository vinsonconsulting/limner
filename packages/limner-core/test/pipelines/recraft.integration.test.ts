import { describe, test } from 'vitest';

// Recraft integration tests are TODO until Phase 4 ships the real
// McpRecraftTransport (the @modelcontextprotocol/sdk client +
// StreamableHTTPClientTransport wiring lives in @limner/mcp, where the SDK
// already has a real consumer). The default placeholder transport in
// @limner/core throws upstream_unavailable by design.
//
// Once Phase 4 lands and exposes a transport implementation that this
// package can import (without circular dependencies), this file becomes:
//
//   import { RecraftPipeline, type PipelineImageOutput } from '../../src/index.js';
//   import { McpRecraftTransport } from '@limner/mcp/transports/recraft.js';
//
//   const apiKey = process.env['RECRAFT_API_KEY'];
//   describe.skipIf(!apiKey)(
//     'RecraftPipeline (remote) — integration (requires RECRAFT_API_KEY)',
//     () => {
//       test('generates an image via mcp.recraft.ai', async () => {
//         const transport = new McpRecraftTransport({ mode: 'remote', apiKey: apiKey! });
//         const p = new RecraftPipeline('remote', transport);
//         const out = await p.generate({ prompt: 'logo' }, { secrets: { RECRAFT_API_KEY: apiKey! } });
//         // assertions...
//         await p.close();
//       }, 120_000);
//     },
//   );

describe.todo('RecraftPipeline (remote) — integration', () => {
  test.todo('generates an image via mcp.recraft.ai (Phase 4 wiring)');
});

describe.todo('RecraftPipeline (local stdio) — integration', () => {
  test.todo('generates an image via the local recraft-mcp-server (Phase 4 wiring)');
});
