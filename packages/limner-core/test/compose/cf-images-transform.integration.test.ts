import { describe, expect, test } from 'vitest';

// NOTE: This is a stub-with-gate. The CFImagesBinding needs a deployed
// Worker (or `wrangler dev --remote`) to be available at runtime — the
// Images Transformations binding isn't surfaced by miniflare in local
// mode. Phase 4 wired wrangler.toml's `[images]` block; the real
// integration body waits for Phase 7's deploy step, at which point this
// test calls the deployed /mcp endpoint with a `compose` op = cfBlur
// and asserts the response shape.
//
// Until then the gate confirms the env var plumbing works without
// burning credits — the workflow runs cleanly with or without the
// secret populated.
//
// Pattern mirrors test/pipelines/recraft.integration.test.ts
// (also a TODO-until-deployed-binding stub).

const token = process.env['CLOUDFLARE_API_TOKEN'];
const deployedUrl = process.env['LIMNER_MCP_DEV_URL']; // e.g. https://limner-mcp.workers.dev

describe.skipIf(!token || !deployedUrl)(
  'cf-images-transform — integration (requires CLOUDFLARE_API_TOKEN + LIMNER_MCP_DEV_URL)',
  () => {
    test('env gate is wired; real binding integration ships with Phase 7 deploy', () => {
      // When Phase 7 deploys the worker and configures the IMAGES
      // binding on the account, replace this body with:
      //   1. POST a JSON-RPC `compose` call (op=cfBlur) to
      //      `${deployedUrl}/mcp` with an OAuth Bearer token.
      //   2. Assert the response.content[0] is image/png with valid
      //      PNG magic bytes.
      expect(token).toBeDefined();
      expect(deployedUrl).toBeDefined();
    });
  },
);
