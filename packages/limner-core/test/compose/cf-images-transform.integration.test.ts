import { describe, expect, test } from 'vitest';

// NOTE: This is a stub-with-gate. The CFImagesBinding needs a deployed
// Worker (or `wrangler dev --remote`) to be available at runtime — the
// Images Transformations binding isn't surfaced by miniflare in local
// mode. Phase 4 wired wrangler.toml's `[images]` block and Phase 7
// deployed the worker; the real integration body is still pending and,
// when written, calls the deployed /mcp endpoint with a `compose`
// op = cfBlur and asserts the response shape. It runs only when
// CLOUDFLARE_API_TOKEN + LIMNER_MCP_DEV_URL are set (see below).
//
// Until then the gate confirms the env var plumbing works without
// burning credits — the workflow runs cleanly with or without the
// secret populated.
//
// Pattern mirrors test/pipelines/recraft.integration.test.ts (a
// placeholder pending cross-package transport access).

const token = process.env['CLOUDFLARE_API_TOKEN'];
const deployedUrl = process.env['LIMNER_MCP_DEV_URL']; // e.g. https://limner-mcp.workers.dev

describe.skipIf(!token || !deployedUrl)(
  'cf-images-transform — integration (requires CLOUDFLARE_API_TOKEN + LIMNER_MCP_DEV_URL)',
  () => {
    test('env gate is wired; real binding integration body pending', () => {
      // Against a deployed worker with the IMAGES binding configured,
      // replace this body with:
      //   1. POST a JSON-RPC `compose` call (op=cfBlur) to
      //      `${deployedUrl}/mcp` with an OAuth Bearer token.
      //   2. Assert the response.content[0] is image/png with valid
      //      PNG magic bytes.
      expect(token).toBeDefined();
      expect(deployedUrl).toBeDefined();
    });
  },
);
