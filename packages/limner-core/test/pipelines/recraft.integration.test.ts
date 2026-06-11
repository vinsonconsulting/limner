import { describe, test } from 'vitest';

// Phase 4 shipped the real McpRecraftTransport in @limner/mcp (the
// @modelcontextprotocol/sdk client + StreamableHTTPClientTransport
// wiring lives there, where the SDK has a real consumer). These tests
// remain todo because @limner/core cannot import @limner/mcp without a
// dependency cycle — live Recraft coverage belongs at the mcp layer.
// The default placeholder transport in @limner/core throws
// upstream_unavailable by design.
//
// If a transport implementation ever becomes importable from this
// package (without circular dependencies), this file becomes:
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
